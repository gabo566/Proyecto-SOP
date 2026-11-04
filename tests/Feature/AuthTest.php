<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolePermissionSeeder::class);
        RateLimiter::clear('login');
    }

    private function makeUser(string $employee, string $role = Role::OPERATOR, string $password = '1234', array $attributes = []): User
    {
        return User::factory()->withRole($role, $role)->create([
            'employee_number' => $employee,
            'password' => $password,
            ...$attributes,
        ]);
    }

    public function test_login_con_credenciales_correctas_devuelve_el_usuario_y_abre_sesion(): void
    {
        $this->makeUser('140785', Role::OPERATOR, '0785', ['name' => 'Operador Demo']);

        $this->postJson('/api/login', ['employeeNumber' => '140785', 'password' => '0785'])
            ->assertOk()
            ->assertJsonPath('user.employeeNumber', '140785')
            ->assertJsonPath('user.role', 'operator')
            ->assertJsonMissingPath('user.password');

        $this->getJson('/api/me')->assertOk()->assertJsonPath('user.name', 'Operador Demo');
    }

    public function test_login_con_contrasena_incorrecta_o_cuenta_inactiva_falla(): void
    {
        $this->makeUser('140785', Role::OPERATOR, '0785');
        $this->makeUser('140786', Role::OPERATOR, '0786', ['is_active' => false]);

        $this->postJson('/api/login', ['employeeNumber' => '140785', 'password' => 'mal'])
            ->assertStatus(422)->assertJsonPath('code', 'invalid-credentials');
        $this->postJson('/api/login', ['employeeNumber' => '140786', 'password' => '0786'])
            ->assertStatus(422)->assertJsonPath('code', 'invalid-credentials');
        $this->getJson('/api/me')->assertOk()->assertJsonPath('user', null);
    }

    public function test_logout_cierra_la_sesion(): void
    {
        $user = $this->makeUser('140785');

        $this->actingAs($user)->postJson('/api/logout')->assertOk();
        $this->app['auth']->forgetGuards();

        $this->getJson('/api/me')->assertOk()->assertJsonPath('user', null);
        $this->getJson('/api/users')->assertUnauthorized();
    }

    public function test_el_login_limita_a_cinco_intentos_por_minuto(): void
    {
        $this->makeUser('140785', Role::OPERATOR, '0785');

        foreach (range(1, 5) as $_) {
            $this->postJson('/api/login', ['employeeNumber' => '140785', 'password' => 'mal'])->assertStatus(422);
        }

        $this->postJson('/api/login', ['employeeNumber' => '140785', 'password' => '0785'])->assertStatus(429);
    }

    public function test_verify_comprueba_a_otra_persona_sin_cambiar_la_sesion(): void
    {
        $actual = $this->makeUser('140785');
        $this->makeUser('140860', Role::OPERATOR, '0860', ['name' => 'Tania']);

        $this->actingAs($actual)
            ->postJson('/api/users/verify', ['employeeNumber' => '140860', 'password' => '0860'])
            ->assertOk()->assertJsonPath('user.name', 'Tania');

        $this->getJson('/api/me')->assertJsonPath('user.employeeNumber', '140785');

        $this->postJson('/api/users/verify', ['employeeNumber' => '140860', 'password' => 'mal'])
            ->assertStatus(422)->assertJsonPath('code', 'invalid-credentials');
    }

    public function test_los_permisos_efectivos_suman_los_del_rol_y_los_propios(): void
    {
        $admin = $this->makeUser('140784', Role::ADMIN);
        $admin->role->permissions()->sync(Permission::where('key', Permission::USERS_MANAGE)->pluck('id'));
        $admin->directPermissions()->sync(Permission::where('key', Permission::SOP_MANAGE)->pluck('id'));

        $this->actingAs($admin)->getJson('/api/me')
            ->assertJsonPath('user.permissions', [Permission::USERS_MANAGE, Permission::SOP_MANAGE]);
    }

    public function test_una_cuenta_desactivada_con_sesion_abierta_queda_fuera(): void
    {
        $user = $this->makeUser('140785', Role::OPERATOR, '0785', ['is_active' => false]);

        $this->actingAs($user)->postJson('/api/logout')
            ->assertUnauthorized()->assertJsonPath('code', 'inactive');
    }
}
