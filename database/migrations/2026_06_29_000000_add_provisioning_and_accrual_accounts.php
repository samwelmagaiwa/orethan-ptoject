<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Adds the two system accounts the loan-loss provisioning and daily interest
 * accrual features depend on, for databases seeded before they existed.
 * Fresh installs get them from ChartOfAccountsSeeder.
 */
return new class extends Migration {
    public function up(): void
    {
        $accounts = [
            ['code' => '1110', 'name' => 'Interest Receivable', 'type' => 'asset', 'normal_balance' => 'debit'],
            ['code' => '1150', 'name' => 'Allowance for Loan Losses', 'type' => 'asset', 'normal_balance' => 'credit'],
        ];

        foreach ($accounts as $a) {
            $exists = DB::table('chart_of_accounts')->where('code', $a['code'])->exists();
            if (!$exists) {
                DB::table('chart_of_accounts')->insert([
                    'code' => $a['code'],
                    'name' => $a['name'],
                    'type' => $a['type'],
                    'normal_balance' => $a['normal_balance'],
                    'is_cash_account' => false,
                    'is_system' => true,
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        DB::table('chart_of_accounts')->whereIn('code', ['1110', '1150'])->delete();
    }
};
