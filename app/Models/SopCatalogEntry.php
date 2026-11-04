<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SopCatalogEntry extends Model
{
    protected $table = 'sop_catalog';

    protected $primaryKey = 'version_id';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];

    protected function casts(): array
    {
        return ['enabled' => 'boolean'];
    }
}
