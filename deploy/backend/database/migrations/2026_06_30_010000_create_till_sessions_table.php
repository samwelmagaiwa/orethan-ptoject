<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-cashier till sessions: a cashier opens the till with a declared opening
 * float, transacts cash repayments (in) and cash disbursements (out) during the
 * shift, then closes with a physical cash count. Variance = counted − expected.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('till_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('status')->default('open'); // open | closed
            $table->decimal('opening_float', 15, 2)->default(0);
            $table->decimal('cash_in', 15, 2)->default(0);   // cash repayments collected
            $table->decimal('cash_out', 15, 2)->default(0);  // cash disbursed
            $table->decimal('expected_close', 15, 2)->default(0);
            $table->decimal('counted_close', 15, 2)->nullable();
            $table->decimal('variance', 15, 2)->nullable();
            $table->text('open_notes')->nullable();
            $table->text('close_notes')->nullable();
            $table->timestamp('opened_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('till_sessions');
    }
};
