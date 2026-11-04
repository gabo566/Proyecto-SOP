<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'employeeNumber' => ['required', 'string', 'max:40'],
            'password' => ['required', 'string', 'max:200'],
        ]);

        $attempt = [
            'employee_number' => trim($credentials['employeeNumber']),
            'password' => $credentials['password'],
            'is_active' => true,
        ];

        if (! Auth::guard('web')->attempt($attempt)) {
            return response()->json(['ok' => false, 'code' => 'invalid-credentials'], 422);
        }

        $request->session()->regenerate();

        return $this->userResponse($request->user());
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['ok' => true]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user && ! $user->is_active) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $user = null;
        }

        return $user ? $this->userResponse($user) : response()->json(['ok' => true, 'user' => null]);
    }

    /**
     * Comprueba las credenciales de otra persona sin tocar la sesión actual
     * (cambio de operador en un retrabajo).
     */
    public function verify(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'employeeNumber' => ['required', 'string', 'max:40'],
            'password' => ['required', 'string', 'max:200'],
        ]);

        $user = User::with(['role.permissions', 'directPermissions'])
            ->where('employee_number', trim($credentials['employeeNumber']))
            ->where('is_active', true)
            ->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            return response()->json(['ok' => false, 'code' => 'invalid-credentials'], 422);
        }

        return $this->userResponse($user);
    }

    private function userResponse(User $user): JsonResponse
    {
        $user->loadMissing(['role.permissions', 'directPermissions']);

        return response()->json(['ok' => true, 'user' => $user->toClientArray()]);
    }
}
