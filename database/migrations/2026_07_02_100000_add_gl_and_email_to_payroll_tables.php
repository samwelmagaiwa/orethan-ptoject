<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payrolls', function (Blueprint $table) {
            $table->unsignedBigInteger('gl_post_journal_id')->nullable()->after('approved_at');
            $table->unsignedBigInteger('gl_pay_journal_id')->nullable()->after('gl_post_journal_id');
        });

        Schema::table('payroll_items', function (Blueprint $table) {
            $table->timestamp('email_sent_at')->nullable()->after('payment_reference');
            $table->string('email_status', 20)->nullable()->after('email_sent_at'); // sent|failed|no_email
        });
    }

    public function down(): void
    {
        Schema::table('payrolls', function (Blueprint $table) {
            $table->dropColumn(['gl_post_journal_id', 'gl_pay_journal_id']);
        });
        Schema::table('payroll_items', function (Blueprint $table) {
            $table->dropColumn(['email_sent_at', 'email_status']);
        });
    }
};
