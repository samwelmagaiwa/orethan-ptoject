<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Loan;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class RiskReportController extends Controller
{
    use ApiResponse;

    const DEFAULT_DAYS = 90;

    /**
     * Portfolio at Risk (PAR1/30/60/90): outstanding balance of every disbursed
     * loan with at least one installment overdue by >= N days, as a percentage
     * of the total outstanding portfolio.
     */
    public function parSummary(Request $request)
    {
        if (!$request->user()->canAccessAccounting()) {
            return $this->error('You do not have access to Risk Reports', 403);
        }

        try {
            $totalOutstanding = (float) Loan::whereNotNull('disbursed_at')->sum('remaining_balance');

            $buckets = [1, 30, 60, 90];
            $par = [];
            foreach ($buckets as $days) {
                $amount = $this->outstandingBalanceOverdueBy($days);
                $par['par' . $days] = [
                    'days' => $days,
                    'outstanding_at_risk' => round($amount),
                    'percentage' => $totalOutstanding > 0 ? round(($amount / $totalOutstanding) * 100, 2) : 0,
                ];
            }

            $riskCounts = [
                'low' => 0,    // 1-30 DPD
                'medium' => 0, // 31-60 DPD
                'high' => 0,   // 61-90 DPD
                'critical' => 0, // 90+ DPD
            ];
            $loans = Loan::whereNotNull('disbursed_at')
                ->whereHas('schedules', fn($q) => $q->where('status', '!=', 'paid')->whereDate('due_date', '<', now()->toDateString()))
                ->with(['schedules' => fn($q) => $q->where('status', '!=', 'paid')->whereDate('due_date', '<', now()->toDateString())->orderBy('due_date')])
                ->get();

            foreach ($loans as $loan) {
                $earliest = $loan->schedules->first();
                if (!$earliest) continue;
                $dpd = Carbon::parse($earliest->due_date)->diffInDays(now());
                if ($dpd <= 30) $riskCounts['low']++;
                elseif ($dpd <= 60) $riskCounts['medium']++;
                elseif ($dpd <= 90) $riskCounts['high']++;
                else $riskCounts['critical']++;
            }

            return $this->success([
                'total_outstanding_portfolio' => round($totalOutstanding),
                'par' => $par,
                'risk_distribution' => $riskCounts,
            ], 'PAR Summary loaded');
        } catch (\Exception $e) {
            Log::error('parSummary error: ' . $e->getMessage());
            return $this->error('Failed to load PAR Summary', 500);
        }
    }

    private function outstandingBalanceOverdueBy(int $minDpd): float
    {
        $cutoff = now()->subDays($minDpd)->toDateString();
        return (float) Loan::whereNotNull('disbursed_at')
            ->whereHas('schedules', function ($q) use ($cutoff) {
                $q->where('status', '!=', 'paid')->whereDate('due_date', '<=', $cutoff);
            })
            ->sum('remaining_balance');
    }

    /**
     * Default analysis: loans with an installment overdue beyond DEFAULT_DAYS,
     * grouped by disbursement cohort month, with the default rate per cohort.
     */
    public function defaultAnalysis(Request $request)
    {
        if (!$request->user()->canAccessAccounting()) {
            return $this->error('You do not have access to Risk Reports', 403);
        }

        try {
            $defaultedLoans = Loan::with('customer')
                ->whereNotNull('disbursed_at')
                ->whereHas('schedules', function ($q) {
                    $q->where('status', '!=', 'paid')
                        ->whereDate('due_date', '<', now()->subDays(self::DEFAULT_DAYS)->toDateString());
                })->get();

            $defaultedIds = $defaultedLoans->pluck('id')->all();

            $cohorts = Loan::whereNotNull('disbursed_at')
                ->selectRaw("DATE_FORMAT(disbursed_at, '%Y-%m') as cohort, COUNT(*) as disbursed_count, SUM(amount) as disbursed_amount")
                ->groupBy('cohort')
                ->orderBy('cohort')
                ->get();

            $defaultedByCohort = Loan::whereIn('id', $defaultedIds)
                ->selectRaw("DATE_FORMAT(disbursed_at, '%Y-%m') as cohort, COUNT(*) as defaulted_count, SUM(remaining_balance) as defaulted_amount")
                ->groupBy('cohort')
                ->get()
                ->keyBy('cohort');

            $rows = $cohorts->map(function ($cohort) use ($defaultedByCohort) {
                $defaulted = $defaultedByCohort->get($cohort->cohort);
                $defaultedCount = $defaulted->defaulted_count ?? 0;
                $defaultedAmount = (float) ($defaulted->defaulted_amount ?? 0);

                return [
                    'cohort' => $cohort->cohort,
                    'disbursed_count' => (int) $cohort->disbursed_count,
                    'disbursed_amount' => round((float) $cohort->disbursed_amount),
                    'defaulted_count' => (int) $defaultedCount,
                    'defaulted_amount' => round($defaultedAmount),
                    'default_rate_by_count' => $cohort->disbursed_count > 0 ? round(($defaultedCount / $cohort->disbursed_count) * 100, 2) : 0,
                    'default_rate_by_amount' => $cohort->disbursed_amount > 0 ? round(($defaultedAmount / $cohort->disbursed_amount) * 100, 2) : 0,
                ];
            })->values();

            $totalDisbursedCount = $cohorts->sum('disbursed_count');
            $totalDisbursedAmount = (float) $cohorts->sum('disbursed_amount');
            $totalDefaultedAmount = round((float) $defaultedLoans->sum('remaining_balance'));

            return $this->success([
                'cohorts' => $rows,
                'overall' => [
                    'defaulted_loans' => $defaultedLoans->count(),
                    'defaulted_amount' => $totalDefaultedAmount,
                    'default_rate_by_count' => $totalDisbursedCount > 0 ? round(($defaultedLoans->count() / $totalDisbursedCount) * 100, 2) : 0,
                    'default_rate_by_amount' => $totalDisbursedAmount > 0 ? round(($totalDefaultedAmount / $totalDisbursedAmount) * 100, 2) : 0,
                ],
                'defaulted_loans' => $defaultedLoans->map(fn($loan) => [
                    'loan_id' => $loan->id,
                    'loan_number' => $loan->loan_account_number,
                    'borrower' => $loan->name,
                    'disbursed_at' => optional($loan->disbursed_at)->toDateString(),
                    'amount' => round((float) $loan->amount),
                    'remaining_balance' => round((float) $loan->remaining_balance),
                ])->values(),
            ], 'Default Analysis loaded');
        } catch (\Exception $e) {
            Log::error('defaultAnalysis error: ' . $e->getMessage());
            return $this->error('Failed to load Default Analysis', 500);
        }
    }

    /**
     * PAR Aging Ladder: bucket overdue loans into 1-30 / 31-60 / 61-90 / 90+ DPD.
     * Returns summary per bucket + per-loan detail for drill-down.
     * GET /reports/par-aging
     */
    public function parAging(Request $request)
    {
        if (!$request->user()->canAccessAccounting()) {
            return $this->error('Forbidden', 403);
        }

        try {
            $today = now()->toDateString();

            // All active/disbursed loans with at least one unpaid overdue installment
            $loans = Loan::whereIn('status', ['disbursed', 'active'])
                ->whereHas('schedules', fn($q) =>
                    $q->where('status', '!=', 'paid')->whereDate('due_date', '<', $today)
                )
                ->with([
                    'customer:id,full_name,phone_number',
                    'user:id,name',
                    'schedules' => fn($q) =>
                        $q->where('status', '!=', 'paid')->whereDate('due_date', '<', $today)->orderBy('due_date'),
                ])
                ->get();

            $totalOutstanding = (float) Loan::whereIn('status', ['disbursed', 'active'])->sum('remaining_balance');

            $buckets = [
                '1_30'  => ['label' => '1–30 Siku',  'min' => 1,  'max' => 30,  'loans' => [], 'count' => 0, 'outstanding' => 0],
                '31_60' => ['label' => '31–60 Siku', 'min' => 31, 'max' => 60,  'loans' => [], 'count' => 0, 'outstanding' => 0],
                '61_90' => ['label' => '61–90 Siku', 'min' => 61, 'max' => 90,  'loans' => [], 'count' => 0, 'outstanding' => 0],
                '90+'   => ['label' => '90+ Siku',   'min' => 91, 'max' => PHP_INT_MAX, 'loans' => [], 'count' => 0, 'outstanding' => 0],
            ];

            foreach ($loans as $loan) {
                $earliest = $loan->schedules->first();
                if (!$earliest) continue;

                $dpd = (int) Carbon::parse($earliest->due_date)->diffInDays($today);
                $outstanding = (float) $loan->remaining_balance;
                $officerName = $loan->user?->name ?? ($loan->officer_name ?? '—');

                $row = [
                    'loan_id'       => $loan->id,
                    'loan_number'   => $loan->loan_account_number,
                    'borrower'      => $loan->customer?->full_name ?? $loan->name,
                    'phone'         => $loan->customer?->phone_number ?? $loan->phone,
                    'officer'       => $officerName,
                    'amount'        => round((float) $loan->amount),
                    'outstanding'   => round($outstanding),
                    'dpd'           => $dpd,
                    'overdue_since' => $earliest->due_date,
                    'status'        => $loan->status,
                ];

                foreach ($buckets as $key => &$bucket) {
                    if ($dpd >= $bucket['min'] && $dpd <= $bucket['max']) {
                        $bucket['loans'][]     = $row;
                        $bucket['count']++;
                        $bucket['outstanding'] += $outstanding;
                        break;
                    }
                }
                unset($bucket);
            }

            // Build summary (strip loans array from summary)
            $summary = [];
            foreach ($buckets as $key => $bucket) {
                $summary[$key] = [
                    'label'       => $bucket['label'],
                    'count'       => $bucket['count'],
                    'outstanding' => round($bucket['outstanding']),
                    'par_pct'     => $totalOutstanding > 0
                        ? round(($bucket['outstanding'] / $totalOutstanding) * 100, 2) : 0,
                    'loans'       => $bucket['loans'],
                ];
            }

            return $this->success([
                'total_outstanding_portfolio' => round($totalOutstanding),
                'total_at_risk'   => round($loans->sum('remaining_balance')),
                'total_at_risk_count' => $loans->count(),
                'buckets'         => $summary,
                'as_of'           => $today,
            ]);
        } catch (\Exception $e) {
            Log::error('parAging error: ' . $e->getMessage());
            return $this->error('Failed to load PAR Aging', 500);
        }
    }
}
