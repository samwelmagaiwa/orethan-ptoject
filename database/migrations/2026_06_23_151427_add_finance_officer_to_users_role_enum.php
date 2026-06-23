<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::statement("ALTER TABLE `users` MODIFY `role` ENUM('admin','loan_officer','loan_manager','general_manager','managing_director','finance_officer') NOT NULL DEFAULT 'loan_officer'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement("ALTER TABLE `users` MODIFY `role` ENUM('admin','loan_officer','loan_manager','general_manager','managing_director') NOT NULL DEFAULT 'loan_officer'");
    }
};
