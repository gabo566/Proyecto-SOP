<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SopVersion extends Model
{
    /** Enviada por quien la editó; falta que otra persona la revise. */
    public const STATUS_PENDING = 'pending_review';

    /** Aprobada por un revisor; falta que una tercera persona la publique. */
    public const STATUS_APPROVED = 'approved';

    /** Devuelta por el revisor con comentarios. */
    public const STATUS_REJECTED = 'rejected';

    /** Ya puede habilitarse para los operadores. */
    public const STATUS_PUBLISHED = 'published';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'document' => 'array',
            'procedures' => 'array',
            'change_summary' => 'array',
            'submitted_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'published_at' => 'datetime',
        ];
    }

    /**
     * Misma forma que guardaba IndexedDB; el PDF pasa de blob a una URL.
     *
     * @return array<string, mixed>
     */
    public function toClientArray(): array
    {
        return [
            'id' => $this->id,
            'document' => $this->document,
            'procedures' => $this->procedures,
            'createdAt' => $this->created_at?->toIso8601String(),
            'createdBy' => $this->created_by_name,
            'status' => $this->status ?? self::STATUS_PUBLISHED,
            'submittedBy' => $this->submitted_by_name,
            'submittedById' => $this->submitted_by,
            'submittedAt' => $this->submitted_at?->toIso8601String(),
            'reviewedBy' => $this->reviewed_by_name,
            'reviewedById' => $this->reviewed_by,
            'reviewedAt' => $this->reviewed_at?->toIso8601String(),
            'reviewNote' => $this->review_note,
            'publishedBy' => $this->published_by_name,
            'publishedById' => $this->published_by,
            'publishedAt' => $this->published_at?->toIso8601String(),
            'changeSummary' => $this->change_summary,
            'pdf' => $this->pdf_path ? [
                'name' => $this->pdf_name,
                'url' => "/api/sop-versions/{$this->id}/pdf",
                'versionId' => $this->id,
            ] : null,
        ];
    }
}
