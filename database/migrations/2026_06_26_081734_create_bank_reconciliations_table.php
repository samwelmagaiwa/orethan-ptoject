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
        Schema::create('bank_reconciliations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('chart_of_account_id')->constrained('chart_of_accounts')->onDelete('cascade');
            $table->date('statement_date');
            $table->decimal('statement_balance', 15, 2);
            $table->decimal('book_balance', 15, 2); // GL balance for the account as of statement_date
            $table->decimal('adjusted_balance', 15, 2)->default(0); // book_balance + deposits_in_transit - outstanding_payments
            $table->decimal('difference', 15, 2)->default(0); // statement_balance - adjusted_balance, 0 when reconciled
            $table->enum('status', ['draft', 'reconciled'])->default('draft');
            $table->text('notes')->nullable();
            $table->foreignId('reconciled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reconciled_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('bank_reconciliations');
    }
};
