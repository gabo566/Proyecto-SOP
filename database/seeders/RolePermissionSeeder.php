<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = [
            Permission::USERS_MANAGE => 'Crear usuarios, cambiar contraseñas y activar o desactivar accesos',
            Permission::EVIDENCE_REVIEW => 'Revisar y aprobar la evidencia de retrabajos',
            Permission::SOP_MANAGE => 'Modificar y activar versiones de la SOP',
            Permission::SOP_CREATE => 'Crear, subir y editar revisiones de la SOP',
            Permission::SOP_REVIEW => 'Revisar y aprobar o devolver revisiones de la SOP',
            Permission::SOP_PUBLISH => 'Publicar revisiones de la SOP ya aprobadas',
        ];

        foreach ($permissions as $key => $name) {
            Permission::updateOrCreate(['key' => $key], ['name' => $name]);
        }

        $roles = [
            Role::OPERATOR => ['Operador', []],
            Role::SUPERVISOR => ['Supervisor', [Permission::EVIDENCE_REVIEW]],
            Role::ADMIN => ['Administrador', [Permission::USERS_MANAGE, Permission::EVIDENCE_REVIEW]],
        ];

        foreach ($roles as $key => [$name, $allowed]) {
            $role = Role::updateOrCreate(['key' => $key], ['name' => $name]);
            $role->permissions()->sync(Permission::whereIn('key', $allowed)->pluck('id'));
        }
    }
}
