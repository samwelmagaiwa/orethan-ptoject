<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\GroupMember;
use App\Models\Loan;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;

class GroupManagementController extends Controller
{
    use ApiResponse;

    /** GET /groups — list all group loans with member counts + performance */
    public function index(Request $request)
    {
        $q = Loan::where('loan_type', 'group')
            ->withCount('repayments')
            ->with('groupMembers:id,loan_id,full_name,role,phone,kyc_status')
            ->latest();

        if ($request->filled('search')) {
            $s = $request->search;
            $q->where(function ($query) use ($s) {
                $query->where('name', 'like', "%$s%")
                      ->orWhere('loan_account_number', 'like', "%$s%")
                      ->orWhere('phone', 'like', "%$s%");
            });
        }
        if ($request->filled('status')) $q->where('status', $request->status);

        $loans = $q->paginate(30);

        // Enrich each group with performance data
        $loans->getCollection()->transform(function ($loan) {
            $details = $loan->details ?? [];
            $loan->group_name       = $details['jinaLaMradi'] ?? $loan->name;
            $loan->member_count     = $loan->groupMembers->count()
                                    ?: (((int)($details['idadiYaWanachamaMe'] ?? 0)) + ((int)($details['idadiYaWanachamaKe'] ?? 0)));
            $loan->chairman         = $details['jinaLaMwenyekiti'] ?? '—';
            $loan->secretary        = $details['jinaLaKatibu'] ?? '—';
            $loan->treasurer        = $details['jinaLaMhazini'] ?? '—';
            $loan->registration_no  = $details['nambaYaUsajiliWaKikundi'] ?? '—';
            return $loan;
        });

        return $this->success($loans);
    }

    /** GET /groups/{loanId} — group detail with members + repayment performance */
    public function show(int $loanId)
    {
        $loan = Loan::where('loan_type', 'group')
            ->with('groupMembers', 'repayments')
            ->findOrFail($loanId);

        $details = $loan->details ?? [];
        $repayments = $loan->repayments ?? collect();
        $totalSchedule = $loan->repayment_schedules()->sum('amount') ?? (float)$loan->amount;
        $totalPaid     = $repayments->sum('amount');

        return $this->success([
            'loan'            => $loan,
            'members'         => $loan->groupMembers,
            'group_info' => [
                'name'            => $details['jinaLaMradi'] ?? $loan->name,
                'registration_no' => $details['nambaYaUsajiliWaKikundi'] ?? '—',
                'chairman'        => $details['jinaLaMwenyekiti'] ?? '—',
                'secretary'       => $details['jinaLaKatibu'] ?? '—',
                'treasurer'       => $details['jinaLaMhazini'] ?? '—',
                'male_members'    => $details['idadiYaWanachamaMe'] ?? 0,
                'female_members'  => $details['idadiYaWanachamaKe'] ?? 0,
                'address'         => $details['anuaniYaMakaziYaKikundi'] ?? '—',
                'meeting_freq'    => $details['mkutanoFrequency'] ?? '—',
            ],
            'performance' => [
                'total_expected'    => $totalSchedule,
                'total_paid'        => $totalPaid,
                'collection_rate'   => $totalSchedule > 0 ? round(($totalPaid / $totalSchedule) * 100, 1) : 0,
                'days_overdue'      => $loan->days_overdue ?? 0,
                'last_payment_date' => $repayments->max('payment_date'),
                'repayments_count'  => $repayments->count(),
            ],
        ]);
    }

    /** GET /groups/{loanId}/members */
    public function members(int $loanId)
    {
        $members = GroupMember::where('loan_id', $loanId)->get();
        return $this->success($members);
    }

    /** POST /groups/{loanId}/members */
    public function storeMember(Request $request, int $loanId)
    {
        Loan::findOrFail($loanId); // ensure exists

        $data = $request->validate([
            'full_name'      => 'required|string|max:150',
            'role'           => 'required|in:chairman,secretary,treasurer,member',
            'phone'          => 'nullable|string|max:20',
            'nida_number'    => 'nullable|string|max:50',
            'gender'         => 'nullable|string|max:20',
            'occupation'     => 'nullable|string|max:150',
            'monthly_income' => 'nullable|numeric|min:0',
            'region'         => 'nullable|string|max:100',
            'district'       => 'nullable|string|max:100',
            'ward'           => 'nullable|string|max:100',
            'share_amount'   => 'nullable|numeric|min:0',
            'kyc_status'     => 'nullable|in:pending,verified,rejected',
            'notes'          => 'nullable|string',
        ]);

        $data['loan_id'] = $loanId;
        $member = GroupMember::create($data);
        return $this->success($member, 'Mwanachama ameongezwa', 201);
    }

    /** PUT /groups/members/{memberId} */
    public function updateMember(Request $request, int $memberId)
    {
        $member = GroupMember::findOrFail($memberId);
        $data = $request->validate([
            'full_name'   => 'sometimes|string|max:150',
            'role'        => 'nullable|in:chairman,secretary,treasurer,member',
            'phone'       => 'nullable|string|max:20',
            'nida_number' => 'nullable|string|max:50',
            'kyc_status'  => 'nullable|in:pending,verified,rejected',
            'notes'       => 'nullable|string',
        ]);
        $member->update($data);
        return $this->success($member->fresh(), 'Mwanachama imesasishwa');
    }

    /** DELETE /groups/members/{memberId} */
    public function destroyMember(int $memberId)
    {
        GroupMember::findOrFail($memberId)->delete();
        return $this->success(null, 'Mwanachama amefutwa');
    }

    /** GET /groups/performance — aggregate group loan performance */
    public function performance()
    {
        $groups = Loan::where('loan_type', 'group')
            ->with('repayments')
            ->get();

        $total   = $groups->count();
        $active  = $groups->whereIn('status', ['disbursed', 'active'])->count();
        $closed  = $groups->where('status', 'fully_paid')->count();
        $overdue = $groups->filter(fn($l) => ($l->days_overdue ?? 0) > 0)->count();

        $totalDisbursed = $groups->sum('amount');
        $totalRepaid    = $groups->flatMap->repayments->sum('amount');

        return $this->success([
            'total_groups'    => $total,
            'active_groups'   => $active,
            'closed_groups'   => $closed,
            'overdue_groups'  => $overdue,
            'total_disbursed' => $totalDisbursed,
            'total_repaid'    => $totalRepaid,
            'collection_rate' => $totalDisbursed > 0 ? round(($totalRepaid / $totalDisbursed) * 100, 1) : 0,
        ]);
    }
}
