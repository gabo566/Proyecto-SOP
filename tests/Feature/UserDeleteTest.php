<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserDeleteTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach ([Role::OPERATOR, Role::ADMIN] as $key) {
            Role::firstOrCreate(['key' => $key], ['name' => $key]);
        }
        Permission::firstOrCreate(['key' => Permission::USERS_MANAGE], ['name' => Permission::USERS_MANAGE]);
    }

    private function person(string $number, string $role, bool $manage = false): User
    {
        $user = User::factory()->create([
            'employee_number' => $number,
            'name' => "Persona {$number}",
            'role_id' => Role::where('key', $role)->value('id'),
            'is_active' => true,
        ]);
        if ($manage) {
            $user->directPermissions()->sync(Permission::where('key', Permission::USERS_MANAGE)->pluck('id'));
        }

        return $user;
    }

    public function test_administrador_elimina_una_cuenta_y_se_quitan_sus_permisos(): void
    {
        $admin = $this->person('140784', Role::ADMIN, true);
        $target = $this->person('500010', Role::OPERATOR);
        $target->directPermissions()->sync(Permission::where('key', Permission::USERS_MANAGE)->pluck('id'));

        $this->actingAs($admin)->deleteJson("/api/users/{$target->id}")->assertOk()->assertJson(['ok' => true]);

        $this->assertDatabaseMissing('users', ['id' => $target->id]);
        $this->assertDatabaseMissing('permission_user', ['user_id' => $target->id]);
    }

    public function test_nadie_se_elimina_a_si_mismo(): void
    {
        $admin = $this->person('140784', Role::ADMIN, true);

        $this->actingAs($admin)->deleteJson("/api/users/{$admin->id}")
            ->assertStatus(422)->assertJsonPath('code', 'active-user');
        $this->assertDatabaseHas('users', ['id' => $admin->id]);
    }

    public function test_no_se_elimina_al_ultimo_administrador_activo(): void
    {
        $manager = $this->person('400001', Role::OPERATOR, true);
        $lastAdmin = $this->person('140784', Role::ADMIN);

        $this->actingAs($manager)->deleteJson("/api/users/{$lastAdmin->id}")
            ->assertStatus(422)->assertJsonPath('code', 'last-admin');
        $this->assertDatabaseHas('users', ['id' => $lastAdmin->id]);
    }

    public function test_sin_permiso_de_usuarios_no_se_puede_eliminar(): void
    {
        $operator = $this->person('400002', Role::OPERATOR);
        $target = $this->person('500011', Role::OPERATOR);

        $this->actingAs($operator)->deleteJson("/api/users/{$target->id}")->assertForbidden();
        $this->assertDatabaseHas('users', ['id' => $target->id]);
    }
}
