<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\ProvisioningService;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ProvisioningController extends Controller
{
    use ApiResponse;

    public function __construct(protected ProvisioningService $provisioning)
    {
    }

    private function guard(Request $request)
    {
        return $request->user()->canAccessAccounting() ? null : $this->error('You do not have access to provisioning', 403);
    }

    public function preview(Request $request)
    {
        if ($r = $this->guard($request)) return $r;
        return $this->success($this->provisioning->preview(), 'Provisioning preview');
    }

    public function run(Request $request)
    {
        if ($r = $this->guard($request)) return $r;
        try {
            $result = $this->provisioning->run($request->user());
            return $this->success($result, $result['message']);
        } catch (\Exception $e) {
            Log::error('Provisioning run error: ' . $e->getMessage());
            return $this->error($e->getMessage(), 500);
        }
    }
}
