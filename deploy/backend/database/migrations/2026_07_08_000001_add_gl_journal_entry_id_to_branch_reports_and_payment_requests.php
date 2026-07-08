<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('branch_reports', function (Blueprint $table) {
            $table->unsignedBigInteger('gl_journal_entry_id')->nullable()->after('approved_at');
        });

        Schema::table('payment_requests', function (Blueprint $table) {
            $table->unsignedBigInteger('gl_journal_entry_id')->nullable()->after('cashier_date');
        });
    }

    public function down(): void
    {
        Schema::table('branch_reports', function (Blueprint $table) {
            $table->dropColumn('gl_journal_entry_id');
        });
        Schema::table('payment_requests', function (Blueprint $table) {
            $table->dropColumn('gl_journal_entry_id');
        });
    }
};
