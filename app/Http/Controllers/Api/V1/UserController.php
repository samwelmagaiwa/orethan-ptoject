<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\AuditLog;
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
            'password' => 'required|string|min:6',
            'role' => 'required|in:admin,loan_officer,loan_manager,general_manager,managing_director,finance_officer',
            'phone' => 'nullable|string|max:20',
            'sidebar_permissions' => 'nullable|array',
            'sidebar_permissions.*' => 'boolean',
            'full_sidebar_access' => 'nullable|boolean',
        ]);

        $fullAccess = (bool) $request->input('full_sidebar_access', false);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'role' => $request->role,
            'phone' => $request->phone,
            // Full access and per-item overrides are mutually exclusive — see update().
            'sidebar_permissions' => $fullAccess ? [] : array_intersect_key(
                $request->input('sidebar_permissions', []),
                array_flip(User::SIDEBAR_KEYS)
            ),
            'full_sidebar_access' => $fullAccess,
        ]);

        return response()->json($this->shape($user), 201);
    }

    public function update(Request $request, $id)
    {
        if ($r = $this->guardAdmin($request)) return $r;

        $user = User::findOrFail($id);

        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email,' . $id,
            'role' => 'required|in:admin,loan_officer,loan_manager,general_manager,managing_director,finance_officer',
            'phone' => 'nullable|string|max:20',
            'password' => 'nullable|string|min:6',
            'sidebar_permissions' => 'nullable|array',
            'sidebar_permissions.*' => 'boolean',
            'full_sidebar_access' => 'nullable|boolean',
        ]);

        $user->name = $request->name;
        $user->email = $request->email;
        $user->role = $request->role;
        $user->phone = $request->phone;
        if ($request->filled('password')) {
            $user->password = Hash::make($request->password);
        }
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

        return response()->json($this->shape($user));
    }

    public function destroy(Request $request, $id)
    {
        if ($r = $this->guardAdmin($request)) return $r;

        $user = User::findOrFail($id);
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'Huwezi kujifuta mwenyewe'], 422);
        }
        AuditLog::record('user.deleted', $request->user(), $user, 'Mtumiaji amefutwa: ' . $user->name);
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

        AuditLog::record('user.locked', $request->user(), $user, 'Mtumiaji amefungwa: ' . $user->name, ['reason' => $data['reason'] ?? null]);
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

        AuditLog::record('user.unlocked', $request->user(), $user, 'Mtumiaji amefunguliwa: ' . $user->name);
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
