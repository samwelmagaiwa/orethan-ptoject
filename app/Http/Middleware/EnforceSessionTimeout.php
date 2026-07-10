<?php

namespace App\Http\Middleware;

use App\Models\LoanSetting;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

/**
 * Tracks the last API activity per user token and returns 401 SESSION_EXPIRED
 * when the idle period exceeds the admin-configured session_timeout_minutes.
 *
 * Cache key: session_activity_{token_id}
 * Exempt: login, register, public loan-settings read, OTP endpoints.
 */
class EnforceSessionTimeout
{
    private const EXEMPT_PATTERNS = [
        'api/login',
        'api/register',
        'api/forgot-password',
        'api/verify-otp',
        'api/reset-password',
        'api/loan-settings',   // public — calculator uses this unauthenticated
    ];

    public function handle(Request $request, Closure $next): Response
    {
        // Only applies to authenticated requests
        $user = $request->user();
        if (!$user) {
            return $next($request);
        }

        // Skip exempt public routes
        foreach (self::EXEMPT_PATTERNS as $pattern) {
            if ($request->is($pattern) || $request->is($pattern . '/*')) {
                return $next($request);
            }
        }

        $token  = $request->bearerToken();
        $cacheKey = 'session_activity_' . md5($token ?? $user->id);

        $timeoutMinutes = (int) (LoanSetting::current()->session_timeout_minutes ?? 30);
        $timeoutSeconds = max(60, $timeoutMinutes * 60);

        $lastActivity = Cache::get($cacheKey);

        if ($lastActivity !== null && (time() - $lastActivity) > $timeoutSeconds) {
            // Expire the Sanctum token so it can't be reused
            if ($user->currentAccessToken()) {
                $user->currentAccessToken()->delete();
            }
            Cache::forget($cacheKey);

            return response()->json([
                'message'   => 'SESSION_EXPIRED',
                'reason'    => 'Idle timeout exceeded',
                'timeout'   => $timeoutMinutes,
            ], 401);
        }

        // Refresh activity timestamp on every valid request
        Cache::put($cacheKey, time(), $timeoutSeconds + 60);

        return $next($request);
    }
}
