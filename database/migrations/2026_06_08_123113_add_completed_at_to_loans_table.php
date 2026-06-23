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
        Schema::table('loans', function (Blueprint $table) {
            // Add missing columns if they don't exist
            if (!Schema::hasColumn('loans', 'approved_by')) {
                $table->string('approved_by')->nullable()->after('rejection_reason');
            }
            if (!Schema::hasColumn('loans', 'approved_at')) {
                $table->timestamp('approved_at')->nullable()->after('approved_by');
            }
            if (!Schema::hasColumn('loans', 'monthly_payment')) {
                $table->decimal('monthly_payment', 15, 2)->nullable()->after('amount');
            }
            if (!Schema::hasColumn('loans', 'next_payment_date')) {
                $table->date('next_payment_date')->nullable()->after('monthly_payment');
            }

            // Ongeza column completed_at - tarehe mkopo ulipokamilika
            $table->timestamp('completed_at')->nullable()->after('approved_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('loans', function (Blueprint $table) {
            $table->dropColumn('completed_at');
        });
    }
};