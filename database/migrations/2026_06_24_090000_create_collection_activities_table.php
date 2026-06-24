<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('collection_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('loan_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('customer_id')->nullable();
            // hatua: reminder | follow_up | recovery | escalation | closure
            $table->string('stage')->default('reminder');
            // njia: sms | email | call | whatsapp | letter | field_visit | app
            $table->string('contact_method')->nullable();
            $table->string('officer_name')->nullable();
            $table->text('notes')->nullable();
            // Ahadi ya kulipa
            $table->decimal('promised_amount', 15, 2)->nullable();
            $table->date('promised_date')->nullable();
            $table->date('expected_payment_date')->nullable();
            // hali ya ahadi: pending | fulfilled | missed
            $table->string('promise_status')->default('pending');
            $table->date('next_action_date')->nullable();
            // hali ya urejeshaji wa mkopo: reminder | follow_up | recovery | escalation | legal | restructured | written_off | closed
            $table->string('recovery_status')->default('reminder');
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->index(['loan_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('collection_activities');
    }
};
