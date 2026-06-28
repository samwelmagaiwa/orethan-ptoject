<?php

namespace App\Console\Commands;

use App\Models\LoanSchedule;
use App\Models\LoanSetting;
use App\Sms\SmsService;
use Illuminate\Console\Command;

/**
 * Daily safety net for the guarantor-overdue SMS: catches any missed
 * installment that wasn't already handled by a staff member clicking
 * "Contact" in Overdue Management (OverdueController::sendReminderSms).
 * Either path sets guarantor_notified_at, so an installment is only ever
 * notified once no matter which one fires first.
 */
class NotifyGuarantorsOfOverdueLoans extends Command
{
    protected $signature = 'loans:notify-guarantors-overdue';

    protected $description = 'Send a Swahili SMS to each loan\'s guarantor(s) the first day a repayment is missed';

    public function handle(SmsService $sms): int
    {
        $schedules = LoanSchedule::with('loan')
            ->whereNull('guarantor_notified_at')
            ->where('status', '!=', 'paid')
            ->whereDate('due_date', '<', now()->toDateString())
            ->get();

        // Admin-configurable via Loan Settings — same source the Overdue
        // Management dashboard and the manual "Contact" button read from, so
        // the percentage quoted to guarantors always matches what staff see.
        $penaltyPercentage = LoanSetting::current()->penalty_rate;

        $notified = 0;
        foreach ($schedules as $schedule) {
            $loan = $schedule->loan;
            if (!$loan) {
                continue;
            }

            $sms->sendGuarantorOverdueNotices($loan, (float) $penaltyPercentage);

            $schedule->guarantor_notified_at = now();
            $schedule->save();
            $notified++;
        }

        $this->info("Guarantor overdue notices sent for {$notified} installment(s).");
        return self::SUCCESS;
    }
}
