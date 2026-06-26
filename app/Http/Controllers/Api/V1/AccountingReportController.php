<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\AccountingService;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class AccountingReportController extends Controller
{
    use ApiResponse;

    public function __construct(protected AccountingService $accounting)
    {
    }

    private function authorize(Request $request)
    {
        return $request->user()->canAccessAccounting();
    }

    public function generalLedger(Request $request)
    {
        if (!$this->authorize($request)) {
            return $this->error('You do not have access to the General Ledger', 403);
        }

        $data = $request->validate([
            'account_id' => 'required|exists:chart_of_accounts,id',
            'from' => 'nullable|date',
            'to' => 'nullable|date',
        ]);

        try {
            $result = $this->accounting->generalLedger((int) $data['account_id'], $data['from'] ?? null, $data['to'] ?? null);
            return $this->success($result, 'General Ledger loaded');
        } catch (\Exception $e) {
            Log::error('generalLedger error: ' . $e->getMessage());
            return $this->error('Failed to load General Ledger', 500);
        }
    }

    public function trialBalance(Request $request)
    {
        if (!$this->authorize($request)) {
            return $this->error('You do not have access to the Trial Balance', 403);
        }

        $asOf = $request->validate(['as_of' => 'nullable|date'])['as_of'] ?? null;

        try {
            return $this->success($this->accounting->trialBalance($asOf), 'Trial Balance loaded');
        } catch (\Exception $e) {
            Log::error('trialBalance error: ' . $e->getMessage());
            return $this->error('Failed to load Trial Balance', 500);
        }
    }

    public function incomeStatement(Request $request)
    {
        if (!$this->authorize($request)) {
            return $this->error('You do not have access to the Income Statement', 403);
        }

        $data = $request->validate(['from' => 'nullable|date', 'to' => 'nullable|date']);

        try {
            return $this->success($this->accounting->incomeStatement($data['from'] ?? null, $data['to'] ?? null), 'Income Statement loaded');
        } catch (\Exception $e) {
            Log::error('incomeStatement error: ' . $e->getMessage());
            return $this->error('Failed to load Income Statement', 500);
        }
    }

    public function balanceSheet(Request $request)
    {
        if (!$this->authorize($request)) {
            return $this->error('You do not have access to the Balance Sheet', 403);
        }

        $asOf = $request->validate(['as_of' => 'nullable|date'])['as_of'] ?? null;

        try {
            return $this->success($this->accounting->balanceSheet($asOf), 'Balance Sheet loaded');
        } catch (\Exception $e) {
            Log::error('balanceSheet error: ' . $e->getMessage());
            return $this->error('Failed to load Balance Sheet', 500);
        }
    }

    public function cashBook(Request $request)
    {
        if (!$this->authorize($request)) {
            return $this->error('You do not have access to the Cash Book', 403);
        }

        $data = $request->validate(['from' => 'nullable|date', 'to' => 'nullable|date']);

        try {
            return $this->success($this->accounting->cashBook($data['from'] ?? null, $data['to'] ?? null), 'Cash Book loaded');
        } catch (\Exception $e) {
            Log::error('cashBook error: ' . $e->getMessage());
            return $this->error('Failed to load Cash Book', 500);
        }
    }
}
