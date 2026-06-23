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
        Schema::table('repayment_schedules', function (Blueprint $table) {
            $table->foreignId('loan_id')->constrained()->onDelete('cascade');
            $table->integer('installment_number');
            $table->date('due_date');
            $table->decimal('principal_amount', 15, 2);
            $table->decimal('interest_amount', 15, 2);
            $table->decimal('total_amount', 15, 2);
            $table->decimal('remaining_balance', 15, 2);
            $table->string('status')->default('pending');
            $table->decimal('paid_amount', 15, 2)->default(0);
            $table->date('paid_date')->nullable();
            $table->decimal('penalty_amount', 15, 2)->default(0);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('repayment_schedules', function (Blueprint $table) {
            $table->dropForeign(['loan_id']);
            $table->dropColumn([
                'loan_id', 'installment_number', 'due_date', 'principal_amount',
                'interest_amount', 'total_amount', 'remaining_balance', 'status',
                'paid_amount', 'paid_date', 'penalty_amount',
            ]);
        });
    }
};
