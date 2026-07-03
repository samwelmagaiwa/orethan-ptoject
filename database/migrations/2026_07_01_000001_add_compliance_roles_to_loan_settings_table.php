<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('loan_settings', function (Blueprint $table) {
            $table->json('compliance_roles')->nullable()->after('default_processing_fee_rate');
        });

        DB::table('loan_settings')->update([
            'compliance_roles' => json_encode(['admin', 'general_manager', 'managing_director']),
        ]);
    }

    public function down(): void
    {
        Schema::table('loan_settings', function (Blueprint $table) {
            $table->dropColumn('compliance_roles');
        });
    }
};
