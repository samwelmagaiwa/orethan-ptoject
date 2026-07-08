<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Per-item overrides keyed by sidebar item (e.g. {"accounting": true, "users": false}).
            // true = force-show regardless of role, false = force-hide regardless of role,
            // missing key = fall back to the role's default visibility.
            $table->json('sidebar_permissions')->nullable()->after('role');
            // When true, the user sees every configurable sidebar item regardless of
            // role or per-item overrides above.
            $table->boolean('full_sidebar_access')->default(false)->after('sidebar_permissions');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['sidebar_permissions', 'full_sidebar_access']);
        });
    }
};
