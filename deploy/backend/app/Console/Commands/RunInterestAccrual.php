<?php

namespace App\Console\Commands;

use App\Services\InterestAccrualService;
use Carbon\Carbon;
use Illuminate\Console\Command;

/**
 * Daily interest accrual. Posts the day's Dr Interest Receivable / Cr Interest
 * Income entry. Idempotent — safe to run repeatedly or to back-fill a date.
 */
class RunInterestAccrual extends Command
{
    protected $signature = 'loans:accrue-interest {--date= : Accrual date (YYYY-MM-DD), defaults to today}';

    protected $description = 'Post the daily interest accrual to the general ledger';

    public function handle(InterestAccrualService $service): int
    {
        $date = $this->option('date') ? Carbon::parse($this->option('date')) : Carbon::today();
        $result = $service->accrue($date);
        $this->info($result['message']);
        return self::SUCCESS;
    }
}
