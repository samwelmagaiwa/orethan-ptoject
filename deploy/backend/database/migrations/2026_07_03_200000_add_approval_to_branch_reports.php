<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('branch_reports', function (Blueprint $table) {
            $table->string('approval_status')->default('pending')->after('status'); // pending | approved | rejected
            $table->unsignedBigInteger('approved_by')->nullable()->after('approval_status');
            $table->string('approved_by_name')->nullable()->after('approved_by');
            $table->timestamp('approved_at')->nullable()->after('approved_by_name');
            $table->boolean('lo_signed')->default(false)->after('approved_at');
            $table->boolean('lm_signed')->default(false)->after('lo_signed');
        });
    }

    public function down(): void
    {
        Schema::table('branch_reports', function (Blueprint $table) {
            $table->dropColumn(['approval_status','approved_by','approved_by_name','approved_at','lo_signed','lm_signed']);
        });
    }
};
