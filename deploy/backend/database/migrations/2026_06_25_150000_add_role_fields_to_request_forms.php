<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('payment_requests', function (Blueprint $table) {
            $table->string('applicant_role')->nullable()->after('section');
        });
        Schema::table('leave_requests', function (Blueprint $table) {
            $table->string('employee_role')->nullable()->after('manager');
        });
        Schema::table('office_delegations', function (Blueprint $table) {
            $table->string('delegate_role')->nullable()->after('delegate_name');
        });
    }

    public function down(): void
    {
        Schema::table('payment_requests', fn(Blueprint $t) => $t->dropColumn('applicant_role'));
        Schema::table('leave_requests', fn(Blueprint $t) => $t->dropColumn('employee_role'));
        Schema::table('office_delegations', fn(Blueprint $t) => $t->dropColumn('delegate_role'));
    }
};
