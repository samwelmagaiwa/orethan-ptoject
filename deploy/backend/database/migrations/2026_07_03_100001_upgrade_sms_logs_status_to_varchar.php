<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Upgrades sms_logs.status from a two-value ENUM to VARCHAR(20) so we can
 * record more granular states: pending | sent | delivered | failed | disabled
 */
return new class extends Migration
{
    public function up(): void
    {
        // Migrate existing 'sent' → 'sent', 'failed' → 'failed' (unchanged)
        DB::statement("ALTER TABLE sms_logs MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'sent'");
    }

    public function down(): void
    {
        // Coerce any new values back to 'failed' for safety before restoring enum
        DB::statement("UPDATE sms_logs SET status = 'failed' WHERE status NOT IN ('sent','failed')");
        DB::statement("ALTER TABLE sms_logs MODIFY COLUMN status ENUM('sent','failed') NOT NULL DEFAULT 'sent'");
    }
};
