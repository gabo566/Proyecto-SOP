<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SopVersion extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'document' => 'array',
            'procedures' => 'array',
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
            'pdf' => $this->pdf_path ? [
                'name' => $this->pdf_name,
                'url' => "/api/sop-versions/{$this->id}/pdf",
                'versionId' => $this->id,
            ] : null,
        ];
    }
}
