<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('loan_schedules', function (Blueprint $table) {
            // Set the first time a guarantor-overdue SMS goes out for this
            // installment — prevents re-notifying every day it stays unpaid.
            $table->timestamp('guarantor_notified_at')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('loan_schedules', function (Blueprint $table) {
            $table->dropColumn('guarantor_notified_at');
        });
    }
};
