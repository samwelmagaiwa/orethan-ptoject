<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Loan;
use App\Models\LoanRestructure;
use App\Services\LoanRestructureService;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class LoanRestructureController extends Controller
{
    use ApiResponse;

    public function __construct(protected LoanRestructureService $service)
    {
    }

    private function guard(Request $request)
    {
        return $request->user()->canManageLoanLifecycle()
            ? null
            : $this->error('You are not authorized to perform loan-lifecycle actions', 403);
    }

    /** History of lifecycle actions on a loan. */
    public function history(Request $request, $loanId)
    {
        if ($r = $this->guard($request)) return $r;
        $records = LoanRestructure::with('performer:id,name')
            ->where('loan_id', $loanId)
            ->orderByDesc('created_at')
            ->get();
        return $this->success($records, 'Loan lifecycle history');
    }

    public function reschedule(Request $request, $loanId)
    {
        if ($r = $this->guard($request)) return $r;
        $data = $request->validate([
            'term_months' => 'required|integer|min:1|max:120',
            'frequency' => 'nullable|string',
            'interest_rate' => 'nullable|numeric|min:0|max:100',
            'start_date' => 'nullable|date',
            'notes' => 'nullable|string|max:1000',
        ]);
        return $this->run(fn() => $this->service->reschedule(Loan::findOrFail($loanId), $data, $request->user()), 'Loan rescheduled');
    }

    public function topUp(Request $request, $loanId)
    {
        if ($r = $this->guard($request)) return $r;
        $data = $request->validate([
            'amount' => 'required|numeric|min:1',
            'method' => 'nullable|string',
            'term_months' => 'nullable|integer|min:1|max:120',
            'interest_rate' => 'nullable|numeric|min:0|max:100',
            'start_date' => 'nullable|date',
            'date' => 'nullable|date',
            'notes' => 'nullable|string|max:1000',
        ]);
        return $this->run(fn() => $this->service->topUp(Loan::findOrFail($loanId), $data, $request->user()), 'Loan topped up');
    }

    public function writeOff(Request $request, $loanId)
    {
        if ($r = $this->guard($request)) return $r;
        $data = $request->validate([
            'reason' => 'required|string|max:1000',
            'date' => 'nullable|date',
            'notes' => 'nullable|string|max:1000',
        ]);
        return $this->run(fn() => $this->service->writeOff(Loan::findOrFail($loanId), $data, $request->user()), 'Loan written off');
    }

    private function run(callable $fn, string $message)
    {
        try {
            return $this->success($fn(), $message);
        } catch (\Throwable $e) {
            Log::error('Loan lifecycle action error: ' . $e->getMessage());
            return $this->error($e->getMessage(), 422);
        }
    }
}
