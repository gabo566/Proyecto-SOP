<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EvidenceFile extends Model
{
    public const MIME_EXTENSIONS = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];
}
