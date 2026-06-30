<?php

namespace App\Services;

use App\Models\InterestAccrual;
use App\Models\Loan;
use App\Models\LoanSetting;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Daily interest accrual. Recognizes interest as it is EARNED rather than only
 * when a repayment lands, by posting — once per day — an aggregate entry:
 *
 *   Dr Interest Receivable (1110) / Cr Interest Income (4010)
 *
 * for the sum of each active loan's daily interest (outstanding balance × daily
 * rate). The matching repayment relief lives in AccountingService::postRepayment,
 * which credits Interest Receivable first (up to its balance) before Interest
 * Income, so collecting interest draws down the receivable that accrual built up.
 *
 * Idempotent: interest_accruals carries a unique (loan_id, accrual_date), so a
 * day already accrued for a loan is skipped on re-run.
 */
class InterestAccrualService
{
    public function __construct(protected AccountingService $accounting)
    {
    }

    /** Daily interest rate (fraction) for a loan, from its captured rate or the admin default. */
    protected function dailyRate(Loan $loan): float
    {
        $monthlyPercent = $loan->details['kiwakocha_Riba'] ?? null;
        $monthlyFraction = $monthlyPercent !== null
            ? (float) $monthlyPercent / 100
            : LoanSetting::current()->defaultInterestRateFraction();
        // Convention: a 30-day month, consistent with the schedule builder's monthly basis.
        return $monthlyFraction / 30;
    }

    /** What a run for $date would post, without writing anything. */
    public function preview(?Carbon $date = null): array
    {
        $date = ($date ?? Carbon::today())->copy()->startOfDay();

        $loans = Loan::whereNotNull('disbursed_at')
            ->where('remaining_balance', '>', 0)
            ->whereIn('status', ['disbursed', 'partial', 'active'])
            ->get();

        $alreadyAccrued = InterestAccrual::whereDate('accrual_date', $date->toDateString())
            ->pluck('loan_id')->all();

        $rows = [];
        $total = 0.0;
        foreach ($loans as $loan) {
            if (in_array($loan->id, $alreadyAccrued, true)) {
                continue;
            }
            $outstanding = (float) $loan->remaining_balance;
            $amount = round($outstanding * $this->dailyRate($loan), 2);
            if ($amount < 0.01) {
                continue;
            }
            $rows[] = ['loan_id' => $loan->id, 'outstanding' => round($outstanding, 2), 'amount' => $amount];
            $total += $amount;
        }

        return [
            'date' => $date->toDateString(),
            'loan_count' => count($rows),
            'total_interest' => round($total, 2),
            'already_accrued_loans' => count($alreadyAccrued),
            'rows' => $rows,
        ];
    }

    /** Post the day's accrual (idempotent). Returns a summary. */
    public function accrue(?Carbon $date = null, ?User $user = null): array
    {
        $date = ($date ?? Carbon::today())->copy()->startOfDay();

        return DB::transaction(function () use ($date, $user) {
            $preview = $this->preview($date);
            if ($preview['loan_count'] === 0 || $preview['total_interest'] < 0.01) {
                return array_merge($preview, ['posted' => false, 'entry_number' => null, 'message' => 'No interest to accrue for ' . $date->toDateString() . '.']);
            }

            $entry = $this->accounting->postJournalEntry([
                'entry_date' => $date->toDateString(),
                'reference_type' => 'interest_accrual',
                'description' => 'Daily interest accrual for ' . $date->toDateString(),
                'lines' => [
                    ['chart_of_account_id' => $this->accounting->account(AccountingService::INTEREST_RECEIVABLE)->id, 'debit' => $preview['total_interest'], 'credit' => 0, 'description' => 'Interest accrued on the portfolio'],
                    ['chart_of_account_id' => $this->accounting->account(AccountingService::INTEREST_INCOME)->id, 'debit' => 0, 'credit' => $preview['total_interest'], 'description' => 'Interest earned (accrued)'],
                ],
            ], $user);

            foreach ($preview['rows'] as $row) {
                InterestAccrual::create([
                    'loan_id' => $row['loan_id'],
                    'accrual_date' => $date->toDateString(),
                    'outstanding' => $row['outstanding'],
                    'amount' => $row['amount'],
                    'journal_entry_id' => $entry->id,
                ]);
            }

            return array_merge($preview, [
                'posted' => true,
                'entry_number' => $entry->entry_number,
                'message' => 'Accrued TZS ' . number_format($preview['total_interest']) . ' across ' . $preview['loan_count'] . ' loan(s) for ' . $date->toDateString() . '.',
            ]);
        });
    }
}
