<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\BranchReport;
use App\Models\LoanSetting;
use App\Models\Loan;
use App\Models\LoanSchedule;
use App\Models\Notification;
use App\Models\Repayment;
use App\Models\SmsLog;
use App\Models\User;
use App\Services\AccountingService;
use App\Sms\SmsService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;

class BranchReportController extends Controller
{
    /** Resolve the branch_report_permissions map with safe defaults */
    private function perms(): array
    {
        $raw = LoanSetting::current()->branch_report_permissions ?? [];
        return array_merge([
            'submit'        => ['loan_officer', 'loan_manager', 'finance_officer', 'general_manager', 'managing_director', 'admin'],
            'view_all'      => ['loan_manager', 'general_manager', 'managing_director', 'admin'],
            'print'         => ['loan_officer', 'loan_manager', 'finance_officer', 'general_manager', 'managing_director', 'admin'],
            'approve'       => ['loan_manager', 'admin'],
            'delete'        => ['admin'],
            'skip_approval' => [],   // nobody skips LM approval by default
        ], $raw);
    }

    /** GET /branch-reports — role + permission filtered list */
    public function index(Request $request)
    {
        $user  = auth()->user();
        $role  = $user?->role ?? '';
        $perms = $this->perms();

        $q = BranchReport::orderByDesc('period_start');

        // LM and Admin see all reports (any status).
        // MD, GM, and Finance see only LM-approved reports.
        if ($role === 'loan_manager' || $role === 'admin') {
            // No filter — sees pending, approved, and rejected
        } elseif (in_array($role, $perms['view_all'] ?? [])) {
            // MD / GM / Finance see only LM-approved reports
            $q->where('approval_status', 'approved');
        } else {
            // Everyone else sees only their own submissions
            $q->where('submitted_by', $user?->id);
        }

        if ($request->filled('branch'))    $q->where('branch', $request->branch);
        if ($request->filled('type'))      $q->where('report_type', $request->type);
        if ($request->filled('date_from')) $q->where('period_start', '>=', $request->date_from);
        if ($request->filled('date_to'))   $q->where('period_end',   '<=', $request->date_to);

        $reports = $q->paginate(50);

        // Attach latest sms_status per branch report
        $ids = collect($reports->items())->pluck('id');
        $latestSms = SmsLog::whereIn('branch_report_id', $ids)
            ->orderByDesc('created_at')
            ->get()
            ->groupBy('branch_report_id')
            ->map(fn($logs) => $logs->first());

        foreach ($reports->items() as $report) {
            $sms = $latestSms->get($report->id);
            $report->sms_status = $sms?->status;
            $report->sms_type   = $sms?->type;
        }

        return response()->json(['data' => $reports]);
    }

    /** GET /branch-reports/{id} */
    public function show(int $id)
    {
        $user   = auth()->user();
        $role   = $user?->role ?? '';
        $perms  = $this->perms();
        $report = BranchReport::findOrFail($id);

        // LM and Admin can open any report regardless of status.
        // MD / GM / Finance can only open LM-approved reports.
        if ($role !== 'loan_manager' && $role !== 'admin'
            && in_array($role, $perms['view_all'] ?? [])
            && $report->approval_status !== 'approved') {
            return response()->json(['message' => 'Ripoti hii bado haijakubaliwa na Meneja'], 403);
        }

        // Staff can only view their own submissions
        if (!in_array($role, $perms['view_all'] ?? []) && $report->submitted_by !== $user?->id) {
            return response()->json(['message' => 'Huna ruhusa ya kuona ripoti hii'], 403);
        }

        return response()->json(['data' => $report]);
    }

    /** POST /branch-reports */
    public function store(Request $request)
    {
        $user  = auth()->user();
        $role  = $user?->role ?? '';
        $perms = $this->perms();

        if (!in_array($role, $perms['submit'] ?? [])) {
            return response()->json(['message' => 'Huna ruhusa ya kuwasilisha ripoti'], 403);
        }

        $data = $request->validate([
            'branch'             => 'nullable|string|max:100',
            'department'         => 'nullable|string|max:100',
            'section'            => 'nullable|string|max:100',
            'report_type'        => 'required|in:daily,weekly,monthly',
            'period_start'       => 'required|date',
            'period_end'         => 'required|date',
            'operations'         => 'nullable|array',
            'financials'         => 'nullable|array',
            'balances'           => 'nullable|array',
            'loan_officers'      => 'nullable|array',
            'expected_loans'     => 'nullable|array',
            'signature_password' => 'nullable|string',
        ]);

        $lo_signed = false;
        if (!empty($data['signature_password']) && $user) {
            $lo_signed = Hash::check($data['signature_password'], $user->password);
        }
        unset($data['signature_password']);

        // Auto-approve if: submitter is an approver (LM submitting own report)
        // OR submitter's role has the skip_approval permission granted by admin.
        $autoApprove = in_array($role, $perms['approve'] ?? [])
                    || in_array($role, $perms['skip_approval'] ?? []);

        $data['submitted_by']      = $user?->id;
        $data['submitted_by_name'] = $user?->name ?? 'unknown';
        $data['status']            = 'submitted';
        $data['lo_signed']         = $lo_signed;

        if ($autoApprove) {
            $data['approval_status']  = 'approved';
            $data['lm_signed']        = true;
            $data['approved_by']      = $user->id;
            $data['approved_by_name'] = $user->name;
            $data['approved_at']      = now();
        } else {
            $data['approval_status'] = 'pending';
            $data['lm_signed']       = false;
        }

        $report = BranchReport::create($data);

        // ── Auto-post to GL if auto-approved ─────────────────────────────────
        if ($autoApprove) {
            try {
                $je = app(AccountingService::class)->postBranchReportToGL($report, $user);
                if ($je) {
                    $report->update(['gl_journal_entry_id' => $je->id]);
                }
            } catch (\Throwable $e) {
                Log::error('Branch report GL auto-post failed: ' . $e->getMessage());
            }
        }

        // ── Notifications ────────────────────────────────────────────────────
        $typeMap = ['daily' => 'Kila Siku', 'weekly' => 'Wiki', 'monthly' => 'Mwezi'];
        $typeLabel = $typeMap[$report->report_type] ?? $report->report_type;
        $period = \Carbon\Carbon::parse($report->period_start)->format('d/m/Y');

        if ($autoApprove) {
            // LM/skip_approval: notify GM, MD, Admin that a report is now visible
            $viewers = User::whereIn('role', ['general_manager', 'managing_director', 'admin'])->get();
            foreach ($viewers as $v) {
                Notification::create([
                    'user_id' => $v->id,
                    'type'    => 'branch_report_approved',
                    'title'   => "📋 Ripoti ya Tawi Mpya ({$typeLabel})",
                    'message' => "Ripoti ya {$typeLabel} ya {$period} kutoka {$report->branch} imewasilishwa na {$report->submitted_by_name}.",
                    'link'    => '/branch-report',
                ]);
            }
        } else {
            // LO submitted — notify all loan_managers to review
            $managers = User::where('role', 'loan_manager')->get();
            $sms = app(SmsService::class);
            foreach ($managers as $m) {
                Notification::create([
                    'user_id' => $m->id,
                    'type'    => 'branch_report_pending',
                    'title'   => "⏳ Ripoti ya Tawi Inahitaji Idhini ({$typeLabel})",
                    'message' => "{$report->submitted_by_name} amewasilisha ripoti ya {$typeLabel} ya {$period} ({$report->branch}). Tafadhali kagua na uidhinishe.",
                    'link'    => '/branch-report',
                ]);
                // SMS to each Loan Manager
                $sms->sendBranchReportPending($m, $report, $user);
            }
        }

        return response()->json(['data' => $report], 201);
    }

    /** POST /branch-reports/{id}/approve */
    public function approve(Request $request, int $id)
    {
        $user  = auth()->user();
        $role  = $user?->role ?? '';
        $perms = $this->perms();

        if (!in_array($role, $perms['approve'] ?? [])) {
            return response()->json(['message' => 'Huna ruhusa ya kuidhinisha ripoti'], 403);
        }

        $request->validate(['signature_password' => 'required|string']);

        if (!Hash::check($request->signature_password, $user->password)) {
            return response()->json(['message' => 'Nywila si sahihi — saini haikuthibitishwa'], 422);
        }

        $report = BranchReport::findOrFail($id);
        $report->update([
            'approval_status'  => 'approved',
            'approved_by'      => $user->id,
            'approved_by_name' => $user->name,
            'approved_at'      => now(),
            'lm_signed'        => true,
        ]);

        // ── Post to GL ────────────────────────────────────────────────────────
        try {
            $je = app(AccountingService::class)->postBranchReportToGL($report->fresh(), $user);
            if ($je) {
                $report->update(['gl_journal_entry_id' => $je->id]);
            }
        } catch (\Throwable $e) {
            Log::error('Branch report GL post failed: ' . $e->getMessage());
        }

        // Notify GM, MD, Admin that a report is now approved and visible
        $typeMap   = ['daily' => 'Kila Siku', 'weekly' => 'Wiki', 'monthly' => 'Mwezi'];
        $typeLabel = $typeMap[$report->report_type] ?? $report->report_type;
        $period    = \Carbon\Carbon::parse($report->period_start)->format('d/m/Y');

        $viewers = User::whereIn('role', ['general_manager', 'managing_director', 'admin', 'finance_officer'])->get();
        foreach ($viewers as $v) {
            Notification::create([
                'user_id' => $v->id,
                'type'    => 'branch_report_approved',
                'title'   => "✅ Ripoti ya Tawi Imeidhinishwa ({$typeLabel})",
                'message' => "Ripoti ya {$typeLabel} ya {$period} ({$report->branch}) imeidhinishwa na {$user->name} na sasa inapatikana.",
                'link'    => '/branch-report',
            ]);
        }

        // Also notify the original submitter that their report was approved
        if ($report->submitted_by && $report->submitted_by !== $user->id) {
            $submitter = User::find($report->submitted_by);
            Notification::create([
                'user_id' => $report->submitted_by,
                'type'    => 'branch_report_approved',
                'title'   => "✅ Ripoti Yako Imeidhinishwa",
                'message' => "Ripoti yako ya {$typeLabel} ya {$period} imeidhinishwa na {$user->name}.",
                'link'    => '/branch-report',
            ]);
            // SMS to the submitter
            if ($submitter) {
                app(SmsService::class)->sendBranchReportApproved($submitter, $report, $user);
            }
        }

        return response()->json(['data' => $report->fresh()]);
    }

    /** POST /branch-reports/{id}/reject */
    public function reject(Request $request, int $id)
    {
        $user  = auth()->user();
        $role  = $user?->role ?? '';
        $perms = $this->perms();

        if (!in_array($role, $perms['approve'] ?? [])) {
            return response()->json(['message' => 'Huna ruhusa ya kukataa ripoti'], 403);
        }

        $request->validate([
            'reason'           => 'required|string|min:3',
            'signature_password' => 'required|string',
        ]);

        if (!Hash::check($request->signature_password, $user->password)) {
            return response()->json(['message' => 'Nywila si sahihi — saini haikuthibitishwa'], 422);
        }

        $report = BranchReport::findOrFail($id);

        if ($report->approval_status !== 'pending') {
            return response()->json(['message' => 'Ripoti hii si katika hali ya kusubiri idhini'], 422);
        }

        $report->update([
            'approval_status' => 'rejected',
            'lm_signed'       => false,
        ]);

        // Notify the original submitter so they can edit and resubmit
        $typeMap   = ['daily' => 'Kila Siku', 'weekly' => 'Wiki', 'monthly' => 'Mwezi'];
        $typeLabel = $typeMap[$report->report_type] ?? $report->report_type;
        $period    = \Carbon\Carbon::parse($report->period_start)->format('d/m/Y');

        if ($report->submitted_by) {
            Notification::create([
                'user_id' => $report->submitted_by,
                'type'    => 'branch_report_rejected',
                'title'   => "❌ Ripoti Yako Imekataliwa",
                'message' => "Ripoti yako ya {$typeLabel} ya {$period} imekataliwa na {$user->name}. Sababu: {$request->reason}. Tafadhali ihariri na uiwasilishe tena.",
                'link'    => '/branch-report',
            ]);
            $submitter = User::find($report->submitted_by);
            if ($submitter) {
                app(SmsService::class)->sendBranchReportRejected($submitter, $report, $user, $request->reason);
            }
        }

        return response()->json(['data' => $report->fresh(), 'rejection_reason' => $request->reason]);
    }

    /**
     * POST /branch-reports/{id}/return
     * GM or MD returns an approved report to a previous stage.
     * return_to: 'lm'  → back to Loan Manager queue (approval_status = pending)
     * return_to: 'lo'  → back to original submitter (approval_status = rejected, editable)
     */
    public function return(Request $request, int $id)
    {
        $user = auth()->user();
        $role = $user?->role ?? '';

        if (!in_array($role, ['general_manager', 'managing_director', 'admin'])) {
            return response()->json(['message' => 'GM au MD pekee wanaweza kurejesha ripoti'], 403);
        }

        $request->validate([
            'return_to'          => 'required|in:lm,lo',
            'reason'             => 'required|string|min:10',
            'signature_password' => 'required|string',
        ]);

        if (!Hash::check($request->signature_password, $user->password)) {
            return response()->json(['message' => 'Nywila si sahihi — saini haikuthibitishwa'], 422);
        }

        $report = BranchReport::findOrFail($id);

        if ($report->approval_status !== 'approved') {
            return response()->json(['message' => 'Ripoti iliyoidhinishwa tu inaweza kurudishwa'], 422);
        }

        $returnTo   = $request->return_to;
        $newStatus  = $returnTo === 'lm' ? 'pending' : 'rejected';
        $stageLabel = $returnTo === 'lm' ? 'Meneja wa Mikopo' : 'Mwasilishaji';

        $report->update([
            'approval_status'  => $newStatus,
            'approved_by'      => null,
            'approved_by_name' => null,
            'approved_at'      => null,
            'lm_signed'        => false,
            'returned_to_stage'  => $returnTo,
            'returned_by_name'   => $user->name,
            'return_reason'      => $request->reason,
            'returned_at'        => now(),
        ]);

        $typeMap   = ['daily' => 'Kila Siku', 'weekly' => 'Wiki', 'monthly' => 'Mwezi'];
        $typeLabel = $typeMap[$report->report_type] ?? $report->report_type;
        $period    = \Carbon\Carbon::parse($report->period_start)->format('d/m/Y');
        $sms = app(SmsService::class);

        if ($returnTo === 'lm') {
            // Notify all loan managers it needs re-review
            $managers = User::where('role', 'loan_manager')->get();
            foreach ($managers as $m) {
                Notification::create([
                    'user_id' => $m->id,
                    'type'    => 'branch_report_returned',
                    'title'   => "🔄 Ripoti ya Tawi Imerudishwa Kwako ({$typeLabel})",
                    'message' => "{$user->name} amerejesha ripoti ya {$typeLabel} ya {$period} ({$report->branch}) ili uifanyie kazi tena. Sababu: {$request->reason}",
                    'link'    => '/branch-report',
                ]);
                $sms->sendBranchReportReturned($m, $report, $user, $stageLabel, $request->reason);
            }
        } else {
            // Notify original submitter (LO)
            if ($report->submitted_by) {
                Notification::create([
                    'user_id' => $report->submitted_by,
                    'type'    => 'branch_report_returned',
                    'title'   => "🔄 Ripoti Yako Imerudishwa — Inahitaji Marekebisho ({$typeLabel})",
                    'message' => "{$user->name} amerejesha ripoti yako ya {$typeLabel} ya {$period} ili uifanyie marekebisho. Sababu: {$request->reason}",
                    'link'    => '/branch-report',
                ]);
                $submitter = User::find($report->submitted_by);
                if ($submitter) {
                    $sms->sendBranchReportReturned($submitter, $report, $user, $stageLabel, $request->reason);
                }
            }
        }

        return response()->json(['data' => $report->fresh()]);
    }

    /** PUT /branch-reports/{id} — LO edits a rejected report and resubmits */
    public function update(Request $request, int $id)
    {
        $user  = auth()->user();
        $report = BranchReport::findOrFail($id);

        if ($report->submitted_by !== $user?->id) {
            return response()->json(['message' => 'Unaweza kuhariri ripoti zako mwenyewe tu'], 403);
        }
        if ($report->approval_status !== 'rejected') {
            return response()->json(['message' => 'Ripoti zilizotaliwa tu zinaweza kuhaririwa'], 422);
        }

        $data = $request->validate([
            'branch'             => 'nullable|string|max:100',
            'department'         => 'nullable|string|max:100',
            'section'            => 'nullable|string|max:100',
            'report_type'        => 'required|in:daily,weekly,monthly',
            'period_start'       => 'required|date',
            'period_end'         => 'required|date',
            'operations'         => 'nullable|array',
            'financials'         => 'nullable|array',
            'balances'           => 'nullable|array',
            'loan_officers'      => 'nullable|array',
            'expected_loans'     => 'nullable|array',
            'signature_password' => 'nullable|string',
        ]);

        $lo_signed = false;
        if (!empty($data['signature_password']) && $user) {
            $lo_signed = Hash::check($data['signature_password'], $user->password);
        }
        unset($data['signature_password']);

        $data['approval_status'] = 'pending';
        $data['lo_signed']       = $lo_signed;
        $data['lm_signed']       = false;
        $data['approved_by']     = null;
        $data['approved_by_name'] = null;
        $data['approved_at']     = null;

        $report->update($data);

        // Notify loan managers of the resubmission
        $typeMap   = ['daily' => 'Kila Siku', 'weekly' => 'Wiki', 'monthly' => 'Mwezi'];
        $typeLabel = $typeMap[$report->report_type] ?? $report->report_type;
        $period    = \Carbon\Carbon::parse($report->period_start)->format('d/m/Y');

        $managers = User::where('role', 'loan_manager')->get();
        $sms = app(SmsService::class);
        foreach ($managers as $m) {
            Notification::create([
                'user_id' => $m->id,
                'type'    => 'branch_report_pending',
                'title'   => "🔄 Ripoti ya Tawi Imewasilishwa Tena ({$typeLabel})",
                'message' => "{$report->submitted_by_name} amewasilisha tena ripoti ya {$typeLabel} ya {$period} ({$report->branch}). Tafadhali kagua.",
                'link'    => '/branch-report',
            ]);
            $sms->sendBranchReportPending($m, $report->fresh(), $user);
        }

        return response()->json(['data' => $report->fresh()]);
    }

    /**
     * GET /daily-report-summary?date=YYYY-MM-DD
     * Live daily snapshot: collections, unpaid clients, cash & mobile balances.
     * Visible to LM, GM, MD, and Admin.
     */
    public function dailyReportSummary(Request $request)
    {
        $user = auth()->user();
        // All authenticated staff can call this — LOs use it to auto-fill their form
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $date      = $request->filled('date') ? Carbon::parse($request->date)->toDateString() : Carbon::today()->toDateString();
        $yesterday = Carbon::parse($date)->subDay()->toDateString();

        // ── Today's repayments ─────────────────────────────────────────────────
        $todayReps = Repayment::with('loan:id,name,loan_account_number')
            ->whereDate('payment_date', $date)
            ->get();

        $todayItems = $todayReps->map(fn($r) => [
            'customer' => $r->loan?->name ?? 'Unknown',
            'amount'   => (float) $r->amount,
            'method'   => $r->payment_method,
        ])->values()->toArray();

        // ── Yesterday's mobile repayments (night) ─────────────────────────────
        $nightReps = Repayment::with('loan:id,name,loan_account_number')
            ->whereDate('payment_date', $yesterday)
            ->where('payment_method', 'mobile_money')
            ->get();

        $nightItems = $nightReps->map(fn($r) => [
            'customer' => $r->loan?->name ?? 'Unknown',
            'amount'   => (float) $r->amount,
            'method'   => $r->payment_method,
        ])->values()->toArray();

        // ── Clients with unpaid installments due on or before today ───────────
        $unpaidSchedules = LoanSchedule::with('loan:id,name,loan_account_number,payment_status')
            ->where('due_date', '<=', $date)
            ->where('status', '!=', 'paid')
            ->get();

        // Group by loan; find clients who haven't paid anything today
        $todayLoanIds = $todayReps->pluck('loan_id')->unique()->toArray();
        $unpaidItems = $unpaidSchedules
            ->groupBy('loan_id')
            ->map(function ($schedules) use ($todayLoanIds) {
                $loan = $schedules->first()->loan;
                return [
                    'customer'       => $loan?->name ?? 'Unknown',
                    'loan_account'   => $loan?->loan_account_number,
                    'paid_today'     => in_array($loan?->id, $todayLoanIds),
                    'installments'   => $schedules->count(),
                    'amount_due'     => round($schedules->sum(fn($s) => (float)$s->total_amount - (float)($s->amount_paid ?? 0))),
                ];
            })
            ->filter(fn($c) => !$c['paid_today'])
            ->values()
            ->toArray();

        // ── Opening balances from most recent approved daily branch report before today ──
        $prevReport = BranchReport::where('report_type', 'daily')
            ->where('approval_status', 'approved')
            ->where('period_start', '<', $date)
            ->orderByDesc('period_start')
            ->first();

        $prevBalances = $prevReport?->balances ?? [];
        $openingCash   = (float) ($prevBalances['cash']   ?? 0);
        $openingMobile = (float) ($prevBalances['mobile'] ?? 0);

        $todayCashIn   = $todayReps->where('payment_method', 'cash')->sum('amount');
        $nightMobileIn = $nightReps->sum('amount');

        // ── Loans disbursed on this date ──────────────────────────────────────
        $disbursedLoans = Loan::whereDate('disbursed_at', $date)->get(['id','name','amount']);
        $disbursedCount = $disbursedLoans->count();
        $disbursedTotal = $disbursedLoans->sum('amount');

        // ── SMS sent on this date ─────────────────────────────────────────────
        $smsSent = SmsLog::whereDate('created_at', $date)->count();

        // ── Mapato description string (names + amounts) ───────────────────────
        $mapatoDesc = collect($todayItems)
            ->map(fn($it) => "{$it['customer']} TZS {$it['amount']}/=")
            ->implode(', ');

        return response()->json(['data' => [
            'date'             => $date,
            'today_collections' => [
                'total'       => round($todayReps->sum('amount')),
                'count'       => $todayReps->count(),
                'items'       => $todayItems,
                'description' => $mapatoDesc,
            ],
            'last_night_mobile' => [
                'total' => round($nightMobileIn),
                'count' => $nightReps->count(),
                'items' => $nightItems,
            ],
            'unpaid_today' => [
                'count'      => count($unpaidItems),
                'total_owed' => round(array_sum(array_column($unpaidItems, 'amount_due'))),
                'items'      => $unpaidItems,
            ],
            'cash_balance' => [
                'opening'         => $openingCash,
                'collected_today' => round($todayCashIn),
                'closing'         => round($openingCash + $todayCashIn),
            ],
            'mobile_balance' => [
                'opening'  => $openingMobile,
                'received' => round($nightMobileIn),
                'closing'  => round($openingMobile + $nightMobileIn),
            ],
            'loans_disbursed' => [
                'count' => $disbursedCount,
                'total' => round($disbursedTotal),
                'items' => $disbursedLoans->map(fn($l) => ['name' => $l->name, 'amount' => (float)$l->amount])->values(),
            ],
            'sms_sent' => $smsSent,
        ]]);
    }

    /** DELETE /branch-reports/{id} */
    public function destroy(int $id)
    {
        $user  = auth()->user();
        $role  = $user?->role ?? '';
        $perms = $this->perms();

        if (!in_array($role, $perms['delete'] ?? [])) {
            return response()->json(['message' => 'Huna ruhusa ya kufuta ripoti'], 403);
        }

        BranchReport::findOrFail($id)->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
