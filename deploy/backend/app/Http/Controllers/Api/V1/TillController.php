<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\TillService;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class TillController extends Controller
{
    use ApiResponse;

    public function __construct(protected TillService $till)
    {
    }

    private function guard(Request $request)
    {
        $u = $request->user();
        return ($u->isFinanceOfficer() || $u->isAdmin())
            ? null
            : $this->error('Only cashiers (Finance Officers) and admins can manage a till', 403);
    }

    /** Current open session + live cash position for the signed-in cashier. */
    public function status(Request $request)
    {
        if ($r = $this->guard($request)) return $r;
        return $this->success($this->till->snapshot($request->user()), 'Till status');
    }

    public function open(Request $request)
    {
        if ($r = $this->guard($request)) return $r;
        $data = $request->validate([
            'opening_float' => 'required|numeric|min:0',
            'notes' => 'nullable|string|max:1000',
        ]);
        try {
            $session = $this->till->open($request->user(), (float) $data['opening_float'], $data['notes'] ?? null);
            return $this->success($session, 'Till opened');
        } catch (\Throwable $e) {
            return $this->error($e->getMessage(), 422);
        }
    }

    public function close(Request $request)
    {
        if ($r = $this->guard($request)) return $r;
        $data = $request->validate([
            'counted_amount' => 'required|numeric|min:0|max:9999999999999',
            'notes' => 'nullable|string|max:1000',
        ]);
        try {
            $session = $this->till->close($request->user(), (float) $data['counted_amount'], $data['notes'] ?? null);
            return $this->success($session, 'Till closed');
        } catch (\Throwable $e) {
            Log::error('Till close error: ' . $e->getMessage());
            return $this->error($e->getMessage(), 422);
        }
    }

    /** Session history — own sessions for a cashier, all sessions for an admin. */
    public function history(Request $request)
    {
        if ($r = $this->guard($request)) return $r;
        $user = $request->user();
        $scope = $user->isAdmin() ? null : $user;
        return $this->success($this->till->history($scope), 'Till session history');
    }
}
