<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('repayments', function (Blueprint $table) {
            if (!Schema::hasColumn('repayments', 'repayment_schedule_id')) {
                $table->foreignId('repayment_schedule_id')->nullable()->constrained()->onDelete('set null')->after('loan_id');
            }
            if (!Schema::hasColumn('repayments', 'penalty_amount')) {
                $table->decimal('penalty_amount', 15, 2)->default(0)->after('principal_amount');
            }
            if (!Schema::hasColumn('repayments', 'collector_name')) {
                $table->string('collector_name')->nullable()->after('receipt_number');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No-op to avoid dropping columns that are required and created by the create migration
    }
};
