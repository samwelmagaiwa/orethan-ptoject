<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\OfficeDelegation;
use App\Models\User;
use App\Models\AuditLog;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;

class OfficeDelegationController extends Controller
{
    use ApiResponse;

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
        if (!$user->isManagingDirector() && !$user->isAdmin()) {
            return $this->error('Mkurugenzi Mtendaji pekee ndiye anaweza kukaimisha madaraka', 403);
        }

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
                'delegator_title' => 'Managing Director',
                'delegate_id' => $delegate->id,
                'delegate_name' => $delegate->name,
                'acting_title' => $data['acting_title'] ?? 'Acting Managing Director',
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
                'MD amekaimisha madaraka kwa ' . $delegate->name, ['from' => $data['from_date'], 'to' => $data['to_date']]);

            return $this->success($del, 'Fomu ya kukaimisha imewasilishwa kwa ' . $delegate->name);
        } catch (\Exception $e) {
            Log::error('office delegation store error: ' . $e->getMessage());
            return $this->error('Imeshindikana kuwasilisha fomu', 500);
        }
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $scope = $request->query('scope'); // mine | assigned | all

        $query = OfficeDelegation::query()->orderByDesc('created_at');

        if ($scope === 'mine') {
            $query->where('delegator_id', $user->id);
        } elseif ($scope === 'assigned') {
            $query->where('delegate_id', $user->id);
        } elseif ($scope === 'all' && !$user->isAdmin()) {
            $query->where(fn($q) => $q->where('delegator_id', $user->id)->orWhere('delegate_id', $user->id));
        } else {
            // default: MD -> mine, others -> assigned
            if ($user->isManagingDirector()) $query->where('delegator_id', $user->id);
            elseif (!$user->isAdmin()) $query->where('delegate_id', $user->id);
        }

        return response()->json(['delegations' => $query->get()]);
    }

    public function show($id)
    {
        return response()->json(OfficeDelegation::findOrFail($id));
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
