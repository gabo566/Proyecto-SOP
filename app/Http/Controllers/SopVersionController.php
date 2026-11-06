<?php

namespace App\Http\Controllers;

use App\Models\Permission;
use App\Models\SopVersion;
use App\Models\User;
use App\Services\SopVersionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

class SopVersionController extends Controller
{
    private const MAX_JSON_BYTES = 8 * 1024 * 1024;

    public function __construct(private readonly SopVersionService $versions) {}

    public function index(): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'versions' => SopVersion::with('reviews')->orderByDesc('created_at')->get()->map->toClientArray()->values(),
        ]);
    }

    /** Contadores para el menú: devueltas y en revisión de quien consulta, y pendientes por revisar o publicar. */
    public function summary(Request $request): JsonResponse
    {
        return response()->json(['ok' => true, 'summary' => $this->versions->summaryFor($request->user())]);
    }

    /**
     * Alta o actualización (upsert por id). La revisión viaja como multipart:
     * `version` (JSON) y, solo si cambia, `pdf`.
     */
    /** Quien sube la SOP: el editor o el revisor (el publicador solo publica). */
    private function canUpload(?User $user): bool
    {
        return $user !== null && ($user->hasPermissionTo(Permission::SOP_MANAGE) || $user->hasPermissionTo(Permission::SOP_REVIEW));
    }

    /** Quien revisa: el editor o el revisor; nunca sobre lo que él mismo subió (lo valida el servicio). */
    private function canReview(?User $user): bool
    {
        return $this->canUpload($user);
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($this->canUpload($request->user()), 403);

        $request->validate([
            'version' => ['required', 'string', 'max:'.self::MAX_JSON_BYTES],
            'pdf' => ['nullable', 'file', 'mimes:pdf', 'max:30720'],
            'pdfCopyFrom' => ['nullable', 'string', 'max:80'],
        ]);

        $version = json_decode($request->input('version'), true);

        if (! is_array($version)) {
            throw ValidationException::withMessages(['version' => 'La revisión no es un JSON válido.']);
        }

        validator($version, [
            'id' => ['required', 'string', 'regex:/^[A-Za-z0-9._-]{1,80}$/'],
            'document' => ['required', 'array'],
            'document.title' => ['required', 'string', 'max:255'],
            'document.revision' => ['required', 'string', 'max:40'],
            'procedures' => ['required', 'array'],
            'createdBy' => ['nullable', 'string', 'max:100'],
        ])->validate();

        $saved = $this->versions->save(
            $version,
            $request->file('pdf'),
            $request->input('pdfCopyFrom'),
            $request->user(),
        );

        return response()->json(['ok' => true, 'version' => $saved->load('reviews')->toClientArray()]);
    }

    public function review(Request $request, SopVersion $version): JsonResponse
    {
        abort_unless($this->canReview($request->user()), 403);

        $data = $request->validate([
            'decision' => ['required', 'string', 'in:approve,reject'],
            'note' => ['nullable', 'string', 'max:1000'],
            // Marcas del revisor sobre las hojas (capa de revisión; el operador no las ve).
            'marks' => ['nullable', 'array', 'max:200'],
            'marks.*.procedureId' => ['required', 'string', 'max:120'],
            'marks.*.type' => ['required', 'string', 'in:note,box,arrow'],
            'marks.*.x' => ['required', 'numeric', 'between:0,1'],
            'marks.*.y' => ['required', 'numeric', 'between:0,1'],
            'marks.*.w' => ['nullable', 'numeric', 'between:-1,1'],
            'marks.*.h' => ['nullable', 'numeric', 'between:-1,1'],
            'marks.*.text' => ['nullable', 'string', 'max:300'],
        ]);

        $marks = array_map(fn (array $mark) => [
            'procedureId' => $mark['procedureId'],
            'type' => $mark['type'],
            'x' => round((float) $mark['x'], 4),
            'y' => round((float) $mark['y'], 4),
            'w' => round((float) ($mark['w'] ?? 0), 4),
            'h' => round((float) ($mark['h'] ?? 0), 4),
            'text' => trim((string) ($mark['text'] ?? '')),
        ], $data['marks'] ?? []);

        $result = $this->versions->review($version, $request->user(), $data['decision'], $data['note'] ?? null, $marks);

        return $this->workflowResponse($result);
    }

    public function publish(Request $request, SopVersion $version): JsonResponse
    {
        return $this->workflowResponse($this->versions->publish($version, $request->user()));
    }

    /** Quién puede revisar y quién publicar, para avisar al editor al enviar una revisión. */
    public function roles(): JsonResponse
    {
        $holders = fn (string $key) => User::with(['role.permissions', 'directPermissions'])
            ->where('is_active', true)->orderBy('name')->get()
            ->filter(fn (User $user) => $user->hasPermissionTo($key))
            ->map(fn (User $user) => ['id' => $user->id, 'name' => $user->name, 'employeeNumber' => $user->employee_number])
            ->values();

        return response()->json([
            'ok' => true,
            'reviewers' => $holders(Permission::SOP_REVIEW),
            'publishers' => $holders(Permission::SOP_PUBLISH),
        ]);
    }

    private function workflowResponse(string|SopVersion $result): JsonResponse
    {
        if (is_string($result)) {
            return response()->json(['ok' => false, 'code' => $result], in_array($result, ['same-person', 'own-version'], true) ? 403 : 422);
        }

        return response()->json(['ok' => true, 'version' => $result->loadMissing('reviews')->toClientArray()]);
    }

    public function destroy(SopVersion $version): JsonResponse
    {
        $this->versions->delete($version);

        return response()->json(['ok' => true]);
    }

    public function pdf(SopVersion $version): Response
    {
        abort_unless($version->pdf_path && Storage::disk('local')->exists($version->pdf_path), 404);

        return Storage::disk('local')->response($version->pdf_path, $version->pdf_name ?: 'sop.pdf', [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.addslashes($version->pdf_name ?: 'sop.pdf').'"',
            'Cache-Control' => 'private, max-age=300',
        ]);
    }
}
