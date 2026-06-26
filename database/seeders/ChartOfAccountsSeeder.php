<?php

namespace Database\Seeders;

use App\Models\ChartOfAccount;
use Illuminate\Database\Seeder;

class ChartOfAccountsSeeder extends Seeder
{
    /**
     * Standard chart of accounts for a microfinance institution. Codes marked
     * 'system' are looked up by AccountingService when auto-posting loan
     * disbursements/repayments -- do not change their codes after go-live.
     */
    public function run(): void
    {
        $accounts = [
            // Assets
            ['code' => '1010', 'name' => 'Cash on Hand', 'type' => 'asset', 'normal_balance' => 'debit', 'is_cash_account' => true, 'is_system' => true],
            ['code' => '1020', 'name' => 'Bank Account', 'type' => 'asset', 'normal_balance' => 'debit', 'is_cash_account' => true, 'is_system' => true],
            ['code' => '1100', 'name' => 'Loans Receivable (Portfolio)', 'type' => 'asset', 'normal_balance' => 'debit', 'is_system' => true],
            ['code' => '1200', 'name' => 'Other Receivables', 'type' => 'asset', 'normal_balance' => 'debit'],
            ['code' => '1500', 'name' => 'Office Equipment', 'type' => 'asset', 'normal_balance' => 'debit'],

            // Liabilities
            ['code' => '2010', 'name' => 'Accounts Payable', 'type' => 'liability', 'normal_balance' => 'credit'],
            ['code' => '2020', 'name' => 'Loans Payable (Borrowings)', 'type' => 'liability', 'normal_balance' => 'credit'],
            ['code' => '2200', 'name' => 'Accrued Expenses Payable', 'type' => 'liability', 'normal_balance' => 'credit'],
            ['code' => '2300', 'name' => 'Taxes Payable', 'type' => 'liability', 'normal_balance' => 'credit'],

            // Equity
            ['code' => '3010', 'name' => 'Share Capital', 'type' => 'equity', 'normal_balance' => 'credit'],
            ['code' => '3020', 'name' => 'Retained Earnings', 'type' => 'equity', 'normal_balance' => 'credit', 'is_system' => true],

            // Income
            ['code' => '4010', 'name' => 'Interest Income', 'type' => 'income', 'normal_balance' => 'credit', 'is_system' => true],
            ['code' => '4020', 'name' => 'Fee Income (Processing/Insurance/Other)', 'type' => 'income', 'normal_balance' => 'credit', 'is_system' => true],
            ['code' => '4030', 'name' => 'Penalty Income', 'type' => 'income', 'normal_balance' => 'credit', 'is_system' => true],
            ['code' => '4040', 'name' => 'Other Income', 'type' => 'income', 'normal_balance' => 'credit'],

            // Expenses
            ['code' => '5010', 'name' => 'Salaries and Wages', 'type' => 'expense', 'normal_balance' => 'debit'],
            ['code' => '5020', 'name' => 'Rent Expense', 'type' => 'expense', 'normal_balance' => 'debit'],
            ['code' => '5030', 'name' => 'Utilities Expense', 'type' => 'expense', 'normal_balance' => 'debit'],
            ['code' => '5040', 'name' => 'Office Supplies Expense', 'type' => 'expense', 'normal_balance' => 'debit'],
            ['code' => '5050', 'name' => 'Loan Loss Provision Expense', 'type' => 'expense', 'normal_balance' => 'debit'],
            ['code' => '5060', 'name' => 'Bank Charges', 'type' => 'expense', 'normal_balance' => 'debit'],
            ['code' => '5070', 'name' => 'Other Operating Expenses', 'type' => 'expense', 'normal_balance' => 'debit'],
        ];

        foreach ($accounts as $account) {
            ChartOfAccount::updateOrCreate(
                ['code' => $account['code']],
                array_merge(['is_active' => true], $account)
            );
        }
    }
}
