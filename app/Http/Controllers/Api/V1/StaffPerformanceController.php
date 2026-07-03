<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Loan;
use App\Models\User;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StaffPerformanceController extends Controller
{
    use ApiResponse;

    /** GET /staff/performance — KPI dashboard for all officers */
    public function index(Request $request)
    {
        $from = $request->filled('from') ? $request->from : now()->startOfMonth()->toDateString();
        $to   = $request->filled('to')   ? $request->to   : now()->toDateString();

        // Loan officer performance: loans submitted, disbursed, amount
        $loansRaw = Loan::select(
                'submitted_by',
                DB::raw('COUNT(*) as total_submitted'),
                DB::raw('SUM(CASE WHEN status IN ("disbursed","active","closed","fully_paid") THEN 1 ELSE 0 END) as total_disbursed'),
                DB::raw('SUM(CASE WHEN status IN ("disbursed","active","closed","fully_paid") THEN amount ELSE 0 END) as total_amount'),
                DB::raw('SUM(CASE WHEN status = "rejected" THEN 1 ELSE 0 END) as total_rejected'),
                DB::raw('SUM(CASE WHEN days_overdue > 0 THEN 1 ELSE 0 END) as overdue_count')
            )
            ->whereBetween('created_at', [$from . ' 00:00:00', $to . ' 23:59:59'])
            ->whereNotNull('submitted_by')
            ->groupBy('submitted_by')
            ->get();

        // Repayment collections by loan officer
        $collectionsRaw = DB::table('repayments')
            ->join('loans', 'repayments.loan_id', '=', 'loans.id')
            ->select(
                'loans.submitted_by',
                DB::raw('SUM(repayments.amount) as total_collected'),
                DB::raw('COUNT(repayments.id) as repayment_count')
            )
            ->whereBetween('repayments.payment_date', [$from, $to])
            ->whereNotNull('loans.submitted_by')
            ->groupBy('loans.submitted_by')
            ->get()
            ->keyBy('submitted_by');

        // Fetch user details for all relevant user IDs
        $userIds = $loansRaw->pluck('submitted_by')->merge($collectionsRaw->keys())->unique();
        $users   = User::whereIn('id', $userIds)->get()->keyBy('id');

        $officers = $loansRaw->map(function ($row) use ($users, $collectionsRaw) {
            $user = $users->get($row->submitted_by);
            $col  = $collectionsRaw->get($row->submitted_by);
            $disbursementRate = $row->total_submitted > 0
                ? round(($row->total_disbursed / $row->total_submitted) * 100, 1) : 0;

            return [
                'user_id'           => $row->submitted_by,
                'name'              => $user?->name ?? 'Unknown',
                'role'              => $user?->role ?? '—',
                'total_submitted'   => (int) $row->total_submitted,
                'total_disbursed'   => (int) $row->total_disbursed,
                'total_rejected'    => (int) $row->total_rejected,
                'total_amount'      => (float) $row->total_amount,
                'overdue_count'     => (int) $row->overdue_count,
                'disbursement_rate' => $disbursementRate,
                'total_collected'   => (float) ($col->total_collected ?? 0),
                'repayment_count'   => (int) ($col->repayment_count ?? 0),
                'collection_score'  => $this->calcCollectionScore((float)$row->total_amount, (float)($col->total_collected ?? 0)),
            ];
        })->sortByDesc('total_amount')->values();

        // Summary stats
        $summary = [
            'total_officers'       => $officers->count(),
            'total_submitted'      => $officers->sum('total_submitted'),
            'total_disbursed'      => $officers->sum('total_disbursed'),
            'total_amount'         => $officers->sum('total_amount'),
            'total_collected'      => $officers->sum('total_collected'),
            'avg_disbursement_rate' => $officers->avg('disbursement_rate'),
        ];

        return $this->success(compact('officers', 'summary', 'from', 'to'));
    }

    /** GET /staff/performance/{userId} — detailed KPIs for one officer */
    public function show(Request $request, int $userId)
    {
        $user = User::findOrFail($userId);
        $from = $request->filled('from') ? $request->from : now()->startOfMonth()->toDateString();
        $to   = $request->filled('to')   ? $request->to   : now()->toDateString();

        $loans = Loan::where('submitted_by', $userId)
            ->whereBetween('created_at', [$from . ' 00:00:00', $to . ' 23:59:59'])
            ->with('repayments')
            ->get();

        $disbursed = $loans->whereIn('status', ['disbursed', 'active', 'closed', 'fully_paid']);
        $totalCollected = $disbursed->flatMap->repayments
            ->where('payment_date', '>=', $from)
            ->where('payment_date', '<=', $to)
            ->sum('amount');

        // Monthly trend: submissions per month
        $monthlyTrend = Loan::where('submitted_by', $userId)
            ->selectRaw('DATE_FORMAT(created_at, "%Y-%m") as month, COUNT(*) as count, SUM(amount) as amount')
            ->groupBy('month')
            ->orderBy('month')
            ->limit(12)
            ->get();

        return $this->success([
            'user' => $user,
            'period' => ['from' => $from, 'to' => $to],
            'kpis' => [
                'total_submitted'   => $loans->count(),
                'total_disbursed'   => $disbursed->count(),
                'total_rejected'    => $loans->where('status', 'rejected')->count(),
                'total_amount'      => $disbursed->sum('amount'),
                'total_collected'   => $totalCollected,
                'overdue_count'     => $loans->filter(fn($l) => ($l->days_overdue ?? 0) > 0)->count(),
                'disbursement_rate' => $loans->count() > 0 ? round(($disbursed->count() / $loans->count()) * 100, 1) : 0,
                'collection_rate'   => $disbursed->sum('amount') > 0 ? round(($totalCollected / $disbursed->sum('amount')) * 100, 1) : 0,
            ],
            'monthly_trend' => $monthlyTrend,
            'recent_loans'  => $loans->sortByDesc('created_at')->take(10)->values(),
        ]);
    }

    private function calcCollectionScore(float $disbursed, float $collected): string
    {
        if ($disbursed <= 0) return '—';
        $rate = ($collected / $disbursed) * 100;
        return match(true) {
            $rate >= 90 => 'A',
            $rate >= 75 => 'B',
            $rate >= 60 => 'C',
            $rate >= 40 => 'D',
            default     => 'E',
        };
    }
}
