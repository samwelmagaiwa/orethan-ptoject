<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('sms_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->foreignId('loan_id')->nullable()->constrained('loans')->nullOnDelete();
            $table->string('phone'); // normalized, e.g. 255743519104
            $table->string('type'); // disbursement, repayment, loan_approved, payment_reminder, payment_overdue
            $table->text('message');
            $table->enum('status', ['sent', 'failed'])->default('sent');
            $table->string('provider_message_id')->nullable();
            $table->text('provider_response')->nullable();
            $table->text('error')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sms_logs');
    }
};
