<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('loans', function (Blueprint $table) {

            if (!Schema::hasColumn('loans', 'details')) {
                $table->json('details')->nullable()->after('status');
            }

            if (!Schema::hasColumn('loans', 'phone')) {
                $table->string('phone')->nullable()->after('name');
            }

            if (!Schema::hasColumn('loans', 'rejection_reason')) {
                $table->text('rejection_reason')->nullable()->after('details');
            }

        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('loans', function (Blueprint $table) {

            if (Schema::hasColumn('loans', 'details')) {
                $table->dropColumn('details');
            }

            if (Schema::hasColumn('loans', 'phone')) {
                $table->dropColumn('phone');
            }

            if (Schema::hasColumn('loans', 'rejection_reason')) {
                $table->dropColumn('rejection_reason');
            }

        });
    }
};