<?php

namespace App\Http\Controllers;

use App\Models\ValidationRecord;
use App\Services\WorkSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RecordController extends Controller
{
    private const MAX_BYTES = 2 * 1024 * 1024;

    public function __construct(private readonly WorkSyncService $sync) {}

    public function index(): JsonResponse
    {
        $records = ValidationRecord::orderByDesc('created_ms')->get();

        return response()->json([
            'ok' => true,
            'records' => $records->pluck('data')->values(),
            'revisions' => $records->pluck('revision', 'id'),
        ]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        abort_unless(preg_match('/^[A-Za-z0-9._-]{1,64}$/', $id) === 1, 404);

        $data = $request->validate([
            'record' => ['required', 'array'],
            'record.id' => ['required', 'string', 'in:'.$id],
            'record.status' => ['required', 'string', 'max:40'],
            'record.employeeNumber' => ['required', 'string', 'max:40'],
            'baseRevision' => ['nullable', 'integer', 'min:0'],
        ]);

        // validate() solo devuelve las claves nombradas; el registro va completo.
        $record = $request->input('record');
        abort_if(strlen(json_encode($record)) > self::MAX_BYTES, 413);

        $result = $this->sync->saveRecord($request->user(), $id, $record, $data['baseRevision'] ?? null);

        if ($result['ok']) {
            return response()->json(['ok' => true, 'revision' => $result['revision']]);
        }

        return response()->json($result, $result['code'] === 'conflict' ? 409 : 403);
    }
}
