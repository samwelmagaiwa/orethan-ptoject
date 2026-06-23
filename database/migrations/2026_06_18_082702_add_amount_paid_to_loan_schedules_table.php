<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('loan_schedules', function (Blueprint $table) {
            $table->decimal('amount_paid', 15, 2)->default(0)->after('balance_remaining');
        });
    }

    public function down(): void
    {
        Schema::table('loan_schedules', function (Blueprint $table) {
            $table->dropColumn('amount_paid');
        });
    }
};
