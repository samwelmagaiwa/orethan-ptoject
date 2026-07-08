<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\InterestAccrualService;
use App\Traits\ApiResponse;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class InterestAccrualController extends Controller
{
    use ApiResponse;

    public function __construct(protected InterestAccrualService $service)
    {
    }

    private function guard(Request $request)
    {
        return $request->user()->canAccessAccounting() ? null : $this->error('You do not have access to interest accrual', 403);
    }

    public function preview(Request $request)
    {
        if ($r = $this->guard($request)) return $r;
        $date = $request->query('date') ? Carbon::parse($request->query('date')) : null;
        return $this->success($this->service->preview($date), 'Interest accrual preview');
    }

    public function run(Request $request)
    {
        if ($r = $this->guard($request)) return $r;
        try {
            $date = $request->input('date') ? Carbon::parse($request->input('date')) : null;
            $result = $this->service->accrue($date, $request->user());
            return $this->success($result, $result['message']);
        } catch (\Throwable $e) {
            Log::error('Interest accrual error: ' . $e->getMessage());
            return $this->error($e->getMessage(), 500);
        }
    }
}
