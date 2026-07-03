<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('loan_settings', function (Blueprint $table) {
            $table->json('payroll_access_roles')->nullable()->after('compliance_roles');
        });

        DB::table('loan_settings')->update([
            'payroll_access_roles' => json_encode(['admin', 'finance_officer', 'general_manager', 'managing_director']),
        ]);
    }

    public function down(): void
    {
        Schema::table('loan_settings', function (Blueprint $table) {
            $table->dropColumn('payroll_access_roles');
        });
    }
};
