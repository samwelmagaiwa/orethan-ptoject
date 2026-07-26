<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('delinquency_escalations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('loan_id')->constrained()->onDelete('cascade');
            $table->integer('days_overdue');
            // manager | general_manager | managing_director
            $table->string('escalation_level');
            $table->foreignId('escalated_to')->nullable()->constrained('users')->onDelete('set null');
            $table->text('notes')->nullable();
            $table->timestamp('escalated_at');
            // prevent re-escalating to same level on same day
            $table->date('escalation_date');
            $table->timestamps();

            $table->unique(['loan_id', 'escalation_level', 'escalation_date'], 'delinq_loan_level_date_unique');
            $table->index(['loan_id', 'escalation_level']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delinquency_escalations');
    }
};
