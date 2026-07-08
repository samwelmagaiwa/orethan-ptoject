<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // ── Scanner device inventory ───────────────────────────────────────────
        Schema::create('biometric_devices', function (Blueprint $table) {
            $table->id();
            $table->string('device_name');
            $table->string('device_model');
            $table->string('manufacturer');
            $table->string('serial_number')->unique();
            $table->string('firmware_version')->nullable();
            $table->string('sdk_version')->nullable();
            $table->string('branch')->nullable();
            $table->string('location')->nullable();
            $table->enum('status', ['active', 'inactive', 'maintenance'])->default('active');
            $table->foreignId('registered_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // ── Per-person biometric profile (one per borrower / guarantor / employee) ──
        Schema::create('biometric_profiles', function (Blueprint $table) {
            $table->id();
            $table->string('person_type');          // borrower | guarantor | employee
            $table->unsignedBigInteger('person_id');
            $table->enum('status', ['pending', 'enrolled', 'suspended'])->default('pending');
            $table->timestamp('enrollment_date')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['person_type', 'person_id']);
            $table->index(['person_type', 'person_id']);
        });

        // ── Encrypted fingerprint templates ───────────────────────────────────
        Schema::create('biometric_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('profile_id')->constrained('biometric_profiles')->cascadeOnDelete();
            $table->string('finger_name');          // right_thumb | left_thumb | right_index | left_index | right_middle | left_middle
            $table->text('fingerprint_template');   // AES-256-CBC encrypted base64 minutiae — never raw image
            $table->integer('quality_score')->default(0);
            $table->string('device_serial')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->index(['profile_id', 'finger_name']);
        });

        // ── Immutable audit log — no update/delete ever ────────────────────────
        Schema::create('biometric_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('profile_id')->nullable()->constrained('biometric_profiles')->nullOnDelete();
            $table->unsignedBigInteger('loan_id')->nullable();
            $table->string('action');               // enroll | verify | duplicate_check | exception | rescan
            $table->string('person_type')->nullable();
            $table->unsignedBigInteger('person_id')->nullable();
            $table->string('finger_name')->nullable();
            $table->enum('verification_result', ['success', 'failure', 'exception', 'pending', 'duplicate'])->nullable();
            $table->integer('similarity_score')->nullable();
            $table->integer('quality_score')->nullable();
            $table->string('device_id')->nullable();
            $table->foreignId('operator_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('branch')->nullable();
            $table->string('ip_address')->nullable();
            $table->string('machine_name')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('logged_at')->useCurrent();
            $table->index(['loan_id']);
            $table->index(['person_type', 'person_id']);
            $table->index(['logged_at']);
            $table->index(['action']);
        });

        // ── Supervisor-approved exceptions (proceed without biometric) ─────────
        Schema::create('biometric_exceptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('loan_id')->constrained('loans')->cascadeOnDelete();
            $table->string('person_type');
            $table->unsignedBigInteger('person_id');
            $table->string('reason');               // missing_finger | injury | scanner_failure | unreadable | other
            $table->text('notes')->nullable();
            $table->foreignId('authorized_by')->constrained('users');
            $table->foreignId('operator_id')->constrained('users');
            $table->string('ip_address')->nullable();
            $table->timestamps();
            $table->index(['loan_id', 'person_type']);
        });

        // ── Global biometric configuration ─────────────────────────────────────
        Schema::create('biometric_configs', function (Blueprint $table) {
            $table->id();
            $table->integer('min_quality_score')->default(60);
            $table->integer('min_similarity_score')->default(75);
            $table->integer('max_retry_attempts')->default(3);
            $table->boolean('required_for_disbursement')->default(true);
            $table->boolean('check_duplicates_on_enroll')->default(true);
            $table->string('allowed_roles')->default('admin,finance_officer');  // roles that can operate scanner
            $table->string('exception_roles')->default('admin,managing_director'); // roles that can authorize exceptions
            $table->timestamp('updated_at')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('biometric_configs');
        Schema::dropIfExists('biometric_exceptions');
        Schema::dropIfExists('biometric_logs');
        Schema::dropIfExists('biometric_templates');
        Schema::dropIfExists('biometric_profiles');
        Schema::dropIfExists('biometric_devices');
    }
};
