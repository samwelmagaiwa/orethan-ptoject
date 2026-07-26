<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('voucher_counter', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('next_number')->default(205);
        });

        // Seed the single counter row
        DB::table('voucher_counter')->insert(['id' => 1, 'next_number' => 205]);
    }

    public function down(): void
    {
        Schema::dropIfExists('voucher_counter');
    }
};
