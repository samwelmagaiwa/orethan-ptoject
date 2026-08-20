<?php

namespace App\Sms;

use App\Models\LoanSchedule;
use App\Models\LoanSetting;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Finds overdue (unpaid) loan installments, accrues daily penalty, and fires
 * guarantor SMS updates. Runs once per calendar day via two triggers:
 *   1. runIfDue() — piggybacked on AuthController::me() (first page-load each day)
 *   2. loans:notify-guarantors-overdue artisan command scheduled at 09:00
 *
 * Idempotency guards:
 *   - penalty_accrued_date  → prevents double-accrual on the same calendar day
 *   - guarantor_penalty_date → prevents duplicate daily-update SMS on same day
 *   - guarantor_notified_at  → first-time "missed payment" notice (fires once ever)
 */
class GuarantorOverdueChecker
{
    const CACHE_KEY = 'guarantor_overdue_check:last_run_date';

    public static function runIfDue(SmsService $sms): void
    {
        $today = now()->toDateString();

        if (Cache::get(self::CACHE_KEY) === $today) {
            return;
        }

        try {
            self::run($sms);
        } catch (\Throwable $e) {
            Log::error('GuarantorOverdueChecker::runIfDue failed: ' . $e->getMessage());
        }

        Cache::put(self::CACHE_KEY, $today, now()->addDays(2));
    }

    /** @return int Number of overdue installments processed. */
    public static function run(SmsService $sms): int
    {
        $today   = now()->toDateString();
        $setting = LoanSetting::current();

        // Flat daily penalty in TZS from Loan Settings (default TZS 1,000/day)
        $dailyPenaltyFlat = $setting->dailyPenaltyAmount();

        // Oldest installment first — guarantees the first-time notice and the
        // daily-update SMS always reference the most-overdue installment when a
        // borrower has several unpaid rows.
        $schedules = LoanSchedule::with('loan.customer')
            ->where('status', '!=', 'paid')
            ->whereDate('due_date', '<', $today)
            ->orderBy('due_date', 'asc')
            ->get();

        $processed = 0;

        // Per-run per-loan guards.  The DB-level date columns (guarantor_penalty_date,
        // guarantor_notified_at) are the durable idempotency source across cron runs;
        // these arrays prevent a second SMS within the same PHP process when a loan
        // has multiple overdue installment rows.
        $firstNoticeSentForLoan = [];
        $penaltySmsSetForLoan   = [];

        foreach ($schedules as $schedule) {
            $loan = $schedule->loan;
            if (!$loan) {
                continue;
            }

            $loanId = $loan->id;

            // ── 1. FIRST-TIME GUARANTOR OVERDUE NOTICE (once per loan, after 3 days) ──
            // guarantor_notified_at is the permanent guard (set once, never cleared).
            // The in-process flag stops a second fire when multiple installments of the
            // same loan all cross the 3-day threshold on the same run.
            $daysOverdue = \Carbon\Carbon::parse($schedule->due_date)->diffInDays($today);
            if (is_null($schedule->guarantor_notified_at) && $daysOverdue >= 3) {
                if (!isset($firstNoticeSentForLoan[$loanId])) {
                    $sms->sendGuarantorOverdueNotices($loan, $dailyPenaltyFlat);
                    $firstNoticeSentForLoan[$loanId] = true;
                }
                // Stamp every qualifying installment row so the notice never re-fires.
                $schedule->guarantor_notified_at = now();
            }

            // ── 2. ACCRUE DAILY PENALTY (idempotent per calendar day per installment) ──
            // Each installment accrues independently — do not consolidate here.
            if ($schedule->penalty_accrued_date !== $today) {
                $overdueAmount = max(0.0, (float) $schedule->total_amount - (float) $schedule->amount_paid);
                if ($overdueAmount > 0) {
                    $schedule->penalty_amount       = (float) $schedule->penalty_amount + $dailyPenaltyFlat;
                    $schedule->penalty_days         = (int) $schedule->penalty_days + 1;
                    $schedule->penalty_accrued_date = $today;
                }
            }

            // ── 3. DAILY PENALTY-UPDATE SMS — ONE per loan per day ──
            // Always stamp guarantor_penalty_date = today on every installment row
            // so that subsequent cron runs (cron fires every minute) skip them.
            // Only dispatch the actual SMS for the oldest installment of each loan
            // (guaranteed by the orderBy above).
            if ($schedule->guarantor_penalty_date !== $today) {
                $schedule->guarantor_penalty_date = $today;

                if ((float) $schedule->penalty_amount > 0 && !isset($penaltySmsSetForLoan[$loanId])) {
                    $sms->sendGuarantorPenaltyUpdate($loan, $schedule);
                    $penaltySmsSetForLoan[$loanId] = true;
                }
            }

            $schedule->save();
            $processed++;
        }

        return $processed;
    }
}
