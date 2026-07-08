<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Loan;
use App\Models\Repayment;
use App\Services\AccountingService;
use App\Support\LoanClassification;
use App\Traits\ApiResponse;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Bank of Tanzania (BOT) Tier-2 microfinance regulatory reporting. Produces the
 * periodic returns a non-deposit-taking microfinance service provider files —
 * portfolio summary, loan classification & provisioning, PAR, and a financial
 * position summary — for a quarterly, half-yearly (mid-annual) or annual period.
 *
 * Accessible to Loan Manager, General Manager, Managing Director and Admin —
 * the roles accountable for regulatory submissions.
 */
class RegulatorReportController extends Controller
{
    use ApiResponse;

    public function __construct(protected AccountingService $accounting)
    {
    }

    private function guard(Request $request)
    {
        $u = $request->user();
        $allowed = $u && ($u->isAdmin() || $u->isLoanManager() || $u->isGeneralManager() || $u->isManagingDirector());
        return $allowed ? null : $this->error('Only Loan Manager, GM, MD or Admin can access regulator reports', 403);
    }

    /**
     * Resolve from/to dates for a period.
     * period_type: quarter | half | annual ; period: 1-4 (quarter), 1-2 (half), 1 (annual).
     */
    private function resolvePeriod(string $type, int $year, int $period): array
    {
        switch ($type) {
            case 'quarter':
                $p = min(4, max(1, $period));
                $startMonth = ($p - 1) * 3 + 1;
                $from = Carbon::create($year, $startMonth, 1)->startOfDay();
                $to = (clone $from)->addMonths(3)->subDay()->endOfDay();
                $label = "Q{$p} {$year}";
                break;
            case 'half':
                $p = min(2, max(1, $period));
                $startMonth = $p === 1 ? 1 : 7;
                $from = Carbon::create($year, $startMonth, 1)->startOfDay();
                $to = (clone $from)->addMonths(6)->subDay()->endOfDay();
                $label = ($p === 1 ? "H1 (Jan–Jun) " : "H2 (Jul–Dec) ") . $year;
                break;
            case 'annual':
            default:
                $from = Carbon::create($year, 1, 1)->startOfDay();
                $to = Carbon::create($year, 12, 31)->endOfDay();
                $label = "Annual {$year}";
                break;
        }
        return ['from' => $from, 'to' => $to, 'label' => $label, 'type' => $type, 'year' => $year, 'period' => $period];
    }

    public function generate(Request $request)
    {
        if ($r = $this->guard($request)) return $r;

        $data = $request->validate([
            'period_type' => 'required|in:quarter,half,annual',
            'year' => 'required|integer|min:2000|max:2100',
            'period' => 'nullable|integer|min:1|max:4',
        ]);

        try {
            $period = $this->resolvePeriod($data['period_type'], (int) $data['year'], (int) ($data['period'] ?? 1));
            $from = $period['from'];
            $to = $period['to'];

            // ---- Portfolio activity during the period ----
            $disbursedInPeriod = Loan::whereBetween('disbursed_at', [$from, $to])->get();
            $newLoansCount = $disbursedInPeriod->count();
            $newLoansValue = round((float) $disbursedInPeriod->sum('amount'));

            $repaymentsInPeriod = Repayment::where('status', 'completed')
                ->whereBetween('payment_date', [$from->toDateString(), $to->toDateString()])
                ->get();
            $principalCollected = round((float) $repaymentsInPeriod->sum('principal_amount'));
            $interestCollected = round((float) $repaymentsInPeriod->sum('interest_amount'));
            $totalCollected = round((float) $repaymentsInPeriod->sum('amount'));

            // ---- Outstanding portfolio + classification AS OF period end ----
            $activeLoans = Loan::with('customer', 'schedules')
                ->whereNotNull('disbursed_at')
                ->where(function ($q) {
                    $q->where('remaining_balance', '>', 0)->orWhereNull('remaining_balance');
                })
                ->get();

            $totalOutstanding = 0;
            $classification = [];
            foreach (LoanClassification::BANDS as $band) {
                $classification[$band['class']] = ['label' => $band['label'], 'rate' => $band['rate'], 'count' => 0, 'outstanding' => 0.0, 'provision' => 0.0];
            }
            $parOutstanding = 0; // outstanding of loans overdue >= 1 day

            foreach ($activeLoans as $loan) {
                $outstanding = (float) ($loan->remaining_balance ?? 0);
                if ($outstanding <= 0) {
                    continue;
                }
                $totalOutstanding += $outstanding;
                $dpd = LoanClassification::maxDaysOverdue($loan, $to->copy()->startOfDay());
                $band = LoanClassification::forDaysOverdue($dpd);
                $classification[$band['class']]['count']++;
                $classification[$band['class']]['outstanding'] += $outstanding;
                $classification[$band['class']]['provision'] += round($outstanding * $band['rate'], 2);
                if ($dpd >= 1) {
                    $parOutstanding += $outstanding;
                }
            }

            $totalProvision = 0;
            foreach ($classification as &$c) {
                $c['outstanding'] = round($c['outstanding']);
                $c['provision'] = round($c['provision']);
                $totalProvision += $c['provision'];
            }
            unset($c);

            $activeBorrowers = $activeLoans->filter(fn($l) => (float) ($l->remaining_balance ?? 0) > 0)
                ->pluck('customer_id')->filter()->unique()->count();

            // Borrower demographics (gender split of active borrowers). Gender is
            // free-text on the customer record and may be EN or SW, so we match
            // on the leading letter: male=Male/Mume/Mwanaume, female=Female/Mke/Mwanamke.
            $genderSplit = ['male' => 0, 'female' => 0, 'unknown' => 0];
            $seenCustomers = [];
            foreach ($activeLoans as $loan) {
                if ((float) ($loan->remaining_balance ?? 0) <= 0 || !$loan->customer_id || isset($seenCustomers[$loan->customer_id])) {
                    continue;
                }
                $seenCustomers[$loan->customer_id] = true;
                $g = strtolower(trim((string) ($loan->customer->gender ?? '')));
                if (in_array($g, ['female', 'mke', 'mwanamke', 'f', 'ke'], true)) {
                    $genderSplit['female']++;
                } elseif (in_array($g, ['male', 'mume', 'mwanaume', 'kiume', 'm', 'me'], true)) {
                    $genderSplit['male']++;
                } else {
                    $genderSplit['unknown']++;
                }
            }

            // ---- Financial position from the accounting engine ----
            $incomeStatement = $this->accounting->incomeStatement($from->toDateString(), $to->toDateString());
            $balanceSheet = $this->accounting->balanceSheet($to->toDateString());

            $writeOffsInPeriod = Loan::where('status', 'written_off')
                ->whereBetween('updated_at', [$from, $to])->get();

            return $this->success([
                'period' => [
                    'type' => $period['type'],
                    'year' => $period['year'],
                    'period' => $period['period'],
                    'label' => $period['label'],
                    'from' => $from->toDateString(),
                    'to' => $to->toDateString(),
                    'generated_at' => now()->toDateTimeString(),
                ],
                'portfolio' => [
                    'new_loans_count' => $newLoansCount,
                    'new_loans_value' => $newLoansValue,
                    'principal_collected' => $principalCollected,
                    'interest_collected' => $interestCollected,
                    'total_collected' => $totalCollected,
                    'total_outstanding' => round($totalOutstanding),
                    'active_loans' => $activeLoans->filter(fn($l) => (float) ($l->remaining_balance ?? 0) > 0)->count(),
                    'active_borrowers' => $activeBorrowers,
                    'write_offs_count' => $writeOffsInPeriod->count(),
                    'write_offs_value' => round((float) $writeOffsInPeriod->sum('remaining_balance')),
                ],
                'classification' => array_values($classification),
                'par' => [
                    'amount_at_risk' => round($parOutstanding),
                    'ratio' => $totalOutstanding > 0 ? round(($parOutstanding / $totalOutstanding) * 100, 2) : 0,
                ],
                'provisioning' => [
                    'total_required' => round($totalProvision),
                ],
                'demographics' => $genderSplit,
                'financials' => [
                    'total_income' => round((float) ($incomeStatement['total_income'] ?? 0)),
                    'total_expense' => round((float) ($incomeStatement['total_expense'] ?? 0)),
                    'net_income' => round((float) ($incomeStatement['net_income'] ?? 0)),
                    'total_assets' => round((float) ($balanceSheet['total_assets'] ?? 0)),
                    'total_liabilities' => round((float) ($balanceSheet['total_liabilities'] ?? 0)),
                    'total_equity' => round((float) ($balanceSheet['total_equity'] ?? 0)),
                ],
            ], 'Regulator report generated');
        } catch (\Exception $e) {
            Log::error('RegulatorReport error: ' . $e->getMessage());
            return $this->error($e->getMessage(), 500);
        }
    }
}
