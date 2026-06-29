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
        Schema::table('repayment_schedules', function (Blueprint $table) {
            if (!Schema::hasColumn('repayment_schedules', 'loan_id')) {
                $table->foreignId('loan_id')->constrained()->onDelete('cascade');
            }
            if (!Schema::hasColumn('repayment_schedules', 'installment_number')) {
                $table->integer('installment_number');
            }
            if (!Schema::hasColumn('repayment_schedules', 'due_date')) {
                $table->date('due_date');
            }
            if (!Schema::hasColumn('repayment_schedules', 'principal_amount')) {
                $table->decimal('principal_amount', 15, 2);
            }
            if (!Schema::hasColumn('repayment_schedules', 'interest_amount')) {
                $table->decimal('interest_amount', 15, 2);
            }
            if (!Schema::hasColumn('repayment_schedules', 'total_amount')) {
                $table->decimal('total_amount', 15, 2);
            }
            if (!Schema::hasColumn('repayment_schedules', 'remaining_balance')) {
                $table->decimal('remaining_balance', 15, 2);
            }
            if (!Schema::hasColumn('repayment_schedules', 'status')) {
                $table->string('status')->default('pending');
            }
            if (!Schema::hasColumn('repayment_schedules', 'paid_amount')) {
                $table->decimal('paid_amount', 15, 2)->default(0);
            }
            if (!Schema::hasColumn('repayment_schedules', 'paid_date')) {
                $table->date('paid_date')->nullable();
            }
            if (!Schema::hasColumn('repayment_schedules', 'penalty_amount')) {
                $table->decimal('penalty_amount', 15, 2)->default(0);
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
