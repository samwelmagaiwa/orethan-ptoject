<?php

namespace App\Console\Commands;

use App\Models\LoanSchedule;
use App\Sms\SmsService;
use Illuminate\Console\Command;

/**
 * Fired daily at 08:00 via the Laravel scheduler.
 *
 * Reminder rules by repayment frequency:
 *   daily  → due-today SMS only (no 3-day advance — it would fire every single day)
 *   weekly / monthly → 3-day advance warning PLUS due-today alert
 *
 * Both loops stamp a timestamp on the schedule row so each SMS fires at most
 * once per installment regardless of how often the scheduler runs.
 */
class SendRepaymentReminders extends Command
{
    protected $signature   = 'loans:send-repayment-reminders';
    protected $description = 'Send pre-due SMS reminders to borrowers (3-day warning for weekly/monthly; due-today for all)';

    public function handle(SmsService $sms): int
    {
        $today        = now()->toDateString();
        $threeDaysOut = now()->addDays(3)->toDateString();

        // ── Loop 1: 3-day advance warnings (weekly / monthly loans only) ────
        $threeDay = LoanSchedule::with('loan.customer')
            ->where('status', '!=', 'paid')
            ->whereDate('due_date', $threeDaysOut)
            ->whereNull('reminder_3day_sent_at')
            ->get();

        $sent3    = 0;
        $skipped3 = 0;
        foreach ($threeDay as $schedule) {
            $loan = $schedule->loan;
            if (!$loan) {
                continue;
            }

            // Always stamp so daily loans don't re-appear in this query every day
            $schedule->reminder_3day_sent_at = now();

            // Daily-frequency loans must NOT receive a 3-day advance SMS.
            // Use the model method to handle both snake_case and camelCase keys
            // and normalise to lowercase for a reliable comparison.
            if (strtolower($loan->repaymentFrequency()) === 'daily') {
                $schedule->save();
                $skipped3++;
                continue;
            }

            $sms->sendPaymentReminderPreDue($loan, $schedule, 3);
            $schedule->save();
            $sent3++;
        }

        // ── Loop 2: due-today reminders (ALL frequencies) ───────────────────
        $dueToday = LoanSchedule::with('loan.customer')
            ->where('status', '!=', 'paid')
            ->whereDate('due_date', $today)
            ->whereNull('reminder_due_sent_at')
            ->get();

        $sentToday = 0;
        foreach ($dueToday as $schedule) {
            $loan = $schedule->loan;
            if (!$loan) {
                continue;
            }
            $sms->sendPaymentReminderPreDue($loan, $schedule, 0);
            $schedule->reminder_due_sent_at = now();
            $schedule->save();
            $sentToday++;
        }

        $this->info("Reminders sent — 3-day: {$sent3} (skipped daily: {$skipped3}), due-today: {$sentToday}");
        return self::SUCCESS;
    }
}
