<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Audit trail of loan-lifecycle actions (reschedule / write-off / top-up) plus a
 * couple of tracking columns on loans. Each row links to the GL journal entry it
 * produced (null for a pure reschedule, which moves no money).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('loan_restructures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('loan_id')->constrained()->cascadeOnDelete();
            $table->string('type'); // reschedule | writeoff | topup
            $table->decimal('amount', 15, 2)->default(0);
            $table->decimal('balance_before', 15, 2)->default(0);
            $table->decimal('balance_after', 15, 2)->default(0);
            $table->json('details')->nullable();
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('journal_entry_id')->nullable();
            $table->unsignedBigInteger('performed_by')->nullable();
            $table->timestamps();
        });

        Schema::table('loans', function (Blueprint $table) {
            if (!Schema::hasColumn('loans', 'written_off_at')) {
                $table->timestamp('written_off_at')->nullable()->after('completed_at');
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loan_restructures');
        if (Schema::hasColumn('loans', 'written_off_at')) {
            Schema::table('loans', function (Blueprint $table) {
                $table->dropColumn('written_off_at');
            });
        }
    }
};
