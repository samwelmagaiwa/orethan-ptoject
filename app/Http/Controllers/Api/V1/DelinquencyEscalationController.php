<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DelinquencyEscalation;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;

class DelinquencyEscalationController extends Controller
{
    use ApiResponse;

    /**
     * GET /escalations?from=&to=&level=
     * Returns escalation records for the current manager's role (or all for admin).
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $managerRoles = ['loan_manager', 'general_manager', 'managing_director', 'admin'];
        if (!in_array($user->role, $managerRoles)) {
            return $this->error('Forbidden', 403);
        }

        $query = DelinquencyEscalation::with(['loan:id,loan_account_number,name,phone,status,amount,remaining_balance', 'recipient:id,name,role'])
            ->orderByDesc('escalated_at');

        // Visibility by role hierarchy:
        //   admin / managing_director → all levels
        //   general_manager           → loan_manager + general_manager levels
        //   loan_manager              → only escalations directed at them personally
        if (in_array($user->role, ['admin', 'managing_director'])) {
            // no extra filter — see everything
        } elseif ($user->role === 'general_manager') {
            $query->whereIn('escalation_level', ['loan_manager', 'general_manager']);
        } else {
            // loan_manager: only records assigned to them
            $query->where('escalated_to', $user->id);
        }

        if ($request->filled('level')) {
            $query->where('escalation_level', $request->level);
        }
        if ($request->filled('from')) {
            $query->where('escalation_date', '>=', $request->from);
        }
        if ($request->filled('to')) {
            $query->where('escalation_date', '<=', $request->to);
        }

        $rows = $query->limit(200)->get()->map(fn($e) => [
            'id'               => $e->id,
            'loan_id'          => $e->loan_id,
            'loan_number'      => $e->loan?->loan_account_number,
            'borrower'         => $e->loan?->name,
            'phone'            => $e->loan?->phone,
            'loan_status'      => $e->loan?->status,
            'outstanding'      => (float) ($e->loan?->remaining_balance ?? 0),
            'days_overdue'     => $e->days_overdue,
            'escalation_level' => $e->escalation_level,
            'escalated_to'     => $e->recipient?->name,
            'notes'            => $e->notes,
            'escalated_at'     => $e->escalated_at?->toDateTimeString(),
            'escalation_date'  => $e->escalation_date?->toDateString(),
        ]);

        return $this->success([
            'escalations' => $rows,
            'total'       => $rows->count(),
        ]);
    }
}
