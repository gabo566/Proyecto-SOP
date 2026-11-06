<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Una ronda de revisión de una versión de SOP: decisión, nota y marcas del revisor sobre las hojas. */
class SopVersionReview extends Model
{
    public const DECISION_APPROVED = 'approved';

    public const DECISION_REJECTED = 'rejected';

    protected $guarded = [];

    protected function casts(): array
    {
        return ['marks' => 'array'];
    }

    /** @return array<string, mixed> */
    public function toClientArray(): array
    {
        return [
            'id' => $this->id,
            'round' => $this->round,
            'decision' => $this->decision,
            'note' => $this->note,
            'marks' => $this->marks ?? [],
            'reviewerId' => $this->reviewer_id,
            'reviewerName' => $this->reviewer_name,
            'at' => $this->created_at?->toIso8601String(),
        ];
    }
}
