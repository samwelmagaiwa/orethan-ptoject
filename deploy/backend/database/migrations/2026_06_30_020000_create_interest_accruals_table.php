<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Daily interest accrual ledger — one row per loan per accrual date, so a run is
 * idempotent (a date already accrued for a loan is never double-posted). Each row
 * links to the aggregate journal entry posted for that day.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('interest_accruals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('loan_id')->constrained()->cascadeOnDelete();
            $table->date('accrual_date');
            $table->decimal('outstanding', 15, 2)->default(0);
            $table->decimal('amount', 15, 2)->default(0);
            $table->unsignedBigInteger('journal_entry_id')->nullable();
            $table->timestamps();
            $table->unique(['loan_id', 'accrual_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('interest_accruals');
    }
};
