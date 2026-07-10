<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('loan_settings', function (Blueprint $table) {
            $table->unsignedSmallInteger('session_timeout_minutes')->default(30)->after('brand_color');
        });
    }

    public function down(): void
    {
        Schema::table('loan_settings', function (Blueprint $table) {
            $table->dropColumn('session_timeout_minutes');
        });
    }
};
