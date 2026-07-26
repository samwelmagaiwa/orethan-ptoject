<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('loan_settings', function (Blueprint $table) {
            $table->json('historical_loan_roles')->nullable()->after('branch_report_permissions');
        });

        // Seed default: LO, LM, and admin can import historical loans
        DB::table('loan_settings')->update([
            'historical_loan_roles' => json_encode(['loan_officer', 'loan_manager', 'admin']),
        ]);
    }

    public function down(): void
    {
        Schema::table('loan_settings', function (Blueprint $table) {
            $table->dropColumn('historical_loan_roles');
        });
    }
};
