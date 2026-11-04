<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProfileTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
    }

    private function user(array $attributes = []): User
    {
        return User::factory()->create(['employee_number' => '140785', 'password' => 'clave-actual', ...$attributes]);
    }

    private function realFile(string $name, string $content): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'av');
        file_put_contents($path, $content);

        return new UploadedFile($path, $name, 'image/jpeg', null, true);
    }

    public function test_requiere_sesion(): void
    {
        $this->patchJson('/api/profile', [])->assertUnauthorized();
        $this->patchJson('/api/profile/password', [])->assertUnauthorized();
        $this->postJson('/api/profile/avatar', [])->assertUnauthorized();
    }

    public function test_actualiza_contacto_y_datos_de_planta_y_los_devuelve(): void
    {
        $this->actingAs($this->user());

        $this->patchJson('/api/profile', [
            'email' => 'operador@empresa.com',
            'phone' => '+52 (951) 123-4567',
            'position' => 'Técnico de FA Sr',
            'shift' => 'T2',
            'area' => 'Retrabajo RWK',
        ])
            ->assertOk()
            ->assertJsonPath('user.email', 'operador@empresa.com')
            ->assertJsonPath('user.phone', '+52 (951) 123-4567')
            ->assertJsonPath('user.position', 'Técnico de FA Sr')
            ->assertJsonPath('user.shift', 'T2')
            ->assertJsonPath('user.area', 'Retrabajo RWK');

        $this->getJson('/api/me')->assertJsonPath('user.area', 'Retrabajo RWK');
    }

    public function test_no_permite_cambiar_nombre_numero_de_empleado_ni_rol(): void
    {
        $user = $this->user(['name' => 'Nombre Original']);
        $this->actingAs($user);

        $this->patchJson('/api/profile', [
            'position' => 'Puesto',
            'name' => 'Otro Nombre',
            'employee_number' => '999999',
            'employeeNumber' => '999999',
            'role' => 'admin',
            'role_id' => 99,
        ])->assertOk();

        $fresh = $user->fresh();
        $this->assertSame('Nombre Original', $fresh->name);
        $this->assertSame('140785', $fresh->employee_number);
        $this->assertSame('operator', $fresh->role->key);
    }

    public function test_valida_correo_unico_telefono_turno_y_puesto(): void
    {
        $this->user(['employee_number' => '140860', 'email' => 'ocupado@empresa.com']);
        $this->actingAs($this->user());

        $this->patchJson('/api/profile', ['position' => 'x', 'email' => 'ocupado@empresa.com'])->assertStatus(422)->assertJsonValidationErrors('email');
        $this->patchJson('/api/profile', ['position' => 'x', 'email' => 'no-es-correo'])->assertStatus(422);
        $this->patchJson('/api/profile', ['position' => 'x', 'phone' => 'abc'])->assertStatus(422)->assertJsonValidationErrors('phone');
        $this->patchJson('/api/profile', ['position' => 'x', 'shift' => 'T9'])->assertStatus(422)->assertJsonValidationErrors('shift');
        $this->patchJson('/api/profile', ['position' => ''])->assertStatus(422)->assertJsonValidationErrors('position');
        // Conservar el mismo correo propio no cuenta como duplicado.
        $this->patchJson('/api/profile', ['position' => 'x', 'email' => 'mio@empresa.com'])->assertOk();
        $this->patchJson('/api/profile', ['position' => 'x', 'email' => 'mio@empresa.com'])->assertOk();
    }

    public function test_los_campos_vacios_se_guardan_como_nulos(): void
    {
        $user = $this->user(['phone' => '123', 'area' => 'Algo', 'shift' => 'T1']);
        $this->actingAs($user);

        $this->patchJson('/api/profile', ['position' => 'x', 'phone' => '  ', 'area' => '', 'shift' => ''])->assertOk();

        $fresh = $user->fresh();
        $this->assertNull($fresh->phone);
        $this->assertNull($fresh->area);
        $this->assertNull($fresh->shift);
    }

    public function test_cambiar_la_contrasena_exige_la_actual_y_un_minimo_de_ocho(): void
    {
        $user = $this->user();
        $this->actingAs($user);

        $this->patchJson('/api/profile/password', ['currentPassword' => 'incorrecta', 'password' => 'nueva-segura-1'])
            ->assertStatus(422)->assertJsonPath('code', 'wrong-password');
        $this->patchJson('/api/profile/password', ['currentPassword' => 'clave-actual', 'password' => 'corta'])
            ->assertStatus(422)->assertJsonValidationErrors('password');
        $this->patchJson('/api/profile/password', ['currentPassword' => 'clave-actual', 'password' => 'clave-actual'])
            ->assertStatus(422)->assertJsonPath('code', 'same-password');

        $this->patchJson('/api/profile/password', ['currentPassword' => 'clave-actual', 'password' => 'nueva-segura-1'])->assertOk();
        $this->assertTrue(Hash::check('nueva-segura-1', $user->fresh()->password));
        $this->assertFalse(Hash::check('clave-actual', $user->fresh()->password));
    }

    public function test_el_cambio_de_contrasena_limita_los_intentos(): void
    {
        $this->actingAs($this->user());

        foreach (range(1, 5) as $_) {
            $this->patchJson('/api/profile/password', ['currentPassword' => 'mal', 'password' => 'nueva-segura-1'])->assertStatus(422);
        }

        $this->patchJson('/api/profile/password', ['currentPassword' => 'clave-actual', 'password' => 'nueva-segura-1'])->assertStatus(429);
    }

    public function test_sube_la_foto_cualquier_usuario_la_ve_y_se_puede_quitar(): void
    {
        $user = $this->user();
        $this->actingAs($user);

        $response = $this->post('/api/profile/avatar', ['avatar' => UploadedFile::fake()->image('yo.jpg', 60, 60)], ['Accept' => 'application/json'])
            ->assertOk();
        $this->assertStringStartsWith("/api/users/{$user->id}/avatar?v=", $response->json('user.avatarUrl'));
        Storage::disk('local')->assertExists("avatars/{$user->id}.jpg");

        $this->actingAs($this->user(['employee_number' => '140860']));
        $this->get("/api/users/{$user->id}/avatar")->assertOk()->assertHeader('X-Content-Type-Options', 'nosniff');

        $this->actingAs($user);
        $this->deleteJson('/api/profile/avatar')->assertOk()->assertJsonPath('user.avatarUrl', '');
        Storage::disk('local')->assertMissing("avatars/{$user->id}.jpg");
        $this->get("/api/users/{$user->id}/avatar")->assertNotFound();
    }

    public function test_rechaza_una_foto_falsa_o_demasiado_grande(): void
    {
        $this->actingAs($this->user());

        $this->post('/api/profile/avatar', ['avatar' => $this->realFile('yo.jpg', 'no soy una imagen')], ['Accept' => 'application/json'])->assertStatus(422);
        $this->post('/api/profile/avatar', ['avatar' => UploadedFile::fake()->image('grande.png', 50, 50)->size(3000)], ['Accept' => 'application/json'])->assertStatus(422);
        $this->post('/api/profile/avatar', [], ['Accept' => 'application/json'])->assertStatus(422);
    }
}
