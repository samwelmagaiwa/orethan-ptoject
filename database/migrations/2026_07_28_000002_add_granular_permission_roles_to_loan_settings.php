<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('loan_settings', function (Blueprint $table) {
            // Loan Restructuring (split)
            $table->json('reschedule_loan_roles')->nullable()->after('approve_payment_roles');
            $table->json('writeoff_loan_roles')->nullable()->after('reschedule_loan_roles');
            $table->json('topup_loan_roles')->nullable()->after('writeoff_loan_roles');
            // Users Management (split)
            $table->json('manage_users_roles')->nullable()->after('topup_loan_roles');
            $table->json('lock_users_roles')->nullable()->after('manage_users_roles');
            // Global Settings (split)
            $table->json('edit_loan_rates_roles')->nullable()->after('lock_users_roles');
            $table->json('edit_access_control_roles')->nullable()->after('edit_loan_rates_roles');
            // Cashier Till
            $table->json('manage_till_roles')->nullable()->after('edit_access_control_roles');
            // Mikopo ya Zamani — add/import
            $table->json('add_historical_loan_roles')->nullable()->after('manage_till_roles');
        });
    }

    public function down(): void
    {
        Schema::table('loan_settings', function (Blueprint $table) {
            $table->dropColumn([
                'reschedule_loan_roles', 'writeoff_loan_roles', 'topup_loan_roles',
                'manage_users_roles', 'lock_users_roles',
                'edit_loan_rates_roles', 'edit_access_control_roles',
                'manage_till_roles', 'add_historical_loan_roles',
            ]);
        });
    }
};
