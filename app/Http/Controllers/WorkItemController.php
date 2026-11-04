<?php

namespace App\Http\Controllers;

use App\Models\WorkItem;
use App\Services\WorkSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class WorkItemController extends Controller
{
    private const MAX_BYTES = 2 * 1024 * 1024;

    public function __construct(private readonly WorkSyncService $sync) {}

    public function index(): JsonResponse
    {
        $items = WorkItem::orderByDesc('created_ms')->get();

        return response()->json([
            'ok' => true,
            'items' => $items->pluck('data')->values(),
            'revisions' => $items->pluck('revision', 'id'),
        ]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        abort_unless(preg_match('/^[A-Za-z0-9._-]{1,64}$/', $id) === 1, 404);

        $data = $request->validate([
            'item' => ['required', 'array'],
            'item.id' => ['required', 'string', Rule::in([$id])],
            'item.status' => ['required', 'string', Rule::in(WorkItem::STATUSES)],
            'item.employeeNumber' => ['required', 'string', 'max:40'],
            'item.history' => ['present', 'array'],
            'baseRevision' => ['nullable', 'integer', 'min:0'],
        ]);

        // validate() solo devuelve las claves nombradas; el documento va completo.
        $item = $request->input('item');
        abort_if(strlen(json_encode($item)) > self::MAX_BYTES, 413);

        $result = $this->sync->saveWorkItem($request->user(), $id, $item, $data['baseRevision'] ?? null);

        return $this->respond($result);
    }

    /** @param  array{ok: bool, code?: string, revision: int, stored?: array<string, mixed>}  $result */
    private function respond(array $result): JsonResponse
    {
        if ($result['ok']) {
            return response()->json(['ok' => true, 'revision' => $result['revision']]);
        }

        $status = $result['code'] === 'conflict' ? 409 : 403;

        return response()->json($result, $status);
    }
}
