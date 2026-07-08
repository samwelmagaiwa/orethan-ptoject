<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('loan_settings', function (Blueprint $table) {
            $table->string('salary_bank_account_code', 20)->default('1020')->after('payroll_access_roles');
            $table->string('salary_cash_account_code', 20)->default('1010')->after('salary_bank_account_code');
            $table->string('paye_payable_account_code', 20)->default('2210')->after('salary_cash_account_code');
            $table->string('nssf_payable_account_code', 20)->default('2220')->after('paye_payable_account_code');
        });
    }

    public function down(): void
    {
        Schema::table('loan_settings', function (Blueprint $table) {
            $table->dropColumn([
                'salary_bank_account_code',
                'salary_cash_account_code',
                'paye_payable_account_code',
                'nssf_payable_account_code',
            ]);
        });
    }
};
