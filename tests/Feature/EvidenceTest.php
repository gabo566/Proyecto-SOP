<?php

namespace Tests\Feature;

use App\Models\EvidenceFile;
use App\Models\Permission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class EvidenceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
    }

    private function operator(string $employee = '140785'): User
    {
        return User::factory()->create(['employee_number' => $employee]);
    }

    private function reviewer(): User
    {
        Permission::firstOrCreate(['key' => Permission::EVIDENCE_REVIEW], ['name' => 'Revisar']);
        $user = User::factory()->create(['employee_number' => '140784']);
        $user->directPermissions()->sync(Permission::where('key', Permission::EVIDENCE_REVIEW)->pluck('id'));

        return $user;
    }

    private function upload(string $id, ?UploadedFile $file = null)
    {
        return $this->post('/api/evidence', [
            'id' => $id,
            'file' => $file ?? UploadedFile::fake()->image('falla.jpg', 40, 40),
        ], ['Accept' => 'application/json']);
    }

    private function realFile(string $name, string $content): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'ev');
        file_put_contents($path, $content);

        return new UploadedFile($path, $name, 'image/jpeg', null, true);
    }

    public function test_requiere_sesion(): void
    {
        $this->upload('evidence-1')->assertUnauthorized();
        $this->getJson('/api/evidence/evidence-1')->assertUnauthorized();
        $this->deleteJson('/api/evidence/evidence-1')->assertUnauthorized();
    }

    public function test_sube_una_foto_y_cualquier_usuario_con_sesion_puede_verla(): void
    {
        $this->actingAs($this->operator());
        $this->upload('evidence-1')->assertCreated()->assertJsonPath('id', 'evidence-1');

        Storage::disk('local')->assertExists('evidence/evidence-1.jpg');
        $this->assertSame('140785', EvidenceFile::find('evidence-1')->employee_number);

        $this->actingAs($this->reviewer());
        $this->get('/api/evidence/evidence-1')
            ->assertOk()
            ->assertHeader('Content-Type', 'image/jpeg')
            ->assertHeader('X-Content-Type-Options', 'nosniff');
    }

    public function test_valida_el_tipo_por_contenido_el_tamano_y_el_id(): void
    {
        $this->actingAs($this->operator());

        // Archivos reales (no los falsos de Laravel, que adivinan el tipo por el nombre):
        // un texto o un PDF con nombre de imagen no pasan.
        $this->upload('evidence-1', $this->realFile('foto.jpg', 'no soy una imagen'))->assertStatus(422);
        $this->upload('evidence-1', $this->realFile('doc.png', '%PDF-1.4 contenido'))->assertStatus(422);
        // Más de 8 MB.
        $this->upload('evidence-1', UploadedFile::fake()->image('grande.png', 50, 50)->size(9000))->assertStatus(422);
        // Id con caracteres peligrosos.
        $this->upload('../evidence')->assertStatus(422);

        $this->assertDatabaseCount('evidence_files', 0);
    }

    public function test_el_dueno_puede_reemplazar_y_otro_operador_no(): void
    {
        $this->actingAs($this->operator('140785'));
        $this->upload('evidence-1')->assertCreated();
        $this->upload('evidence-1', UploadedFile::fake()->image('otra.png', 30, 30))->assertOk();
        Storage::disk('local')->assertExists('evidence/evidence-1.png');
        Storage::disk('local')->assertMissing('evidence/evidence-1.jpg');

        $this->actingAs($this->operator('140860'));
        $this->upload('evidence-1')->assertForbidden();
    }

    public function test_borrar_es_del_dueno_o_de_quien_revisa(): void
    {
        $this->actingAs($this->operator('140785'));
        $this->upload('evidence-1')->assertCreated();

        $this->actingAs($this->operator('140860'));
        $this->deleteJson('/api/evidence/evidence-1')->assertForbidden();
        Storage::disk('local')->assertExists('evidence/evidence-1.jpg');

        $this->actingAs($this->reviewer());
        $this->deleteJson('/api/evidence/evidence-1')->assertOk();
        Storage::disk('local')->assertMissing('evidence/evidence-1.jpg');
        $this->assertNull(EvidenceFile::find('evidence-1'));
        $this->getJson('/api/evidence/evidence-1')->assertNotFound();
    }

    public function test_un_id_inexistente_o_invalido_responde_404(): void
    {
        $this->actingAs($this->operator());

        $this->getJson('/api/evidence/no-existe')->assertNotFound();
        $this->getJson('/api/evidence/bad$id')->assertNotFound();
        $this->deleteJson('/api/evidence/no-existe')->assertNotFound();
    }
}
