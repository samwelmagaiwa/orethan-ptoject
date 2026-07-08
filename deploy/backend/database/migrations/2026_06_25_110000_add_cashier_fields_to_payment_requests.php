<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('payment_requests', function (Blueprint $table) {
            // Hatua ya mwisho: Finance Officer / Cashier hutoa malipo
            $table->string('cashier_name')->nullable()->after('md_date');
            $table->text('cashier_comments')->nullable()->after('cashier_name');
            $table->string('cashier_reference')->nullable()->after('cashier_comments');
            $table->timestamp('cashier_date')->nullable()->after('cashier_reference');
        });
    }

    public function down(): void
    {
        Schema::table('payment_requests', function (Blueprint $table) {
            $table->dropColumn(['cashier_name', 'cashier_comments', 'cashier_reference', 'cashier_date']);
        });
    }
};
