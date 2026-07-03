<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('payroll_item_details', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('payroll_item_id');
            $table->unsignedBigInteger('component_id');
            $table->decimal('amount', 15, 2)->default(0);
            $table->timestamps();

            $table->foreign('payroll_item_id')->references('id')->on('payroll_items')->onDelete('cascade');
            $table->foreign('component_id')->references('id')->on('salary_components')->onDelete('cascade');
            $table->unique(['payroll_item_id', 'component_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_item_details');
    }
};
