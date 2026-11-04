<?php

namespace App\Services;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Reglas de cuentas portadas de user-control.js: números de empleado y correos
 * únicos, contraseña mínima, un administrador activo como mínimo y nadie se
 * desactiva a sí mismo. Devuelve los mismos códigos que usa el front.
 */
class UserAccessService
{
    public const MIN_PASSWORD_LENGTH = 4;

    /** @return Collection<int, User> */
    public function list(): Collection
    {
        return User::with(['role.permissions', 'directPermissions'])
            ->orderBy('employee_number')
            ->get();
    }

    /**
     * @param  array{name: string, employee_number: string, position: string, email?: ?string, role: string, password: string}  $data
     */
    public function create(array $data): string|User
    {
        $employee = trim($data['employee_number']);
        $email = trim((string) ($data['email'] ?? ''));

        if (User::whereRaw('LOWER(employee_number) = ?', [mb_strtolower($employee)])->exists()) {
            return 'employee';
        }

        if ($email !== '' && User::whereRaw('LOWER(email) = ?', [mb_strtolower($email)])->exists()) {
            return 'email';
        }

        if (mb_strlen(trim($data['password'])) < self::MIN_PASSWORD_LENGTH) {
            return 'password';
        }

        $role = Role::where('key', $data['role'])->first();

        if (! $role) {
            return 'role';
        }

        return User::create([
            'employee_number' => $employee,
            'name' => trim($data['name']),
            'position' => trim($data['position']),
            'email' => $email !== '' ? $email : null,
            'password' => trim($data['password']),
            'role_id' => $role->id,
            'is_active' => true,
        ])->load(['role.permissions', 'directPermissions']);
    }

    public function changePassword(User $target, string $password): string
    {
        if (mb_strlen(trim($password)) < self::MIN_PASSWORD_LENGTH) {
            return 'password';
        }

        $target->update(['password' => trim($password)]);

        return 'ok';
    }

    /**
     * Concede o retira las funciones de revisor y publicador de SOP (permisos directos de la persona).
     */
    public function setSopRoles(User $target, bool $review, bool $publish): User
    {
        $ids = Permission::whereIn('key', [Permission::SOP_REVIEW, Permission::SOP_PUBLISH])->pluck('id', 'key');
        $target->directPermissions()->detach($ids->values());

        $grant = collect([Permission::SOP_REVIEW => $review, Permission::SOP_PUBLISH => $publish])
            ->filter()->keys()->map(fn (string $key) => $ids[$key])->all();

        if ($grant) {
            $target->directPermissions()->attach($grant);
        }

        return $target->load(['role.permissions', 'directPermissions']);
    }

    /**
     * Habilita o quita el rol de administrador. Quitarlo devuelve la cuenta a operador;
     * nadie se quita el rol a sí mismo y siempre queda un administrador activo.
     */
    public function setAdmin(User $actor, User $target, bool $admin): string
    {
        $isAdmin = $target->role->key === Role::ADMIN;

        if ($admin === $isAdmin) {
            return 'ok';
        }

        if (! $admin) {
            if ($actor->is($target)) {
                return 'active-user';
            }

            $activeAdmins = User::where('is_active', true)
                ->whereHas('role', fn ($query) => $query->where('key', Role::ADMIN))
                ->count();

            if ($target->is_active && $activeAdmins <= 1) {
                return 'last-admin';
            }
        }

        $role = Role::where('key', $admin ? Role::ADMIN : Role::OPERATOR)->first();

        if (! $role) {
            return 'role';
        }

        $target->update(['role_id' => $role->id]);

        return 'ok';
    }

    public function setActive(User $actor, User $target, bool $active): string
    {
        if (! $active && $actor->is($target)) {
            return 'active-user';
        }

        if (! $active && $target->is_active && $target->role->key === Role::ADMIN) {
            $activeAdmins = User::where('is_active', true)
                ->whereHas('role', fn ($query) => $query->where('key', Role::ADMIN))
                ->count();

            if ($activeAdmins <= 1) {
                return 'last-admin';
            }
        }

        $target->update(['is_active' => $active]);

        return 'ok';
    }
}
