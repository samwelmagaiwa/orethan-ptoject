<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('sms_logs', function (Blueprint $table) {
            $table->unsignedBigInteger('payment_request_id')->nullable()->after('loan_id');
            $table->unsignedBigInteger('leave_request_id')->nullable()->after('payment_request_id');
            $table->unsignedBigInteger('branch_report_id')->nullable()->after('leave_request_id');

            $table->foreign('payment_request_id')->references('id')->on('payment_requests')->nullOnDelete();
            $table->foreign('leave_request_id')->references('id')->on('leave_requests')->nullOnDelete();
            $table->foreign('branch_report_id')->references('id')->on('branch_reports')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('sms_logs', function (Blueprint $table) {
            $table->dropForeign(['payment_request_id']);
            $table->dropForeign(['leave_request_id']);
            $table->dropForeign(['branch_report_id']);
            $table->dropColumn(['payment_request_id', 'leave_request_id', 'branch_report_id']);
        });
    }
};
