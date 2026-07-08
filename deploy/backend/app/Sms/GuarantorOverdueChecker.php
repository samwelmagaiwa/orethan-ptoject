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

        // Monthly penalty rate from settings (e.g. 4 for 4%); daily = rate/30
        $penaltyRate    = (float) $setting->penalty_rate;
        $dailyRate      = $penaltyRate / 100 / 30;
        $penaltyPercent = $penaltyRate; // for the one-time guarantor overdue notice

        // All unpaid installments whose due date has already passed
        $schedules = LoanSchedule::with('loan.customer')
            ->where('status', '!=', 'paid')
            ->whereDate('due_date', '<', $today)
            ->get();

        $processed = 0;

        foreach ($schedules as $schedule) {
            $loan = $schedule->loan;
            if (!$loan) {
                continue;
            }

            // ── 1. FIRST-TIME GUARANTOR OVERDUE NOTICE ──────────────────────
            if (is_null($schedule->guarantor_notified_at)) {
                $sms->sendGuarantorOverdueNotices($loan, $penaltyPercent);
                $schedule->guarantor_notified_at = now();
            }

            // ── 2. ACCRUE DAILY PENALTY (idempotent per calendar day) ────────
            $penaltyAlreadyAccruedToday = $schedule->penalty_accrued_date === $today;
            if (!$penaltyAlreadyAccruedToday) {
                $overdueAmount = max(0.0, (float) $schedule->total_amount - (float) $schedule->amount_paid);
                if ($overdueAmount > 0) {
                    $schedule->penalty_amount    = (float) $schedule->penalty_amount + ($overdueAmount * $dailyRate);
                    $schedule->penalty_days      = (int) $schedule->penalty_days + 1;
                    $schedule->penalty_accrued_date = $today;
                }
            }

            // ── 3. DAILY GUARANTOR PENALTY-UPDATE SMS (idempotent per day) ──
            $smsSentToday = $schedule->guarantor_penalty_date === $today;
            if (!$smsSentToday && (float) $schedule->penalty_amount > 0) {
                $sms->sendGuarantorPenaltyUpdate($loan, $schedule);
                $schedule->guarantor_penalty_date = $today;
            }

            $schedule->save();
            $processed++;
        }

        return $processed;
    }
}
