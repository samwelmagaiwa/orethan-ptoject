<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('guarantors', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('loan_id');
            $table->string('guarantor_number', 20)->nullable();
            $table->string('full_name', 150);
            $table->string('relationship', 80)->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('nida_number', 50)->nullable();
            $table->string('id_type', 50)->nullable();
            $table->string('id_number', 80)->nullable();
            $table->date('date_of_birth')->nullable();
            $table->string('gender', 20)->nullable();
            $table->string('employment_status', 80)->nullable();
            $table->string('employer_name', 150)->nullable();
            $table->string('employer_phone', 20)->nullable();
            $table->string('employer_address', 255)->nullable();
            $table->decimal('monthly_income', 15, 2)->nullable();
            $table->string('region', 100)->nullable();
            $table->string('district', 100)->nullable();
            $table->string('ward', 100)->nullable();
            $table->string('street', 150)->nullable();
            $table->string('house_number', 50)->nullable();
            $table->string('photo_path', 500)->nullable();
            $table->enum('status', ['active', 'released', 'defaulted'])->default('active');
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->foreign('loan_id')->references('id')->on('loans')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('guarantors');
    }
};
