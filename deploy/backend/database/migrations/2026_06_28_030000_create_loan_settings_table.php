<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('loan_settings', function (Blueprint $table) {
            $table->id();
            // All stored as plain percentage numbers (4.00 means 4%), not
            // fractions — every consumer divides by 100 at the point of use.
            $table->decimal('penalty_rate', 5, 2)->default(4.00);
            $table->decimal('default_interest_rate', 5, 2)->default(3.00);
            $table->decimal('default_processing_fee_rate', 5, 2)->default(0.00);
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // Single-row settings table, seeded with the values already live
        // across the app today (the three previously-duplicated 4% penalty
        // constants, and the 3% interest-rate fallback) so switching to this
        // table changes nothing until an admin explicitly edits it.
        DB::table('loan_settings')->insert([
            'penalty_rate' => 4.00,
            'default_interest_rate' => 3.00,
            'default_processing_fee_rate' => 0.00,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('loan_settings');
    }
};
