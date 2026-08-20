<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('loan_settings', function (Blueprint $table) {
            $table->json('disburse_loan_roles')->nullable()->after('historical_loan_roles');
            $table->json('record_repayment_roles')->nullable()->after('disburse_loan_roles');
            $table->json('approve_payment_roles')->nullable()->after('record_repayment_roles');
        });
    }

    public function down(): void
    {
        Schema::table('loan_settings', function (Blueprint $table) {
            $table->dropColumn(['disburse_loan_roles', 'record_repayment_roles', 'approve_payment_roles']);
        });
    }
};
