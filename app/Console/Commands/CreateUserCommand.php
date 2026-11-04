<?php

namespace App\Console\Commands;

use App\Models\Role;
use App\Models\User;
use App\Services\UserAccessService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('sop:crear-usuario {employeeNumber} {name} {--position=Ing FA} {--role=admin} {--password=}')]
#[Description('Crea una cuenta (por defecto administrador) sin pasar por la interfaz')]
class CreateUserCommand extends Command
{
    public function handle(UserAccessService $access): int
    {
        $password = $this->option('password') ?: $this->secret('Contraseña (mínimo 4 caracteres)');

        $result = $access->create([
            'name' => $this->argument('name'),
            'employee_number' => $this->argument('employeeNumber'),
            'position' => $this->option('position'),
            'role' => $this->option('role'),
            'password' => (string) $password,
        ]);

        if (! $result instanceof User) {
            $this->error("No se creó la cuenta ({$result}).");

            return self::FAILURE;
        }

        $this->info("Cuenta {$result->employee_number} creada con rol ".Role::find($result->role_id)->name.'.');

        return self::SUCCESS;
    }
}
