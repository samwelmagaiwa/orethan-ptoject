<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('branch_reports', function (Blueprint $table) {
            $table->string('returned_to_stage')->nullable()->after('approved_at');  // 'lm' | 'lo'
            $table->string('returned_by_name')->nullable()->after('returned_to_stage');
            $table->text('return_reason')->nullable()->after('returned_by_name');
            $table->timestamp('returned_at')->nullable()->after('return_reason');
        });
    }

    public function down(): void
    {
        Schema::table('branch_reports', function (Blueprint $table) {
            $table->dropColumn(['returned_to_stage', 'returned_by_name', 'return_reason', 'returned_at']);
        });
    }
};
