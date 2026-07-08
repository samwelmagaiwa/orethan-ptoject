<?php

namespace App\Support;

use App\Models\Loan;
use Carbon\Carbon;

/**
 * Single source of truth for BOT (Bank of Tanzania) microfinance loan
 * classification and provisioning rates. Used by both the regulator report
 * and the automated loan-loss provisioning so the two can never disagree.
 *
 * Bands follow the standard BOT non-deposit-taking microfinance classification,
 * with the user-specified anchors (1% current, ~25% substandard, 100% loss).
 */
class LoanClassification
{
    /** @var array<int, array{max:int, rate:float, class:string, label:string}> */
    public const BANDS = [
        ['max' => 0,           'rate' => 0.01, 'class' => 'current',     'label' => 'Current'],
        ['max' => 30,          'rate' => 0.05, 'class' => 'watch',       'label' => 'Especially Mentioned'],
        ['max' => 60,          'rate' => 0.25, 'class' => 'substandard', 'label' => 'Substandard'],
        ['max' => 90,          'rate' => 0.50, 'class' => 'doubtful',    'label' => 'Doubtful'],
        ['max' => PHP_INT_MAX, 'rate' => 1.00, 'class' => 'loss',        'label' => 'Loss'],
    ];

    /** Return the band (class, label, rate) for a given days-past-due. */
    public static function forDaysOverdue(int $daysOverdue): array
    {
        $dpd = max(0, $daysOverdue);
        foreach (self::BANDS as $band) {
            if ($dpd <= $band['max']) {
                return $band;
            }
        }
        return self::BANDS[count(self::BANDS) - 1];
    }

    /**
     * Largest number of days any unpaid installment of this loan is past due
     * (0 = current / nothing overdue). Uses already-loaded schedules when
     * available to avoid an extra query.
     */
    public static function maxDaysOverdue(Loan $loan, ?Carbon $asOf = null): int
    {
        $asOf = $asOf ?? Carbon::today();
        $schedules = $loan->relationLoaded('schedules')
            ? $loan->schedules
            : $loan->schedules()->where('status', '!=', 'paid')->get();

        $maxDpd = 0;
        foreach ($schedules as $s) {
            if ($s->status === 'paid' || !$s->due_date) {
                continue;
            }
            $due = $s->due_date instanceof Carbon ? $s->due_date : Carbon::parse($s->due_date);
            if ($due->lt($asOf)) {
                $maxDpd = max($maxDpd, (int) $due->diffInDays($asOf));
            }
        }
        return $maxDpd;
    }

    /** Provision required on a loan = outstanding balance × band rate. */
    public static function provisionFor(Loan $loan, ?Carbon $asOf = null): float
    {
        $band = self::forDaysOverdue(self::maxDaysOverdue($loan, $asOf));
        return round((float) ($loan->remaining_balance ?? 0) * $band['rate'], 2);
    }
}
