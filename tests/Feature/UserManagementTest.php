<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
    }

    private function admin(string $employee = '140784'): User
    {
        return User::factory()->withRole(Role::ADMIN, 'Administrador')->create(['employee_number' => $employee]);
    }

    private function payload(array $overrides = []): array
    {
        return [
            'name' => 'Nueva Persona',
            'employeeNumber' => '150001',
            'position' => 'Técnico de FA',
            'role' => 'operator',
            'password' => '1234',
            ...$overrides,
        ];
    }

    public function test_solo_quien_administra_usuarios_puede_listar_y_crear(): void
    {
        $operator = User::factory()->create();

        $this->actingAs($operator)->getJson('/api/users')->assertForbidden();
        $this->postJson('/api/users', $this->payload())->assertForbidden();

        $this->actingAs($this->admin())->getJson('/api/users')->assertOk()->assertJsonCount(2, 'users');
    }

    public function test_crear_usuario_guarda_la_contrasena_con_hash(): void
    {
        $this->actingAs($this->admin())->postJson('/api/users', $this->payload())
            ->assertCreated()->assertJsonPath('user.employeeNumber', '150001');

        $stored = User::where('employee_number', '150001')->firstOrFail();
        $this->assertNotSame('1234', $stored->password);
        $this->assertTrue(Hash::check('1234', $stored->password));
    }

    public function test_numero_de_empleado_y_correo_son_unicos_y_la_contrasena_tiene_minimo(): void
    {
        $this->actingAs($this->admin());
        $this->postJson('/api/users', $this->payload(['email' => 'a@example.com']))->assertCreated();

        $this->postJson('/api/users', $this->payload(['name' => 'Otra']))
            ->assertStatus(422)->assertJsonPath('code', 'employee');
        $this->postJson('/api/users', $this->payload(['employeeNumber' => '150002', 'email' => 'A@example.com']))
            ->assertStatus(422)->assertJsonPath('code', 'email');
        $this->postJson('/api/users', $this->payload(['employeeNumber' => '150003', 'password' => '123']))
            ->assertStatus(422)->assertJsonPath('code', 'password');
        $this->postJson('/api/users', $this->payload(['employeeNumber' => '150004', 'role' => 'inexistente']))
            ->assertStatus(422);
    }

    public function test_cambiar_contrasena_exige_minimo_y_actualiza_el_hash(): void
    {
        $target = User::factory()->create(['password' => 'vieja1']);
        $this->actingAs($this->admin());

        $this->patchJson("/api/users/{$target->id}/password", ['password' => '123'])
            ->assertStatus(422)->assertJsonPath('code', 'password');
        $this->patchJson("/api/users/{$target->id}/password", ['password' => 'nueva1'])->assertOk();

        $this->assertTrue(Hash::check('nueva1', $target->fresh()->password));
    }

    public function test_no_se_puede_desactivar_a_si_mismo_ni_al_ultimo_administrador(): void
    {
        $admin = $this->admin('140784');
        $this->actingAs($admin);

        $this->patchJson("/api/users/{$admin->id}/active", ['active' => false])
            ->assertStatus(422)->assertJsonPath('code', 'active-user');

        $otro = $this->admin('140783');
        $this->patchJson("/api/users/{$otro->id}/active", ['active' => false])->assertOk();
        $this->assertFalse($otro->fresh()->is_active);

        // Con un solo administrador activo, otro administrador ya no puede desactivarlo.
        $tercero = $this->admin('140782');
        $this->actingAs($tercero);
        $this->patchJson("/api/users/{$admin->id}/active", ['active' => false])->assertOk();
        $this->patchJson("/api/users/{$tercero->id}/active", ['active' => false])
            ->assertStatus(422)->assertJsonPath('code', 'active-user');
    }

    public function test_no_se_desactiva_al_ultimo_administrador_activo(): void
    {
        $unico = $this->admin('140784');
        $operadorConPermiso = User::factory()->create();
        $operadorConPermiso->directPermissions()->sync(
            \App\Models\Permission::where('key', 'users.manage')->pluck('id'),
        );

        $this->actingAs($operadorConPermiso)
            ->patchJson("/api/users/{$unico->id}/active", ['active' => false])
            ->assertStatus(422)->assertJsonPath('code', 'last-admin');
    }

    public function test_reactivar_una_cuenta_funciona(): void
    {
        $target = User::factory()->inactive()->create();

        $this->actingAs($this->admin())
            ->patchJson("/api/users/{$target->id}/active", ['active' => true])->assertOk();

        $this->assertTrue($target->fresh()->is_active);
    }
}
