<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use App\Models\User;

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

        // First-ever login -> require a 4-digit OTP (shown on screen, no SMS)
        if ($user->first_login) {
            $otp = (string) random_int(1000, 9999);
            $user->otp_code = $otp;
            $user->otp_expires_at = now()->addMinutes(10);
            $user->save();

            return response()->json([
                'otp_required' => true,
                'email' => $user->email,
                'otp' => $otp, // delivered via the built-in on-screen notification
                'message' => 'Enter the 4-digit verification code to continue.',
            ]);
        }

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

    /** Forgot password: verify the registered phone, reset to default ORETHAN. */
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

        $user->password = Hash::make('ORETHAN');
        $user->must_change_password = true;
        $user->save();

        return response()->json([
            'message' => 'Your password has been reset to the default password.',
            'default_password' => 'ORETHAN',
            'email' => $user->email,
        ]);
    }

    /** Change password (forced after a default reset), then require an OTP to finish. */
    public function changePassword(Request $request)
    {
        $data = $request->validate([
            'new_password' => 'required|string|min:6|confirmed',
        ]);

        $user = $request->user();
        $wasReset = (bool) $user->must_change_password;

        $user->password = Hash::make($data['new_password']);
        $user->must_change_password = false;

        // After a reset-driven change, send a verification code to finish.
        if ($wasReset) {
            $otp = (string) random_int(1000, 9999);
            $user->otp_code = $otp;
            $user->otp_expires_at = now()->addMinutes(10);
            $user->save();

            return response()->json([
                'otp_required' => true,
                'email' => $user->email,
                'otp' => $otp, // delivered via the built-in notification (no SMS gateway)
                'message' => 'Password changed. Enter the verification code to finish.',
            ]);
        }

        $user->save();
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
        $request->user()->currentAccessToken()->delete();
        
        return response()->json([
            'message' => 'Logged out successfully'
        ]);
    }

    // GET CURRENT USER
    public function me(Request $request)
    {
        return response()->json($request->user());
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