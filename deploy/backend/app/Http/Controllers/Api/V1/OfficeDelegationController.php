<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\OfficeDelegation;
use App\Models\User;
use App\Models\AuditLog;
use App\Models\Notification;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;

class OfficeDelegationController extends Controller
{
    use ApiResponse;

    // Cheo cha juu kinaweza kuona ukaimishaji wa cheo cha chini (read-only oversight)
    const RANK = [
        'loan_officer' => 1, 'finance_officer' => 1,
        'loan_manager' => 2, 'general_manager' => 3, 'managing_director' => 4, 'admin' => 5,
    ];

    /** Majukumu yaliyo chini ya mtazamaji (oversight). */
    private function subordinateRoles($user): array
    {
        if ($user->isManagingDirector()) return ['loan_manager', 'general_manager'];
        if ($user->isGeneralManager()) return ['loan_manager'];
        return [];
    }

    private function canDelegate($user): bool
    {
        return $user->isManagingDirector() || $user->isGeneralManager() || $user->isLoanManager() || $user->isAdmin();
    }

    private function titleFor(string $role): array
    {
        return match ($role) {
            'general_manager' => ['General Manager', 'Acting General Manager'],
            'loan_manager' => ['Loan Manager', 'Acting Loan Manager'],
            default => ['Managing Director', 'Acting Managing Director'],
        };
    }

    /**
     * Watumishi ambao MD anaweza kuwakaimisha (wote isipokuwa yeye mwenyewe).
     */
    public function staff(Request $request)
    {
        $user = $request->user();
        $staff = User::where('id', '!=', $user->id)
            ->orderBy('name')
            ->get(['id', 'name', 'role', 'email']);
        return response()->json(['staff' => $staff]);
    }

    /**
     * MD anaunda fomu ya kukaimisha ofisi na madaraka.
     */
    public function store(Request $request)
    {
        $user = $request->user();
        if (!$this->canDelegate($user)) {
            return $this->error('Mkurugenzi, Meneja Mkuu au Meneja wa Mikopo pekee ndiye anaweza kukaimisha madaraka', 403);
        }
        [$delegatorTitle, $defaultActing] = $this->titleFor($user->role);

        $data = $request->validate([
            'delegate_id' => 'required|exists:users,id',
            'acting_title' => 'nullable|string|max:255',
            'reason' => 'nullable|string',
            'from_date' => 'required|date',
            'to_date' => 'required|date|after_or_equal:from_date',
            'responsibilities' => 'required|string',
            'limitations' => 'nullable|string',
            'handover_notes' => 'nullable|string',
            'delegator_signature_img' => 'nullable|string',
            'delegator_date' => 'nullable|date',
            'password' => 'required|string',
        ]);

        if (!Hash::check($data['password'], $user->password)) {
            return $this->error('Nenosiri si sahihi (PIN verification failed)', 422);
        }

        // Huwezi kujikaimisha mwenyewe
        if ((int) $data['delegate_id'] === (int) $user->id) {
            return $this->error('Huwezi kukaimisha madaraka kwako mwenyewe (You cannot delegate authority to yourself)', 422);
        }

        // Zuia kukaimisha mara mbili kwa kipindi kinachoendelea
        $hasActive = OfficeDelegation::where('delegator_id', $user->id)
            ->where('status', 'pending')->exists();
        if ($hasActive) {
            return $this->error('Tayari una ukaimishaji unaosubiri kuthibitishwa. Subiri ushughulikiwe kabla ya kuunda mwingine.', 422);
        }

        try {
            $delegate = User::findOrFail($data['delegate_id']);

            $del = OfficeDelegation::create([
                'delegator_id' => $user->id,
                'delegator_name' => $user->name,
                'delegator_title' => $delegatorTitle,
                'delegator_role' => $user->role,
                'delegate_id' => $delegate->id,
                'delegate_name' => $delegate->name,
                'delegate_role' => $delegate->role,
                'acting_title' => $data['acting_title'] ?: $defaultActing,
                'reason' => $data['reason'] ?? null,
                'from_date' => $data['from_date'],
                'to_date' => $data['to_date'],
                'responsibilities' => $data['responsibilities'],
                'limitations' => $data['limitations'] ?? null,
                'handover_notes' => $data['handover_notes'] ?? null,
                'status' => 'pending',
                'delegator_signature_img' => $data['delegator_signature_img'] ?? $user->signature,
                'delegator_date' => $data['delegator_date'] ?? now()->toDateString(),
                'created_by' => $user->id,
            ]);

            AuditLog::record('office_delegation.created', $user, $del,
                $delegatorTitle . ' amekaimisha madaraka kwa ' . $delegate->name, ['from' => $data['from_date'], 'to' => $data['to_date']]);

            // Arifa: kwa mkaimishwa (kuthibitisha) na kwa wakubwa (read-only oversight)
            $this->notify($delegate->id, 'delegation', 'You have been delegated authority',
                $user->name . ' (' . $delegatorTitle . ') has delegated office & authority to you as ' . ($data['acting_title'] ?: $defaultActing) . '. Please review and acknowledge.', '/delegations', ['id' => $del->id]);

            // Wakubwa wa cheo cha mkaimishaji wanaarifiwa kwa ufuatiliaji (kuona tu)
            $superiorRoles = [];
            if ($user->isLoanManager()) $superiorRoles = ['general_manager', 'managing_director'];
            elseif ($user->isGeneralManager()) $superiorRoles = ['managing_director'];
            if ($superiorRoles) {
                foreach (User::whereIn('role', $superiorRoles)->pluck('id') as $sid) {
                    $this->notify($sid, 'delegation_oversight', 'New delegation to review (view only)',
                        $user->name . ' (' . $delegatorTitle . ') delegated authority to ' . $delegate->name . '. View it for your records.', '/delegations', ['id' => $del->id]);
                }
            }

            return $this->success($del, 'Fomu ya kukaimisha imewasilishwa kwa ' . $delegate->name);
        } catch (\Exception $e) {
            Log::error('office delegation store error: ' . $e->getMessage());
            return $this->error('Imeshindikana kuwasilisha fomu', 500);
        }
    }

    /** Tengeneza arifa kwa mtumiaji. */
    private function notify($userId, string $type, string $title, string $message, ?string $link = null, array $data = []): void
    {
        try {
            Notification::create([
                'user_id' => $userId, 'type' => $type, 'title' => $title, 'message' => $message, 'link' => $link, 'data' => $data,
            ]);
        } catch (\Exception $e) {
            Log::error('notify error: ' . $e->getMessage());
        }
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $scope = $request->query('scope'); // mine | assigned | oversight | all
        $below = $this->subordinateRoles($user);

        $query = OfficeDelegation::query()->orderByDesc('created_at');

        if ($scope === 'mine') {
            $query->where('delegator_id', $user->id);
        } elseif ($scope === 'assigned') {
            $query->where('delegate_id', $user->id);
        } elseif ($scope === 'oversight') {
            // Ukaimishaji wa wasaidizi — kuona tu (read-only)
            $query->whereIn('delegator_role', $below ?: ['__none__']);
        } elseif ($scope === 'all' && $user->isAdmin()) {
            // admin: yote
        } else {
            // default / 'all' for non-admin: mine + assigned + oversight
            $query->where(function ($q) use ($user, $below) {
                $q->where('delegator_id', $user->id)->orWhere('delegate_id', $user->id);
                if ($below) $q->orWhereIn('delegator_role', $below);
            });
        }

        return response()->json(['delegations' => $query->get()]);
    }

    public function show($id)
    {
        return response()->json(OfficeDelegation::findOrFail($id));
    }

    /** Admin anaweza kufuta ukaimishaji wowote. */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        if (!$user->isAdmin()) {
            return $this->error('Admin pekee ndiye anaweza kufuta ukaimishaji', 403);
        }
        $del = OfficeDelegation::findOrFail($id);
        AuditLog::record('office_delegation.deleted', $user, $del, 'Ukaimishaji umefutwa na admin');
        $del->delete();
        return $this->success(null, 'Ukaimishaji umefutwa');
    }

    /**
     * Mfanyakazi aliyechaguliwa anakubali kukaimishwa.
     */
    public function acknowledge(Request $request, $id)
    {
        $user = $request->user();
        $del = OfficeDelegation::findOrFail($id);

        if ($del->delegate_id !== $user->id && !$user->isAdmin()) {
            return $this->error('Ni mtumishi aliyechaguliwa pekee anayeweza kuthibitisha', 403);
        }
        if ($del->status !== 'pending') {
            return $this->error('Ukaimishaji huu tayari umeshughulikiwa', 422);
        }

        $data = $request->validate(['password' => 'required|string']);
        if (!Hash::check($data['password'], $user->password)) {
            return $this->error('Nenosiri si sahihi (PIN verification failed)', 422);
        }

        try {
            $del->status = 'acknowledged';
            $del->delegate_signature_img = $user->signature;
            $del->delegate_date = now();
            $del->save();

            AuditLog::record('office_delegation.acknowledged', $user, $del, 'Ukaimishaji umekubaliwa na ' . $user->name);
            return $this->success($del, 'Umekubali kukaimishwa madaraka kikamilifu');
        } catch (\Exception $e) {
            Log::error('office delegation ack error: ' . $e->getMessage());
            return $this->error('Imeshindikana kuthibitisha', 500);
        }
    }

    /**
     * Mfanyakazi anakataa kukaimishwa.
     */
    public function decline(Request $request, $id)
    {
        $user = $request->user();
        $del = OfficeDelegation::findOrFail($id);

        if ($del->delegate_id !== $user->id && !$user->isAdmin()) {
            return $this->error('Ni mtumishi aliyechaguliwa pekee anayeweza kukataa', 403);
        }
        if ($del->status !== 'pending') {
            return $this->error('Ukaimishaji huu tayari umeshughulikiwa', 422);
        }

        $data = $request->validate([
            'reason' => 'required|string|min:3',
            'password' => 'required|string',
        ]);
        if (!Hash::check($data['password'], $user->password)) {
            return $this->error('Nenosiri si sahihi (PIN verification failed)', 422);
        }

        try {
            $del->status = 'declined';
            $del->decline_reason = $data['reason'];
            $del->delegate_date = now();
            $del->save();

            AuditLog::record('office_delegation.declined', $user, $del, 'Ukaimishaji umekataliwa na ' . $user->name, ['reason' => $data['reason']]);
            return $this->success($del, 'Umekataa kukaimishwa madaraka');
        } catch (\Exception $e) {
            Log::error('office delegation decline error: ' . $e->getMessage());
            return $this->error('Imeshindikana kukataa', 500);
        }
    }
}
