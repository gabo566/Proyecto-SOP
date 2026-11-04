<?php

namespace App\Http\Controllers;

use App\Models\Role;
use App\Models\User;
use App\Services\UserAccessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    private const FAILURE_STATUS = [
        'missing' => 404,
        'forbidden' => 403,
    ];

    public function __construct(private readonly UserAccessService $access) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'users' => $this->access->list()->map->toClientArray()->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'employeeNumber' => ['required', 'string', 'max:40'],
            'position' => ['required', 'string', 'max:80'],
            'email' => ['nullable', 'string', 'max:255'],
            'role' => ['required', 'string', Rule::in(Role::pluck('key')->all())],
            'password' => ['required', 'string', 'max:80'],
        ]);

        $result = $this->access->create([
            'name' => $data['name'],
            'employee_number' => $data['employeeNumber'],
            'position' => $data['position'],
            'email' => $data['email'] ?? null,
            'role' => $data['role'],
            'password' => $data['password'],
        ]);

        if (is_string($result)) {
            return $this->failure($result);
        }

        return response()->json(['ok' => true, 'user' => $result->toClientArray()], 201);
    }

    public function updatePassword(Request $request, User $user): JsonResponse
    {
        $data = $request->validate(['password' => ['required', 'string', 'max:80']]);

        $result = $this->access->changePassword($user, $data['password']);

        return $result === 'ok' ? response()->json(['ok' => true]) : $this->failure($result);
    }

    public function updateActive(Request $request, User $user): JsonResponse
    {
        $data = $request->validate(['active' => ['required', 'boolean']]);

        $result = $this->access->setActive($request->user(), $user, (bool) $data['active']);

        return $result === 'ok' ? response()->json(['ok' => true]) : $this->failure($result);
    }

    public function updateSopRoles(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'review' => ['required', 'boolean'],
            'publish' => ['required', 'boolean'],
        ]);

        $updated = $this->access->setSopRoles($user, (bool) $data['review'], (bool) $data['publish']);

        return response()->json(['ok' => true, 'user' => $updated->toClientArray()]);
    }

    public function updateAdmin(Request $request, User $user): JsonResponse
    {
        $data = $request->validate(['admin' => ['required', 'boolean']]);

        $result = $this->access->setAdmin($request->user(), $user, (bool) $data['admin']);

        return $result === 'ok'
            ? response()->json(['ok' => true, 'user' => $user->fresh(['role.permissions', 'directPermissions'])->toClientArray()])
            : $this->failure($result);
    }

    private function failure(string $code): JsonResponse
    {
        return response()->json(['ok' => false, 'code' => $code], self::FAILURE_STATUS[$code] ?? 422);
    }
}
