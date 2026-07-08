<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\Log;

class Notifier
{
    /** Stage -> the role that must act next. */
    public static function roleForStatus(string $status): ?string
    {
        return match ($status) {
            'manager_review' => 'loan_manager',
            'gm_review' => 'general_manager',
            'md_review' => 'managing_director',
            'awaiting_disbursement' => 'finance_officer',
            default => null,
        };
    }

    /** Create a notification for specific user ids. */
    public static function toUsers(array $ids, string $type, string $title, string $message, ?string $link = null, array $data = []): void
    {
        foreach (array_unique(array_filter($ids)) as $id) {
            try {
                Notification::create([
                    'user_id' => $id, 'type' => $type, 'title' => $title,
                    'message' => $message, 'link' => $link, 'data' => $data,
                ]);
            } catch (\Exception $e) {
                Log::error('notify error: ' . $e->getMessage());
            }
        }
    }

    /** Notify every (active) user holding any of the given roles. */
    public static function toRoles($roles, string $type, string $title, string $message, ?string $link = null, array $data = [], ?int $excludeUserId = null): void
    {
        $ids = User::whereIn('role', (array) $roles)
            ->where('is_locked', false)
            ->pluck('id')->all();
        if ($excludeUserId) $ids = array_values(array_diff($ids, [$excludeUserId]));
        self::toUsers($ids, $type, $title, $message, $link, $data);
    }
}
