<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Loan;
use App\Models\LoanSetting;

class RiskRatingService
{
    /**
     * Score a customer (0–100, higher = lower risk) and persist result.
     */
    public function score(Customer $customer): array
    {
        $loans = Loan::where(function ($q) use ($customer) {
            $q->where('customer_id', $customer->id)
              ->orWhere('phone', $customer->phone_number);
        })->get();

        $activeLoans    = $loans->whereIn('status', ['disbursed', 'active', 'manager_review', 'gm_review', 'md_review']);
        $closedLoans    = $loans->whereIn('status', ['closed', 'fully_paid']);
        $writtenOff     = $loans->where('status', 'written_off')->count();
        $totalLoans     = $loans->count();

        // ── Factor 1: Repayment history (0–35 pts) ───────────────────────────
        $repaymentPts = 35;
        if ($totalLoans === 0) {
            $repaymentPts = 20; // No history — moderate score
        } else {
            $overdueCount = $loans->filter(fn($l) => $l->days_overdue > 0)->count();
            $overdueRatio = $totalLoans ? $overdueCount / $totalLoans : 0;
            $repaymentPts = (int) round(35 * (1 - $overdueRatio));
        }

        // ── Factor 2: Current arrears severity (0–25 pts) ───────────────────
        $arrearsPts = 25;
        $maxDaysOverdue = $activeLoans->max('days_overdue') ?? 0;
        if ($maxDaysOverdue > 90)      $arrearsPts = 0;
        elseif ($maxDaysOverdue > 60)  $arrearsPts = 5;
        elseif ($maxDaysOverdue > 30)  $arrearsPts = 10;
        elseif ($maxDaysOverdue > 0)   $arrearsPts = 18;

        // ── Factor 3: Write-offs (0–20 pts) ─────────────────────────────────
        $writeOffPts = 20;
        if ($writtenOff >= 2)     $writeOffPts = 0;
        elseif ($writtenOff == 1) $writeOffPts = 5;

        // ── Factor 4: Loan count (activity — 0–10 pts) ──────────────────────
        $activityPts = min(10, $totalLoans * 2);

        // ── Factor 5: Closed/paid loans ratio (0–10 pts) ────────────────────
        $closedRatio = $totalLoans ? $closedLoans->count() / $totalLoans : 0;
        $closedPts   = (int) round(10 * $closedRatio);

        $score = $repaymentPts + $arrearsPts + $writeOffPts + $activityPts + $closedPts;
        $score = max(0, min(100, $score));

        // ── Grade & suggested rate ───────────────────────────────────────────
        $baseRate = (float) LoanSetting::current()->default_interest_rate;
        [$grade, $adjustment] = match(true) {
            $score >= 85 => ['A', -1.0],
            $score >= 70 => ['B', -0.5],
            $score >= 55 => ['C',  0.0],
            $score >= 40 => ['D', +1.0],
            default      => ['E', +2.0],
        };
        $suggestedRate = max(0.5, $baseRate + $adjustment);

        $factors = [
            'repayment_history' => $repaymentPts,
            'arrears_severity'  => $arrearsPts,
            'write_offs'        => $writeOffPts,
            'loan_activity'     => $activityPts,
            'closed_loans'      => $closedPts,
            'total_loans'       => $totalLoans,
            'max_days_overdue'  => $maxDaysOverdue,
            'write_off_count'   => $writtenOff,
        ];

        $customer->update([
            'risk_score'            => $score,
            'risk_grade'            => $grade,
            'suggested_interest_rate' => $suggestedRate,
            'risk_scored_at'        => now(),
            'risk_factors'          => $factors,
        ]);

        return compact('score', 'grade', 'suggestedRate', 'factors');
    }

    /** Score all customers with at least one loan. */
    public function scoreAll(): int
    {
        $count = 0;
        Customer::all()->each(function ($c) use (&$count) {
            $this->score($c);
            $count++;
        });
        return $count;
    }

    public static function gradeLabel(string $grade): string
    {
        return match($grade) {
            'A' => 'Excellent',
            'B' => 'Good',
            'C' => 'Fair',
            'D' => 'Poor',
            'E' => 'High Risk',
            default => 'Unrated',
        };
    }

    public static function gradeColor(string $grade): string
    {
        return match($grade) {
            'A' => '#059669',
            'B' => '#0ea5e9',
            'C' => '#f59e0b',
            'D' => '#ef4444',
            'E' => '#7c3aed',
            default => '#94a3b8',
        };
    }
}
