<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('payment_requests', function (Blueprint $table) {
            $table->longText('applicant_signature_img')->nullable();
            $table->longText('manager_signature_img')->nullable();
            $table->longText('gm_signature_img')->nullable();
            $table->longText('md_signature_img')->nullable();
            $table->longText('cashier_signature_img')->nullable();
        });

        Schema::table('leave_requests', function (Blueprint $table) {
            $table->longText('employee_signature_img')->nullable();
            $table->longText('manager_signature_img')->nullable();
            $table->longText('gm_signature_img')->nullable();
            $table->longText('md_signature_img')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('payment_requests', function (Blueprint $table) {
            $table->dropColumn(['applicant_signature_img', 'manager_signature_img', 'gm_signature_img', 'md_signature_img', 'cashier_signature_img']);
        });
        Schema::table('leave_requests', function (Blueprint $table) {
            $table->dropColumn(['employee_signature_img', 'manager_signature_img', 'gm_signature_img', 'md_signature_img']);
        });
    }
};
