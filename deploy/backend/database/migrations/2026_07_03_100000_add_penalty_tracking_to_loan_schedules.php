<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('loan_schedules', function (Blueprint $table) {
            // Cumulative penalty accumulated on this overdue installment
            $table->decimal('penalty_amount', 15, 2)->default(0)->after('amount_paid');
            // How many calendar days this installment has been overdue + accruing
            $table->unsignedInteger('penalty_days')->default(0)->after('penalty_amount');
            // Last date daily penalty was accrued (prevents double-accrual on same day)
            $table->date('penalty_accrued_date')->nullable()->after('penalty_days');
            // Last date guarantor received a daily penalty-update SMS
            $table->date('guarantor_penalty_date')->nullable()->after('guarantor_notified_at');
            // Timestamp when the 3-days-before reminder was sent to the borrower
            $table->timestamp('reminder_3day_sent_at')->nullable()->after('guarantor_penalty_date');
            // Timestamp when the due-today reminder was sent to the borrower
            $table->timestamp('reminder_due_sent_at')->nullable()->after('reminder_3day_sent_at');
        });
    }

    public function down(): void
    {
        Schema::table('loan_schedules', function (Blueprint $table) {
            $table->dropColumn([
                'penalty_amount',
                'penalty_days',
                'penalty_accrued_date',
                'guarantor_penalty_date',
                'reminder_3day_sent_at',
                'reminder_due_sent_at',
            ]);
        });
    }
};
