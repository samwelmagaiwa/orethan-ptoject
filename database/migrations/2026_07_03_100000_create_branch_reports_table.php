<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('branch_reports', function (Blueprint $table) {
            $table->id();
            $table->string('branch')->nullable();
            $table->string('department')->default('LOAN');
            $table->string('section')->nullable();
            $table->string('report_type');              // daily | weekly | monthly
            $table->date('period_start');
            $table->date('period_end');
            $table->unsignedBigInteger('submitted_by')->nullable();
            $table->string('submitted_by_name')->nullable();
            $table->json('operations')->nullable();     // UTENDAJI
            $table->json('financials')->nullable();     // daily rows
            $table->json('balances')->nullable();       // cash/mobile/safe
            $table->json('loan_officers')->nullable();  // officer performance
            $table->json('expected_loans')->nullable(); // pipeline
            $table->string('status')->default('submitted');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('branch_reports');
    }
};
