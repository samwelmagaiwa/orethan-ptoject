<?php

namespace App\Services;

use App\Models\Loan;
use App\Models\LoanRestructure;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Loan-lifecycle operations beyond ordinary repayment:
 *
 *   - reschedule: re-amortize the OUTSTANDING balance over a new term / frequency /
 *     rate (and optional new start date). Moves no cash, so no GL posting — just a
 *     fresh schedule and an audit row. Used to give a struggling borrower relief.
 *
 *   - topUp: advance additional principal on an active loan. Posts a disbursement-
 *     style entry (Dr Loans Receivable / Cr Cash-or-Bank) and re-amortizes the new
 *     combined balance over the remaining/!given term.
 *
 *   - writeOff: remove an uncollectible balance from Loans Receivable, absorbing it
 *     against the Allowance for Loan Losses first and charging any shortfall to the
 *     provision expense. Closes the loan as written_off.
 *
 * Every action is recorded in loan_restructures for an auditable history.
 */
class LoanRestructureService
{
    public function __construct(protected AccountingService $accounting)
    {
    }

    /** Re-amortize the outstanding balance over new terms. No cash moves. */
    public function reschedule(Loan $loan, array $data, ?User $user = null): array
    {
        return DB::transaction(function () use ($loan, $data, $user) {
            if (!$loan->disbursed_at) {
                throw new \Exception('Only a disbursed loan can be rescheduled');
            }
            $outstanding = round((float) $loan->remaining_balance, 2);
            if ($outstanding <= 0) {
                throw new \Exception('This loan has no outstanding balance to reschedule');
            }

            $months = max(1, (int) ($data['term_months'] ?? $loan->termMonths()));
            $frequency = $data['frequency'] ?? $loan->repaymentFrequency();
            $rate = isset($data['interest_rate'])
                ? (float) $data['interest_rate'] / 100
                : \App\Models\LoanSetting::current()->defaultInterestRateFraction();
            $startDate = $data['start_date'] ?? Carbon::today()->toDateString();

            // Re-amortize over the OUTSTANDING balance (not the original principal) by
            // building the schedule against a clone whose amount is the balance owed.
            $proxy = $loan->replicate();
            $proxy->amount = $outstanding;
            $rows = $proxy->buildScheduleRows($months, $rate, $frequency, $startDate);

            $loan->schedules()->where('status', '!=', 'paid')->delete();
            $startIndex = (int) ($loan->schedules()->max('installment_number') ?? 0);
            foreach ($rows as $i => $row) {
                $row['installment_number'] = $startIndex + $i + 1;
                $loan->schedules()->create($row);
            }

            // Persist the new terms back onto the application details so previews/
            // future actions read the rescheduled values.
            $details = $loan->details ?? [];
            $details['kwaTarakimu'] = $months;
            $details['repayment_frequency'] = $frequency;
            if (isset($data['interest_rate'])) {
                $details['kiwakocha_Riba'] = (float) $data['interest_rate'];
            }
            $loan->details = $details;

            $first = $loan->schedules()->where('status', '!=', 'paid')->orderBy('due_date')->first();
            $loan->next_payment_date = $first?->due_date;
            $loan->monthly_payment = $first ? round($first->total_amount) : $loan->monthly_payment;
            $loan->save();

            $record = $this->log($loan, 'reschedule', 0, $outstanding, $outstanding, [
                'term_months' => $months,
                'frequency' => $frequency,
                'interest_rate' => $data['interest_rate'] ?? null,
                'start_date' => $startDate,
            ], $data['notes'] ?? null, null, $user);

            $this->audit('loan.rescheduled', $user, $loan, "Loan {$loan->loan_account_number} rescheduled over {$months} month(s)");

            return ['loan' => $loan->fresh('schedules'), 'restructure' => $record];
        });
    }

    /** Advance more principal on an active loan and re-amortize the new balance. */
    public function topUp(Loan $loan, array $data, ?User $user = null): array
    {
        return DB::transaction(function () use ($loan, $data, $user) {
            if (!$loan->disbursed_at || in_array($loan->status, ['written_off', 'completed'], true)) {
                throw new \Exception('Only an active, disbursed loan can be topped up');
            }
            $topUp = round((float) ($data['amount'] ?? 0), 2);
            if ($topUp <= 0) {
                throw new \Exception('Top-up amount must be greater than zero');
            }

            $method = $data['method'] ?? 'cash';
            $balanceBefore = round((float) $loan->remaining_balance, 2);

            // GL: disburse the extra principal (same shape as a normal disbursement).
            $cashAccount = strtolower($method) === 'cash'
                ? $this->accounting->account(AccountingService::CASH_ON_HAND)
                : $this->accounting->account(AccountingService::BANK_ACCOUNT);

            $entry = $this->accounting->postJournalEntry([
                'entry_date' => $data['date'] ?? Carbon::today()->toDateString(),
                'reference_type' => 'loan_topup',
                'reference_id' => $loan->id,
                'description' => 'Top-up advance on loan ' . ($loan->loan_account_number ?? $loan->id),
                'lines' => [
                    ['chart_of_account_id' => $this->accounting->account(AccountingService::LOANS_RECEIVABLE)->id, 'debit' => $topUp, 'credit' => 0, 'description' => 'Top-up principal advanced'],
                    ['chart_of_account_id' => $cashAccount->id, 'debit' => 0, 'credit' => $topUp, 'description' => 'Top-up paid out via ' . $method],
                ],
            ], $user);

            // Grow the loan and re-amortize the new outstanding balance.
            $loan->amount = round((float) $loan->amount + $topUp, 2);
            $newBalance = round($balanceBefore + $topUp, 2);
            $loan->remaining_balance = $newBalance;
            $loan->payment_status = 'partial';
            if ($loan->status === 'completed') {
                $loan->status = 'disbursed';
                $loan->completed_at = null;
            }

            $months = max(1, (int) ($data['term_months'] ?? $loan->termMonths()));
            $frequency = $loan->repaymentFrequency();
            $rate = isset($data['interest_rate'])
                ? (float) $data['interest_rate'] / 100
                : \App\Models\LoanSetting::current()->defaultInterestRateFraction();
            $startDate = $data['start_date'] ?? Carbon::today()->toDateString();

            $proxy = $loan->replicate();
            $proxy->amount = $newBalance;
            $rows = $proxy->buildScheduleRows($months, $rate, $frequency, $startDate);
            $loan->schedules()->where('status', '!=', 'paid')->delete();
            $startIndex = (int) ($loan->schedules()->max('installment_number') ?? 0);
            foreach ($rows as $i => $row) {
                $row['installment_number'] = $startIndex + $i + 1;
                $loan->schedules()->create($row);
            }

            $first = $loan->schedules()->where('status', '!=', 'paid')->orderBy('due_date')->first();
            $loan->next_payment_date = $first?->due_date;
            $loan->monthly_payment = $first ? round($first->total_amount) : $loan->monthly_payment;
            $loan->save();

            $record = $this->log($loan, 'topup', $topUp, $balanceBefore, $newBalance, [
                'method' => $method,
                'term_months' => $months,
            ], $data['notes'] ?? null, $entry->id, $user);

            $this->audit('loan.topped_up', $user, $loan, "Loan {$loan->loan_account_number} topped up by " . number_format($topUp));

            return ['loan' => $loan->fresh('schedules'), 'restructure' => $record, 'journal_entry' => $entry];
        });
    }

    /** Write off an uncollectible balance against the allowance, then the expense. */
    public function writeOff(Loan $loan, array $data, ?User $user = null): array
    {
        return DB::transaction(function () use ($loan, $data, $user) {
            if (!$loan->disbursed_at) {
                throw new \Exception('Only a disbursed loan can be written off');
            }
            if ($loan->status === 'written_off') {
                throw new \Exception('This loan has already been written off');
            }
            $balance = round((float) $loan->remaining_balance, 2);
            if ($balance <= 0) {
                throw new \Exception('This loan has no outstanding balance to write off');
            }

            $asOf = $data['date'] ?? Carbon::today()->toDateString();
            $loansReceivable = $this->accounting->account(AccountingService::LOANS_RECEIVABLE);
            $allowance = $this->accounting->account(AccountingService::ALLOWANCE_LOAN_LOSSES);
            $expense = $this->accounting->account(AccountingService::LOAN_LOSS_PROVISION_EXPENSE);

            // Absorb against the allowance first; charge any shortfall to the expense.
            $allowanceBalance = round($allowance->balance($asOf), 2);
            $fromAllowance = round(min(max($allowanceBalance, 0), $balance), 2);
            $fromExpense = round($balance - $fromAllowance, 2);

            $lines = [];
            if ($fromAllowance > 0) {
                $lines[] = ['chart_of_account_id' => $allowance->id, 'debit' => $fromAllowance, 'credit' => 0, 'description' => 'Write-off absorbed by allowance for loan losses'];
            }
            if ($fromExpense > 0) {
                $lines[] = ['chart_of_account_id' => $expense->id, 'debit' => $fromExpense, 'credit' => 0, 'description' => 'Write-off charged to provision expense (allowance shortfall)'];
            }
            $lines[] = ['chart_of_account_id' => $loansReceivable->id, 'debit' => 0, 'credit' => $balance, 'description' => 'Loan principal written off'];

            $entry = $this->accounting->postJournalEntry([
                'entry_date' => $asOf,
                'reference_type' => 'loan_writeoff',
                'reference_id' => $loan->id,
                'description' => 'Write-off of loan ' . ($loan->loan_account_number ?? $loan->id),
                'lines' => $lines,
            ], $user);

            $loan->schedules()->where('status', '!=', 'paid')->update(['status' => 'written_off']);
            $loan->remaining_balance = 0;
            $loan->status = 'written_off';
            $loan->payment_status = 'written_off';
            $loan->written_off_at = now();
            $loan->save();

            $record = $this->log($loan, 'writeoff', $balance, $balance, 0, [
                'from_allowance' => $fromAllowance,
                'from_expense' => $fromExpense,
            ], $data['notes'] ?? $data['reason'] ?? null, $entry->id, $user);

            $this->audit('loan.written_off', $user, $loan, "Loan {$loan->loan_account_number} written off (" . number_format($balance) . ')');

            return ['loan' => $loan->fresh('schedules'), 'restructure' => $record, 'journal_entry' => $entry];
        });
    }

    protected function log(Loan $loan, string $type, float $amount, float $before, float $after, array $details, ?string $notes, ?int $entryId, ?User $user): LoanRestructure
    {
        return LoanRestructure::create([
            'loan_id' => $loan->id,
            'type' => $type,
            'amount' => $amount,
            'balance_before' => $before,
            'balance_after' => $after,
            'details' => $details,
            'notes' => $notes,
            'journal_entry_id' => $entryId,
            'performed_by' => $user->id ?? null,
        ]);
    }

    protected function audit(string $action, ?User $user, Loan $loan, string $message): void
    {
        if (class_exists(\App\Models\AuditLog::class)) {
            \App\Models\AuditLog::record($action, $user, $loan, $message);
        }
    }
}
