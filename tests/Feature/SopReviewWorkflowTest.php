<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\Role;
use App\Models\SopVersion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Control de dos personas: quien edita envía la revisión, otra persona la revisa
 * (sop.review) y una tercera la publica (sop.publish).
 */
class SopReviewWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        foreach ([Permission::SOP_MANAGE, Permission::SOP_REVIEW, Permission::SOP_PUBLISH, Permission::USERS_MANAGE] as $key) {
            Permission::firstOrCreate(['key' => $key], ['name' => $key]);
        }
    }

    private function person(string $number, array $permissions = []): User
    {
        $user = User::factory()->create(['employee_number' => $number, 'name' => "Persona {$number}"]);
        $user->directPermissions()->sync(Permission::whereIn('key', $permissions)->pluck('id'));

        return $user;
    }

    /** @return array{editor: User, reviewer: User, publisher: User, version: string} */
    private function submittedVersion(): array
    {
        $editor = $this->person('140784', [Permission::SOP_MANAGE, Permission::USERS_MANAGE]);
        $reviewer = $this->person('200001', [Permission::SOP_REVIEW]);
        $publisher = $this->person('200002', [Permission::SOP_PUBLISH]);

        $payload = [
            'id' => 'sop-version-rev',
            'document' => ['id' => 'SOP-X', 'title' => 'SOP de prueba', 'revision' => '4', 'stationAssignment' => 'RWK:RWK'],
            'procedures' => [['id' => 'sheet-5', 'sheet' => 5, 'steps' => [['number' => '5.1', 'text' => 'Paso uno']]]],
            'changeSummary' => ['total' => 2, 'rows' => [['sheet' => 5, 'type' => 'Texto del paso', 'before' => 'a', 'after' => 'b']]],
        ];

        $this->actingAs($editor)->post('/api/sop-versions', [
            'version' => json_encode($payload),
            'pdf' => UploadedFile::fake()->createWithContent('a.pdf', '%PDF-1.4'),
        ], ['Accept' => 'application/json'])->assertOk()->assertJsonPath('version.status', 'pending_review');

        return compact('editor', 'reviewer', 'publisher') + ['version' => 'sop-version-rev'];
    }

    public function test_una_revision_nueva_queda_en_revision_con_su_resumen_y_quien_la_envio(): void
    {
        ['editor' => $editor] = $this->submittedVersion();

        $saved = SopVersion::find('sop-version-rev');
        $this->assertSame('pending_review', $saved->status);
        $this->assertSame($editor->id, $saved->submitted_by);
        $this->assertSame(2, $saved->change_summary['total']);
        $this->getJson('/api/sop-versions')->assertJsonPath('versions.0.submittedBy', 'Persona 140784');
    }

    public function test_quien_sube_la_revision_no_puede_revisarla_ni_publicarla(): void
    {
        ['editor' => $editor, 'reviewer' => $reviewer, 'version' => $id] = $this->submittedVersion();

        $this->actingAs($editor)->postJson("/api/sop-versions/{$id}/review", ['decision' => 'approve'])
            ->assertForbidden()->assertJsonPath('code', 'own-version');
        $this->assertSame('pending_review', SopVersion::find($id)->status);

        $this->actingAs($reviewer)->postJson("/api/sop-versions/{$id}/review", ['decision' => 'approve'])->assertOk();
        $this->actingAs($editor)->postJson("/api/sop-versions/{$id}/publish")->assertForbidden();
        $this->assertSame('approved', SopVersion::find($id)->status);
    }

    public function test_el_revisor_devuelve_con_marcas_y_quien_subio_corrige_y_reenvia(): void
    {
        ['editor' => $editor, 'reviewer' => $reviewer, 'version' => $id] = $this->submittedVersion();
        $marks = [
            ['procedureId' => 'sheet-5', 'type' => 'box', 'x' => 0.1, 'y' => 0.2, 'w' => 0.3, 'h' => 0.2, 'text' => 'Falta el torque'],
            ['procedureId' => 'sheet-5', 'type' => 'note', 'x' => 0.6, 'y' => 0.4, 'text' => 'Revisar la foto'],
        ];

        $this->actingAs($reviewer)->postJson("/api/sop-versions/{$id}/review", ['decision' => 'reject', 'note' => 'Corrige la hoja 5.', 'marks' => $marks])
            ->assertOk()->assertJsonPath('version.status', 'rejected')
            ->assertJsonPath('version.reviews.0.round', 1)
            ->assertJsonPath('version.reviews.0.marks.0.text', 'Falta el torque')
            ->assertJsonCount(2, 'version.reviews.0.marks');

        $this->actingAs($editor)->getJson('/api/sop-versions/mine/summary')->assertJsonPath('summary.returned', 1);

        // Otra persona no puede reenviar la versión ajena: solo se actualiza su estación.
        $payload = [
            'id' => $id,
            'document' => ['id' => 'SOP-X', 'title' => 'SOP corregida', 'revision' => '4', 'stationAssignment' => 'RWK:RWK'],
            'procedures' => [['id' => 'sheet-5', 'sheet' => 5, 'steps' => [['number' => '5.1', 'text' => 'Paso corregido']]]],
        ];
        $this->actingAs($reviewer)->post('/api/sop-versions', ['version' => json_encode($payload)], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('version.status', 'rejected')->assertJsonPath('version.document.title', 'SOP de prueba');

        // Quien la subió corrige y reenvía con el mismo id: vuelve a revisión como ronda 2.
        $this->actingAs($editor)->post('/api/sop-versions', ['version' => json_encode($payload)], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('version.status', 'pending_review')->assertJsonPath('version.reviewRound', 2)
            ->assertJsonPath('version.document.title', 'SOP corregida')
            ->assertJsonPath('version.reviews.0.decision', 'rejected');

        $this->actingAs($reviewer)->postJson("/api/sop-versions/{$id}/review", ['decision' => 'approve'])
            ->assertOk()->assertJsonPath('version.reviews.0.round', 2)->assertJsonCount(2, 'version.reviews');
    }

    public function test_una_version_aprobada_o_publicada_no_cambia_de_contenido(): void
    {
        ['editor' => $editor, 'reviewer' => $reviewer, 'version' => $id] = $this->submittedVersion();
        $this->actingAs($reviewer)->postJson("/api/sop-versions/{$id}/review", ['decision' => 'approve'])->assertOk();

        $payload = [
            'id' => $id,
            'document' => ['id' => 'SOP-X', 'title' => 'Otro título', 'revision' => '4', 'stationAssignment' => 'MFG:TDR'],
            'procedures' => [['id' => 'sheet-9', 'sheet' => 9, 'steps' => []]],
        ];
        $this->actingAs($editor)->post('/api/sop-versions', ['version' => json_encode($payload)], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('version.status', 'approved')
            ->assertJsonPath('version.document.title', 'SOP de prueba')
            ->assertJsonPath('version.document.stationAssignment', 'MFG:TDR')
            ->assertJsonPath('version.procedures.0.id', 'sheet-5');
    }

    public function test_las_marcas_del_revisor_se_validan(): void
    {
        ['reviewer' => $reviewer, 'version' => $id] = $this->submittedVersion();

        $this->actingAs($reviewer)->postJson("/api/sop-versions/{$id}/review", [
            'decision' => 'reject', 'note' => 'x',
            'marks' => [['procedureId' => 'sheet-5', 'type' => 'circle', 'x' => 2, 'y' => 0.1]],
        ])->assertStatus(422)->assertJsonValidationErrors(['marks.0.type', 'marks.0.x']);
    }

    public function test_el_publicador_no_sube_ni_revisa(): void
    {
        ['version' => $id] = $this->submittedVersion();
        $publisher = $this->person('200009', [Permission::SOP_PUBLISH]);

        $this->actingAs($publisher)->postJson('/api/sop-versions', ['version' => '{}'])->assertForbidden();
        $this->actingAs($publisher)->postJson("/api/sop-versions/{$id}/review", ['decision' => 'approve'])->assertForbidden();
    }

    public function test_revisor_y_publicador_son_funciones_excluyentes(): void
    {
        $owner = $this->person('140784', [Permission::SOP_MANAGE, Permission::USERS_MANAGE]);
        $target = $this->person('500020');

        $this->actingAs($owner)->patchJson("/api/users/{$target->id}/sop-roles", ['review' => true, 'publish' => true])
            ->assertStatus(422)->assertJsonPath('code', 'roles-exclusive');
        $this->assertCount(0, $target->fresh()->directPermissions);
    }

    public function test_sin_el_permiso_no_se_puede_revisar_ni_publicar(): void
    {
        ['version' => $id] = $this->submittedVersion();
        $operator = $this->person('300000');

        $this->actingAs($operator)->postJson("/api/sop-versions/{$id}/review", ['decision' => 'approve'])->assertForbidden();
        $this->actingAs($operator)->postJson("/api/sop-versions/{$id}/publish")->assertForbidden();
    }

    public function test_el_revisor_aprueba_o_devuelve_y_la_devolucion_exige_un_comentario(): void
    {
        ['reviewer' => $reviewer, 'version' => $id] = $this->submittedVersion();

        $this->actingAs($reviewer)->postJson("/api/sop-versions/{$id}/review", ['decision' => 'reject'])
            ->assertStatus(422)->assertJsonPath('code', 'note-required');
        $this->postJson("/api/sop-versions/{$id}/review", ['decision' => 'reject', 'note' => 'Falta la hoja 8.'])
            ->assertOk()->assertJsonPath('version.status', 'rejected')->assertJsonPath('version.reviewNote', 'Falta la hoja 8.');
        // Ya no está pendiente: no se puede volver a revisar.
        $this->postJson("/api/sop-versions/{$id}/review", ['decision' => 'approve'])->assertStatus(422)->assertJsonPath('code', 'not-pending');
    }

    public function test_publica_una_tercera_persona_distinta_del_editor_y_del_revisor(): void
    {
        ['reviewer' => $reviewer, 'publisher' => $publisher, 'version' => $id] = $this->submittedVersion();
        $reviewer->directPermissions()->attach(Permission::where('key', Permission::SOP_PUBLISH)->pluck('id'));

        $this->actingAs($reviewer)->postJson("/api/sop-versions/{$id}/review", ['decision' => 'approve', 'note' => 'Todo en orden'])
            ->assertOk()->assertJsonPath('version.status', 'approved');

        // El revisor tiene permiso de publicar, pero no puede ser quien revisó.
        $this->actingAs($reviewer->fresh())->postJson("/api/sop-versions/{$id}/publish")
            ->assertForbidden()->assertJsonPath('code', 'same-person');

        $this->actingAs($publisher)->postJson("/api/sop-versions/{$id}/publish")
            ->assertOk()->assertJsonPath('version.status', 'published')->assertJsonPath('version.publishedBy', 'Persona 200002');
    }

    public function test_solo_una_revision_publicada_puede_habilitarse_para_los_operadores(): void
    {
        ['editor' => $editor, 'reviewer' => $reviewer, 'publisher' => $publisher, 'version' => $id] = $this->submittedVersion();
        $catalog = ['catalog' => [$id => ['stationAssignment' => 'RWK:RWK', 'enabled' => true]]];

        $this->actingAs($editor)->putJson('/api/sop-catalog', $catalog)->assertStatus(422)->assertJsonPath('code', 'not-published');

        $this->actingAs($reviewer)->postJson("/api/sop-versions/{$id}/review", ['decision' => 'approve'])->assertOk();
        $this->actingAs($editor)->putJson('/api/sop-catalog', $catalog)->assertStatus(422);

        $this->actingAs($publisher)->postJson("/api/sop-versions/{$id}/publish")->assertOk();
        $this->actingAs($editor)->putJson('/api/sop-catalog', $catalog)->assertOk();
    }

    public function test_cualquiera_puede_guardar_la_estacion_de_una_revision_pendiente_sin_habilitarla(): void
    {
        ['editor' => $editor, 'version' => $id] = $this->submittedVersion();

        $this->actingAs($editor)->putJson('/api/sop-catalog', ['catalog' => [$id => ['stationAssignment' => 'MFG:TDR', 'enabled' => false]]])->assertOk();
    }

    public function test_solo_quien_administra_la_sop_concede_revisor_y_publicador(): void
    {
        $owner = $this->person('140784', [Permission::SOP_MANAGE, Permission::USERS_MANAGE]);
        $other = $this->person('400000', [Permission::USERS_MANAGE]);
        $target = $this->person('500000');

        $this->actingAs($other)->patchJson("/api/users/{$target->id}/sop-roles", ['review' => true, 'publish' => false])->assertForbidden();

        $this->actingAs($owner)->patchJson("/api/users/{$target->id}/sop-roles", ['review' => true, 'publish' => false])
            ->assertOk()->assertJsonFragment(['permissions' => ['sop.review']]);
        $this->patchJson("/api/users/{$target->id}/sop-roles", ['review' => false, 'publish' => true])
            ->assertOk()->assertJsonPath('user.permissions', ['sop.publish']);
        $this->patchJson("/api/users/{$target->id}/sop-roles", ['review' => true, 'publish' => false])
            ->assertOk()->assertJsonPath('user.permissions', ['sop.review']);
        $this->patchJson("/api/users/{$target->id}/sop-roles", ['review' => false, 'publish' => false])
            ->assertOk()->assertJsonPath('user.permissions', []);
    }

    public function test_conceder_los_roles_de_sop_no_toca_otros_permisos_de_la_persona(): void
    {
        $owner = $this->person('140784', [Permission::SOP_MANAGE]);
        $target = $this->person('500001', [Permission::USERS_MANAGE]);

        $this->actingAs($owner)->patchJson("/api/users/{$target->id}/sop-roles", ['review' => true, 'publish' => false])->assertOk();
        $this->assertEqualsCanonicalizing(['users.manage', 'sop.review'], $target->fresh()->load('directPermissions')->directPermissions->pluck('key')->all());
    }

    public function test_el_editor_ve_quien_puede_revisar_y_publicar(): void
    {
        ['editor' => $editor] = $this->submittedVersion();

        $this->actingAs($editor)->getJson('/api/sop-roles')
            ->assertOk()
            ->assertJsonPath('reviewers.0.name', 'Persona 200001')
            ->assertJsonPath('publishers.0.name', 'Persona 200002');
    }

    public function test_solo_quien_administra_la_sop_habilita_o_quita_administrador(): void
    {
        foreach ([Role::OPERATOR, Role::ADMIN] as $key) {
            Role::firstOrCreate(['key' => $key], ['name' => $key]);
        }
        $owner = $this->person('140784', [Permission::SOP_MANAGE, Permission::USERS_MANAGE]);
        $owner->update(['role_id' => Role::where('key', Role::ADMIN)->value('id')]);
        $other = $this->person('400001', [Permission::USERS_MANAGE]);
        $target = $this->person('500002');
        $target->update(['role_id' => Role::where('key', Role::OPERATOR)->value('id')]);

        $this->actingAs($other)->patchJson("/api/users/{$target->id}/admin", ['admin' => true])->assertForbidden();

        $this->actingAs($owner)->patchJson("/api/users/{$target->id}/admin", ['admin' => true])
            ->assertOk()->assertJsonPath('user.role', 'admin');
        $this->patchJson("/api/users/{$target->id}/admin", ['admin' => false])
            ->assertOk()->assertJsonPath('user.role', 'operator');
        $this->patchJson("/api/users/{$owner->id}/admin", ['admin' => false])->assertStatus(422);
    }
}
