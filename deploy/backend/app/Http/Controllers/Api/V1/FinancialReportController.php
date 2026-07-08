<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Loan;
use App\Models\Repayment;
use App\Services\AccountingService;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class FinancialReportController extends Controller
{
    use ApiResponse;

    const DEFAULT_DAYS = 90;

    public function __construct(protected AccountingService $accounting)
    {
    }

    /**
     * High-level KPIs for leadership: portfolio size, disbursed/collected this
     * period, active loans, NPL ratio (PAR90), and net income for the period.
     */
    public function executiveSummary(Request $request)
    {
        if (!$request->user()->canAccessAccounting()) {
            return $this->error('You do not have access to Financial Reports', 403);
        }

        $data = $request->validate(['from' => 'nullable|date', 'to' => 'nullable|date']);
        $from = $data['from'] ?? now()->startOfMonth()->toDateString();
        $to = $data['to'] ?? now()->toDateString();

        try {
            $totalOutstanding = (float) Loan::whereNotNull('disbursed_at')->sum('remaining_balance');
            $totalPortfolio = (float) Loan::whereNotNull('disbursed_at')->sum('amount');

            $disbursedThisPeriod = (float) Loan::whereNotNull('disbursed_at')
                ->whereDate('disbursed_at', '>=', $from)->whereDate('disbursed_at', '<=', $to)
                ->sum('amount');

            $collectedThisPeriod = (float) Repayment::where('status', 'completed')
                ->whereDate('payment_date', '>=', $from)->whereDate('payment_date', '<=', $to)
                ->sum('amount');

            $activeLoans = Loan::whereNotNull('disbursed_at')->whereIn('payment_status', ['pending', 'partial'])->count();
            $completedLoans = Loan::where('payment_status', 'completed')->count();

            $par90Outstanding = (float) Loan::whereNotNull('disbursed_at')
                ->whereHas('schedules', function ($q) {
                    $q->where('status', '!=', 'paid')
                        ->whereDate('due_date', '<=', now()->subDays(self::DEFAULT_DAYS)->toDateString());
                })->sum('remaining_balance');
            $nplRatio = $totalOutstanding > 0 ? round(($par90Outstanding / $totalOutstanding) * 100, 2) : 0;

            $incomeStatement = $this->accounting->incomeStatement($from, $to);

            return $this->success([
                'from' => $from,
                'to' => $to,
                'total_portfolio' => round($totalPortfolio),
                'total_outstanding' => round($totalOutstanding),
                'disbursed_this_period' => round($disbursedThisPeriod),
                'collected_this_period' => round($collectedThisPeriod),
                'active_loans' => $activeLoans,
                'completed_loans' => $completedLoans,
                'npl_ratio' => $nplRatio,
                'total_income_this_period' => $incomeStatement['total_income'],
                'total_expense_this_period' => $incomeStatement['total_expense'],
                'net_income_this_period' => $incomeStatement['net_income'],
            ], 'Executive Summary loaded');
        } catch (\Exception $e) {
            Log::error('executiveSummary error: ' . $e->getMessage());
            return $this->error('Failed to load Executive Summary', 500);
        }
    }

    /**
     * Collections breakdown: totals, by payment method, and a monthly trend.
     */
    public function collectionsReport(Request $request)
    {
        if (!$request->user()->canAccessAccounting()) {
            return $this->error('You do not have access to Financial Reports', 403);
        }

        $data = $request->validate(['from' => 'nullable|date', 'to' => 'nullable|date']);
        $from = $data['from'] ?? now()->subMonths(6)->startOfMonth()->toDateString();
        $to = $data['to'] ?? now()->toDateString();

        try {
            $totalCollected = (float) Repayment::where('status', 'completed')
                ->whereDate('payment_date', '>=', $from)->whereDate('payment_date', '<=', $to)
                ->sum('amount');

            $byMethod = Repayment::where('status', 'completed')
                ->whereDate('payment_date', '>=', $from)->whereDate('payment_date', '<=', $to)
                ->selectRaw('payment_method, COUNT(*) as count, SUM(amount) as total')
                ->groupBy('payment_method')
                ->get()
                ->map(fn($r) => ['method' => $r->payment_method, 'count' => (int) $r->count, 'total' => round((float) $r->total)]);

            $monthlyTrend = Repayment::where('status', 'completed')
                ->whereDate('payment_date', '>=', $from)->whereDate('payment_date', '<=', $to)
                ->selectRaw("DATE_FORMAT(payment_date, '%Y-%m') as month, COUNT(*) as count, SUM(amount) as total")
                ->groupBy('month')
                ->orderBy('month')
                ->get()
                ->map(fn($r) => ['month' => $r->month, 'count' => (int) $r->count, 'total' => round((float) $r->total)]);

            return $this->success([
                'from' => $from,
                'to' => $to,
                'total_collected' => round($totalCollected),
                'by_method' => $byMethod,
                'monthly_trend' => $monthlyTrend,
            ], 'Collections Report loaded');
        } catch (\Exception $e) {
            Log::error('collectionsReport error: ' . $e->getMessage());
            return $this->error('Failed to load Collections Report', 500);
        }
    }

    /**
     * Interest income collected over time (Repayment.interest_amount, populated
     * automatically since the Accounting Module went live).
     */
    public function interestIncomeReport(Request $request)
    {
        if (!$request->user()->canAccessAccounting()) {
            return $this->error('You do not have access to Financial Reports', 403);
        }

        $data = $request->validate(['from' => 'nullable|date', 'to' => 'nullable|date']);
        $from = $data['from'] ?? now()->subMonths(6)->startOfMonth()->toDateString();
        $to = $data['to'] ?? now()->toDateString();

        try {
            $total = (float) Repayment::where('status', 'completed')
                ->whereDate('payment_date', '>=', $from)->whereDate('payment_date', '<=', $to)
                ->sum('interest_amount');

            $monthlyTrend = Repayment::where('status', 'completed')
                ->whereDate('payment_date', '>=', $from)->whereDate('payment_date', '<=', $to)
                ->selectRaw("DATE_FORMAT(payment_date, '%Y-%m') as month, SUM(interest_amount) as total")
                ->groupBy('month')
                ->orderBy('month')
                ->get()
                ->map(fn($r) => ['month' => $r->month, 'total' => round((float) $r->total)]);

            return $this->success([
                'from' => $from,
                'to' => $to,
                'total_interest_income' => round($total),
                'monthly_trend' => $monthlyTrend,
            ], 'Interest Income Report loaded');
        } catch (\Exception $e) {
            Log::error('interestIncomeReport error: ' . $e->getMessage());
            return $this->error('Failed to load Interest Income Report', 500);
        }
    }

    /**
     * Penalties collected (Repayment.penalty_amount). Note: the repayment flow
     * does not currently let a Finance Officer earmark part of a payment as a
     * penalty, so this will read 0 until that capability is added -- it is not
     * fabricated/estimated here.
     */
    public function penaltiesReport(Request $request)
    {
        if (!$request->user()->canAccessAccounting()) {
            return $this->error('You do not have access to Financial Reports', 403);
        }

        $data = $request->validate(['from' => 'nullable|date', 'to' => 'nullable|date']);
        $from = $data['from'] ?? now()->subMonths(6)->startOfMonth()->toDateString();
        $to = $data['to'] ?? now()->toDateString();

        try {
            $total = (float) Repayment::where('status', 'completed')
                ->whereDate('payment_date', '>=', $from)->whereDate('payment_date', '<=', $to)
                ->sum('penalty_amount');

            $monthlyTrend = Repayment::where('status', 'completed')
                ->whereDate('payment_date', '>=', $from)->whereDate('payment_date', '<=', $to)
                ->selectRaw("DATE_FORMAT(payment_date, '%Y-%m') as month, SUM(penalty_amount) as total")
                ->groupBy('month')
                ->orderBy('month')
                ->get()
                ->map(fn($r) => ['month' => $r->month, 'total' => round((float) $r->total)]);

            return $this->success([
                'from' => $from,
                'to' => $to,
                'total_penalties_collected' => round($total),
                'monthly_trend' => $monthlyTrend,
            ], 'Penalties Report loaded');
        } catch (\Exception $e) {
            Log::error('penaltiesReport error: ' . $e->getMessage());
            return $this->error('Failed to load Penalties Report', 500);
        }
    }

    /**
     * Profit & Loss for a period -- delegates to the same Income Statement engine
     * used by the Accounting Module so the two never disagree.
     */
    public function profitAndLoss(Request $request)
    {
        if (!$request->user()->canAccessAccounting()) {
            return $this->error('You do not have access to Financial Reports', 403);
        }

        $data = $request->validate(['from' => 'nullable|date', 'to' => 'nullable|date']);

        try {
            return $this->success($this->accounting->incomeStatement($data['from'] ?? null, $data['to'] ?? null), 'Profit & Loss loaded');
        } catch (\Exception $e) {
            Log::error('profitAndLoss error: ' . $e->getMessage());
            return $this->error('Failed to load Profit & Loss', 500);
        }
    }
}
