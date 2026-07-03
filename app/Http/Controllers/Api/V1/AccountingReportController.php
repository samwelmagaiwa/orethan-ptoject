<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ChartOfAccount;
use App\Models\JournalEntryLine;
use App\Services\AccountingService;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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

    /**
     * Branch Report Summary — per-day GL aggregates for the period.
     * Accessible to all authenticated roles (Loan Officers need this for Branch Reports).
     *
     * Returns:
     *   daily[date] = { mapato, matumizi, mkopo, kutoka_benki, kwenda_benki }
     *   closing_cash  — Cash on Hand (1010) balance as of period end
     *   closing_bank  — Bank Account (1020) balance as of period end
     */
    public function branchSummary(Request $request)
    {
        $data = $request->validate([
            'from' => 'required|date',
            'to'   => 'required|date|after_or_equal:from',
        ]);

        $from = $data['from'];
        $to   = $data['to'];

        try {
            // Pull all relevant journal entry lines for the period, joined with entry date + account info
            $rows = DB::table('journal_entry_lines as jel')
                ->join('journal_entries as je',   'je.id',  '=', 'jel.journal_entry_id')
                ->join('chart_of_accounts as coa','coa.id', '=', 'jel.account_id')
                ->whereBetween('je.entry_date', [$from, $to])
                ->where('je.status', '!=', 'reversed')
                ->select(
                    'je.entry_date as date',
                    'coa.type',
                    'coa.code',
                    'coa.normal_balance',
                    DB::raw('COALESCE(jel.debit,0)  as debit'),
                    DB::raw('COALESCE(jel.credit,0) as credit')
                )
                ->get();

            // Aggregate per day
            $daily = [];
            foreach ($rows as $row) {
                $date = $row->date;
                if (!isset($daily[$date])) {
                    $daily[$date] = [
                        'mapato'       => 0,
                        'matumizi'     => 0,
                        'mkopo'        => 0,
                        'kutoka_benki' => 0,
                        'kwenda_benki' => 0,
                    ];
                }

                // Income accounts (4xxx) — credit side = revenue earned
                if ($row->type === 'income') {
                    $daily[$date]['mapato'] += (float) $row->credit;
                }

                // Expense accounts (5xxx) — debit side = cost incurred
                if ($row->type === 'expense') {
                    $daily[$date]['matumizi'] += (float) $row->debit;
                }

                // Loans Receivable (1100) — debit = new loan disbursed
                if ($row->code === '1100') {
                    $daily[$date]['mkopo'] += (float) $row->debit;
                }

                // Bank Account (1020) — credit = cash pulled FROM bank; debit = cash pushed TO bank
                if ($row->code === '1020') {
                    $daily[$date]['kutoka_benki'] += (float) $row->credit;
                    $daily[$date]['kwenda_benki'] += (float) $row->debit;
                }
            }

            // Round all values
            foreach ($daily as $d => &$v) {
                foreach ($v as $k => $amount) {
                    $v[$k] = round($amount, 2);
                }
            }

            // Closing balances of cash-type accounts as of period end
            $cashAccount  = ChartOfAccount::where('code', '1010')->first();
            $bankAccount  = ChartOfAccount::where('code', '1020')->first();

            return $this->success([
                'from'         => $from,
                'to'           => $to,
                'daily'        => $daily,
                'closing_cash' => $cashAccount ? round($cashAccount->balance($to), 2) : 0,
                'closing_bank' => $bankAccount ? round($bankAccount->balance($to), 2) : 0,
            ], 'Branch accounting summary loaded');

        } catch (\Exception $e) {
            Log::error('branchSummary error: ' . $e->getMessage());
            return $this->error('Failed to load branch summary', 500);
        }
    }
}
