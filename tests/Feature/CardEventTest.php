<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CardEventTest extends TestCase
{
    use RefreshDatabase;

    private function operator(): User
    {
        Role::firstOrCreate(['key' => Role::OPERATOR], ['name' => Role::OPERATOR]);

        return User::factory()->create([
            'role_id' => Role::where('key', Role::OPERATOR)->value('id'),
            'is_active' => true,
            'name' => 'Operador Prueba',
            'employee_number' => '300001',
        ]);
    }

    private function validation(array $overrides = []): array
    {
        return array_merge([
            'type' => 'validation',
            'nodeSerial' => '1934526000155',
            'nodePartNumber' => '675-24975-2000-000',
            'cardType' => 'BMC',
            'cardPartNumber' => 'BMC-001',
            'cardSerial' => 'SN-BMC-77',
            'result' => 'ok',
            'sheets' => ['5', '6'],
        ], $overrides);
    }

    public function test_requiere_sesion(): void
    {
        $this->postJson('/api/card-events', $this->validation())->assertUnauthorized();
    }

    public function test_guarda_una_validacion_sin_daño_y_la_consulta_por_nodo(): void
    {
        $operator = $this->operator();
        $this->actingAs($operator)->postJson('/api/card-events', $this->validation())
            ->assertCreated()
            ->assertJsonPath('event.type', 'validation')
            ->assertJsonPath('event.operatorName', 'Operador Prueba');

        $this->actingAs($operator)->getJson('/api/card-events?nodeSerial=1934526000155')
            ->assertOk()
            ->assertJsonPath('summary.validations', 1)
            ->assertJsonPath('summary.replacements', 0)
            ->assertJsonPath('summary.validationsByCard.BMC', 1)
            ->assertJsonPath('summary.damageFound', 0);
    }

    public function test_daño_encontrado_exige_describirlo(): void
    {
        $this->actingAs($this->operator())->postJson('/api/card-events', $this->validation(['result' => 'damage']))
            ->assertStatus(422)->assertJsonValidationErrors(['note']);
    }

    public function test_reemplazo_por_daño_se_liga_a_la_validacion_que_lo_encontro(): void
    {
        $operator = $this->operator();
        $validationId = $this->actingAs($operator)->postJson('/api/card-events', $this->validation([
            'result' => 'damage', 'note' => 'Daño físico en BMC',
        ]))->json('event.id');

        $this->actingAs($operator)->postJson('/api/card-events', [
            'type' => 'replacement',
            'nodeSerial' => '1934526000155',
            'cardType' => 'BMC',
            'cardPartNumber' => 'BMC-002',
            'cardSerial' => 'SN-BMC-88',
            'removedPartNumber' => 'BMC-001',
            'removedSerial' => 'SN-BMC-77',
            'reason' => 'damage',
            'validationId' => $validationId,
        ])->assertCreated()->assertJsonPath('event.validationId', $validationId);

        $this->actingAs($operator)->getJson('/api/card-events?nodeSerial=1934526000155')
            ->assertJsonPath('summary.replacements', 1)
            ->assertJsonPath('summary.replacementsByCard.BMC', 1)
            ->assertJsonPath('summary.damageFound', 1);
    }

    public function test_no_se_liga_un_reemplazo_a_una_validacion_sin_daño(): void
    {
        $operator = $this->operator();
        $validationId = $this->actingAs($operator)->postJson('/api/card-events', $this->validation())->json('event.id');

        $this->actingAs($operator)->postJson('/api/card-events', [
            'type' => 'replacement', 'nodeSerial' => '1934526000155', 'cardType' => 'BMC',
            'cardPartNumber' => 'BMC-002', 'cardSerial' => 'SN-BMC-88', 'removedSerial' => 'SN-BMC-77', 'reason' => 'damage',
            'validationId' => $validationId,
        ])->assertStatus(422)->assertJsonValidationErrors(['validationId']);
    }

    public function test_un_reemplazo_directo_no_necesita_validacion(): void
    {
        $this->actingAs($this->operator())->postJson('/api/card-events', [
            'type' => 'replacement', 'nodeSerial' => '1934526000155', 'cardType' => 'Interposer',
            'cardPartNumber' => 'INT-9', 'cardSerial' => 'SN-INT-1', 'removedSerial' => 'SN-INT-0', 'reason' => 'direct',
        ])->assertCreated()->assertJsonPath('event.reason', 'direct');
    }

    public function test_un_reemplazo_exige_la_serie_retirada(): void
    {
        $this->actingAs($this->operator())->postJson('/api/card-events', [
            'type' => 'replacement', 'nodeSerial' => '1934526000155', 'cardType' => 'BMC',
            'cardPartNumber' => 'BMC-002', 'cardSerial' => 'SN-BMC-88', 'reason' => 'direct',
        ])->assertStatus(422)->assertJsonValidationErrors(['removedSerial']);
    }

    public function test_el_lote_guarda_varias_tarjetas_con_el_mismo_grupo(): void
    {
        $operator = $this->operator();

        $this->actingAs($operator)->postJson('/api/card-events/batch', [
            'groupId' => 'ses-abc',
            'events' => [
                $this->validation(['cardType' => 'BMC']),
                $this->validation(['cardType' => 'Interposer', 'cardPartNumber' => 'INT-1', 'cardSerial' => 'SN-I-1']),
            ],
        ])->assertCreated()->assertJsonCount(2, 'events')->assertJsonPath('events.1.groupId', 'ses-abc');

        $this->actingAs($operator)->getJson('/api/card-events?nodeSerial=1934526000155')
            ->assertJsonPath('summary.validations', 2);
    }

    public function test_el_lote_es_atomico_si_una_tarjeta_es_invalida(): void
    {
        $operator = $this->operator();

        $this->actingAs($operator)->postJson('/api/card-events/batch', [
            'events' => [
                $this->validation(),
                $this->validation(['cardSerial' => '']),
            ],
        ])->assertStatus(422)->assertJsonValidationErrors(['events.1.cardSerial']);

        $this->assertDatabaseCount('card_events', 0);
    }

    public function test_el_reporte_agrupa_por_tipo_y_por_operador(): void
    {
        $operator = $this->operator();
        $this->actingAs($operator)->postJson('/api/card-events/batch', [
            'events' => [
                $this->validation(),
                ['type' => 'replacement', 'nodeSerial' => '1934526000155', 'cardType' => 'BMC', 'cardPartNumber' => 'BMC-2',
                    'cardSerial' => 'SN-2', 'removedSerial' => 'SN-1', 'reason' => 'direct'],
                ['type' => 'replacement', 'nodeSerial' => '1934526000200', 'cardType' => 'BMC', 'cardPartNumber' => 'BMC-3',
                    'cardSerial' => 'SN-3', 'removedSerial' => 'SN-4', 'reason' => 'direct'],
            ],
        ])->assertCreated();

        $this->actingAs($operator)->getJson('/api/card-events/report')
            ->assertOk()
            ->assertJsonPath('validations.total', 1)
            ->assertJsonPath('validations.byCard.BMC', 1)
            ->assertJsonPath('replacements.total', 2)
            ->assertJsonPath('replacements.byCard.BMC', 2)
            ->assertJsonPath('replacements.byOperator.0.count', 2)
            ->assertJsonPath('replacements.byOperator.0.employeeNumber', '300001');

        $this->actingAs($operator)->getJson('/api/card-events/report?cardType=Interposer')
            ->assertJsonPath('validations.total', 0)->assertJsonPath('replacements.total', 0);
    }

    public function test_el_historial_se_busca_por_terminacion_de_la_serie(): void
    {
        $operator = $this->operator();
        $this->actingAs($operator)->postJson('/api/card-events', $this->validation())->assertCreated();
        $this->actingAs($operator)->postJson('/api/card-events', $this->validation(['nodeSerial' => '1934526000200']))->assertCreated();

        $this->actingAs($operator)->getJson('/api/card-events?query=000155')
            ->assertOk()->assertJsonCount(1, 'events')->assertJsonPath('events.0.nodeSerial', '1934526000155');

        $this->actingAs($operator)->getJson('/api/card-events?query=52600')->assertOk()->assertJsonCount(2, 'events');
        $this->actingAs($operator)->getJson('/api/card-events')->assertStatus(422);
    }
}
