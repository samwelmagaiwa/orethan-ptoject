<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('payment_requests', function (Blueprint $table) {
            $table->id();

            // 01-09: Taarifa za mwombaji
            $table->string('applicant_name');
            $table->string('department')->nullable();
            $table->string('section')->nullable();
            $table->string('activity_type');           // aina ya shughuli
            $table->text('activity_detail')->nullable(); // maelezo ya ziada
            $table->string('loan_applicant_name')->nullable();
            $table->string('invoice_path')->nullable();  // ankara iliyoambatanishwa
            $table->string('mode_of_payment');           // cash | cheque | bank_transfer
            $table->string('payable_to');
            $table->string('currency')->default('TZS');  // TZS | USD
            $table->decimal('amount', 15, 2);            // kwa tarakimu
            $table->text('amount_in_words')->nullable();
            $table->string('applicant_signature')->nullable();
            $table->date('applicant_date')->nullable();

            // Mtiririko wa idhini
            // submitted -> manager_review -> gm_review -> md_review -> authorized | rejected
            $table->string('status')->default('manager_review');
            $table->decimal('final_amount', 15, 2)->nullable();

            // 10: Loan Manager / Head of Loan Department
            $table->string('manager_name')->nullable();
            $table->string('manager_decision')->nullable();   // approved | adjusted | not_approved
            $table->decimal('manager_adjusted_amount', 15, 2)->nullable();
            $table->text('manager_comments')->nullable();
            $table->timestamp('manager_date')->nullable();

            // 11: General Manager / Head of HR & Administration
            $table->string('gm_name')->nullable();
            $table->string('gm_decision')->nullable();
            $table->decimal('gm_adjusted_amount', 15, 2)->nullable();
            $table->text('gm_comments')->nullable();
            $table->timestamp('gm_date')->nullable();

            // 12: Managing Director (Authorisation)
            $table->string('md_name')->nullable();
            $table->text('md_comments')->nullable();
            $table->timestamp('md_date')->nullable();

            $table->string('rejection_reason')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_requests');
    }
};
