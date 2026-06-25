<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\LeaveRequest;
use App\Models\AuditLog;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class LeaveRequestController extends Controller
{
    use ApiResponse;

    private function nextStatus(string $current): string
    {
        return match ($current) {
            'manager_review' => 'gm_review',
            'gm_review' => 'md_review',
            'md_review' => 'authorized',
            default => $current,
        };
    }

    private function canDecide($user, string $status): bool
    {
        if ($user->isAdmin()) return true;
        return match ($status) {
            'manager_review' => $user->isLoanManager(),
            'gm_review' => $user->isGeneralManager(),
            'md_review' => $user->isManagingDirector(),
            default => false,
        };
    }

    public function store(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'employee_name' => 'required|string|max:255',
            'department' => 'nullable|string|max:255',
            'manager' => 'nullable|string|max:255',
            'absence_type' => 'required|string|in:sick,bereavement,unpaid,personal,maternity,other',
            'absence_other' => 'nullable|string|max:255',
            'from_date' => 'required|date',
            'to_date' => 'required|date|after_or_equal:from_date',
            'reason' => 'nullable|string',
            'employee_signature' => 'nullable|string|max:255',
            'employee_date' => 'nullable|date',
        ]);

        try {
            $data['status'] = 'manager_review';
            $data['created_by'] = $user->id ?? null;
            if (empty($data['employee_signature'])) {
                $data['employee_signature'] = $user->name ?? null;
            }

            $lr = LeaveRequest::create($data);

            AuditLog::record('leave_request.created', $user, $lr,
                'Ombi la likizo limewasilishwa: ' . $lr->employee_name, ['absence_type' => $lr->absence_type]);

            return $this->success($lr, 'Ombi la likizo limewasilishwa');
        } catch (\Exception $e) {
            Log::error('leave request store error: ' . $e->getMessage());
            return $this->error('Imeshindikana kuwasilisha ombi', 500);
        }
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $scope = $request->query('scope', 'queue');

        $query = LeaveRequest::query()->orderByDesc('created_at');

        if ($scope === 'mine') {
            $query->where('created_by', $user->id);
        } elseif ($scope === 'queue' && !$user->isAdmin()) {
            if ($user->isLoanManager()) $query->where('status', 'manager_review');
            elseif ($user->isGeneralManager()) $query->where('status', 'gm_review');
            elseif ($user->isManagingDirector()) $query->where('status', 'md_review');
            else $query->where('created_by', $user->id);
        }

        return response()->json(['requests' => $query->get()]);
    }

    public function show($id)
    {
        return response()->json(LeaveRequest::findOrFail($id));
    }

    public function approve(Request $request, $id)
    {
        $user = $request->user();
        $lr = LeaveRequest::findOrFail($id);

        if (!$this->canDecide($user, $lr->status)) {
            return $this->error('Huna ruhusa ya kuidhinisha hatua hii', 403);
        }

        $data = $request->validate(['comments' => 'nullable|string']);

        try {
            $stage = $lr->status;
            if ($stage === 'manager_review') {
                $lr->manager_name = $user->name; $lr->manager_decision = 'approved';
                $lr->manager_comments = $data['comments'] ?? null; $lr->manager_date = now();
            } elseif ($stage === 'gm_review') {
                $lr->gm_name = $user->name; $lr->gm_decision = 'approved';
                $lr->gm_comments = $data['comments'] ?? null; $lr->gm_date = now();
            } elseif ($stage === 'md_review') {
                $lr->md_name = $user->name; $lr->md_comments = $data['comments'] ?? null; $lr->md_date = now();
            }

            $lr->status = $this->nextStatus($stage);
            $lr->save();

            AuditLog::record('leave_request.approved', $user, $lr,
                'Ombi la likizo limeidhinishwa (' . $stage . ')', ['stage' => $stage]);

            return $this->success($lr, $lr->status === 'authorized' ? 'Likizo imeidhinishwa kikamilifu' : 'Imeidhinishwa, imepelekwa hatua inayofuata');
        } catch (\Exception $e) {
            Log::error('leave request approve error: ' . $e->getMessage());
            return $this->error('Imeshindikana kuidhinisha', 500);
        }
    }

    public function reject(Request $request, $id)
    {
        $user = $request->user();
        $lr = LeaveRequest::findOrFail($id);

        if (!$this->canDecide($user, $lr->status)) {
            return $this->error('Huna ruhusa ya kukataa hatua hii', 403);
        }

        $data = $request->validate(['reason' => 'required|string|min:3']);

        try {
            $stage = $lr->status;
            if ($stage === 'manager_review') { $lr->manager_name = $user->name; $lr->manager_decision = 'not_approved'; $lr->manager_comments = $data['reason']; $lr->manager_date = now(); }
            elseif ($stage === 'gm_review') { $lr->gm_name = $user->name; $lr->gm_decision = 'not_approved'; $lr->gm_comments = $data['reason']; $lr->gm_date = now(); }
            elseif ($stage === 'md_review') { $lr->md_name = $user->name; $lr->md_comments = $data['reason']; $lr->md_date = now(); }

            $lr->status = 'rejected';
            $lr->rejection_reason = $data['reason'];
            $lr->save();

            AuditLog::record('leave_request.rejected', $user, $lr, 'Ombi la likizo limekataliwa', ['reason' => $data['reason']]);

            return $this->success($lr, 'Ombi limekataliwa');
        } catch (\Exception $e) {
            Log::error('leave request reject error: ' . $e->getMessage());
            return $this->error('Imeshindikana kukataa ombi', 500);
        }
    }
}
