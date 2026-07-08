<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('loans', function (Blueprint $table) {

            if (!Schema::hasColumn('loans', 'details')) {
                $table->json('details')->nullable()->after('status');
            }

            if (!Schema::hasColumn('loans', 'phone')) {
                $table->string('phone')->nullable()->after('status');
            }

        });
    }

    public function down(): void
    {
        Schema::table('loans', function (Blueprint $table) {
            $table->dropColumn(['details', 'phone']);
        });
    }
};