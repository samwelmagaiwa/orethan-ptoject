<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('loans', function (Blueprint $table) {
            if (!Schema::hasColumn('loans', 'guarantor_1_photo')) {
                $table->string('guarantor_1_photo')->nullable()->after('passport_photo');
            }
            if (!Schema::hasColumn('loans', 'guarantor_2_photo')) {
                $table->string('guarantor_2_photo')->nullable()->after('guarantor_1_photo');
            }
        });

    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('loans', function (Blueprint $table) {
            //
        });
    }
};
