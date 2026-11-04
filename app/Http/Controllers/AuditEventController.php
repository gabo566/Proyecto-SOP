<?php

namespace App\Http\Controllers;

use App\Services\AuditTrailService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditEventController extends Controller
{
    public function __construct(private readonly AuditTrailService $audit) {}

    public function index(Request $request): JsonResponse
    {
        $limit = max(1, min((int) $request->query('limit', AuditTrailService::MAX_READ), AuditTrailService::MAX_READ));

        return response()->json(['ok' => true, 'events' => $this->audit->latest($limit)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'events' => ['required', 'array', 'min:1', 'max:100'],
            'events.*.id' => ['required', 'string', 'regex:/^[A-Za-z0-9._-]{1,64}$/'],
            'events.*.action' => ['required', 'string', 'max:60'],
            'events.*.at' => ['nullable', 'string', 'max:40'],
        ]);

        abort_if(strlen(json_encode($request->input('events'))) > 1024 * 1024, 413);

        // Se guarda el evento completo tal como lo describió el front, no solo lo validado.
        $created = $this->audit->record($request->user(), $request->input('events'));

        return response()->json(['ok' => true, 'created' => $created, 'received' => count($data['events'])]);
    }
}
