<?php

namespace App\Services;

use App\Models\ChartOfAccount;
use App\Models\JournalEntry;
use App\Models\JournalEntryLine;
use App\Models\LoanDisbursement;
use App\Models\Repayment;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class AccountingService
{
    // System account codes auto-posting depends on (see ChartOfAccountsSeeder)
    const CASH_ON_HAND = '1010';
    const BANK_ACCOUNT = '1020';
    const LOANS_RECEIVABLE = '1100';
    const INTEREST_RECEIVABLE = '1110';
    const ALLOWANCE_LOAN_LOSSES = '1150';
    const RETAINED_EARNINGS = '3020';
    const INTEREST_INCOME = '4010';
    const FEE_INCOME = '4020';
    const PENALTY_INCOME = '4030';
    const LOAN_LOSS_PROVISION_EXPENSE = '5050';

    /**
     * Resolve a system account by its fixed code, throwing a clear error if the
     * chart of accounts hasn't been seeded or the account was renamed/removed.
     */
    public function account(string $code): ChartOfAccount
    {
        $account = ChartOfAccount::where('code', $code)->first();
        if (!$account) {
            throw new \Exception("Chart of Accounts is missing required system account code {$code}. Run the ChartOfAccountsSeeder.");
        }
        return $account;
    }

    /**
     * Cash on Hand for cash payments, Bank Account for every electronic method.
     */
    protected function cashOrBankAccount(string $method): ChartOfAccount
    {
        return strtolower($method) === 'cash' ? $this->account(self::CASH_ON_HAND) : $this->account(self::BANK_ACCOUNT);
    }

    /**
     * Post a balanced journal entry. $lines is an array of:
     *   ['chart_of_account_id' => int, 'debit' => float, 'credit' => float, 'description' => ?string]
     * Throws if the entry doesn't balance or has fewer than 2 lines.
     */
    public function postJournalEntry(array $data, ?User $user = null): JournalEntry
    {
        return DB::transaction(function () use ($data, $user) {
            $lines = $data['lines'] ?? [];
            if (count($lines) < 2) {
                throw new \Exception('A journal entry needs at least two lines');
            }

            $totalDebit = 0;
            $totalCredit = 0;
            foreach ($lines as $line) {
                $debit = round((float) ($line['debit'] ?? 0), 2);
                $credit = round((float) ($line['credit'] ?? 0), 2);
                if ($debit > 0 && $credit > 0) {
                    throw new \Exception('A journal entry line cannot have both a debit and a credit');
                }
                if ($debit <= 0 && $credit <= 0) {
                    throw new \Exception('Every journal entry line needs a debit or a credit amount');
                }
                $totalDebit += $debit;
                $totalCredit += $credit;
            }

            if (round($totalDebit, 2) !== round($totalCredit, 2)) {
                throw new \Exception("Journal entry does not balance: debits {$totalDebit} vs credits {$totalCredit}");
            }

            $entryDate = $data['entry_date'] ?? now()->toDateString();
            $entry = JournalEntry::create([
                'entry_number' => $this->nextEntryNumber($entryDate),
                'entry_date' => $entryDate,
                'reference_type' => $data['reference_type'] ?? null,
                'reference_id' => $data['reference_id'] ?? null,
                'description' => $data['description'],
                'status' => 'posted',
                'created_by' => $user->id ?? null,
            ]);

            foreach ($lines as $i => $line) {
                JournalEntryLine::create([
                    'journal_entry_id' => $entry->id,
                    'chart_of_account_id' => $line['chart_of_account_id'],
                    'debit' => round((float) ($line['debit'] ?? 0), 2),
                    'credit' => round((float) ($line['credit'] ?? 0), 2),
                    'description' => $line['description'] ?? null,
                    'line_order' => $i,
                ]);
            }

            return $entry->load('lines.account');
        });
    }

    /**
     * Reverse a posted entry by creating a mirror-image entry (debits <-> credits)
     * and marking the original as reversed. Reversed entries cannot be reversed again.
     */
    public function reverseJournalEntry(JournalEntry $entry, ?User $user = null, ?string $reason = null): JournalEntry
    {
        return DB::transaction(function () use ($entry, $user, $reason) {
            if ($entry->status === 'reversed') {
                throw new \Exception('This journal entry has already been reversed');
            }

            $reversal = $this->postJournalEntry([
                'entry_date' => now()->toDateString(),
                'reference_type' => $entry->reference_type,
                'reference_id' => $entry->reference_id,
                'description' => 'Reversal of ' . $entry->entry_number . ($reason ? " — {$reason}" : ''),
                'lines' => $entry->lines->map(fn($line) => [
                    'chart_of_account_id' => $line->chart_of_account_id,
                    'debit' => $line->credit,
                    'credit' => $line->debit,
                    'description' => $line->description,
                ])->all(),
            ], $user);

            $reversal->reversal_of_id = $entry->id;
            $reversal->save();

            $entry->status = 'reversed';
            $entry->reversed_by = $user->id ?? null;
            $entry->reversed_at = now();
            $entry->save();

            return $reversal;
        });
    }

    /**
     * Dr Loans Receivable (gross) / Cr Cash-or-Bank (net) / Cr Fee Income (charges).
     */
    public function postLoanDisbursement(LoanDisbursement $disbursement, ?User $user = null): JournalEntry
    {
        $loan = $disbursement->loan;
        $cashAccount = $this->cashOrBankAccount($disbursement->method);

        $lines = [
            [
                'chart_of_account_id' => $this->account(self::LOANS_RECEIVABLE)->id,
                'debit' => $disbursement->amount,
                'credit' => 0,
                'description' => 'Loan principal disbursed — ' . ($loan->loan_account_number ?? $loan->id),
            ],
            [
                'chart_of_account_id' => $cashAccount->id,
                'debit' => 0,
                'credit' => $disbursement->net_amount,
                'description' => 'Net proceeds paid out via ' . $disbursement->method,
            ],
        ];

        if ($disbursement->total_charges > 0) {
            $lines[] = [
                'chart_of_account_id' => $this->account(self::FEE_INCOME)->id,
                'debit' => 0,
                'credit' => $disbursement->total_charges,
                'description' => 'Processing/insurance/other charges withheld at disbursement',
            ];
        }

        return $this->postJournalEntry([
            'entry_date' => $disbursement->disbursement_date,
            'reference_type' => 'loan_disbursement',
            'reference_id' => $disbursement->id,
            'description' => 'Disbursement of loan ' . ($loan->loan_account_number ?? $loan->id) . ' (' . ($disbursement->voucher_number ?? 'no voucher') . ')',
            'lines' => $lines,
        ], $user);
    }

    /**
     * Dr Cash-or-Bank (amount) / Cr Loans Receivable (principal) / Cr Interest Income
     * (interest) / Cr Penalty Income (penalty, if any).
     */
    public function postRepayment(Repayment $repayment, ?User $user = null): JournalEntry
    {
        $loan = $repayment->loan;
        $cashAccount = $this->cashOrBankAccount($repayment->payment_method);

        $lines = [
            [
                'chart_of_account_id' => $cashAccount->id,
                'debit' => $repayment->amount,
                'credit' => 0,
                'description' => 'Repayment received via ' . $repayment->payment_method,
            ],
        ];

        if ($repayment->principal_amount > 0) {
            $lines[] = [
                'chart_of_account_id' => $this->account(self::LOANS_RECEIVABLE)->id,
                'debit' => 0,
                'credit' => $repayment->principal_amount,
                'description' => 'Principal portion of repayment',
            ];
        }
        if ($repayment->interest_amount > 0) {
            // If interest was already accrued (Dr Interest Receivable / Cr Interest
            // Income via the daily accrual run), collecting it should RELIEVE the
            // receivable rather than recognize income twice. Credit Interest
            // Receivable up to its current balance; book any remainder — interest
            // not yet accrued — straight to Interest Income.
            $interest = round((float) $repayment->interest_amount, 2);
            $receivable = $this->account(self::INTEREST_RECEIVABLE);
            $receivableBalance = round($receivable->balance($repayment->payment_date), 2);
            $relieve = round(min(max($receivableBalance, 0), $interest), 2);
            $toIncome = round($interest - $relieve, 2);

            if ($relieve > 0) {
                $lines[] = [
                    'chart_of_account_id' => $receivable->id,
                    'debit' => 0,
                    'credit' => $relieve,
                    'description' => 'Interest collected — relieves accrued receivable',
                ];
            }
            if ($toIncome > 0) {
                $lines[] = [
                    'chart_of_account_id' => $this->account(self::INTEREST_INCOME)->id,
                    'debit' => 0,
                    'credit' => $toIncome,
                    'description' => 'Interest portion of repayment',
                ];
            }
        }
        if ($repayment->penalty_amount > 0) {
            $lines[] = [
                'chart_of_account_id' => $this->account(self::PENALTY_INCOME)->id,
                'debit' => 0,
                'credit' => $repayment->penalty_amount,
                'description' => 'Penalty portion of repayment',
            ];
        }

        return $this->postJournalEntry([
            'entry_date' => $repayment->payment_date,
            'reference_type' => 'repayment',
            'reference_id' => $repayment->id,
            'description' => 'Repayment for loan ' . ($loan->loan_account_number ?? $loan->id) . ' (' . ($repayment->receipt_number ?? 'no receipt') . ')',
            'lines' => $lines,
        ], $user);
    }

    /**
     * General Ledger for a single account: every posted line in date order with a
     * running balance, signed per the account's normal_balance.
     */
    public function generalLedger(int $accountId, ?string $from = null, ?string $to = null): array
    {
        $account = ChartOfAccount::findOrFail($accountId);

        $openingBalance = 0.0;
        if ($from) {
            $openingBalance = $this->signedBalance($account, null, Carbon::parse($from)->subDay()->toDateString());
        }

        $query = JournalEntryLine::with('journalEntry')
            ->where('chart_of_account_id', $accountId)
            ->whereHas('journalEntry', function ($q) use ($from, $to) {
                $q->where('status', 'posted');
                if ($from) $q->whereDate('entry_date', '>=', $from);
                if ($to) $q->whereDate('entry_date', '<=', $to);
            })
            ->join('journal_entries', 'journal_entries.id', '=', 'journal_entry_lines.journal_entry_id')
            ->orderBy('journal_entries.entry_date')
            ->orderBy('journal_entry_lines.id')
            ->select('journal_entry_lines.*');

        $running = $openingBalance;
        $rows = $query->get()->map(function ($line) use (&$running, $account) {
            $delta = $account->normal_balance === 'debit' ? ($line->debit - $line->credit) : ($line->credit - $line->debit);
            $running = round($running + $delta, 2);
            return [
                'date' => $line->journalEntry->entry_date->toDateString(),
                'entry_number' => $line->journalEntry->entry_number,
                'description' => $line->description ?: $line->journalEntry->description,
                'debit' => (float) $line->debit,
                'credit' => (float) $line->credit,
                'running_balance' => $running,
            ];
        });

        return [
            'account' => ['id' => $account->id, 'code' => $account->code, 'name' => $account->name, 'type' => $account->type],
            'opening_balance' => round($openingBalance, 2),
            'closing_balance' => round($running, 2),
            'lines' => $rows,
        ];
    }

    protected function signedBalance(ChartOfAccount $account, ?string $from, ?string $asOf): float
    {
        return $account->balance($asOf, $from);
    }

    /**
     * Bank Reconciliation auto-matching: diffs a list of bank-statement lines
     * (typed/pasted in by the preparer, since there is no live bank feed)
     * against the account's own ledger up to the statement date. Matching is
     * by amount (within $tolerance) and the closest date within $dayWindow
     * days. Book transactions left over with no statement match become the
     * suggested reconciling items (deposit in transit / outstanding payment)
     * — replacing what used to be entirely hand-typed guesswork.
     *
     * @param array<int, array{date: string, amount: float, description?: string}> $statementLines
     */
    public function matchBankStatement(int $accountId, string $statementDate, array $statementLines, int $dayWindow = 7, float $tolerance = 0.01): array
    {
        $account = ChartOfAccount::findOrFail($accountId);
        $ledger = $this->generalLedger($accountId, null, $statementDate);

        // Signed amount: for a debit-normal (cash/bank) account, a debit line is
        // money coming in (deposit), a credit line is money going out (payment).
        $bookEntries = [];
        foreach ($ledger['lines'] as $line) {
            $amount = $account->normal_balance === 'debit'
                ? ((float) $line['debit'] - (float) $line['credit'])
                : ((float) $line['credit'] - (float) $line['debit']);
            $bookEntries[] = [
                'date' => $line['date'],
                'entry_number' => $line['entry_number'],
                'description' => $line['description'],
                'amount' => round($amount, 2),
            ];
        }

        $matched = [];
        $unmatchedStatement = [];
        $claimedBookIndexes = [];

        foreach ($statementLines as $statementLine) {
            $statementAmount = round((float) ($statementLine['amount'] ?? 0), 2);
            $statementDateValue = $statementLine['date'] ?? null;

            $bestIndex = null;
            $bestDayDiff = null;
            foreach ($bookEntries as $index => $entry) {
                if (in_array($index, $claimedBookIndexes, true)) continue;
                if (abs($entry['amount'] - $statementAmount) > $tolerance) continue;
                $dayDiff = $statementDateValue ? abs(Carbon::parse($entry['date'])->diffInDays(Carbon::parse($statementDateValue))) : 0;
                if ($dayDiff > $dayWindow) continue;
                if ($bestDayDiff === null || $dayDiff < $bestDayDiff) {
                    $bestDayDiff = $dayDiff;
                    $bestIndex = $index;
                }
            }

            if ($bestIndex !== null) {
                $claimedBookIndexes[] = $bestIndex;
                $matched[] = [
                    'statement' => $statementLine,
                    'book' => $bookEntries[$bestIndex],
                ];
            } else {
                $unmatchedStatement[] = $statementLine;
            }
        }

        $unmatchedBookItems = [];
        foreach ($bookEntries as $index => $entry) {
            if (in_array($index, $claimedBookIndexes, true)) continue;
            $unmatchedBookItems[] = [
                'type' => $entry['amount'] >= 0 ? 'deposit_in_transit' : 'outstanding_payment',
                'description' => trim($entry['description'] . ($entry['entry_number'] ? " ({$entry['entry_number']})" : '')),
                'amount' => abs($entry['amount']),
                'date' => $entry['date'],
            ];
        }

        return [
            'matched' => $matched,
            'unmatched_book_items' => $unmatchedBookItems,
            'unmatched_statement_lines' => $unmatchedStatement,
        ];
    }

    /**
     * Trial Balance: every active account's balance as of a date, split into the
     * Debit/Credit columns. Total debits must equal total credits.
     */
    public function trialBalance(?string $asOf = null): array
    {
        $asOf = $asOf ?? now()->toDateString();
        $accounts = ChartOfAccount::where('is_active', true)->orderBy('code')->get();

        $rows = [];
        $totalDebit = 0;
        $totalCredit = 0;

        foreach ($accounts as $account) {
            $balance = $account->balance($asOf);
            if (abs($balance) < 0.01) {
                continue;
            }
            $debitColumn = $account->normal_balance === 'debit' ? max($balance, 0) : max(-$balance, 0);
            $creditColumn = $account->normal_balance === 'credit' ? max($balance, 0) : max(-$balance, 0);

            $totalDebit += $debitColumn;
            $totalCredit += $creditColumn;

            $rows[] = [
                'id' => $account->id,
                'code' => $account->code,
                'name' => $account->name,
                'type' => $account->type,
                'debit' => round($debitColumn, 2),
                'credit' => round($creditColumn, 2),
            ];
        }

        return [
            'as_of' => $asOf,
            'rows' => $rows,
            'total_debit' => round($totalDebit, 2),
            'total_credit' => round($totalCredit, 2),
            'is_balanced' => round($totalDebit, 2) === round($totalCredit, 2),
        ];
    }

    /**
     * Income Statement (Profit & Loss) for a period: Income accounts minus
     * Expense accounts, restricted to the date range.
     */
    public function incomeStatement(?string $from = null, ?string $to = null): array
    {
        $to = $to ?? now()->toDateString();
        $from = $from ?? now()->startOfYear()->toDateString();

        $income = ChartOfAccount::where('type', 'income')->where('is_active', true)->orderBy('code')->get()
            ->map(fn($a) => ['id' => $a->id, 'code' => $a->code, 'name' => $a->name, 'amount' => $a->balance($to, $from)])
            ->filter(fn($r) => abs($r['amount']) > 0.01)->values();

        $expense = ChartOfAccount::where('type', 'expense')->where('is_active', true)->orderBy('code')->get()
            ->map(fn($a) => ['id' => $a->id, 'code' => $a->code, 'name' => $a->name, 'amount' => $a->balance($to, $from)])
            ->filter(fn($r) => abs($r['amount']) > 0.01)->values();

        $totalIncome = round($income->sum('amount'), 2);
        $totalExpense = round($expense->sum('amount'), 2);

        return [
            'from' => $from,
            'to' => $to,
            'income' => $income,
            'expense' => $expense,
            'total_income' => $totalIncome,
            'total_expense' => $totalExpense,
            'net_income' => round($totalIncome - $totalExpense, 2),
        ];
    }

    /**
     * Balance Sheet as of a date: Assets = Liabilities + Equity. Since no period-
     * close entries are posted, undistributed net income (all income minus all
     * expense to date) is rolled into Equity as "Current Period Earnings".
     */
    public function balanceSheet(?string $asOf = null): array
    {
        $asOf = $asOf ?? now()->toDateString();

        $section = fn(string $type) => ChartOfAccount::where('type', $type)->where('is_active', true)->orderBy('code')->get()
            ->map(fn($a) => ['id' => $a->id, 'code' => $a->code, 'name' => $a->name, 'amount' => $a->balance($asOf)])
            ->filter(fn($r) => abs($r['amount']) > 0.01)->values();

        $assets = $section('asset');
        $liabilities = $section('liability');
        $equity = $section('equity');

        $netIncomeToDate = $this->incomeStatement(null, $asOf);
        $currentEarnings = $netIncomeToDate['net_income'];
        if (abs($currentEarnings) > 0.01) {
            $equity->push(['id' => null, 'code' => null, 'name' => 'Current Period Earnings', 'amount' => $currentEarnings]);
        }

        $totalAssets = round($assets->sum('amount'), 2);
        $totalLiabilities = round($liabilities->sum('amount'), 2);
        $totalEquity = round($equity->sum('amount'), 2);

        return [
            'as_of' => $asOf,
            'assets' => $assets,
            'liabilities' => $liabilities,
            'equity' => $equity,
            'total_assets' => $totalAssets,
            'total_liabilities' => $totalLiabilities,
            'total_equity' => $totalEquity,
            'is_balanced' => round($totalAssets, 2) === round($totalLiabilities + $totalEquity, 2),
        ];
    }

    /**
     * Cash Book: combined ledger across every account flagged is_cash_account.
     */
    public function cashBook(?string $from = null, ?string $to = null): array
    {
        $cashAccounts = ChartOfAccount::where('is_cash_account', true)->where('is_active', true)->orderBy('code')->get();

        $accounts = $cashAccounts->map(function ($account) use ($from, $to) {
            return $this->generalLedger($account->id, $from, $to);
        })->values();

        $combinedOpening = round($accounts->sum('opening_balance'), 2);
        $combinedClosing = round($accounts->sum('closing_balance'), 2);

        return [
            'from' => $from,
            'to' => $to,
            'accounts' => $accounts,
            'combined_opening_balance' => $combinedOpening,
            'combined_closing_balance' => $combinedClosing,
        ];
    }

    // ── System account codes for branch-report and payment-request posting ────
    const OTHER_INCOME   = '4040';
    const OTHER_EXPENSE  = '5070';

    /**
     * Post a branch report's financial data to the GL on approval.
     *
     * Each FinRow has:
     *   mapato (income collected in cash)  → Dr Cash / Cr Other Income
     *   matumizi (expenses paid in cash)   → Dr Other Operating Expenses / Cr Cash
     *
     * A single balanced journal entry covers all rows for the report period.
     * Skips posting if no financial data exists.
     */
    public function postBranchReportToGL(\App\Models\BranchReport $report, ?User $user = null): ?JournalEntry
    {
        $financials = $report->financials ?? [];
        $totalMapato   = 0;
        $totalMatumizi = 0;
        foreach ($financials as $row) {
            $totalMapato   += (float) ($row['mapato']   ?? 0);
            $totalMatumizi += (float) ($row['matumizi'] ?? 0);
        }

        if ($totalMapato <= 0 && $totalMatumizi <= 0) {
            return null; // nothing to post
        }

        $cash    = $this->account(self::CASH_ON_HAND);
        $income  = $this->account(self::OTHER_INCOME);
        $expense = $this->account(self::OTHER_EXPENSE);

        $branch  = $report->branch ?? 'Branch';
        $period  = optional($report->period_start)->format('d/m/Y') . '–' . optional($report->period_end)->format('d/m/Y');
        $lines   = [];

        if ($totalMapato > 0) {
            $lines[] = ['chart_of_account_id' => $cash->id,   'debit' => $totalMapato, 'credit' => 0,            'description' => "Branch income ({$branch}) {$period}"];
            $lines[] = ['chart_of_account_id' => $income->id, 'debit' => 0,            'credit' => $totalMapato, 'description' => "Branch income ({$branch}) {$period}"];
        }
        if ($totalMatumizi > 0) {
            $lines[] = ['chart_of_account_id' => $expense->id, 'debit' => $totalMatumizi, 'credit' => 0,             'description' => "Branch expenses ({$branch}) {$period}"];
            $lines[] = ['chart_of_account_id' => $cash->id,    'debit' => 0,              'credit' => $totalMatumizi, 'description' => "Branch expenses ({$branch}) {$period}"];
        }

        return $this->postJournalEntry([
            'entry_date'     => now()->toDateString(),
            'reference_type' => 'branch_report',
            'reference_id'   => $report->id,
            'description'    => "Branch Report: {$branch} ({$period})",
            'lines'          => $lines,
        ], $user);
    }

    /**
     * Post a payment request disbursement to the GL.
     *
     * Dr Other Operating Expenses (5070) / Cr Cash or Bank (1010/1020)
     * based on mode_of_payment.
     */
    public function postPaymentRequestToGL(\App\Models\PaymentRequest $pr, ?User $user = null): JournalEntry
    {
        $amount   = (float) ($pr->final_amount ?? $pr->amount);
        $expense  = $this->account(self::OTHER_EXPENSE);
        $payment  = $this->cashOrBankAccount($pr->mode_of_payment ?? 'cash');

        $desc = "Payment Request: {$pr->payable_to} — {$pr->activity_type}";

        return $this->postJournalEntry([
            'entry_date'     => now()->toDateString(),
            'reference_type' => 'payment_request',
            'reference_id'   => $pr->id,
            'description'    => $desc,
            'lines'          => [
                ['chart_of_account_id' => $expense->id, 'debit' => $amount,  'credit' => 0,       'description' => $desc],
                ['chart_of_account_id' => $payment->id, 'debit' => 0,        'credit' => $amount, 'description' => $desc],
            ],
        ], $user);
    }

    /**
     * Sequential, year-scoped entry number e.g. JE-2026-000001.
     */
    protected function nextEntryNumber(string $entryDate): string
    {
        $year = Carbon::parse($entryDate)->format('Y');
        $count = JournalEntry::whereYear('entry_date', $year)->count() + 1;
        return 'JE-' . $year . '-' . str_pad((string) $count, 6, '0', STR_PAD_LEFT);
    }
}
