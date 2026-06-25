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

        if (!Auth::attempt($request->only('email', 'password'))) {
            return response()->json([
                'message' => 'Invalid credentials'
            ], 401);
        }

        $user = User::where('email', $request->email)->firstOrFail();

        if ($user->isLocked()) {
            return response()->json([
                'message' => 'Akaunti yako imefungwa na msimamizi. Wasiliana na Admin. (Your account is locked.)' .
                    ($user->locked_reason ? ' Reason: ' . $user->locked_reason : ''),
            ], 403);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Login success',
            'user' => $user,
            'token' => $token,
            'role' => $user->role,
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