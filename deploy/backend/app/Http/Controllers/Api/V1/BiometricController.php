<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\BiometricProfile;
use App\Models\BiometricTemplate;
use App\Models\BiometricLog;
use App\Models\BiometricDevice;
use App\Models\BiometricException;
use App\Models\Loan;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class BiometricController extends Controller
{
    // ── Encryption helpers ─────────────────────────────────────────────────────
    private function encryptTemplate(string $raw): string
    {
        $key = substr(hash('sha256', config('app.key', 'biometric-fallback-key-2026'), true), 0, 32);
        $iv  = random_bytes(16);
        $enc = openssl_encrypt($raw, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv);
        return base64_encode($iv . $enc);
    }

    private function decryptTemplate(string $stored): string
    {
        $key  = substr(hash('sha256', config('app.key', 'biometric-fallback-key-2026'), true), 0, 32);
        $data = base64_decode($stored);
        $iv   = substr($data, 0, 16);
        $enc  = substr($data, 16);
        return openssl_decrypt($enc, 'AES-256-CBC', $key, OPENSSL_RAW_DATA, $iv) ?: '';
    }

    // ── Config loader (with sane defaults) ────────────────────────────────────
    private function cfg(): array
    {
        try {
            $row = DB::table('biometric_configs')->first();
            if ($row) return (array) $row;
        } catch (\Throwable) {}
        return [
            'min_quality_score'           => 60,
            'min_similarity_score'        => 75,
            'max_retry_attempts'          => 3,
            'required_for_disbursement'   => true,
            'check_duplicates_on_enroll'  => true,
            'allowed_roles'               => 'admin,finance_officer',
            'exception_roles'             => 'admin,managing_director',
            'agent_websocket_url'         => 'ws://localhost:9000',
        ];
    }

    // ── Audit log helper ───────────────────────────────────────────────────────
    private function auditLog(array $fields, Request $request, ?int $operatorId = null): void
    {
        try {
            BiometricLog::create(array_merge([
                'operator_id'  => $operatorId ?? optional($request->user())->id,
                'branch'       => optional($request->user())->branch,
                'ip_address'   => $request->ip(),
                'machine_name' => $request->header('X-Machine-Name'),
                'logged_at'    => now(),
            ], $fields));
        } catch (\Throwable $e) {
            Log::error('biometric audit log failed: ' . $e->getMessage());
        }
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  ENROLLMENT
    // ══════════════════════════════════════════════════════════════════════════

    public function enroll(Request $request)
    {
        $data = $request->validate([
            'person_type'   => 'required|in:borrower,guarantor,employee',
            'person_id'     => 'required|integer|min:1',
            'finger_name'   => 'required|in:right_thumb,left_thumb,right_index,left_index,right_middle,left_middle',
            'template_data' => 'required|string|min:10',
            'quality_score' => 'required|integer|min:0|max:100',
            'device_serial' => 'nullable|string',
            'loan_id'       => 'nullable|integer',
        ]);

        $cfg        = $this->cfg();
        $minQuality = (int) $cfg['min_quality_score'];

        if ($data['quality_score'] < $minQuality) {
            return response()->json([
                'message' => "Quality {$data['quality_score']}% is below minimum {$minQuality}%. Please rescan.",
                'quality_score' => $data['quality_score'],
                'min_quality'   => $minQuality,
            ], 422);
        }

        $profile = BiometricProfile::firstOrCreate(
            ['person_type' => $data['person_type'], 'person_id' => $data['person_id']],
            ['created_by' => $request->user()->id, 'status' => 'pending']
        );

        // Deactivate existing template for this finger (one active template per finger)
        BiometricTemplate::where('profile_id', $profile->id)
            ->where('finger_name', $data['finger_name'])
            ->update(['is_active' => false]);

        $template = BiometricTemplate::create([
            'profile_id'            => $profile->id,
            'finger_name'           => $data['finger_name'],
            'fingerprint_template'  => $this->encryptTemplate($data['template_data']),
            'quality_score'         => $data['quality_score'],
            'device_serial'         => $data['device_serial'],
        ]);

        $activeCount = BiometricTemplate::where('profile_id', $profile->id)->where('is_active', true)->count();

        $profile->update(['status' => 'enrolled', 'enrollment_date' => now()]);

        $this->auditLog([
            'profile_id'          => $profile->id,
            'loan_id'             => $data['loan_id'] ?? null,
            'action'              => 'enroll',
            'person_type'         => $data['person_type'],
            'person_id'           => $data['person_id'],
            'finger_name'         => $data['finger_name'],
            'verification_result' => 'success',
            'quality_score'       => $data['quality_score'],
            'device_id'           => $data['device_serial'],
        ], $request);

        return response()->json([
            'message'            => 'Fingerprint enrolled successfully.',
            'profile_id'         => $profile->id,
            'template_id'        => $template->id,
            'templates_count'    => $activeCount,
            'enrolled_fingers'   => BiometricTemplate::where('profile_id', $profile->id)->where('is_active', true)->pluck('finger_name'),
        ], 201);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  DUPLICATE CHECK (1:N — run before enroll to prevent ghost accounts)
    // ══════════════════════════════════════════════════════════════════════════

    public function duplicateCheck(Request $request)
    {
        $data = $request->validate([
            'template_data'  => 'required|string',
            'quality_score'  => 'required|integer|min:0|max:100',
            'similarity_hit' => 'required|integer|min:0|max:100',  // score from local SDK 1:N search
            'matched_profile_id' => 'nullable|integer',
            'person_type'    => 'nullable|string',
            'person_id'      => 'nullable|integer',
            'device_serial'  => 'nullable|string',
            'loan_id'        => 'nullable|integer',
        ]);

        $cfg = $this->cfg();
        $isDuplicate = $data['similarity_hit'] >= (int) $cfg['min_similarity_score'];

        $matchedProfile = null;
        if ($isDuplicate && $data['matched_profile_id']) {
            $matchedProfile = BiometricProfile::with([])->find($data['matched_profile_id']);
        }

        $this->auditLog([
            'loan_id'             => $data['loan_id'] ?? null,
            'action'              => 'duplicate_check',
            'person_type'         => $data['person_type'],
            'person_id'           => $data['person_id'],
            'verification_result' => $isDuplicate ? 'duplicate' : 'success',
            'similarity_score'    => $data['similarity_hit'],
            'quality_score'       => $data['quality_score'],
            'device_id'           => $data['device_serial'],
        ], $request);

        return response()->json([
            'is_duplicate'      => $isDuplicate,
            'similarity_score'  => $data['similarity_hit'],
            'matched_profile'   => $matchedProfile,
            'message'           => $isDuplicate
                ? 'Duplicate fingerprint detected. This person may already be registered.'
                : 'No duplicate found. Safe to enroll.',
        ]);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  1:1 VERIFICATION (loan disbursement)
    // ══════════════════════════════════════════════════════════════════════════

    public function verify(Request $request)
    {
        $data = $request->validate([
            'person_type'      => 'required|in:borrower,guarantor,employee',
            'person_id'        => 'required|integer',
            'finger_name'      => 'nullable|string',
            'similarity_score' => 'required|integer|min:0|max:100',
            'quality_score'    => 'required|integer|min:0|max:100',
            'device_serial'    => 'nullable|string',
            'loan_id'          => 'nullable|integer',
            'notes'            => 'nullable|string',
        ]);

        $cfg       = $this->cfg();
        $minScore  = (int) $cfg['min_similarity_score'];
        $minQual   = (int) $cfg['min_quality_score'];

        $profile = BiometricProfile::where('person_type', $data['person_type'])
            ->where('person_id', $data['person_id'])
            ->first();

        if ($data['quality_score'] < $minQual) {
            return response()->json([
                'result'         => 'failure',
                'reason'         => 'quality',
                'message'        => "Quality {$data['quality_score']}% is below minimum {$minQual}%. Please rescan.",
                'quality_score'  => $data['quality_score'],
            ], 422);
        }

        $result = $data['similarity_score'] >= $minScore ? 'success' : 'failure';

        $this->auditLog([
            'profile_id'          => $profile?->id,
            'loan_id'             => $data['loan_id'] ?? null,
            'action'              => 'verify',
            'person_type'         => $data['person_type'],
            'person_id'           => $data['person_id'],
            'finger_name'         => $data['finger_name'],
            'verification_result' => $result,
            'similarity_score'    => $data['similarity_score'],
            'quality_score'       => $data['quality_score'],
            'device_id'           => $data['device_serial'],
            'notes'               => $data['notes'] ?? null,
        ], $request);

        return response()->json([
            'result'           => $result,
            'similarity_score' => $data['similarity_score'],
            'quality_score'    => $data['quality_score'],
            'threshold'        => $minScore,
            'profile_id'       => $profile?->id,
            'enrolled_fingers' => $profile ? $profile->activeTemplates()->pluck('finger_name') : [],
            'message'          => $result === 'success'
                ? 'Identity verified successfully.'
                : "Fingerprint does not match (score {$data['similarity_score']}% < threshold {$minScore}%). Please retry.",
        ]);
    }

    // ── Retrieve decrypted template(s) for local agent 1:1 matching ───────────
    public function getTemplates(Request $request)
    {
        $request->validate([
            'person_type' => 'required|in:borrower,guarantor,employee',
            'person_id'   => 'required|integer',
            'finger_name' => 'nullable|string',
        ]);

        $profile = BiometricProfile::where('person_type', $request->person_type)
            ->where('person_id', $request->person_id)
            ->first();

        if (!$profile) {
            return response()->json(['enrolled' => false, 'templates' => []]);
        }

        $query = BiometricTemplate::where('profile_id', $profile->id)->where('is_active', true);
        if ($request->finger_name) $query->where('finger_name', $request->finger_name);

        $templates = $query->get()->map(fn($t) => [
            'id'           => $t->id,
            'finger_name'  => $t->finger_name,
            'template'     => $this->decryptTemplate($t->fingerprint_template),
            'quality_score' => $t->quality_score,
        ]);

        return response()->json([
            'enrolled'         => true,
            'profile_id'       => $profile->id,
            'status'           => $profile->status,
            'enrolled_fingers' => $profile->activeTemplates()->pluck('finger_name'),
            'templates'        => $templates,
        ]);
    }

    // ── Profile status (no templates) ─────────────────────────────────────────
    public function getProfile(Request $request)
    {
        $request->validate([
            'person_type' => 'required|in:borrower,guarantor,employee',
            'person_id'   => 'required|integer',
        ]);

        $profile = BiometricProfile::where('person_type', $request->person_type)
            ->where('person_id', $request->person_id)
            ->first();

        if (!$profile) {
            return response()->json(['enrolled' => false, 'templates_count' => 0, 'enrolled_fingers' => []]);
        }

        return response()->json([
            'enrolled'          => $profile->status === 'enrolled',
            'profile_id'        => $profile->id,
            'status'            => $profile->status,
            'enrollment_date'   => $profile->enrollment_date,
            'templates_count'   => $profile->activeTemplates()->count(),
            'enrolled_fingers'  => $profile->activeTemplates()->pluck('finger_name'),
        ]);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  EXCEPTIONS (supervisor override)
    // ══════════════════════════════════════════════════════════════════════════

    public function createException(Request $request)
    {
        $data = $request->validate([
            'loan_id'     => 'required|integer|exists:loans,id',
            'person_type' => 'required|in:borrower,guarantor',
            'person_id'   => 'required|integer',
            'reason'      => 'required|in:missing_finger,injury,scanner_failure,unreadable,other',
            'notes'       => 'nullable|string|max:1000',
            'authorized_by' => 'required|integer|exists:users,id',
        ]);

        $cfg             = $this->cfg();
        $exceptionRoles  = array_map('trim', explode(',', $cfg['exception_roles']));
        $authorizer      = \App\Models\User::find($data['authorized_by']);

        if (!$authorizer || !in_array($authorizer->role, $exceptionRoles)) {
            return response()->json(['message' => 'Authorizing user does not have permission to approve biometric exceptions.'], 403);
        }

        $exception = BiometricException::create([
            'loan_id'       => $data['loan_id'],
            'person_type'   => $data['person_type'],
            'person_id'     => $data['person_id'],
            'reason'        => $data['reason'],
            'notes'         => $data['notes'],
            'authorized_by' => $data['authorized_by'],
            'operator_id'   => $request->user()->id,
            'ip_address'    => $request->ip(),
        ]);

        $this->auditLog([
            'loan_id'             => $data['loan_id'],
            'action'              => 'exception',
            'person_type'         => $data['person_type'],
            'person_id'           => $data['person_id'],
            'verification_result' => 'exception',
            'notes'               => "Reason: {$data['reason']}. Authorized by: {$authorizer->name}. Notes: " . ($data['notes'] ?? '—'),
        ], $request);

        return response()->json(['message' => 'Exception recorded. Disbursement may proceed.', 'exception_id' => $exception->id], 201);
    }

    // ── Check if an exception already exists for this person+loan ─────────────
    public function checkException(Request $request)
    {
        $request->validate([
            'loan_id'     => 'required|integer',
            'person_type' => 'required|string',
            'person_id'   => 'required|integer',
        ]);

        $ex = BiometricException::where('loan_id', $request->loan_id)
            ->where('person_type', $request->person_type)
            ->where('person_id', $request->person_id)
            ->with('authorizer:id,name,role')
            ->latest()
            ->first();

        return response()->json(['exception' => $ex]);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  DEVICES CRUD (admin)
    // ══════════════════════════════════════════════════════════════════════════

    public function devicesIndex(Request $request)
    {
        $devices = BiometricDevice::with('registeredBy:id,name')->orderByDesc('id')->get();
        return response()->json(['data' => $devices]);
    }

    public function devicesStore(Request $request)
    {
        $data = $request->validate([
            'device_name'      => 'required|string|max:100',
            'device_model'     => 'required|string|max:100',
            'manufacturer'     => 'required|string|max:100',
            'serial_number'    => 'required|string|unique:biometric_devices,serial_number',
            'firmware_version' => 'nullable|string',
            'sdk_version'      => 'nullable|string',
            'branch'           => 'nullable|string',
            'location'         => 'nullable|string',
            'status'           => 'nullable|in:active,inactive,maintenance',
        ]);
        $device = BiometricDevice::create(array_merge($data, ['registered_by' => $request->user()->id]));
        return response()->json(['message' => 'Device registered.', 'data' => $device->load('registeredBy:id,name')], 201);
    }

    public function devicesUpdate(Request $request, int $id)
    {
        $device = BiometricDevice::findOrFail($id);
        $data = $request->validate([
            'device_name'      => 'sometimes|string|max:100',
            'device_model'     => 'sometimes|string|max:100',
            'manufacturer'     => 'sometimes|string|max:100',
            'serial_number'    => "sometimes|string|unique:biometric_devices,serial_number,{$id}",
            'firmware_version' => 'nullable|string',
            'sdk_version'      => 'nullable|string',
            'branch'           => 'nullable|string',
            'location'         => 'nullable|string',
            'status'           => 'nullable|in:active,inactive,maintenance',
        ]);
        $device->update($data);
        return response()->json(['message' => 'Device updated.', 'data' => $device->fresh('registeredBy:id,name')]);
    }

    public function devicesDestroy(int $id)
    {
        BiometricDevice::findOrFail($id)->delete();
        return response()->json(['message' => 'Device removed.']);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  AUDIT LOGS (read-only)
    // ══════════════════════════════════════════════════════════════════════════

    public function logs(Request $request)
    {
        $query = BiometricLog::with('operator:id,name,role')
            ->orderByDesc('logged_at');

        if ($request->loan_id)   $query->where('loan_id', $request->loan_id);
        if ($request->action)    $query->where('action', $request->action);
        if ($request->result)    $query->where('verification_result', $request->result);
        if ($request->person_type) $query->where('person_type', $request->person_type);
        if ($request->from)      $query->whereDate('logged_at', '>=', $request->from);
        if ($request->to)        $query->whereDate('logged_at', '<=', $request->to);

        $logs = $query->paginate((int) ($request->per_page ?? 50));
        return response()->json($logs);
    }

    // ── Log stats for dashboard ────────────────────────────────────────────────
    public function logStats()
    {
        $today = now()->toDateString();
        return response()->json([
            'total_enrollments'     => BiometricLog::where('action', 'enroll')->count(),
            'total_verifications'   => BiometricLog::where('action', 'verify')->count(),
            'successful_today'      => BiometricLog::where('action', 'verify')->where('verification_result', 'success')->whereDate('logged_at', $today)->count(),
            'failed_today'          => BiometricLog::where('action', 'verify')->where('verification_result', 'failure')->whereDate('logged_at', $today)->count(),
            'exceptions_total'      => BiometricLog::where('action', 'exception')->count(),
            'enrolled_profiles'     => BiometricProfile::where('status', 'enrolled')->count(),
            'devices_active'        => BiometricDevice::where('status', 'active')->count(),
        ]);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  PROFILES list (admin)
    // ══════════════════════════════════════════════════════════════════════════

    public function profilesList(Request $request)
    {
        $query = BiometricProfile::withCount(['activeTemplates as fingers_enrolled'])
            ->with('creator:id,name')
            ->orderByDesc('id');

        if ($request->person_type) $query->where('person_type', $request->person_type);
        if ($request->status)      $query->where('status', $request->status);

        return response()->json(['data' => $query->paginate((int)($request->per_page ?? 50))]);
    }

    // ── Suspend / reactivate a profile ────────────────────────────────────────
    public function profileUpdateStatus(Request $request, int $id)
    {
        $request->validate(['status' => 'required|in:enrolled,suspended,pending']);
        $profile = BiometricProfile::findOrFail($id);
        $profile->update(['status' => $request->status]);

        $this->auditLog([
            'profile_id'          => $profile->id,
            'action'              => 'status_change',
            'person_type'         => $profile->person_type,
            'person_id'           => $profile->person_id,
            'verification_result' => 'success',
            'notes'               => "Status changed to {$request->status}",
        ], $request);

        return response()->json(['message' => "Profile status updated to {$request->status}."]);
    }

    // ── Delete a specific template (admin) ────────────────────────────────────
    public function deleteTemplate(int $id)
    {
        $template = BiometricTemplate::findOrFail($id);
        $template->update(['is_active' => false]);
        return response()->json(['message' => 'Template deactivated.']);
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  GLOBAL CONFIG (admin CRUD)
    // ══════════════════════════════════════════════════════════════════════════

    public function getConfig()
    {
        try {
            $row = DB::table('biometric_configs')->first();
            if (!$row) {
                // seed defaults
                DB::table('biometric_configs')->insert([
                    'min_quality_score'          => 60,
                    'min_similarity_score'        => 75,
                    'max_retry_attempts'          => 3,
                    'required_for_disbursement'   => 1,
                    'check_duplicates_on_enroll'  => 1,
                    'allowed_roles'               => 'admin,finance_officer',
                    'exception_roles'             => 'admin,managing_director',
                    'agent_websocket_url'         => 'ws://localhost:9000',
                ]);
                $row = DB::table('biometric_configs')->first();
            }
            return response()->json(['data' => $row]);
        } catch (\Throwable $e) {
            return response()->json(['data' => $this->cfg()]);
        }
    }

    public function updateConfig(Request $request)
    {
        $data = $request->validate([
            'min_quality_score'          => 'required|integer|min:0|max:100',
            'min_similarity_score'       => 'required|integer|min:0|max:100',
            'max_retry_attempts'         => 'required|integer|min:1|max:10',
            'required_for_disbursement'  => 'required|boolean',
            'check_duplicates_on_enroll' => 'required|boolean',
            'allowed_roles'              => 'required|string',
            'exception_roles'            => 'required|string',
            'agent_websocket_url'        => 'nullable|string|max:255',
        ]);

        DB::table('biometric_configs')->updateOrInsert(
            [],
            array_merge($data, [
                'updated_at' => now(),
                'updated_by' => $request->user()->id,
            ])
        );

        return response()->json(['message' => 'Biometric configuration saved.', 'data' => $data]);
    }

    // ── Loan-level biometric status (used by PaymentRequests UI) ──────────────
    public function loanBiometricStatus(Request $request, int $loanId)
    {
        $loan = Loan::findOrFail($loanId);

        $borrowerProfile = BiometricProfile::where('person_type', 'borrower')
            ->where('person_id', $loan->id)  // loan.id is used as person_id for borrower in this system
            ->first();

        // Guarantor: check by loan_id through the loan's guarantor field
        $guarantorId = $loan->dhamana_jina ?? null;  // adjust to actual guarantor FK if different

        $borrowerEx  = BiometricException::where('loan_id', $loanId)->where('person_type', 'borrower')->latest()->first();
        $guarantorEx = BiometricException::where('loan_id', $loanId)->where('person_type', 'guarantor')->latest()->first();

        // Most recent successful verification for this loan
        $borrowerVerified  = BiometricLog::where('loan_id', $loanId)->where('person_type', 'borrower')->where('verification_result', 'success')->exists()
            || $borrowerEx !== null;
        $guarantorVerified = BiometricLog::where('loan_id', $loanId)->where('person_type', 'guarantor')->where('verification_result', 'success')->exists()
            || $guarantorEx !== null;

        return response()->json([
            'loan_id'             => $loanId,
            'borrower_enrolled'   => $borrowerProfile?->status === 'enrolled',
            'borrower_verified'   => $borrowerVerified,
            'borrower_exception'  => $borrowerEx,
            'guarantor_verified'  => $guarantorVerified,
            'guarantor_exception' => $guarantorEx,
            'both_cleared'        => $borrowerVerified && $guarantorVerified,
            'config'              => $this->cfg(),
        ]);
    }
}
