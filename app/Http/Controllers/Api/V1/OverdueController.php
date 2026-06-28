<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Loan;
use App\Models\LoanSchedule;
use App\Models\CollectionActivity;
use App\Models\AuditLog;
use App\Sms\SmsService;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class OverdueController extends Controller
{
    use ApiResponse;

    public function __construct(protected SmsService $sms)
    {
    }

    // Sera za adhabu na uainishaji
    const PENALTY_RATE = 0.04;   // 4% ya kiasi kilichochelewa
    const DEFAULT_DAYS = 90;     // siku za kuhesabu mkopo kuwa "defaulted"

    /**
     * Muhtasari wa dashibodi ya madeni yaliyochelewa.
     */
    public function dashboard()
    {
        try {
            $today = now()->toDateString();
            $weekEnd = now()->addDays(7)->toDateString();

            // Schedules zilizochelewa (za mikopo iliyotolewa, hazijalipwa)
            $overdueSchedules = LoanSchedule::with('loan.customer')
                ->whereHas('loan', fn($q) => $q->whereNotNull('disbursed_at'))
                ->where('status', '!=', 'paid')
                ->whereDate('due_date', '<', $today)
                ->get();

            $overdueAmount = 0;
            $penalties = 0;
            $overdueLoanIds = [];
            $delinquentCustomers = [];
            foreach ($overdueSchedules as $s) {
                $amt = (float) $s->total_amount - (float) ($s->amount_paid ?? 0);
                $overdueAmount += $amt;
                $penalties += $amt * self::PENALTY_RATE;
                $overdueLoanIds[$s->loan_id] = true;
                if ($s->loan?->customer_id) {
                    $delinquentCustomers[$s->loan->customer_id] = true;
                }
            }

            $dueToday = LoanSchedule::whereHas('loan', fn($q) => $q->whereNotNull('disbursed_at'))
                ->where('status', '!=', 'paid')->whereDate('due_date', $today)->count();

            $dueThisWeek = LoanSchedule::whereHas('loan', fn($q) => $q->whereNotNull('disbursed_at'))
                ->where('status', '!=', 'paid')
                ->whereDate('due_date', '>=', $today)->whereDate('due_date', '<=', $weekEnd)->count();

            // Portfolio at Risk (PAR) = salio la mikopo iliyochelewa / salio lote * 100
            $totalOutstanding = (float) Loan::whereNotNull('disbursed_at')->sum('remaining_balance');
            $parOutstanding = (float) Loan::whereNotNull('disbursed_at')
                ->whereIn('id', array_keys($overdueLoanIds))->sum('remaining_balance');
            $par = $totalOutstanding > 0 ? round(($parOutstanding / $totalOutstanding) * 100, 2) : 0;

            // Recovery rate = jumla iliyolipwa / jumla inayotarajiwa
            $expected = (float) LoanSchedule::whereHas('loan', fn($q) => $q->whereNotNull('disbursed_at'))->sum('total_amount');
            $collected = (float) Loan::whereNotNull('disbursed_at')->sum('total_paid');
            $recoveryRate = $expected > 0 ? round(($collected / $expected) * 100, 2) : 0;

            // Collection efficiency = iliyolipwa / iliyostahili kulipwa hadi leo
            $dueToDate = (float) LoanSchedule::whereHas('loan', fn($q) => $q->whereNotNull('disbursed_at'))
                ->whereDate('due_date', '<=', $today)->sum('total_amount');
            $collectionEfficiency = $dueToDate > 0 ? round((min($collected, $dueToDate) / $dueToDate) * 100, 2) : 0;

            $defaulted = Loan::whereNotNull('disbursed_at')
                ->whereHas('schedules', function ($q) {
                    $q->where('status', '!=', 'paid')
                        ->whereDate('due_date', '<', now()->subDays(self::DEFAULT_DAYS)->toDateString());
                })->count();

            $underRecovery = CollectionActivity::whereIn('recovery_status', ['recovery', 'escalation', 'legal'])
                ->distinct('loan_id')->count('loan_id');

            return response()->json([
                'total_overdue_loans' => count($overdueLoanIds),
                'total_overdue_amount' => round($overdueAmount),
                'total_penalties' => round($penalties),
                'delinquent_borrowers' => count($delinquentCustomers),
                'due_today' => $dueToday,
                'due_this_week' => $dueThisWeek,
                'par' => $par,
                'recovery_rate' => $recoveryRate,
                'collection_efficiency' => $collectionEfficiency,
                'defaulted_loans' => $defaulted,
                'under_recovery' => $underRecovery,
                'aging' => $this->buildAging($overdueSchedules),
            ]);
        } catch (\Exception $e) {
            Log::error('overdue dashboard error: ' . $e->getMessage());
            return response()->json(['message' => 'Imeshindikana kupakia dashibodi'], 500);
        }
    }

    /**
     * Mgawanyo wa umri wa madeni (aging buckets) kwa chati.
     */
    private function buildAging($overdueSchedules): array
    {
        $buckets = ['1-7' => 0, '8-30' => 0, '31-60' => 0, '61-90' => 0, '90+' => 0];
        foreach ($overdueSchedules as $s) {
            $dpd = Carbon::parse($s->due_date)->diffInDays(now());
            if ($dpd <= 7) $buckets['1-7']++;
            elseif ($dpd <= 30) $buckets['8-30']++;
            elseif ($dpd <= 60) $buckets['31-60']++;
            elseif ($dpd <= 90) $buckets['61-90']++;
            else $buckets['90+']++;
        }
        return $buckets;
    }

    private function statusCategory(int $dpd): string
    {
        if ($dpd <= 0) return 'due_today';
        if ($dpd <= 7) return '1-7';
        if ($dpd <= 30) return '8-30';
        if ($dpd <= 60) return '31-60';
        if ($dpd <= 90) return '61-90';
        return '90+';
    }

    private function riskCategory(int $dpd): string
    {
        if ($dpd <= 7) return 'low';
        if ($dpd <= 30) return 'medium';
        if ($dpd <= 90) return 'high';
        return 'critical';
    }

    /**
     * Orodha ya mikopo iliyochelewa yenye taarifa kamili + vichujio.
     */
    public function loans(Request $request)
    {
        try {
            $today = now()->toDateString();

            $loans = Loan::with(['customer', 'user', 'schedules', 'collectionActivities'])
                ->whereNotNull('disbursed_at')
                ->whereHas('schedules', function ($q) use ($today) {
                    $q->where('status', '!=', 'paid')->whereDate('due_date', '<', $today);
                })
                ->get();

            $rows = $loans->map(function ($loan) use ($today) {
                $overdue = $loan->schedules
                    ->filter(fn($s) => $s->status !== 'paid' && $s->due_date && $s->due_date->toDateString() < $today);

                $overdueAmount = $overdue->sum(fn($s) => (float) $s->total_amount - (float) ($s->amount_paid ?? 0));
                $earliest = $overdue->sortBy('due_date')->first();
                $dpd = $earliest ? Carbon::parse($earliest->due_date)->diffInDays(now()) : 0;
                $penalty = round($overdueAmount * self::PENALTY_RATE);

                $latestActivity = $loan->collectionActivities->sortByDesc('created_at')->first();
                $recoveryStatus = $latestActivity?->recovery_status;

                // Hali: heshimu hali ya urejeshaji ikiwa ni ya juu, vinginevyo tumia umri
                $status = in_array($recoveryStatus, ['legal', 'written_off', 'restructured'])
                    ? $recoveryStatus
                    : ($dpd > self::DEFAULT_DAYS ? 'defaulted' : $this->statusCategory($dpd));

                return [
                    'loan_id' => $loan->id,
                    'loan_number' => $loan->loan_account_number ?? ('LN-' . $loan->id),
                    'borrower' => $loan->name,
                    'customer_id' => $loan->customer?->customer_number ?? ('CUST-' . str_pad((string) ($loan->customer_id ?? 0), 6, '0', STR_PAD_LEFT)),
                    'product' => $loan->product_name,
                    'branch' => $loan->customer?->region ?: 'Dar es Salaam',
                    'loan_officer' => $loan->user?->name ?? '—',
                    'loan_amount' => round((float) $loan->amount),
                    'outstanding_balance' => round((float) ($loan->remaining_balance ?? $loan->amount)),
                    'installment_amount' => round((float) ($loan->monthly_payment ?? ($earliest?->total_amount ?? 0))),
                    'due_date' => $earliest?->due_date?->toDateString(),
                    'days_past_due' => $dpd,
                    'penalty_amount' => $penalty,
                    'total_due' => round($overdueAmount + $penalty),
                    'status' => $status,
                    'risk' => $this->riskCategory($dpd),
                    'recovery_status' => $recoveryStatus ?? 'reminder',
                    'activities_count' => $loan->collectionActivities->count(),
                ];
            })->values();

            // Vichujio
            $search = strtolower((string) $request->query('search', ''));
            $statusFilter = $request->query('status');
            $riskFilter = $request->query('risk');

            $filtered = $rows->filter(function ($r) use ($search, $statusFilter, $riskFilter) {
                if ($search && !str_contains(strtolower($r['borrower'] . ' ' . $r['loan_number']), $search)) return false;
                if ($statusFilter && $r['status'] !== $statusFilter) return false;
                if ($riskFilter && $r['risk'] !== $riskFilter) return false;
                return true;
            })->values();

            return response()->json(['loans' => $filtered]);
        } catch (\Exception $e) {
            Log::error('overdue loans error: ' . $e->getMessage());
            return response()->json(['message' => 'Imeshindikana kupakia mikopo'], 500);
        }
    }

    /**
     * Historia ya hatua za ukusanyaji kwa mkopo mmoja.
     */
    public function activities($loanId)
    {
        $activities = CollectionActivity::where('loan_id', $loanId)
            ->orderByDesc('created_at')->get();
        return response()->json(['activities' => $activities]);
    }

    /**
     * Rekodi hatua mpya ya ukusanyaji / ahadi ya kulipa.
     */
    public function storeActivity(Request $request, $loanId)
    {
        $user = $request->user();

        $data = $request->validate([
            'stage' => 'required|string|in:reminder,follow_up,recovery,escalation,closure',
            'contact_method' => 'nullable|string|in:sms,email,call,whatsapp,letter,field_visit,app',
            'notes' => 'nullable|string',
            'promised_amount' => 'nullable|numeric|min:0',
            'promised_date' => 'nullable|date',
            'expected_payment_date' => 'nullable|date',
            'next_action_date' => 'nullable|date',
            'recovery_status' => 'nullable|string|in:reminder,follow_up,recovery,escalation,legal,restructured,written_off,closed',
        ]);

        try {
            $loan = Loan::findOrFail($loanId);

            $activity = CollectionActivity::create([
                'loan_id' => $loan->id,
                'customer_id' => $loan->customer_id,
                'stage' => $data['stage'],
                'contact_method' => $data['contact_method'] ?? null,
                'officer_name' => $user->name ?? null,
                'notes' => $data['notes'] ?? null,
                'promised_amount' => $data['promised_amount'] ?? null,
                'promised_date' => $data['promised_date'] ?? null,
                'expected_payment_date' => $data['expected_payment_date'] ?? null,
                'promise_status' => !empty($data['promised_amount']) ? 'pending' : 'pending',
                'next_action_date' => $data['next_action_date'] ?? null,
                'recovery_status' => $data['recovery_status'] ?? $data['stage'],
                'created_by' => $user->id ?? null,
            ]);

            AuditLog::record(
                'collection.activity',
                $user,
                $loan,
                'Hatua ya ukusanyaji imerekodiwa kwa mkopo ' . ($loan->loan_account_number ?? $loan->id),
                ['stage' => $data['stage'], 'recovery_status' => $activity->recovery_status]
            );

            return $this->success($activity, 'Hatua ya ukusanyaji imehifadhiwa');
        } catch (\Exception $e) {
            Log::error('storeActivity error: ' . $e->getMessage());
            return $this->error('Imeshindikana kuhifadhi hatua', 500);
        }
    }

    /**
     * Send an automated Swahili payment reminder/overdue SMS for a single
     * loan's next unpaid installment, and log it as a collection activity
     * so it shows up in that loan's contact history alongside manual notes.
     */
    public function sendReminderSms(Request $request, $loanId)
    {
        $user = $request->user();

        try {
            $loan = Loan::with('customer')->findOrFail($loanId);

            $schedule = LoanSchedule::where('loan_id', $loan->id)
                ->where('status', '!=', 'paid')
                ->orderBy('due_date', 'asc')
                ->first();

            if (!$schedule) {
                return $this->error('Mkopo huu hauna malipo yanayosubiri', 422);
            }

            $amountDue = (float) $schedule->total_amount - (float) ($schedule->amount_paid ?? 0);
            $dueDate = $schedule->due_date instanceof \Carbon\Carbon ? $schedule->due_date->toDateString() : $schedule->due_date;
            $daysOverdue = Carbon::parse($dueDate)->diffInDays(now(), false);
            $isOverdue = $daysOverdue > 0;

            $result = $isOverdue
                ? $this->sms->sendPaymentOverdue($loan, $amountDue, (int) $daysOverdue)
                : $this->sms->sendPaymentReminder($loan, $amountDue, $dueDate);

            if (!$result->success) {
                return $this->error('Imeshindikana kutuma SMS: ' . ($result->error ?? 'hitilafu isiyojulikana'), 422);
            }

            $activity = CollectionActivity::create([
                'loan_id' => $loan->id,
                'customer_id' => $loan->customer_id,
                'stage' => $isOverdue ? 'follow_up' : 'reminder',
                'contact_method' => 'sms',
                'officer_name' => $user->name ?? null,
                'notes' => $isOverdue
                    ? "SMS ya malipo yaliyochelewa imetumwa (siku {$daysOverdue}, TZS " . number_format($amountDue) . ')'
                    : 'SMS ya ukumbusho wa malipo imetumwa (TZS ' . number_format($amountDue) . ')',
                'recovery_status' => $isOverdue ? 'follow_up' : 'reminder',
                'created_by' => $user->id ?? null,
            ]);

            AuditLog::record(
                'collection.sms_sent',
                $user,
                $loan,
                'SMS ya ' . ($isOverdue ? 'malipo yaliyochelewa' : 'ukumbusho') . ' imetumwa kwa mkopo ' . ($loan->loan_account_number ?? $loan->id),
                ['amount_due' => $amountDue, 'overdue' => $isOverdue]
            );

            return $this->success($activity, $isOverdue ? 'SMS ya malipo yaliyochelewa imetumwa' : 'SMS ya ukumbusho imetumwa');
        } catch (\Exception $e) {
            Log::error('sendReminderSms error: ' . $e->getMessage());
            return $this->error('Imeshindikana kutuma SMS', 500);
        }
    }
}
