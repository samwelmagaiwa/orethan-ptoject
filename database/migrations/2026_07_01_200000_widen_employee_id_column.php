<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropUnique('employees_employee_id_unique');
            $table->string('employee_id', 30)->change();
            $table->unique('employee_id');
        });
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropUnique('employees_employee_id_unique');
            $table->string('employee_id', 20)->change();
            $table->unique('employee_id');
        });
    }
};
