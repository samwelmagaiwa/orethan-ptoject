<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_biometrics', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('customer_id');
            $table->string('finger_position', 30)->default('right_thumb');
            $table->longText('template');              // base64 ANSI minutiae template
            $table->longText('image_b64')->nullable(); // base64 BMP image for voucher printing
            $table->string('device_serial', 60)->nullable();
            $table->string('captured_by', 100)->nullable();
            $table->timestamps();

            $table->index('customer_id');
            $table->unique(['customer_id', 'finger_position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_biometrics');
    }
};
