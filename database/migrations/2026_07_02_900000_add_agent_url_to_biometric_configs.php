<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('biometric_configs', function (Blueprint $table) {
            $table->string('agent_websocket_url', 255)->default('ws://localhost:9000')->after('exception_roles');
        });
    }

    public function down(): void
    {
        Schema::table('biometric_configs', function (Blueprint $table) {
            $table->dropColumn('agent_websocket_url');
        });
    }
};
