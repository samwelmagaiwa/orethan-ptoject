<?php

namespace App\Console\Commands;

use App\Sms\GuarantorOverdueChecker;
use App\Sms\SmsService;
use Illuminate\Console\Command;

/**
 * Manual/cron entry point for the guarantor-overdue SMS check. The actual
 * logic lives in GuarantorOverdueChecker so it can also run automatically
 * from ordinary app traffic (see GuarantorOverdueChecker::runIfDue(), wired
 * into AuthController::me()) on servers with no cron configured at all.
 *
 * Running this command explicitly always re-checks immediately, regardless
 * of whether the once-a-day traffic-triggered check has already fired today.
 */
class NotifyGuarantorsOfOverdueLoans extends Command
{
    protected $signature = 'loans:notify-guarantors-overdue';

    protected $description = 'Send a Swahili SMS to each loan\'s guarantor(s) the first day a repayment is missed';

    public function handle(SmsService $sms): int
    {
        $notified = GuarantorOverdueChecker::run($sms);
        $this->info("Guarantor overdue notices sent for {$notified} installment(s).");
        return self::SUCCESS;
    }
}
