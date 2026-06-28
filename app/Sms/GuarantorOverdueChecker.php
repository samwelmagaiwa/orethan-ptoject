<?php

namespace App\Sms;

use App\Models\LoanSchedule;
use App\Models\LoanSetting;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * The actual "find missed installments, notify guarantors" logic, shared by:
 * - the `loans:notify-guarantors-overdue` artisan command (for servers that
 *   DO have a cron entry running `schedule:run`), and
 * - runIfDue(), a zero-infrastructure fallback that piggybacks on ordinary
 *   app traffic so this still fires automatically on servers/local dev
 *   environments with no cron configured at all (e.g. plain XAMPP/Windows).
 *
 * runIfDue() is called from AuthController::me() — hit by every page load
 * (Sidebar.tsx fetches it on mount) — so the first request of a new day
 * triggers the check. It runs at most once per calendar day, tracked via a
 * cache flag, and never throws: a misbehaving SMS gateway must never break
 * the page the staff member is actually trying to load.
 */
class GuarantorOverdueChecker
{
    const CACHE_KEY = 'guarantor_overdue_check:last_run_date';

    public static function runIfDue(SmsService $sms): void
    {
        $today = now()->toDateString();

        if (Cache::get(self::CACHE_KEY) === $today) {
            return; // already ran today
        }

        try {
            self::run($sms);
        } catch (\Throwable $e) {
            Log::error('GuarantorOverdueChecker::runIfDue failed: ' . $e->getMessage());
        }

        // Set regardless of success/failure so one bad run can't retry on
        // every single request for the rest of the day.
        Cache::put(self::CACHE_KEY, $today, now()->addDays(2));
    }

    /** @return int Number of installments notified. */
    public static function run(SmsService $sms): int
    {
        $schedules = LoanSchedule::with('loan')
            ->whereNull('guarantor_notified_at')
            ->where('status', '!=', 'paid')
            ->whereDate('due_date', '<', now()->toDateString())
            ->get();

        $penaltyPercentage = (float) LoanSetting::current()->penalty_rate;

        $notified = 0;
        foreach ($schedules as $schedule) {
            $loan = $schedule->loan;
            if (!$loan) {
                continue;
            }

            $sms->sendGuarantorOverdueNotices($loan, $penaltyPercentage);

            $schedule->guarantor_notified_at = now();
            $schedule->save();
            $notified++;
        }

        return $notified;
    }
}
