<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class EodCashReportController extends Controller
{
    use ApiResponse;

    /**
     * GET /reports/eod-cash?date=YYYY-MM-DD
     * Returns expected vs. actual collections per loan officer for a given date.
     * Expected = all repayment_schedules with due_date <= date (unpaid or partially paid).
     * Actual   = all repayments with payment_date = date.
     */
    public function index(Request $request)
    {
        $roles = ['loan_officer', 'loan_manager', 'general_manager', 'managing_director', 'admin', 'finance_officer'];
        if (!in_array($request->user()->role, $roles)) {
            return $this->error('Forbidden', 403);
        }

        $date = $request->filled('date') ? $request->date : now()->toDateString();
        $carbon = Carbon::parse($date);

        // Actual collections on this date, grouped by the loan's officer (user_id)
        $actualRaw = DB::table('repayments')
            ->join('loans', 'repayments.loan_id', '=', 'loans.id')
            ->select(
                'loans.user_id',
                DB::raw('SUM(repayments.amount) as actual_collected'),
                DB::raw('COUNT(repayments.id) as repayment_count'),
                DB::raw('SUM(repayments.penalty_amount) as penalty_collected')
            )
            ->where('repayments.payment_date', $date)
            ->where('repayments.status', 'completed')
            ->whereNotNull('loans.user_id')
            ->groupBy('loans.user_id')
            ->get()
            ->keyBy('user_id');

        // Expected (due) installments on or before this date that are still unpaid,
        // grouped by the loan's officer
        $expectedRaw = DB::table('repayment_schedules')
            ->join('loans', 'repayment_schedules.loan_id', '=', 'loans.id')
            ->select(
                'loans.user_id',
                DB::raw('SUM(repayment_schedules.total_amount) as expected_amount'),
                DB::raw('COUNT(repayment_schedules.id) as due_count')
            )
            ->whereDate('repayment_schedules.due_date', $date)
            ->where('repayment_schedules.status', '!=', 'paid')
            ->whereIn('loans.status', ['disbursed', 'active'])
            ->whereNotNull('loans.user_id')
            ->groupBy('loans.user_id')
            ->get()
            ->keyBy('user_id');

        // Merge user IDs from both sets
        $userIds = collect($actualRaw->keys())->merge($expectedRaw->keys())->unique();
        $users   = User::whereIn('id', $userIds)->get()->keyBy('id');

        $officers = $userIds->map(function ($uid) use ($users, $actualRaw, $expectedRaw) {
            $user     = $users->get($uid);
            $actual   = $actualRaw->get($uid);
            $expected = $expectedRaw->get($uid);

            $actualAmt   = (float) ($actual->actual_collected ?? 0);
            $expectedAmt = (float) ($expected->expected_amount ?? 0);
            $variance    = $actualAmt - $expectedAmt;
            $collRate    = $expectedAmt > 0 ? round(($actualAmt / $expectedAmt) * 100, 1) : ($actualAmt > 0 ? 100.0 : 0.0);

            return [
                'user_id'           => $uid,
                'name'              => $user?->name ?? 'Unknown',
                'role'              => $user?->role ?? '—',
                'expected_amount'   => round($expectedAmt),
                'due_count'         => (int) ($expected->due_count ?? 0),
                'actual_collected'  => round($actualAmt),
                'repayment_count'   => (int) ($actual->repayment_count ?? 0),
                'penalty_collected' => round((float) ($actual->penalty_collected ?? 0)),
                'variance'          => round($variance),
                'collection_rate'   => $collRate,
                'status'            => $collRate >= 100 ? 'full' : ($collRate >= 70 ? 'partial' : 'low'),
            ];
        })->sortByDesc('actual_collected')->values();

        $totals = [
            'expected_amount'   => $officers->sum('expected_amount'),
            'actual_collected'  => $officers->sum('actual_collected'),
            'penalty_collected' => $officers->sum('penalty_collected'),
            'variance'          => $officers->sum('variance'),
            'collection_rate'   => $officers->sum('expected_amount') > 0
                ? round(($officers->sum('actual_collected') / $officers->sum('expected_amount')) * 100, 1)
                : 0,
            'officers_count'    => $officers->count(),
        ];

        return $this->success([
            'date'     => $date,
            'officers' => $officers,
            'totals'   => $totals,
        ]);
    }
}
