<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('loan_settings', function (Blueprint $table) {
            $table->json('branch_report_permissions')->nullable()->after('branch_report_roles');
        });

        DB::table('loan_settings')->update([
            'branch_report_permissions' => json_encode([
                'submit'   => ['loan_officer', 'loan_manager', 'finance_officer', 'general_manager', 'managing_director', 'admin'],
                'view_all' => ['loan_manager', 'general_manager', 'managing_director', 'admin'],
                'print'    => ['loan_officer', 'loan_manager', 'finance_officer', 'general_manager', 'managing_director', 'admin'],
                'approve'  => ['loan_manager', 'admin'],
                'delete'   => ['admin'],
            ]),
        ]);
    }

    public function down(): void
    {
        Schema::table('loan_settings', function (Blueprint $table) {
            $table->dropColumn('branch_report_permissions');
        });
    }
};
