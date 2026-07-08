<?php

namespace App\Console\Commands;

use App\Models\LoanSchedule;
use App\Sms\SmsService;
use Illuminate\Console\Command;

/**
 * Fired daily at 08:00 via the Laravel scheduler.
 *
 * Loop 1 — 3-day warning:  find installments due exactly 3 days from now
 *                          that have NOT yet received a 3-day reminder.
 *
 * Loop 2 — due-today alert: find installments due today (and still unpaid)
 *                           that have NOT yet received a due-today reminder.
 *
 * Both loops stamp a timestamp on the schedule row so the SMS fires at most
 * once per installment regardless of how often this command is scheduled.
 */
class SendRepaymentReminders extends Command
{
    protected $signature   = 'loans:send-repayment-reminders';
    protected $description = 'Send pre-due SMS reminders to borrowers (3-day warning + due-today alert)';

    public function handle(SmsService $sms): int
    {
        $today        = now()->toDateString();
        $threeDaysOut = now()->addDays(3)->toDateString();

        // ── Loop 1: 3-day advance warnings ──────────────────────────────────
        $threeDay = LoanSchedule::with('loan.customer')
            ->where('status', '!=', 'paid')
            ->whereDate('due_date', $threeDaysOut)
            ->whereNull('reminder_3day_sent_at')
            ->get();

        $sent3 = 0;
        foreach ($threeDay as $schedule) {
            $loan = $schedule->loan;
            if (!$loan) {
                continue;
            }
            $sms->sendPaymentReminderPreDue($loan, $schedule, 3);
            $schedule->reminder_3day_sent_at = now();
            $schedule->save();
            $sent3++;
        }

        // ── Loop 2: due-today reminders ──────────────────────────────────────
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

        $this->info("Reminders sent — 3-day: {$sent3}, due-today: {$sentToday}");
        return self::SUCCESS;
    }
}
