<?php

namespace App\Services;

use App\Models\ActivityLog;
use Illuminate\Support\Facades\Log;

class ActivityLogger
{
    public static function log(
        ?object $actor,
        string  $action,
        string  $module,
        string  $description,
        ?int    $recordId    = null,
        ?string $recordLabel = null,
        ?string $ip          = null,
    ): void {
        try {
            ActivityLog::create([
                'user_id'      => $actor?->id,
                'user_name'    => $actor?->name ?? 'System',
                'user_role'    => $actor?->role ?? null,
                'action'       => $action,
                'module'       => $module,
                'record_id'    => $recordId,
                'record_label' => $recordLabel,
                'description'  => $description,
                'ip_address'   => $ip ?? request()->ip(),
            ]);
        } catch (\Throwable $e) {
            Log::error('ActivityLogger::log failed: ' . $e->getMessage());
        }
    }
}
