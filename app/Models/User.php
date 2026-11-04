<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Collection;

#[Fillable(['employee_number', 'name', 'position', 'email', 'phone', 'shift', 'area', 'avatar_path', 'password', 'role_id', 'is_active'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    public function directPermissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class);
    }

    /**
     * Claves de permiso efectivas: las del rol más las concedidas a la persona.
     *
     * @return Collection<int, string>
     */
    public function permissionKeys(): Collection
    {
        return $this->role->permissions->pluck('key')
            ->merge($this->directPermissions->pluck('key'))
            ->unique()
            ->values();
    }

    public function hasPermissionTo(string $key): bool
    {
        return $this->is_active && $this->permissionKeys()->contains($key);
    }

    /**
     * Forma pública que consume el front (mismos nombres que el prototipo local).
     *
     * @return array<string, mixed>
     */
    public function toClientArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'username' => $this->employee_number,
            'employeeNumber' => $this->employee_number,
            'position' => $this->position,
            'email' => $this->email ?? '',
            'phone' => $this->phone ?? '',
            'shift' => $this->shift ?? '',
            'area' => $this->area ?? '',
            // El número de versión evita que el navegador muestre la foto anterior.
            'avatarUrl' => $this->avatar_path
                ? "/api/users/{$this->id}/avatar?v={$this->updated_at?->timestamp}"
                : '',
            'role' => $this->role->key,
            'active' => $this->is_active,
            'permissions' => $this->permissionKeys()->all(),
        ];
    }
}
