<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Sms\SmsService;
use App\Sms\SmsTemplates;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    /** Only an admin may manage users. */
    private function guardAdmin(Request $request)
    {
        $u = $request->user();
        return ($u && $u->isAdmin()) ? null : response()->json(['message' => 'Admin pekee ndiye anaweza kusimamia watumiaji'], 403);
    }

    public function index(Request $request)
    {
        if ($r = $this->guardAdmin($request)) return $r;
        return User::select('id', 'name', 'email', 'phone', 'role', 'is_locked', 'locked_at', 'locked_reason', 'sidebar_permissions', 'full_sidebar_access')->get();
    }

    public function store(Request $request)
    {
        if ($r = $this->guardAdmin($request)) return $r;

        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users',
            'role' => 'required|in:admin,loan_officer,loan_manager,general_manager,managing_director,finance_officer',
            'phone' => 'nullable|string|max:20',
            'sidebar_permissions' => 'nullable|array',
            'sidebar_permissions.*' => 'boolean',
            'full_sidebar_access' => 'nullable|boolean',
        ]);

        $fullAccess = (bool) $request->input('full_sidebar_access', false);

        $user = User::create([
            'name'                => $request->name,
            'email'               => $request->email,
            'password'            => Hash::make('ORETHAN'),
            'role'                => $request->role,
            'phone'               => $request->phone,
            'must_change_password' => true,
            'password_expires_at'  => now()->addHours(12),
            'sidebar_permissions'  => $fullAccess ? [] : array_intersect_key(
                $request->input('sidebar_permissions', []),
                array_flip(User::SIDEBAR_KEYS)
            ),
            'full_sidebar_access'  => $fullAccess,
        ]);

        // Send welcome SMS with default password if user has a phone number
        if ($user->phone) {
            try {
                app(SmsService::class)->send(
                    $user->phone,
                    SmsTemplates::welcomeNewUser($user->name)
                );
            } catch (\Throwable) {
                // SMS failure must never block user creation
            }
        }

        ActivityLogger::log($request->user(), 'create', 'User', "Created user {$user->name} ({$user->role})", $user->id, $user->name);
        return response()->json($this->shape($user), 201);
    }

    public function update(Request $request, $id)
    {
        if ($r = $this->guardAdmin($request)) return $r;

        $user = User::findOrFail($id);

        $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'email' => 'sometimes|required|email|unique:users,email,' . $id,
            'role' => 'sometimes|required|in:admin,loan_officer,loan_manager,general_manager,managing_director,finance_officer',
            'phone' => 'nullable|string|max:20',
            'password' => 'nullable|string|min:6',
            'must_change_password' => 'nullable|boolean',
            'password_expires_at' => 'nullable|date',
            'sidebar_permissions' => 'nullable|array',
            'sidebar_permissions.*' => 'boolean',
            'full_sidebar_access' => 'nullable|boolean',
        ]);

        if ($request->has('name')) $user->name = $request->name;
        if ($request->has('email')) $user->email = $request->email;
        if ($request->has('role')) $user->role = $request->role;
        if ($request->has('phone')) $user->phone = $request->phone;
        if ($request->filled('password')) {
            $user->password = Hash::make($request->password);
        }
        if ($request->has('must_change_password')) $user->must_change_password = (bool) $request->must_change_password;
        if ($request->has('password_expires_at')) $user->password_expires_at = $request->password_expires_at;
        $fullAccess = $request->has('full_sidebar_access')
            ? (bool) $request->input('full_sidebar_access')
            : (bool) $user->full_sidebar_access;

        if ($request->has('full_sidebar_access')) {
            $user->full_sidebar_access = $fullAccess;
        }
        if ($request->has('sidebar_permissions')) {
            // Only known sidebar keys are persisted — anything else is silently dropped.
            // Full access and per-item overrides are mutually exclusive, so once full
            // access is on the per-item map is always cleared to avoid storing a
            // contradictory state (full access ON + everything denied, for example).
            $user->sidebar_permissions = $fullAccess ? [] : array_intersect_key(
                $request->input('sidebar_permissions', []),
                array_flip(User::SIDEBAR_KEYS)
            );
        } elseif ($fullAccess) {
            $user->sidebar_permissions = [];
        }
        $user->save();

        // Send SMS when admin resets a user's password back to ORETHAN
        if ($request->filled('password') && $request->has('must_change_password') && $request->must_change_password && $user->phone) {
            try {
                app(SmsService::class)->send($user->phone, SmsTemplates::passwordReset($user->name));
            } catch (\Throwable) {}
            ActivityLogger::log($request->user(), 'reset_password', 'User', "Reset password for {$user->name}", $user->id, $user->name);
        } else {
            ActivityLogger::log($request->user(), 'update', 'User', "Updated user {$user->name}", $user->id, $user->name);
        }

        return response()->json($this->shape($user));
    }

    public function destroy(Request $request, $id)
    {
        if ($r = $this->guardAdmin($request)) return $r;

        $user = User::findOrFail($id);
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'Huwezi kujifuta mwenyewe'], 422);
        }
        ActivityLogger::log($request->user(), 'delete', 'User', "Deleted user {$user->name} ({$user->role})", $user->id, $user->name);
        $user->tokens()->delete();
        $user->delete();
        return response()->json(['message' => 'User deleted']);
    }

    /** Lock a user out of the system and revoke their active sessions. */
    public function lock(Request $request, $id)
    {
        if ($r = $this->guardAdmin($request)) return $r;

        $user = User::findOrFail($id);
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'Huwezi kujifunga mwenyewe'], 422);
        }

        $data = $request->validate(['reason' => 'nullable|string|max:255']);
        $user->is_locked = true;
        $user->locked_at = now();
        $user->locked_reason = $data['reason'] ?? null;
        $user->save();
        $user->tokens()->delete(); // force logout everywhere

        ActivityLogger::log($request->user(), 'lock', 'User', "Locked user {$user->name}" . ($data['reason'] ? ": {$data['reason']}" : ""), $user->id, $user->name);
        return response()->json(['message' => 'User locked', 'user' => $this->shape($user)]);
    }

    public function unlock(Request $request, $id)
    {
        if ($r = $this->guardAdmin($request)) return $r;

        $user = User::findOrFail($id);
        $user->is_locked = false;
        $user->locked_at = null;
        $user->locked_reason = null;
        $user->save();

        ActivityLogger::log($request->user(), 'unlock', 'User', "Unlocked user {$user->name}", $user->id, $user->name);
        return response()->json(['message' => 'User unlocked', 'user' => $this->shape($user)]);
    }

    private function shape(User $u): array
    {
        return [
            'id' => $u->id, 'name' => $u->name, 'email' => $u->email, 'phone' => $u->phone,
            'role' => $u->role, 'is_locked' => (bool) $u->is_locked, 'locked_at' => $u->locked_at, 'locked_reason' => $u->locked_reason,
            'sidebar_permissions' => $u->sidebar_permissions ?? [], 'full_sidebar_access' => (bool) $u->full_sidebar_access,
        ];
    }
}
