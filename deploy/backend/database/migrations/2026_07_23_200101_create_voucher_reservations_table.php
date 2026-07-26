<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('voucher_reservations', function (Blueprint $table) {
            $table->id();
            $table->string('context_key')->unique(); // e.g. repay_cust_3, disburse_loan_7, payreq_12
            $table->unsignedInteger('voucher_number');
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('voucher_reservations');
    }
};
