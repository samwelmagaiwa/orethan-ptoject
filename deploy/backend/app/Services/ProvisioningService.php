<?php

namespace App\Services;

use App\Models\Loan;
use App\Models\User;
use App\Support\LoanClassification;
use Carbon\Carbon;

/**
 * Automated loan-loss provisioning. Computes the provision required across the
 * active portfolio (per BOT aging bands, via LoanClassification) and posts a
 * single adjusting journal entry to bring the "Allowance for Loan Losses"
 * contra-asset to that required level:
 *
 *   increase needed:  Dr Loan Loss Provision Expense / Cr Allowance for Loan Losses
 *   decrease needed:  Dr Allowance for Loan Losses    / Cr Loan Loss Provision Expense
 *
 * Idempotent within a period: re-running when nothing has changed posts nothing
 * (the delta is zero), so it's safe to run from a button or a monthly schedule.
 */
class ProvisioningService
{
    public function __construct(protected AccountingService $accounting)
    {
    }

    /** Compute required provision and the change vs the current allowance, without posting. */
    public function preview(?Carbon $asOf = null): array
    {
        $asOf = $asOf ?? Carbon::today();

        $loans = Loan::with('schedules')
            ->whereNotNull('disbursed_at')
            ->where('remaining_balance', '>', 0)
            ->get();

        $byBand = [];
        foreach (LoanClassification::BANDS as $band) {
            $byBand[$band['class']] = ['label' => $band['label'], 'rate' => $band['rate'], 'count' => 0, 'outstanding' => 0.0, 'provision' => 0.0];
        }

        $required = 0.0;
        foreach ($loans as $loan) {
            $outstanding = (float) $loan->remaining_balance;
            $dpd = LoanClassification::maxDaysOverdue($loan, $asOf->copy()->startOfDay());
            $band = LoanClassification::forDaysOverdue($dpd);
            $prov = round($outstanding * $band['rate'], 2);
            $byBand[$band['class']]['count']++;
            $byBand[$band['class']]['outstanding'] += $outstanding;
            $byBand[$band['class']]['provision'] += $prov;
            $required += $prov;
        }
        $required = round($required, 2);

        $current = round($this->accounting->account(AccountingService::ALLOWANCE_LOAN_LOSSES)->balance($asOf->toDateString()), 2);
        $delta = round($required - $current, 2);

        foreach ($byBand as &$b) {
            $b['outstanding'] = round($b['outstanding']);
            $b['provision'] = round($b['provision']);
        }
        unset($b);

        return [
            'as_of' => $asOf->toDateString(),
            'required_provision' => $required,
            'current_allowance' => $current,
            'adjustment' => $delta,
            'bands' => array_values($byBand),
        ];
    }

    /** Post the adjusting entry to bring the allowance to the required level. */
    public function run(?User $user = null, ?Carbon $asOf = null): array
    {
        $asOf = $asOf ?? Carbon::today();
        $preview = $this->preview($asOf);
        $delta = $preview['adjustment'];

        if (abs($delta) < 0.01) {
            return array_merge($preview, ['posted' => false, 'entry_number' => null, 'message' => 'Provision already at the required level — nothing posted.']);
        }

        $expense = $this->accounting->account(AccountingService::LOAN_LOSS_PROVISION_EXPENSE);
        $allowance = $this->accounting->account(AccountingService::ALLOWANCE_LOAN_LOSSES);
        $amount = abs($delta);

        // delta > 0 → need more provision (charge expense). delta < 0 → release provision.
        $lines = $delta > 0
            ? [
                ['chart_of_account_id' => $expense->id, 'debit' => $amount, 'credit' => 0, 'description' => 'Loan loss provision charge'],
                ['chart_of_account_id' => $allowance->id, 'debit' => 0, 'credit' => $amount, 'description' => 'Increase allowance for loan losses'],
            ]
            : [
                ['chart_of_account_id' => $allowance->id, 'debit' => $amount, 'credit' => 0, 'description' => 'Release allowance for loan losses'],
                ['chart_of_account_id' => $expense->id, 'debit' => 0, 'credit' => $amount, 'description' => 'Loan loss provision release'],
            ];

        $entry = $this->accounting->postJournalEntry([
            'entry_date' => $asOf->toDateString(),
            'reference_type' => 'provisioning',
            'description' => 'Loan-loss provision adjustment as of ' . $asOf->toDateString(),
            'lines' => $lines,
        ], $user);

        return array_merge($preview, [
            'posted' => true,
            'entry_number' => $entry->entry_number,
            'message' => ($delta > 0 ? 'Charged' : 'Released') . ' TZS ' . number_format($amount) . ' to match the required provision.',
        ]);
    }
}
