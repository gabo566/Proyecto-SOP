<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

/**
 * Perfil de quien tiene la sesión abierta. Nombre, número de empleado y rol los
 * cambia solo quien administra usuarios; aquí cada persona edita su contacto,
 * sus datos de planta, su foto y su contraseña.
 */
class ProfileController extends Controller
{
    public const MIN_PASSWORD_LENGTH = 8;

    private const AVATAR_MIMES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'email' => ['nullable', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => ['nullable', 'string', 'max:30', 'regex:/^[0-9+()\-\s.]*$/'],
            'position' => ['required', 'string', 'max:80'],
            'shift' => ['nullable', 'string', Rule::in(['T1', 'T2', 'T3'])],
            'area' => ['nullable', 'string', 'max:80'],
        ]);

        $user->update([
            'email' => $this->blankToNull($data['email'] ?? null),
            'phone' => $this->blankToNull($data['phone'] ?? null),
            'position' => trim($data['position']),
            'shift' => $this->blankToNull($data['shift'] ?? null),
            'area' => $this->blankToNull($data['area'] ?? null),
        ]);

        return $this->userResponse($user);
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'currentPassword' => ['required', 'string', 'max:200'],
            'password' => ['required', 'string', 'min:'.self::MIN_PASSWORD_LENGTH, 'max:200'],
        ]);

        $user = $request->user();

        if (! Hash::check($data['currentPassword'], $user->password)) {
            return response()->json(['ok' => false, 'code' => 'wrong-password'], 422);
        }

        if ($data['password'] === $data['currentPassword']) {
            return response()->json(['ok' => false, 'code' => 'same-password'], 422);
        }

        $user->update(['password' => $data['password']]);

        return response()->json(['ok' => true]);
    }

    public function storeAvatar(Request $request): JsonResponse
    {
        $request->validate([
            // El tipo se comprueba por el contenido del archivo, no por su nombre.
            'avatar' => ['required', 'file', 'mimetypes:'.implode(',', array_keys(self::AVATAR_MIMES)), 'max:2048'],
        ]);

        $user = $request->user();
        $file = $request->file('avatar');
        $path = "avatars/{$user->id}.".self::AVATAR_MIMES[$file->getMimeType()];

        if ($user->avatar_path && $user->avatar_path !== $path) {
            Storage::disk('local')->delete($user->avatar_path);
        }

        Storage::disk('local')->putFileAs('avatars', $file, basename($path));
        $user->update(['avatar_path' => $path]);
        $user->touch();

        return $this->userResponse($user);
    }

    public function destroyAvatar(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->avatar_path) {
            Storage::disk('local')->delete($user->avatar_path);
            $user->update(['avatar_path' => null]);
        }

        return $this->userResponse($user);
    }

    public function showAvatar(User $user): Response
    {
        abort_unless($user->avatar_path && Storage::disk('local')->exists($user->avatar_path), 404);

        return Storage::disk('local')->response($user->avatar_path, null, [
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, max-age=300',
        ]);
    }

    private function userResponse(User $user): JsonResponse
    {
        $user->load(['role.permissions', 'directPermissions']);

        return response()->json(['ok' => true, 'user' => $user->toClientArray()]);
    }

    private function blankToNull(?string $value): ?string
    {
        $text = trim((string) $value);

        return $text === '' ? null : $text;
    }
}
