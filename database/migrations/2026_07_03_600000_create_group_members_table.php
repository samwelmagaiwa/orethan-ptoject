<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('group_members', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('loan_id');
            $table->string('full_name', 150);
            $table->enum('role', ['chairman', 'secretary', 'treasurer', 'member'])->default('member');
            $table->string('phone', 20)->nullable();
            $table->string('nida_number', 50)->nullable();
            $table->string('gender', 20)->nullable();
            $table->string('occupation', 150)->nullable();
            $table->decimal('monthly_income', 15, 2)->nullable();
            $table->string('region', 100)->nullable();
            $table->string('district', 100)->nullable();
            $table->string('ward', 100)->nullable();
            $table->string('street', 150)->nullable();
            $table->string('photo_path', 500)->nullable();
            $table->enum('kyc_status', ['pending', 'verified', 'rejected'])->default('pending');
            $table->decimal('share_amount', 15, 2)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('loan_id')->references('id')->on('loans')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('group_members');
    }
};
