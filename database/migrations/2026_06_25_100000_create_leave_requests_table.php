<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('leave_requests', function (Blueprint $table) {
            $table->id();

            // Taarifa za likizo / Leave information
            $table->string('employee_name');
            $table->string('department')->nullable();
            $table->string('manager')->nullable();              // Mkuu wa kazi / Supervisor
            $table->string('absence_type');                     // sick|bereavement|unpaid|personal|maternity|other
            $table->string('absence_other')->nullable();        // maelezo kama "Others"
            $table->date('from_date');
            $table->date('to_date');
            $table->text('reason')->nullable();
            $table->string('employee_signature')->nullable();
            $table->date('employee_date')->nullable();

            // Mtiririko wa idhini (sawa na Payment Request)
            // manager_review -> gm_review -> md_review -> authorized | rejected
            $table->string('status')->default('manager_review');

            // Manager / Supervisor
            $table->string('manager_name')->nullable();
            $table->string('manager_decision')->nullable();     // approved | not_approved
            $table->text('manager_comments')->nullable();
            $table->timestamp('manager_date')->nullable();

            // General Manager / HR
            $table->string('gm_name')->nullable();
            $table->string('gm_decision')->nullable();
            $table->text('gm_comments')->nullable();
            $table->timestamp('gm_date')->nullable();

            // Managing Director / Employer
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
        Schema::dropIfExists('leave_requests');
    }
};
