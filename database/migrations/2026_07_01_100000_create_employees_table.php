<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('employees', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable()->index();
            $table->string('employee_id', 20)->unique();
            $table->string('full_name');
            $table->string('department', 100)->nullable();
            $table->string('designation', 100)->nullable();
            $table->string('branch', 100)->nullable();
            $table->enum('employment_type', ['permanent', 'contract', 'casual', 'probation'])->default('permanent');
            $table->decimal('basic_salary', 15, 2)->default(0);
            $table->string('bank_name', 100)->nullable();
            $table->string('bank_account', 50)->nullable();
            $table->string('tin_number', 50)->nullable();
            $table->string('nssf_number', 50)->nullable();
            $table->string('nhif_number', 50)->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('email', 150)->nullable();
            $table->date('hire_date')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employees');
    }
};
