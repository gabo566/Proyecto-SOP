<?php

namespace App\Services;

use App\Models\SopCatalogEntry;
use App\Models\SopVersion;
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

        $record->fill([
            'document' => $version['document'],
            'procedures' => $version['procedures'],
            'created_by' => $record->created_by ?? $actor->id,
            'created_by_name' => $record->created_by_name ?? ($version['createdBy'] ?? $actor->name),
        ]);

        // Una revisión nueva nace «en revisión»: no puede habilitarse hasta que otra persona la apruebe y una tercera la publique.
        if ($isNew) {
            $record->fill([
                'status' => SopVersion::STATUS_PENDING,
                'submitted_by' => $actor->id,
                'submitted_by_name' => $actor->name,
                'submitted_at' => now(),
                'change_summary' => is_array($version['changeSummary'] ?? null) ? $version['changeSummary'] : null,
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
    public function review(SopVersion $version, User $actor, string $decision, ?string $note): string|SopVersion
    {
        if ($version->status !== SopVersion::STATUS_PENDING) {
            return 'not-pending';
        }

        if ($version->submitted_by === $actor->id) {
            return 'same-person';
        }

        $note = trim((string) $note);

        if ($decision === 'reject' && $note === '') {
            return 'note-required';
        }

        $version->fill([
            'status' => $decision === 'approve' ? SopVersion::STATUS_APPROVED : SopVersion::STATUS_REJECTED,
            'reviewed_by' => $actor->id,
            'reviewed_by_name' => $actor->name,
            'reviewed_at' => now(),
            'review_note' => $note !== '' ? $note : null,
        ])->save();

        return $version;
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
