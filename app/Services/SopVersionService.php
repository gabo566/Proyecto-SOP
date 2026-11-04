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

        $record->fill([
            'document' => $version['document'],
            'procedures' => $version['procedures'],
            'created_by' => $record->created_by ?? $actor->id,
            'created_by_name' => $record->created_by_name ?? ($version['createdBy'] ?? $actor->name),
        ]);

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
