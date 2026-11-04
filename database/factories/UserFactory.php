<?php

namespace Database\Factories;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    public function definition(): array
    {
        return [
            'employee_number' => (string) fake()->unique()->numberBetween(100000, 999999),
            'name' => fake()->name(),
            'position' => 'Técnico de FA',
            'email' => null,
            'password' => static::$password ??= Hash::make('password'),
            'role_id' => fn () => Role::firstOrCreate(
                ['key' => Role::OPERATOR],
                ['name' => 'Operador'],
            )->id,
            'is_active' => true,
            'remember_token' => null,
        ];
    }

    public function withRole(string $key, string $name): static
    {
        return $this->state(fn () => [
            'role_id' => Role::firstOrCreate(['key' => $key], ['name' => $name])->id,
        ]);
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }
}
