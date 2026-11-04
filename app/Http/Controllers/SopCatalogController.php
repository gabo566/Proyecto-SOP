<?php

namespace App\Http\Controllers;

use App\Models\SopCatalogEntry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SopCatalogController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'catalog' => SopCatalogEntry::all()->mapWithKeys(fn (SopCatalogEntry $entry) => [
                $entry->version_id => [
                    'stationAssignment' => $entry->station_assignment ?? '',
                    'enabled' => $entry->enabled,
                ],
            ]),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'catalog' => ['required', 'array', 'max:500'],
            'catalog.*.stationAssignment' => ['nullable', 'string', 'max:160'],
            'catalog.*.enabled' => ['required', 'boolean'],
        ]);

        foreach ($data['catalog'] as $versionId => $config) {
            abort_unless(preg_match('/^[A-Za-z0-9._-]{1,80}$/', (string) $versionId) === 1, 422);

            SopCatalogEntry::updateOrCreate(
                ['version_id' => (string) $versionId],
                [
                    'station_assignment' => ($config['stationAssignment'] ?? '') ?: null,
                    'enabled' => (bool) $config['enabled'],
                    'updated_by' => $request->user()->id,
                ],
            );
        }

        return response()->json(['ok' => true]);
    }
}
