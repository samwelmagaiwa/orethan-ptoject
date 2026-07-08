<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Optional, redundant safety net — the guarantor-overdue check already runs
// automatically off ordinary page traffic (AuthController::me(), via
// GuarantorOverdueChecker::runIfDue()), so a cron entry is NOT required for
// this to work. This only matters on a server that already has cron set up
// and you want the check to run reliably even on a day nobody logs in.
// * * * * * php artisan schedule:run >> /dev/null 2>&1
// 08:00 — pre-due borrower reminders (3-day warning + due-today alert)
Schedule::command('loans:send-repayment-reminders')->dailyAt('08:00');

// 09:00 — accrue daily penalty + daily guarantor overdue updates
Schedule::command('loans:notify-guarantors-overdue')->dailyAt('09:00');
