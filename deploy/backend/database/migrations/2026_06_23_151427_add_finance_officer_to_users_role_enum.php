<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // ALTER TABLE ... MODIFY is MySQL-only syntax; SQLite (used in tests)
        // does not support it, so we skip it for non-MySQL connections.
        if (DB::getDriverName() !== 'sqlite') {
            DB::statement("ALTER TABLE `users` MODIFY `role` ENUM('admin','loan_officer','loan_manager','general_manager','managing_director','finance_officer') NOT NULL DEFAULT 'loan_officer'");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            DB::statement("ALTER TABLE `users` MODIFY `role` ENUM('admin','loan_officer','loan_manager','general_manager','managing_director') NOT NULL DEFAULT 'loan_officer'");
        }
    }
};
