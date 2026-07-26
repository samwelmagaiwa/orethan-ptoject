<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add a dedicated voucher_number column to journal_entries so that every
     * auto-posted GL entry is directly queryable by its physical voucher book
     * reference. This replaces the previous approach of embedding the voucher
     * inside the free-text description field.
     *
     * Sources:
     *   - loan_disbursements.voucher_number  → reference_type = 'loan_disbursement'
     *   - repayments.transaction_id          → reference_type = 'repayment'
     *   - payment_requests.cashier_reference → reference_type = 'payment_request'
     *   - manual journal entries             → null (entry_number serves as the reference)
     */
    public function up(): void
    {
        Schema::table('journal_entries', function (Blueprint $table) {
            $table->string('voucher_number', 20)->nullable()->after('reference_id');
            $table->index('voucher_number');
        });
    }

    public function down(): void
    {
        Schema::table('journal_entries', function (Blueprint $table) {
            $table->dropIndex(['voucher_number']);
            $table->dropColumn('voucher_number');
        });
    }
};
