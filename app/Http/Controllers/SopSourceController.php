<?php

namespace App\Http\Controllers;

use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

/**
 * PDF fuente que reemplaza al incluido en el proyecto para el cotejo manual de
 * la SOP incorporada (antes un registro "active-sop-pdf" en IndexedDB).
 */
class SopSourceController extends Controller
{
    private const PATH = 'sop/source.pdf';

    private const SETTING = 'sop_source';

    public function show(): JsonResponse
    {
        return response()->json(['ok' => true, 'source' => $this->describe()]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate(['pdf' => ['required', 'file', 'mimes:pdf', 'max:30720']]);

        $file = $request->file('pdf');
        Storage::disk('local')->putFileAs('sop', $file, 'source.pdf');
        Setting::write(self::SETTING, [
            'name' => $file->getClientOriginalName(),
            'updatedAt' => now()->toIso8601String(),
        ]);

        return response()->json(['ok' => true, 'source' => $this->describe()], 201);
    }

    public function file(): Response
    {
        $source = $this->describe();
        abort_unless($source, 404);

        return Storage::disk('local')->response(self::PATH, $source['name'], [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.addslashes($source['name']).'"',
            'Cache-Control' => 'private, max-age=300',
        ]);
    }

    /** @return array{name: string, updatedAt: string, url: string}|null */
    private function describe(): ?array
    {
        $meta = Setting::read(self::SETTING);

        if (! $meta || ! Storage::disk('local')->exists(self::PATH)) {
            return null;
        }

        return [
            'name' => $meta['name'],
            'updatedAt' => $meta['updatedAt'],
            'url' => '/api/sop-source/file?v='.rawurlencode($meta['updatedAt']),
        ];
    }
}
