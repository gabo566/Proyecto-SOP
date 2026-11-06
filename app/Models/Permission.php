<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

#[Fillable(['key', 'name'])]
class Permission extends Model
{
    public const USERS_MANAGE = 'users.manage';

    public const EVIDENCE_REVIEW = 'evidence.review';

    public const SOP_MANAGE = 'sop.manage';

    public const SOP_CREATE = 'sop.create';

    public const SOP_REVIEW = 'sop.review';

    public const SOP_PUBLISH = 'sop.publish';

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class);
    }
}
