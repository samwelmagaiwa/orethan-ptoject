<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Ongeza columns kwenye loans table
        Schema::table('loans', function (Blueprint $table) {
            if (!Schema::hasColumn('loans', 'total_paid')) {
                $table->decimal('total_paid', 15, 2)->default(0)->after('amount');
            }
            if (!Schema::hasColumn('loans', 'remaining_balance')) {
                $table->decimal('remaining_balance', 15, 2)->nullable()->after('total_paid');
            }
            if (!Schema::hasColumn('loans', 'payment_status')) {
                $table->string('payment_status')->default('pending')->after('status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('loans', function (Blueprint $table) {
            $table->dropColumn(['total_paid', 'remaining_balance', 'payment_status']);
        });
    }
};