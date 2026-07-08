<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $items = Notification::where('user_id', $user->id)
            ->orderByDesc('created_at')->limit(30)->get();
        $unread = Notification::where('user_id', $user->id)->whereNull('read_at')->count();
        return response()->json(['notifications' => $items, 'unread_count' => $unread]);
    }

    public function markRead(Request $request, $id)
    {
        $n = Notification::where('user_id', $request->user()->id)->findOrFail($id);
        $n->read_at = $n->read_at ?? now();
        $n->save();
        return response()->json(['message' => 'ok']);
    }

    public function markAllRead(Request $request)
    {
        Notification::where('user_id', $request->user()->id)->whereNull('read_at')->update(['read_at' => now()]);
        return response()->json(['message' => 'ok']);
    }
}
