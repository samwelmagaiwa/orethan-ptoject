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
        Schema::table('repayments', function (Blueprint $table) {
            $table->text('reversal_reason')->nullable()->after('status');
            $table->string('authorized_by')->nullable()->after('reversal_reason');
            $table->unsignedBigInteger('reversed_by')->nullable()->after('authorized_by');
            $table->timestamp('reversed_at')->nullable()->after('reversed_by');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('repayments', function (Blueprint $table) {
            $table->dropColumn(['reversal_reason', 'authorized_by', 'reversed_by', 'reversed_at']);
        });
    }
};
