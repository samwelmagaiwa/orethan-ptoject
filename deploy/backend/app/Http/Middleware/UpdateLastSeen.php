<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class UpdateLastSeen
{
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);

        $user = $request->user();
        if ($user) {
            // Throttle DB writes: update at most once per 60 seconds per user
            $cacheKey = "last_seen_{$user->id}";
            if (!Cache::has($cacheKey)) {
                $user->timestamps = false;
                $user->last_seen_at = now();
                $user->save();
                Cache::put($cacheKey, true, 60);
            }
        }

        return $response;
    }
}
