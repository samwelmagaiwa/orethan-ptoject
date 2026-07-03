<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('loan_settings', function (Blueprint $table) {
            $table->json('branch_report_roles')->nullable()->after('payroll_access_roles');
        });

        // Default: all staff roles can access Branch Report
        DB::table('loan_settings')->update([
            'branch_report_roles' => json_encode([
                'loan_officer', 'loan_manager', 'finance_officer',
                'general_manager', 'managing_director', 'admin',
            ]),
        ]);
    }

    public function down(): void
    {
        Schema::table('loan_settings', function (Blueprint $table) {
            $table->dropColumn('branch_report_roles');
        });
    }
};
