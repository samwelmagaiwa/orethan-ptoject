<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    /** GET /activity-logs  — admin only, paginated + filterable */
    public function index(Request $request)
    {
        $actor = $request->user();
        if (!$actor || $actor->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $q = ActivityLog::query()->orderByDesc('created_at');

        if ($search = $request->query('search')) {
            $q->where(function ($sub) use ($search) {
                $sub->where('user_name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('module', 'like', "%{$search}%")
                    ->orWhere('record_label', 'like', "%{$search}%");
            });
        }

        if ($module = $request->query('module')) {
            $q->where('module', $module);
        }

        if ($action = $request->query('action')) {
            $q->where('action', $action);
        }

        if ($userId = $request->query('user_id')) {
            $q->where('user_id', $userId);
        }

        if ($date = $request->query('date')) {
            $q->whereDate('created_at', $date);
        }

        $logs = $q->paginate(50);

        // Who is online: last_seen_at within 5 minutes
        $online = User::whereNotNull('last_seen_at')
            ->where('last_seen_at', '>=', now()->subMinutes(5))
            ->get(['id', 'name', 'role', 'last_seen_at']);

        return response()->json([
            'logs'   => $logs,
            'online' => $online,
        ]);
    }

    /** GET /activity-logs/users  — list of users for filter dropdown */
    public function users(Request $request)
    {
        $actor = $request->user();
        if (!$actor || $actor->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $users = User::select('id', 'name', 'role')->orderBy('name')->get();
        return response()->json($users);
    }
}
