<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    protected $fillable = [
        'user_id',
        'user_name',
        'action',
        'auditable_type',
        'auditable_id',
        'description',
        'metadata',
        'branch',
        'ip_address',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Convenience recorder for audit-trail entries.
     */
    public static function record(string $action, $user, $auditable = null, ?string $description = null, array $metadata = [], ?string $branch = null): self
    {
        return self::create([
            'user_id' => $user->id ?? null,
            'user_name' => $user->name ?? 'System',
            'action' => $action,
            'auditable_type' => $auditable ? get_class($auditable) : null,
            'auditable_id' => $auditable->id ?? null,
            'description' => $description,
            'metadata' => $metadata,
            'branch' => $branch,
            'ip_address' => request()->ip(),
        ]);
    }
}
