<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Sms\GuarantorOverdueChecker;
use App\Sms\SmsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use App\Services\ActivityLogger;

class AuthController extends Controller
{
    // REGISTER
    public function register(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users',
            'password' => 'required|string|min:6',
            'role' => 'nullable|string|in:admin,loan_officer,loan_manager,general_manager,managing_director,finance_officer',
            'phone' => 'nullable|string|max:20',
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'role' => $request->role ?? 'loan_officer',
            'phone' => $request->phone,
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Registered successfully',
            'user' => $user,
            'token' => $token,
            'role' => $user->role,
        ], 201);
    }

    // LOGIN
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Invalid email or password'], 401);
        }

        if ($user->isLocked()) {
            return response()->json([
                'message' => 'Akaunti yako imefungwa na msimamizi. Wasiliana na Admin. (Your account is locked.)' .
                    ($user->locked_reason ? ' Reason: ' . $user->locked_reason : ''),
            ], 403);
        }

        // Temporary password expired — block login until admin resets the account
        if ($user->password_expires_at && now()->gt($user->password_expires_at) && $user->must_change_password) {
            return response()->json([
                'message' => 'Nenosiri lako la muda limeisha muda wake (masaa 12). Wasiliana na Admin ili kuweka upya akaunti yako. (Your temporary password has expired after 12 hours. Contact Admin to reset your account.)',
            ], 403);
        }

        // First-ever login -- send a 6-digit OTP to the user's phone
        if ($user->first_login) {
            $otp = (string) random_int(100000, 999999);
            $user->otp_code = $otp;
            $user->otp_expires_at = now()->addMinutes(10);
            $user->save();

            // Send via SMS; if the user has no phone on record the SMS fails
            // gracefully and the OTP still lives in otp_code so admin can relay it.
            $smsResult = app(SmsService::class)->sendOtp($user, $otp, 'first_login');

            return response()->json([
                'otp_required' => true,
                'email' => $user->email,
                'sms_sent' => $smsResult->success,
                'message' => $smsResult->success
                    ? 'A 6-digit verification code has been sent to your registered phone number.'
                    : 'Enter the verification code provided by your administrator.',
            ]);
        }

        ActivityLogger::log($user, 'login', 'Auth', "User logged in from {$request->ip()}");
        return $this->issueToken($user);
    }

    /** Verify the first-login OTP and issue the token. */
    public function verifyOtp(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email',
            'otp' => 'required|string',
        ]);

        $user = User::where('email', $data['email'])->first();
        if (!$user) {
            return response()->json(['message' => 'User not found'], 404);
        }
        if ($user->isLocked()) {
            return response()->json(['message' => 'Account is locked.'], 403);
        }
        if (!$user->otp_code || $user->otp_code !== $data['otp']) {
            return response()->json(['message' => 'Incorrect verification code.'], 422);
        }
        if (!$user->otp_expires_at || $user->otp_expires_at->isPast()) {
            return response()->json(['message' => 'The verification code has expired. Please log in again.'], 422);
        }

        $user->first_login = false;
        $user->otp_code = null;
        $user->otp_expires_at = null;
        $user->save();

        return $this->issueToken($user);
    }

    /**
     * Forgot password -- Step 1: send a 6-digit OTP to the user's registered phone.
     * The OTP is NOT returned in the response; the user must retrieve it from their phone.
     */
    public function forgotPassword(Request $request)
    {
        $data = $request->validate(['phone' => 'required|string']);

        $phone = preg_replace('/\s+/', '', $data['phone']);
        $user = User::whereRaw("REPLACE(phone,' ','') = ?", [$phone])->first();

        if (!$user) {
            return response()->json(['message' => 'No account is registered with that phone number.'], 404);
        }
        if ($user->isLocked()) {
            return response()->json(['message' => 'Account is locked. Contact the administrator.'], 403);
        }

        $otp = (string) random_int(100000, 999999); // 6-digit OTP
        $user->otp_code = $otp;
        $user->otp_expires_at = now()->addMinutes(10);
        $user->must_change_password = true;
        $user->save();

        // Send OTP to the user's phone -- never return it in the HTTP response
        app(SmsService::class)->sendOtp($user, $otp, 'forgot_password');

        return response()->json([
            'message' => 'A 6-digit verification code has been sent to your registered phone number.',
            'phone_hint' => substr($phone, 0, 4) . str_repeat('*', max(0, strlen($phone) - 7)) . substr($phone, -3),
        ]);
    }

    /**
     * Forgot password -- Step 2: verify the OTP and set a new password.
     * Issues a token on success so the user is immediately logged in.
     */
    public function verifyForgotPasswordOtp(Request $request)
    {
        $data = $request->validate([
            'phone'                 => 'required|string',
            'otp'                   => 'required|string',
            'new_password'          => 'required|string|min:6|confirmed',
        ]);

        $phone = preg_replace('/\s+/', '', $data['phone']);
        $user = User::whereRaw("REPLACE(phone,' ','') = ?", [$phone])->first();

        if (!$user) {
            return response()->json(['message' => 'User not found.'], 404);
        }
        if ($user->isLocked()) {
            return response()->json(['message' => 'Account is locked.'], 403);
        }
        if (!$user->otp_code || $user->otp_code !== $data['otp']) {
            return response()->json(['message' => 'Incorrect verification code.'], 422);
        }
        if (!$user->otp_expires_at || $user->otp_expires_at->isPast()) {
            return response()->json(['message' => 'Verification code has expired. Please request a new one.'], 422);
        }

        $user->password            = Hash::make($data['new_password']);
        $user->must_change_password = false;
        $user->otp_code            = null;
        $user->otp_expires_at      = null;
        $user->save();

        ActivityLogger::log($user, 'login', 'Auth', "Password reset via OTP, logged in");
        return $this->issueToken($user);
    }

    /** Resend the first-login OTP to the user's phone. */
    public function resendOtp(Request $request)
    {
        $data = $request->validate(['email' => 'required|email']);
        $user = User::where('email', $data['email'])->first();

        if (!$user || !$user->first_login) {
            // Don't reveal whether the email exists
            return response()->json(['message' => 'If an OTP is pending, a new code has been sent.']);
        }

        $otp = (string) random_int(100000, 999999);
        $user->otp_code = $otp;
        $user->otp_expires_at = now()->addMinutes(10);
        $user->save();

        $smsResult = app(SmsService::class)->sendOtp($user, $otp, 'first_login');

        return response()->json([
            'sms_sent' => $smsResult->success,
            'message'  => $smsResult->success
                ? 'A new verification code has been sent to your registered phone number.'
                : 'Could not send SMS. Please contact your administrator for the code.',
        ]);
    }

    /** Change password (voluntary change while already authenticated). */
    public function changePassword(Request $request)
    {
        $data = $request->validate([
            'new_password' => 'required|string|min:6|confirmed',
        ]);

        $user = $request->user();
        $user->password = Hash::make($data['new_password']);
        $user->must_change_password = false;
        $user->password_expires_at = null;
        $user->save();

        ActivityLogger::log($user, 'update', 'Auth', "Changed own password");
        return response()->json(['message' => 'Password changed successfully.']);
    }

    private function issueToken(User $user)
    {
        $token = $user->createToken('auth_token')->plainTextToken;
        return response()->json([
            'message' => 'Login success',
            'user' => $user,
            'token' => $token,
            'role' => $user->role,
            'must_change_password' => (bool) $user->must_change_password,
        ]);
    }

    // LOGOUT
    public function logout(Request $request)
    {
        $user = $request->user();
        ActivityLogger::log($user, 'logout', 'Auth', "User logged out");
        $user->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out successfully']);
    }

    // GET CURRENT USER
    public function me(Request $request)
    {
        // Zero-infrastructure fallback for the daily guarantor-overdue SMS
        // check -- runs at most once per calendar day, triggered by ordinary
        // page loads (every page calls /me on mount) rather than requiring a
        // server cron entry. See GuarantorOverdueChecker for details.
        GuarantorOverdueChecker::runIfDue(app(SmsService::class));

        $user = $request->user();
        $data = $user->toArray();
        $data['has_employee_record'] = \App\Models\Employee::where('user_id', $user->id)->exists();
        return response()->json($data);
    }

    // SAVE DRAWN SIGNATURE (base64 PNG data URL)
    public function saveSignature(Request $request)
    {
        $data = $request->validate([
            'signature' => 'required|string', // data:image/png;base64,....
        ]);

        if (!str_starts_with($data['signature'], 'data:image/')) {
            return response()->json(['message' => 'Invalid signature image'], 422);
        }

        $user = $request->user();
        $user->signature = $data['signature'];
        $user->save();

        return response()->json(['message' => 'Signature saved', 'signature' => $user->signature]);
    }

    // SAVE PROFILE AVATAR (base64 image data URL)
    public function saveAvatar(Request $request)
    {
        $data = $request->validate(['avatar' => 'required|string']);
        if (!str_starts_with($data['avatar'], 'data:image/')) {
            return response()->json(['message' => 'Invalid image'], 422);
        }
        $user = $request->user();
        $user->avatar = $data['avatar'];
        $user->save();
        return response()->json(['message' => 'Avatar saved', 'avatar' => $user->avatar]);
    }

    // VERIFY THE CURRENT USER'S PASSWORD/PIN (for re-auth gates)
    public function verifyPin(Request $request)
    {
        $data = $request->validate(['password' => 'required|string']);
        $ok = Hash::check($data['password'], $request->user()->password);
        return response()->json(['valid' => $ok], $ok ? 200 : 422);
    }
}