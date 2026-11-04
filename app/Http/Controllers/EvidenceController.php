<?php

namespace App\Http\Controllers;

use App\Models\EvidenceFile;
use App\Models\Permission;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

/**
 * Fotos de evidencia (máximo 8 MB, JPG, PNG o WebP). Se leen con sesión; solo
 * quien las subió o quien revisa evidencia puede reemplazarlas o borrarlas.
 */
class EvidenceController extends Controller
{
    private const ID_PATTERN = '/^[A-Za-z0-9._-]{1,64}$/';

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'id' => ['required', 'string', 'regex:'.self::ID_PATTERN],
            // El tipo se comprueba por el contenido del archivo, no por su nombre.
            'file' => ['required', 'file', 'mimetypes:'.implode(',', array_keys(EvidenceFile::MIME_EXTENSIONS)), 'max:8192'],
        ]);

        $user = $request->user();
        $id = $request->input('id');
        $file = $request->file('file');
        $existing = EvidenceFile::find($id);

        if ($existing && ! $this->canChange($request, $existing)) {
            return response()->json(['ok' => false, 'code' => 'forbidden'], 403);
        }

        $mime = $file->getMimeType();
        $path = "evidence/{$id}.".EvidenceFile::MIME_EXTENSIONS[$mime];
        Storage::disk('local')->putFileAs('evidence', $file, basename($path));

        if ($existing && $existing->path !== $path) {
            Storage::disk('local')->delete($existing->path);
        }

        EvidenceFile::updateOrCreate(['id' => $id], [
            'uploaded_by' => $existing?->uploaded_by ?? $user->id,
            'employee_number' => $existing?->employee_number ?? $user->employee_number,
            'original_name' => mb_substr($file->getClientOriginalName(), 0, 255),
            'mime' => $mime,
            'size' => $file->getSize(),
            'path' => $path,
        ]);

        return response()->json(['ok' => true, 'id' => $id], $existing ? 200 : 201);
    }

    public function show(string $id): Response
    {
        $evidence = $this->find($id);
        abort_unless(Storage::disk('local')->exists($evidence->path), 404);

        return Storage::disk('local')->response($evidence->path, $evidence->original_name, [
            'Content-Type' => $evidence->mime,
            'Content-Disposition' => 'inline; filename="'.addslashes($evidence->original_name).'"',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, max-age=300',
        ]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $evidence = $this->find($id);

        if (! $this->canChange($request, $evidence)) {
            return response()->json(['ok' => false, 'code' => 'forbidden'], 403);
        }

        Storage::disk('local')->delete($evidence->path);
        $evidence->delete();

        return response()->json(['ok' => true]);
    }

    private function find(string $id): EvidenceFile
    {
        abort_unless(preg_match(self::ID_PATTERN, $id) === 1, 404);

        return EvidenceFile::findOrFail($id);
    }

    private function canChange(Request $request, EvidenceFile $evidence): bool
    {
        $user = $request->user();

        return $evidence->employee_number === $user->employee_number
            || $user->hasPermissionTo(Permission::EVIDENCE_REVIEW);
    }
}
