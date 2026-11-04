<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\User;
use App\Models\WorkItem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkSyncTest extends TestCase
{
    use RefreshDatabase;

    private function operator(string $employee = '140785'): User
    {
        return User::factory()->create(['employee_number' => $employee]);
    }

    private function reviewer(): User
    {
        $user = User::factory()->create(['employee_number' => '140784']);
        Permission::firstOrCreate(['key' => Permission::EVIDENCE_REVIEW], ['name' => 'Revisar']);
        $user->directPermissions()->sync(Permission::where('key', Permission::EVIDENCE_REVIEW)->pluck('id'));

        return $user;
    }

    private function item(array $overrides = []): array
    {
        return [
            'id' => 'work-1',
            'createdAt' => 1700000000000,
            'updatedAt' => 1700000001000,
            'status' => 'En proceso',
            'employeeNumber' => '140785',
            'serial' => 'SN-1',
            'nodeNumber' => 'N-9',
            'sopVersionId' => '__built-in-sop__',
            'history' => [],
            'completedSteps' => ['5.1'],
            ...$overrides,
        ];
    }

    private function record(array $overrides = []): array
    {
        return [
            'id' => 'local-1',
            'status' => 'Completado',
            'employeeNumber' => '140785',
            'serial' => 'SN-1',
            'date' => '2026-11-04',
            'shift' => 'T1',
            'declaredAt' => '2026-11-04T10:00:00.000Z',
            ...$overrides,
        ];
    }

    public function test_requiere_sesion(): void
    {
        $this->getJson('/api/work-items')->assertUnauthorized();
        $this->putJson('/api/work-items/work-1', ['item' => $this->item()])->assertUnauthorized();
        $this->getJson('/api/records')->assertUnauthorized();
        $this->postJson('/api/audit-events', ['events' => []])->assertUnauthorized();
    }

    public function test_crear_un_trabajo_propio_y_listarlo_con_su_revision(): void
    {
        $this->actingAs($this->operator());

        $this->putJson('/api/work-items/work-1', ['item' => $this->item()])
            ->assertOk()->assertJsonPath('revision', 1);

        $this->getJson('/api/work-items')
            ->assertOk()
            ->assertJsonPath('items.0.serial', 'SN-1')
            ->assertJsonPath('items.0.completedSteps.0', '5.1')
            ->assertJsonPath('revisions.work-1', 1);

        $this->assertSame('SN-1', WorkItem::find('work-1')->serial);
    }

    public function test_las_cadenas_vacias_y_los_espacios_del_documento_se_guardan_tal_cual(): void
    {
        $this->actingAs($this->operator());

        $item = $this->item(['form' => ['nodeNumber' => '', 'repairType' => '', 'serial' => ' SN-1 '], 'reason' => '']);
        $this->putJson('/api/work-items/work-1', ['item' => $item])->assertOk();

        // Si "" volviera como null, el front falla al hacer form.nodeNumber.trim().
        $this->getJson('/api/work-items')
            ->assertJsonPath('items.0.form.nodeNumber', '')
            ->assertJsonPath('items.0.form.repairType', '')
            ->assertJsonPath('items.0.form.serial', ' SN-1 ')
            ->assertJsonPath('items.0.reason', '');
    }

    public function test_no_se_crea_un_trabajo_a_nombre_de_otra_persona(): void
    {
        $this->actingAs($this->operator('140785'));

        $this->putJson('/api/work-items/work-1', ['item' => $this->item(['employeeNumber' => '140860'])])
            ->assertForbidden()->assertJsonPath('code', 'forbidden');
        $this->assertNull(WorkItem::find('work-1'));
    }

    public function test_actualizar_exige_la_revision_conocida_y_detecta_conflictos(): void
    {
        $this->actingAs($this->operator());
        $this->putJson('/api/work-items/work-1', ['item' => $this->item()])->assertOk();

        $this->putJson('/api/work-items/work-1', ['item' => $this->item(['serial' => 'SN-2']), 'baseRevision' => 1])
            ->assertOk()->assertJsonPath('revision', 2);

        $this->putJson('/api/work-items/work-1', ['item' => $this->item(['serial' => 'SN-3']), 'baseRevision' => 1])
            ->assertStatus(409)
            ->assertJsonPath('code', 'conflict')
            ->assertJsonPath('stored.serial', 'SN-2')
            ->assertJsonPath('revision', 2);

        $this->assertSame('SN-2', WorkItem::find('work-1')->serial);
    }

    public function test_valida_estado_id_y_forma_del_documento(): void
    {
        $this->actingAs($this->operator());

        $this->putJson('/api/work-items/work-1', ['item' => $this->item(['status' => 'Inventado'])])->assertStatus(422);
        $this->putJson('/api/work-items/work-1', ['item' => $this->item(['id' => 'work-2'])])->assertStatus(422);
        $this->putJson('/api/work-items/work-1', ['item' => $this->item(['history' => null])])->assertStatus(422);
        $this->putJson('/api/work-items/bad$id', ['item' => $this->item()])->assertNotFound();
    }

    public function test_salir_de_pendiente_de_revision_es_del_supervisor(): void
    {
        $this->actingAs($this->operator());
        $this->putJson('/api/work-items/work-1', ['item' => $this->item(['status' => 'Pendiente de revisión'])])->assertOk();

        $this->putJson('/api/work-items/work-1', ['item' => $this->item(['status' => 'Completado']), 'baseRevision' => 1])
            ->assertForbidden();

        $this->actingAs($this->reviewer());
        $this->putJson('/api/work-items/work-1', ['item' => $this->item(['status' => 'Completado']), 'baseRevision' => 1])
            ->assertOk()->assertJsonPath('revision', 2);
    }

    public function test_los_registros_siguen_las_mismas_reglas_y_protegen_la_revision(): void
    {
        $this->actingAs($this->operator());

        $this->putJson('/api/records/local-1', ['record' => $this->record()])->assertOk()->assertJsonPath('revision', 1);
        $this->putJson('/api/records/local-2', ['record' => $this->record(['id' => 'local-2', 'employeeNumber' => '999'])])->assertForbidden();

        $conRevision = $this->record(['reviewedBy' => 'Quien sea', 'reviewNote' => 'ok']);
        $this->putJson('/api/records/local-1', ['record' => $conRevision, 'baseRevision' => 1])->assertForbidden();

        $this->actingAs($this->reviewer());
        $this->putJson('/api/records/local-1', ['record' => $conRevision, 'baseRevision' => 1])->assertOk();
        $this->getJson('/api/records')->assertJsonPath('records.0.reviewedBy', 'Quien sea')->assertJsonPath('revisions.local-1', 2);
    }

    public function test_la_auditoria_fuerza_el_actor_es_idempotente_y_no_se_edita(): void
    {
        $operator = $this->operator();
        $this->actingAs($operator);

        $event = [
            'id' => 'audit-1',
            'action' => 'step_completed',
            'at' => '2026-11-04T10:00:00.000Z',
            'sessionId' => 'session-1',
            'workItemId' => 'work-1',
            'actor' => ['id' => 99, 'name' => 'Otra Persona', 'employeeNumber' => '000', 'role' => 'admin'],
        ];

        $this->postJson('/api/audit-events', ['events' => [$event]])->assertOk()->assertJsonPath('created', 1);
        $this->postJson('/api/audit-events', ['events' => [$event]])->assertOk()->assertJsonPath('created', 0);

        $this->getJson('/api/audit-events')
            ->assertJsonCount(1, 'events')
            ->assertJsonPath('events.0.actor.employeeNumber', '140785')
            ->assertJsonPath('events.0.actor.role', 'operator')
            ->assertJsonPath('events.0.sessionId', 'session-1');

        $this->deleteJson('/api/audit-events/audit-1')->assertStatus(405);
        $this->putJson('/api/audit-events/audit-1', [])->assertStatus(405);
    }

    public function test_la_auditoria_se_lee_en_orden_cronologico_y_respeta_el_limite(): void
    {
        $this->actingAs($this->operator());
        $events = collect(range(1, 5))->map(fn ($n) => [
            'id' => "audit-$n",
            'action' => 'step_completed',
            'at' => now()->subMinutes(10 - $n)->toIso8601String(),
        ])->all();

        $this->postJson('/api/audit-events', ['events' => array_reverse($events)])->assertOk();

        // Un reloj adelantado no falsea la línea de tiempo: se registra la hora del servidor.
        $this->postJson('/api/audit-events', ['events' => [['id' => 'audit-futuro', 'action' => 'x', 'at' => now()->addDay()->toIso8601String()]]])->assertOk();
        $this->assertLessThan(60, abs(now()->diffInSeconds(\App\Models\AuditEvent::find('audit-futuro')->occurred_at)));

        $this->getJson('/api/audit-events?limit=4')
            ->assertJsonCount(4, 'events')
            ->assertJsonPath('events.0.id', 'audit-3')
            ->assertJsonPath('events.2.id', 'audit-5')
            ->assertJsonPath('events.3.id', 'audit-futuro');
    }

    public function test_valida_los_eventos_de_auditoria(): void
    {
        $this->actingAs($this->operator());

        $this->postJson('/api/audit-events', ['events' => []])->assertStatus(422);
        $this->postJson('/api/audit-events', ['events' => [['id' => '../x', 'action' => 'a']]])->assertStatus(422);
        $this->postJson('/api/audit-events', ['events' => [['id' => 'ok', 'action' => '']]])->assertStatus(422);
    }
}
