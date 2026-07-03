<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->integer('risk_score')->nullable()->after('residency_type');
            $table->string('risk_grade', 10)->nullable()->after('risk_score');  // A, B, C, D, E
            $table->decimal('suggested_interest_rate', 6, 2)->nullable()->after('risk_grade');
            $table->timestamp('risk_scored_at')->nullable()->after('suggested_interest_rate');
            $table->json('risk_factors')->nullable()->after('risk_scored_at');
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->dropColumn(['risk_score', 'risk_grade', 'suggested_interest_rate', 'risk_scored_at', 'risk_factors']);
        });
    }
};
