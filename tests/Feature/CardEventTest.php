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
            'cardPartNumber' => 'BMC-002', 'cardSerial' => 'SN-BMC-88', 'reason' => 'damage',
            'validationId' => $validationId,
        ])->assertStatus(422)->assertJsonValidationErrors(['validationId']);
    }

    public function test_un_reemplazo_directo_no_necesita_validacion(): void
    {
        $this->actingAs($this->operator())->postJson('/api/card-events', [
            'type' => 'replacement', 'nodeSerial' => '1934526000155', 'cardType' => 'Interposer',
            'cardPartNumber' => 'INT-9', 'cardSerial' => 'SN-INT-1', 'reason' => 'direct',
        ])->assertCreated()->assertJsonPath('event.reason', 'direct');
    }
}
