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
        Schema::table('loans', function (Blueprint $table) {
            if (!Schema::hasColumn('loans', 'loan_account_number')) {
                $table->string('loan_account_number')->nullable()->unique()->after('id');
            }
            if (!Schema::hasColumn('loans', 'disbursed_at')) {
                $table->timestamp('disbursed_at')->nullable()->after('approved_at');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('loans', function (Blueprint $table) {
            if (Schema::hasColumn('loans', 'loan_account_number')) {
                $table->dropUnique(['loan_account_number']);
                $table->dropColumn('loan_account_number');
            }
            if (Schema::hasColumn('loans', 'disbursed_at')) {
                $table->dropColumn('disbursed_at');
            }
        });
    }
};
