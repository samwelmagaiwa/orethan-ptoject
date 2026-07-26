<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('loan_settings', function (Blueprint $table) {
            $table->decimal('penalty_rate', 10, 2)->default(1000)->change();
            $table->decimal('default_interest_rate', 10, 2)->default(3)->change();
            $table->decimal('default_processing_fee_rate', 10, 2)->default(0)->change();
        });
    }

    public function down(): void
    {
        Schema::table('loan_settings', function (Blueprint $table) {
            $table->decimal('penalty_rate', 5, 2)->default(4)->change();
            $table->decimal('default_interest_rate', 5, 2)->default(3)->change();
            $table->decimal('default_processing_fee_rate', 5, 2)->default(0)->change();
        });
    }
};
