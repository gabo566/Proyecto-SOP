<?php

namespace App\Services;

use App\Models\SopCatalogEntry;
use App\Models\SopVersion;
use App\Models\SopVersionReview;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Guarda las revisiones de SOP: el JSON (documento, hojas y pasos) en la base y
 * el PDF fuente en storage/app. Una revisión nueva puede heredar el PDF de otra
 * (cuando se edita una existente) sin volver a subirlo.
 */
class SopVersionService
{
    public function save(array $version, ?UploadedFile $pdf, ?string $copyPdfFrom, User $actor): SopVersion
    {
        $record = SopVersion::find($version['id']) ?? new SopVersion(['id' => $version['id']]);
        $previousPath = $record->pdf_path;
        $isNew = ! $record->exists;
        // Quien subió una versión devuelta puede corregirla y reenviarla con el mismo id.
        $isResubmit = ! $isNew
            && $record->status === SopVersion::STATUS_REJECTED
            && $record->submitted_by === $actor->id;

        if ($isNew || $isResubmit) {
            $record->fill([
                'document' => $version['document'],
                'procedures' => $version['procedures'],
                'created_by' => $record->created_by ?? $actor->id,
                'created_by_name' => $record->created_by_name ?? ($version['createdBy'] ?? $actor->name),
            ]);
        } else {
            // Una versión enviada, aprobada o publicada ya no cambia de contenido: solo se actualizan
            // los datos de estación que asigna el catálogo.
            $document = $record->document ?? [];
            foreach ((array) $version['document'] as $key => $value) {
                if (str_starts_with((string) $key, 'station')) {
                    $document[$key] = $value;
                }
            }
            $record->document = $document;
            $pdf = null;
            $copyPdfFrom = null;
        }

        // Una revisión nueva nace «en revisión»: no puede habilitarse hasta que otra persona la apruebe y una tercera la publique.
        if ($isNew) {
            $record->fill([
                'status' => SopVersion::STATUS_PENDING,
                'submitted_by' => $actor->id,
                'submitted_by_name' => $actor->name,
                'submitted_at' => now(),
                'review_round' => 1,
                'change_summary' => is_array($version['changeSummary'] ?? null) ? $version['changeSummary'] : null,
            ]);
        }

        // Reenvío tras correcciones: vuelve a revisión como una ronda nueva.
        if ($isResubmit) {
            $record->fill([
                'status' => SopVersion::STATUS_PENDING,
                'submitted_at' => now(),
                'review_round' => ($record->review_round ?? 1) + 1,
                'reviewed_by' => null,
                'reviewed_by_name' => null,
                'reviewed_at' => null,
                'change_summary' => is_array($version['changeSummary'] ?? null) ? $version['changeSummary'] : $record->change_summary,
            ]);
        }

        if ($pdf) {
            $record->pdf_path = $this->storePdf($record->id, $pdf);
            $record->pdf_name = $pdf->getClientOriginalName();
        } elseif ($copyPdfFrom && ! $record->pdf_path) {
            $origin = SopVersion::find($copyPdfFrom);

            if ($origin?->pdf_path && Storage::disk('local')->exists($origin->pdf_path)) {
                $record->pdf_path = "sop/versions/{$record->id}.pdf";
                Storage::disk('local')->copy($origin->pdf_path, $record->pdf_path);
                $record->pdf_name = $origin->pdf_name;
            }
        }

        $record->save();

        if ($previousPath && $previousPath !== $record->pdf_path) {
            Storage::disk('local')->delete($previousPath);
        }

        return $record;
    }

    /**
     * Aprobación o devolución por un revisor. Nunca puede ser quien envió la revisión.
     *
     * @return string|SopVersion código de error o la revisión actualizada
     */
    public function review(SopVersion $version, User $actor, string $decision, ?string $note, array $marks = []): string|SopVersion
    {
        if ($version->status !== SopVersion::STATUS_PENDING) {
            return 'not-pending';
        }

        // La revisión la hace siempre otra persona: quien subió la versión no puede aprobarla ni devolverla.
        if ($version->submitted_by === $actor->id) {
            return 'own-version';
        }

        $note = trim((string) $note);

        if ($decision === 'reject' && $note === '' && $marks === []) {
            return 'note-required';
        }

        DB::transaction(function () use ($version, $actor, $decision, $note, $marks): void {
            $version->fill([
                'status' => $decision === 'approve' ? SopVersion::STATUS_APPROVED : SopVersion::STATUS_REJECTED,
                'reviewed_by' => $actor->id,
                'reviewed_by_name' => $actor->name,
                'reviewed_at' => now(),
                'review_note' => $note !== '' ? $note : null,
            ])->save();

            $version->reviews()->create([
                'round' => $version->review_round ?? 1,
                'decision' => $decision === 'approve' ? SopVersionReview::DECISION_APPROVED : SopVersionReview::DECISION_REJECTED,
                'note' => $note !== '' ? $note : null,
                'marks' => array_values($marks),
                'reviewer_id' => $actor->id,
                'reviewer_name' => $actor->name,
            ]);
        });

        return $version->load('reviews');
    }

    /** Cuántas versiones de esta persona están devueltas o esperando revisión (para el contador del menú). */
    public function summaryFor(User $actor): array
    {
        $mine = SopVersion::where('submitted_by', $actor->id);

        return [
            'returned' => (clone $mine)->where('status', SopVersion::STATUS_REJECTED)->count(),
            'pending' => (clone $mine)->where('status', SopVersion::STATUS_PENDING)->count(),
            'toReview' => SopVersion::where('status', SopVersion::STATUS_PENDING)->where(fn ($q) => $q->whereNull('submitted_by')->orWhere('submitted_by', '!=', $actor->id))->count(),
            'toPublish' => SopVersion::where('status', SopVersion::STATUS_APPROVED)->count(),
        ];
    }

    /**
     * Publicación de una revisión aprobada. Debe hacerla una tercera persona: ni quien la editó ni quien la revisó.
     *
     * @return string|SopVersion código de error o la revisión actualizada
     */
    public function publish(SopVersion $version, User $actor): string|SopVersion
    {
        if ($version->status !== SopVersion::STATUS_APPROVED) {
            return 'not-approved';
        }

        if ($version->submitted_by === $actor->id || $version->reviewed_by === $actor->id) {
            return 'same-person';
        }

        $version->fill([
            'status' => SopVersion::STATUS_PUBLISHED,
            'published_by' => $actor->id,
            'published_by_name' => $actor->name,
            'published_at' => now(),
        ])->save();

        return $version;
    }

    public function delete(SopVersion $version): void
    {
        DB::transaction(function () use ($version): void {
            SopCatalogEntry::whereKey($version->id)->delete();
            $version->delete();
        });

        if ($version->pdf_path) {
            Storage::disk('local')->delete($version->pdf_path);
        }
    }

    private function storePdf(string $versionId, UploadedFile $pdf): string
    {
        $path = "sop/versions/{$versionId}.pdf";
        Storage::disk('local')->putFileAs('sop/versions', $pdf, "{$versionId}.pdf");

        return $path;
    }
}
