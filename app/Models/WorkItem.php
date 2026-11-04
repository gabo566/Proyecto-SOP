<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WorkItem extends Model
{
    public const STATUSES = [
        'En proceso',
        'Detenida',
        'Retrabajo requerido',
        'Retrabajo en proceso',
        'Pendiente de revisión',
        'Completado',
    ];

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];

    protected function casts(): array
    {
        return ['data' => 'array'];
    }
}
