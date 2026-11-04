<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Carga las cuentas iniciales desde database/seeders/data/demo-users.json.
 * Ese archivo no se versiona (contiene contraseñas): ver demo-users.example.json.
 */
class DemoUserSeeder extends Seeder
{
    public function run(): void
    {
        $path = database_path('seeders/data/demo-users.json');

        if (! is_file($path)) {
            $this->command?->warn('Sin database/seeders/data/demo-users.json: no se crearon usuarios. Usa `php artisan sop:crear-usuario`.');

            return;
        }

        $roles = Role::pluck('id', 'key');

        foreach (json_decode(file_get_contents($path), true, flags: JSON_THROW_ON_ERROR) as $row) {
            $user = User::updateOrCreate(
                ['employee_number' => $row['employeeNumber']],
                [
                    'name' => $row['name'],
                    'position' => $row['position'],
                    'email' => $row['email'] ?? null,
                    'password' => $row['password'],
                    'role_id' => $roles[$row['role']],
                    'is_active' => $row['active'] ?? true,
                ],
            );

            $user->directPermissions()->sync(
                Permission::whereIn('key', $row['permissions'] ?? [])->pluck('id'),
            );
        }
    }
}
