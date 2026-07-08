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
        Schema::table('loan_disbursements', function (Blueprint $table) {
            // Charges & net amount
            $table->decimal('processing_fee', 15, 2)->default(0)->after('amount');
            $table->decimal('insurance_fee', 15, 2)->default(0)->after('processing_fee');
            $table->decimal('other_charges', 15, 2)->default(0)->after('insurance_fee');
            $table->decimal('total_charges', 15, 2)->default(0)->after('other_charges');
            $table->decimal('net_amount', 15, 2)->default(0)->after('total_charges');

            // Auto-generated identifiers
            $table->string('voucher_number')->nullable()->unique()->after('net_amount');
            $table->string('receipt_number')->nullable()->unique()->after('voucher_number');

            // Payment + context
            $table->json('payment_details')->nullable()->after('transaction_reference');
            $table->string('narration')->nullable()->after('payment_details');
            $table->string('branch')->nullable()->after('narration');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('loan_disbursements', function (Blueprint $table) {
            $table->dropUnique(['voucher_number']);
            $table->dropUnique(['receipt_number']);
            $table->dropColumn([
                'processing_fee',
                'insurance_fee',
                'other_charges',
                'total_charges',
                'net_amount',
                'voucher_number',
                'receipt_number',
                'payment_details',
                'narration',
                'branch',
            ]);
        });
    }
};
