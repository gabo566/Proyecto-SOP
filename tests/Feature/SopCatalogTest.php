<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\SopCatalogEntry;
use App\Models\SopVersion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SopCatalogTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        foreach ([Permission::SOP_MANAGE => 'Modificar SOP', Permission::SOP_CREATE => 'Crear SOP', Permission::USERS_MANAGE => 'Usuarios'] as $key => $name) {
            Permission::firstOrCreate(['key' => $key], ['name' => $name]);
        }
    }

    /** Administra la SOP (catálogo, borrar) y además es creador: sube y edita revisiones. */
    private function manager(): User
    {
        $user = User::factory()->create();
        $user->directPermissions()->sync(Permission::whereIn('key', [Permission::SOP_MANAGE, Permission::SOP_CREATE])->pluck('id'));

        return $user;
    }

    private function versionPayload(string $id = 'sop-version-1', string $revision = '4'): array
    {
        return [
            'id' => $id,
            'document' => ['id' => 'SOP-X', 'title' => 'SOP de prueba', 'revision' => $revision, 'stationAssignment' => 'RWK:RWK'],
            'procedures' => [['id' => 'sheet-5', 'sheet' => 5, 'steps' => [['number' => '5.1', 'text' => 'Paso uno']]]],
            'createdBy' => 'Quien sea',
        ];
    }

    private function save(array $version, ?UploadedFile $pdf = null, array $extra = [])
    {
        return $this->post('/api/sop-versions', [
            'version' => json_encode($version),
            ...($pdf ? ['pdf' => $pdf] : []),
            ...$extra,
        ], ['Accept' => 'application/json']);
    }

    public function test_cualquier_usuario_autenticado_lee_pero_solo_sop_manage_escribe(): void
    {
        $operator = User::factory()->create();
        SopVersion::create(['id' => 'sop-version-1', 'document' => ['title' => 'x', 'revision' => '1'], 'procedures' => []]);

        $this->getJson('/api/sop-versions')->assertUnauthorized();
        $this->actingAs($operator)->getJson('/api/sop-versions')->assertOk();
        $this->getJson('/api/sop-catalog')->assertOk();

        $this->save($this->versionPayload())->assertForbidden();
        $this->putJson('/api/sop-catalog', ['catalog' => []])->assertForbidden();
        $this->deleteJson('/api/sop-versions/sop-version-1')->assertForbidden();
    }

    public function test_guardar_una_revision_con_pdf_la_devuelve_con_url_y_sirve_el_archivo(): void
    {
        $this->actingAs($this->manager());
        $pdf = UploadedFile::fake()->createWithContent('SOP-141.pdf', '%PDF-1.4 contenido');

        $this->save($this->versionPayload(), $pdf)
            ->assertOk()
            ->assertJsonPath('version.id', 'sop-version-1')
            ->assertJsonPath('version.pdf.name', 'SOP-141.pdf')
            ->assertJsonPath('version.pdf.url', '/api/sop-versions/sop-version-1/pdf')
            ->assertJsonPath('version.procedures.0.steps.0.number', '5.1');

        Storage::disk('local')->assertExists('sop/versions/sop-version-1.pdf');
        $this->get('/api/sop-versions/sop-version-1/pdf')->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->getJson('/api/sop-versions')->assertJsonCount(1, 'versions');
    }

    public function test_las_anotaciones_del_editor_visual_viajan_y_vuelven_intactas(): void
    {
        $this->actingAs($this->manager());
        $version = $this->versionPayload();
        $version['procedures'][0]['pageAspect'] = 1.2941;
        $version['procedures'][0]['annotations'] = [
            ['id' => 'a1', 'type' => 'arrow', 'stepNumber' => '5.1', 'x1' => 100, 'y1' => 200, 'x2' => 300, 'y2' => 400, 'color' => '#1f56b3', 'strokeWidth' => 12, 'dash' => 'dashed'],
            ['id' => 'a2', 'type' => 'highlight', 'stepNumber' => '5.1', 'x' => 50, 'y' => 60, 'width' => 200, 'height' => 30, 'color' => '#ffe14d', 'opacity' => 0.4],
            ['id' => 'a3', 'type' => 'note', 'stepNumber' => '', 'x' => 400, 'y' => 500, 'text' => 'Cuidar el conector: no forzar el giro', 'fontSize' => 24, 'width' => 320],
            ['id' => 'a4', 'type' => 'text', 'stepNumber' => '5.1', 'x' => 10, 'y' => 900, 'text' => 'Paso crítico', 'fontSize' => 34, 'bold' => true, 'bg' => '#ffffff'],
        ];

        $this->save($version)->assertOk()
            ->assertJsonPath('version.procedures.0.pageAspect', 1.2941)
            ->assertJsonPath('version.procedures.0.annotations.0.dash', 'dashed')
            ->assertJsonPath('version.procedures.0.annotations.1.type', 'highlight')
            ->assertJsonPath('version.procedures.0.annotations.2.text', 'Cuidar el conector: no forzar el giro')
            ->assertJsonPath('version.procedures.0.annotations.3.bold', true);

        $leida = $this->getJson('/api/sop-versions')->json('versions.0.procedures.0.annotations');
        $this->assertCount(4, $leida);
        $this->assertSame('#1f56b3', $leida[0]['color']);
    }

    public function test_actualizar_sin_pdf_conserva_el_archivo_y_los_metadatos_de_creacion(): void
    {
        $this->actingAs($this->manager());
        $this->save($this->versionPayload(), UploadedFile::fake()->createWithContent('a.pdf', '%PDF-1.4'))->assertOk();

        $editada = $this->versionPayload();
        $editada['document']['stationAssignment'] = 'MFG:TDR';
        $this->save($editada)->assertOk()->assertJsonPath('version.pdf.name', 'a.pdf');

        $this->assertSame('MFG:TDR', SopVersion::find('sop-version-1')->document['stationAssignment']);
        Storage::disk('local')->assertExists('sop/versions/sop-version-1.pdf');
    }

    public function test_una_revision_nueva_puede_heredar_el_pdf_de_otra(): void
    {
        $this->actingAs($this->manager());
        $this->save($this->versionPayload('origen'), UploadedFile::fake()->createWithContent('origen.pdf', '%PDF-1.4'))->assertOk();

        $this->save($this->versionPayload('copia', '5'), null, ['pdfCopyFrom' => 'origen'])
            ->assertOk()->assertJsonPath('version.pdf.name', 'origen.pdf');

        Storage::disk('local')->assertExists('sop/versions/copia.pdf');
        Storage::disk('local')->assertExists('sop/versions/origen.pdf');
    }

    public function test_valida_el_id_el_documento_y_el_tipo_de_archivo(): void
    {
        $this->actingAs($this->manager());

        $this->save([...$this->versionPayload(), 'id' => '../malo'])->assertStatus(422);
        $sinTitulo = $this->versionPayload();
        unset($sinTitulo['document']['title']);
        $this->save($sinTitulo)->assertStatus(422);
        $this->save($this->versionPayload(), UploadedFile::fake()->createWithContent('x.exe', 'MZ'))->assertStatus(422);
        $this->post('/api/sop-versions', ['version' => 'no es json'], ['Accept' => 'application/json'])->assertStatus(422);
    }

    public function test_eliminar_borra_la_revision_su_pdf_y_su_entrada_del_catalogo(): void
    {
        $this->actingAs($this->manager());
        $this->save($this->versionPayload(), UploadedFile::fake()->createWithContent('a.pdf', '%PDF-1.4'))->assertOk();
        // Solo una revisión publicada puede habilitarse (ver SopReviewWorkflowTest).
        SopVersion::find('sop-version-1')->update(['status' => SopVersion::STATUS_PUBLISHED]);
        $this->putJson('/api/sop-catalog', ['catalog' => ['sop-version-1' => ['stationAssignment' => 'RWK:RWK', 'enabled' => true]]])->assertOk();

        $this->deleteJson('/api/sop-versions/sop-version-1')->assertOk();

        $this->assertNull(SopVersion::find('sop-version-1'));
        $this->assertNull(SopCatalogEntry::find('sop-version-1'));
        Storage::disk('local')->assertMissing('sop/versions/sop-version-1.pdf');
        $this->getJson('/api/sop-versions/sop-version-1/pdf')->assertNotFound();
    }

    public function test_el_catalogo_se_guarda_y_se_lee_incluida_la_sop_estatica(): void
    {
        $this->actingAs($this->manager());

        $this->putJson('/api/sop-catalog', ['catalog' => [
            '__built-in-sop__' => ['stationAssignment' => 'RWK:RWK', 'enabled' => true],
            'sop-version-1' => ['stationAssignment' => '', 'enabled' => false],
        ]])->assertOk();

        $this->getJson('/api/sop-catalog')
            ->assertJsonPath('catalog.__built-in-sop__.enabled', true)
            ->assertJsonPath('catalog.__built-in-sop__.stationAssignment', 'RWK:RWK')
            ->assertJsonPath('catalog.sop-version-1.enabled', false)
            ->assertJsonPath('catalog.sop-version-1.stationAssignment', '');

        $this->putJson('/api/sop-catalog', ['catalog' => ['../x' => ['enabled' => true]]])->assertStatus(422);
    }

    public function test_el_pdf_fuente_se_sube_y_lo_lee_cualquier_usuario(): void
    {
        $this->actingAs(User::factory()->create())->getJson('/api/sop-source')->assertJsonPath('source', null);
        $this->post('/api/sop-source', ['pdf' => UploadedFile::fake()->createWithContent('f.pdf', '%PDF')], ['Accept' => 'application/json'])->assertForbidden();

        $this->actingAs($this->manager());
        $this->post('/api/sop-source', ['pdf' => UploadedFile::fake()->createWithContent('fuente.pdf', '%PDF-1.4')], ['Accept' => 'application/json'])
            ->assertCreated()->assertJsonPath('source.name', 'fuente.pdf');

        $this->actingAs(User::factory()->create());
        $this->getJson('/api/sop-source')->assertJsonPath('source.name', 'fuente.pdf');
        $this->get('/api/sop-source/file')->assertOk()->assertHeader('Content-Type', 'application/pdf');
    }
}
