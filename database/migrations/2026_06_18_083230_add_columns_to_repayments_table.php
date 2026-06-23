<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('repayments', function (Blueprint $table) {
            $table->foreignId('repayment_schedule_id')->nullable()->constrained()->onDelete('set null')->after('loan_id');
            $table->decimal('penalty_amount', 15, 2)->default(0)->after('principal_amount');
            $table->string('collector_name')->nullable()->after('receipt_number');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('repayments', function (Blueprint $table) {
            $table->dropForeign(['repayment_schedule_id']);
            $table->dropColumn(['repayment_schedule_id', 'penalty_amount', 'collector_name']);
        });
    }
};
