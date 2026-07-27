<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('payment_requests', function (Blueprint $table) {
            $table->string('voucher_number', 20)->nullable()->after('cashier_reference');
        });
    }

    public function down(): void
    {
        Schema::table('payment_requests', function (Blueprint $table) {
            $table->dropColumn('voucher_number');
        });
    }
};
