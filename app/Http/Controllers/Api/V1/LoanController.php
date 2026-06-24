<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Loan;
use App\Models\Repayment;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use App\Models\Customer;
use App\Models\LoanApproval;
use App\Http\Requests\StoreLoanRequest;
use App\Services\LoanService;
use App\Traits\ApiResponse;

class LoanController extends Controller
{
    use ApiResponse;

    protected $loanService;

    public function __construct(LoanService $loanService)
    {
        $this->loanService = $loanService;
    }
    // ========== LOAN SUBMISSION ==========

    // SUBMIT LOAN
    public function store(StoreLoanRequest $request)
    {
        try {
            $data = $request->validated();
            $data['user_id'] = $request->user()->id ?? null;
            $loan = $this->loanService->createLoan($data);
            return $this->success($loan, 'Loan created successfully', 201);
        } catch (\Exception $e) {
            Log::error('Loan submission error: ' . $e->getMessage());
            return $this->error($e->getMessage(), 500);
        }
    }


    // ========== APPROVAL FLOW ==========

    // OFFICER VIEW (Their own submitted loans)
    public function myLoans(Request $request)
    {
        $loans = Loan::with(['customer', 'approvals.user', 'user'])
            ->where('user_id', $request->user()->id)
            ->orderBy('created_at', 'desc')
            ->get();
        return $this->appendBorrowerMetrics($loans);
    }

    // MANAGER VIEW
    public function managerLoans()
    {
        // Show loans CURRENTLY at manager_review
        // OR previously at/above manager_review (to keep rejected/returned loans visible)
        $loans = Loan::with(['customer', 'approvals.user', 'user'])
            ->where('status', 'manager_review')
            ->orWhereHas('approvals', function ($query) {
                $query->whereIn('status', ['manager_review', 'gm_review', 'md_review', 'approved']);
            })
            ->orderByRaw("FIELD(status, 'manager_review', 'gm_review', 'md_review', 'approved', 'loan_officer')")
            ->orderBy('updated_at', 'desc')
            ->get();
        return response()->json($this->appendBorrowerMetrics($loans));
    }

    // GM VIEW
    public function gmLoans()
    {
        // Show loans CURRENTLY at gm_review or higher
        // OR previously processed by GM level or above
        $loans = Loan::with(['customer', 'approvals.user', 'user'])
            ->whereIn('status', ['gm_review', 'md_review', 'approved'])
            ->orWhereHas('approvals', function ($query) {
                $query->whereIn('status', ['gm_review', 'md_review', 'approved']);
            })
            ->orderByRaw("FIELD(status, 'gm_review', 'md_review', 'approved', 'manager_review', 'loan_officer')")
            ->orderBy('updated_at', 'desc')
            ->get();
        return response()->json($this->appendBorrowerMetrics($loans));
    }

    // MD VIEW
    public function mdLoans()
    {
        // Show loans CURRENTLY at md_review or higher
        // OR previously processed by MD level
        $loans = Loan::with(['customer', 'approvals.user', 'user'])
            ->whereIn('status', ['md_review', 'approved'])
            ->orWhereHas('approvals', function ($query) {
                $query->whereIn('status', ['md_review', 'approved']);
            })
            ->orderByRaw("FIELD(status, 'md_review', 'approved', 'gm_review', 'manager_review', 'loan_officer')")
            ->orderBy('updated_at', 'desc')
            ->get();
        return response()->json($this->appendBorrowerMetrics($loans));
    }


    // FINANCE OFFICER / CASHIER VIEW (approved loans awaiting disbursement, plus already disbursed for reference)
    public function financeLoans()
    {
        $loans = Loan::with(['customer', 'approvals.user', 'user'])
            ->whereIn('status', ['approved', 'disbursed'])
            ->orderByRaw("FIELD(status, 'approved', 'disbursed')")
            ->orderBy('updated_at', 'desc')
            ->get();
        return response()->json($this->appendBorrowerMetrics($loans));
    }

    /**
     * Helper to append borrower metrics to a collection of loans.
     */
    private function appendBorrowerMetrics($loans)
    {
        foreach ($loans as $loan) {
            $customer = $loan->customer;
            if ($customer) {
                $loan->active_loans_count = $customer->loans()->whereIn('status', ['approved', 'disbursed'])->count();
                $loan->total_remaining_balance = $customer->loans()->sum('remaining_balance');

                // Arrears across all loans for this customer
                $totalArrears = 0;
                foreach ($customer->loans as $cLoan) {
                    $totalArrears += $cLoan->getArrearsAmount();
                }
                $loan->total_arrears = $totalArrears;
            } else {
                $loan->active_loans_count = 0;
                $loan->total_remaining_balance = 0;
                $loan->total_arrears = 0;
            }

            // Append latest rejection if any
            $latestRejection = $loan->approvals()
                ->whereIn('status', ['rejected', 'returned'])
                ->latest()
                ->with('user')
                ->first();

            if ($latestRejection) {
                $loan->rejection_metadata = [
                    'reason' => $latestRejection->rejection_reason ?? $latestRejection->comments,
                    'rejector_name' => $latestRejection->user->name ?? 'Msimamizi',
                    'rejector_role' => $latestRejection->user->role ?? 'admin',
                    'date' => $latestRejection->created_at->toDateTimeString()
                ];
            }
        }
        return $loans;
    }

    // ALL LOANS (for debugging)
    public function allLoans()
    {
        return Loan::with(['customer', 'approvals.user', 'user'])->orderBy('created_at', 'desc')->get();
    }

    // GET SINGLE LOAN
    public function show($id)
    {
        $loan = Loan::with(['customer', 'approvals.user', 'user'])->findOrFail($id);
        $this->appendBorrowerMetrics(collect([$loan]));
        return response()->json($loan);
    }

    // APPROVE LOAN (moves to next level)
    public function approve(Request $request, $id)
    {
        try {
            $loan = Loan::findOrFail($id);
            $user = $request->user();

            $request->validate([
                'comments' => 'required|string|min:3'
            ]);

            // Strict role verification for each stage
            if ($loan->status === 'manager_review' && !$user->isLoanManager() && !$user->isAdmin()) {
                return $this->error('Only Loan Manager can approve this stage', 403);
            }
            if ($loan->status === 'gm_review' && !$user->isGeneralManager() && !$user->isAdmin()) {
                return $this->error('Only General Manager can approve this stage', 403);
            }
            if ($loan->status === 'md_review' && !$user->isManagingDirector() && !$user->isAdmin()) {
                return $this->error('Only Managing Director can approve this stage', 403);
            }

            $updatedLoan = $this->loanService->approveLoan($loan, $request->all(), $user);
            return $this->success($updatedLoan->fresh(['customer', 'approvals.user']), 'Loan approved successfully');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), 500);
        }
    }

    // REJECT LOAN (returns to previous level)
    public function reject(Request $request, $id)
    {
        $request->validate([
            'reason' => 'required|string|min:3'
        ]);

        try {
            $loan = Loan::findOrFail($id);
            $user = $request->user();

            // Strict role verification (same as approve)
            if ($loan->status === 'manager_review' && !$user->isLoanManager() && !$user->isAdmin()) {
                return $this->error('Only Loan Manager can reject this stage', 403);
            }
            if ($loan->status === 'gm_review' && !$user->isGeneralManager() && !$user->isAdmin()) {
                return $this->error('Only General Manager can reject this stage', 403);
            }
            if ($loan->status === 'md_review' && !$user->isManagingDirector() && !$user->isAdmin()) {
                return $this->error('Only Managing Director can reject this stage', 403);
            }

            $updatedLoan = $this->loanService->rejectLoan($loan, $request->all(), $user);
            return $this->success($updatedLoan->fresh(['customer', 'approvals.user']), 'Loan rejected successfully');
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), 500);
        }
    }

    // DISBURSEMENT PREVIEW (borrower info, loan details, charges defaults, repayment summary)
    public function disbursementPreview(Request $request, $id)
    {
        $user = $request->user();
        if (!$user->isFinanceOfficer() && !$user->isAdmin()) {
            return $this->error('Only Finance Officer/Cashier can access disbursement', 403);
        }

        $loan = Loan::with(['customer', 'user', 'disbursement'])->findOrFail($id);
        $interestRate = (float) ($loan->details['kiwakocha_Riba'] ?? 3) / 100;
        $summary = $loan->scheduleSummary($interestRate);

        return response()->json([
            'loan' => $loan,
            'customer_number' => $loan->customer?->customer_number,
            'loan_number' => $loan->loan_number,
            'product_name' => $loan->product_name,
            'officer_name' => $loan->user?->name,
            'branch' => $loan->customer?->region ?: 'Dar es Salaam',
            'repayment_summary' => [
                'term_months' => $loan->termMonths(),
                'frequency' => $loan->repaymentFrequency(),
                'interest_rate' => (int) ($loan->details['kiwakocha_Riba'] ?? 3),
                'total_installments' => $summary['total_installments'],
                'installment_amount' => $summary['installment_amount'],
                'first_payment_date' => $summary['first_payment_date'],
                'final_payment_date' => $summary['final_payment_date'],
            ],
            'already_disbursed' => (bool) ($loan->disbursed_at || $loan->disbursement),
        ]);
    }

    // DISBURSE LOAN (full flow: charges, payment details, verification, confirmation, activation)
    public function disburse(Request $request, $id)
    {
        $user = $request->user();
        if (!$user->isFinanceOfficer() && !$user->isAdmin()) {
            return $this->error('Only Finance Officer/Cashier can disburse loans', 403);
        }

        $data = $request->validate([
            'disbursement_date' => 'required|date',
            'amount' => 'required|numeric|min:1',
            'processing_fee' => 'nullable|numeric|min:0',
            'insurance_fee' => 'nullable|numeric|min:0',
            'other_charges' => 'nullable|numeric|min:0',
            'method' => 'required|string|in:cash,bank_transfer,mpesa,airtel_money,tigo_pesa,halopesa,cheque',
            'transaction_reference' => 'nullable|string',
            'payment_details' => 'nullable|array',
            'narration' => 'nullable|string|max:255',
            'branch' => 'nullable|string|max:120',

            // Verification checklist — all six must be confirmed
            'verification' => 'required|array',
            'verification.identity_verified' => 'accepted',
            'verification.agreement_signed' => 'accepted',
            'verification.guarantor_signed' => 'accepted',
            'verification.charges_confirmed' => 'accepted',
            'verification.customer_present' => 'accepted',
            'verification.payment_verified' => 'accepted',

            // Final confirmation
            'confirm' => 'accepted',
            'password' => 'required|string',
        ]);

        // Confirm the operator's identity via password/PIN
        if (!\Illuminate\Support\Facades\Hash::check($data['password'], $user->password)) {
            return $this->error('Password confirmation failed. Please re-enter your password.', 422);
        }

        try {
            $loan = Loan::findOrFail($id);
            $updatedLoan = $this->loanService->disburseLoan($loan, $data, $user);
            return $this->success(
                $updatedLoan->fresh(['disbursement', 'customer']),
                'Loan disbursed and activated successfully'
            );
        } catch (\Exception $e) {
            return $this->error($e->getMessage(), 500);
        }
    }


    // UPDATE LOAN
    public function update(Request $request, $id)
    {
        try {
            $loan = Loan::findOrFail($id);

            // Only allow updates if the loan is still in review status
            if (!in_array($loan->status, ['manager_review', 'loan_officer'])) {
                return $this->error('Loan cannot be updated at this stage', 403);
            }

            $data = $request->all();
            $updateData = [
                'name' => $data['name'] ?? $loan->name,
                'phone' => $data['phone'] ?? $loan->phone,
                'amount' => $data['amount'] ?? $loan->amount,
                'details' => $data['details'] ?? $loan->details,
                'passport_photo' => $data['passport_photo'] ?? $loan->passport_photo,
                'guarantor_1_photo' => $data['guarantor_1_photo'] ?? $loan->guarantor_1_photo,
                'guarantor_2_photo' => $data['guarantor_2_photo'] ?? $loan->guarantor_2_photo,
            ];

            // If it was returned to officer, resubmit it to manager review upon update
            if ($loan->status === 'loan_officer') {
                $updateData['status'] = 'manager_review';
            }

            $loan->update($updateData);

            return $this->success($loan, 'Loan updated successfully');
        } catch (\Exception $e) {
            Log::error('Loan update error: ' . $e->getMessage());
            return $this->error($e->getMessage(), 500);
        }
    }

    // DELETE LOAN
    public function destroy($id)
    {
        try {
            $loan = Loan::findOrFail($id);
            $loan->delete();
            return $this->success(null, 'Loan deleted successfully');
        } catch (\Exception $e) {
            Log::error('Loan deletion error: ' . $e->getMessage());
            return $this->error($e->getMessage(), 500);
        }
    }


    // ========== DASHBOARD STATISTICS ==========

    // GET LOANS STATISTICS FOR DASHBOARD
    public function getStats(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $counts = [
            'manager_review' => 0,
            'gm_review' => 0,
            'md_review' => 0,
            'approved' => 0,
        ];

        // Role-based visibility logic
        if ($user->isAdmin() || $user->isLoanManager()) {
            $counts['manager_review'] = Loan::where('status', 'manager_review')->count();
        }

        if ($user->isAdmin() || $user->isLoanManager() || $user->isGeneralManager()) {
            $counts['gm_review'] = Loan::where('status', 'gm_review')->count();
        }

        if ($user->isAdmin() || $user->isLoanManager() || $user->isGeneralManager() || $user->isManagingDirector()) {
            $counts['md_review'] = Loan::where('status', 'md_review')->count();
        }

        // Everyone (except maybe officer) can see approved/disbursed totals?
        // Let's keep it visible for all management roles as a baseline
        if ($user->isAdmin() || $user->isLoanManager() || $user->isGeneralManager() || $user->isManagingDirector()) {
            $counts['approved'] = Loan::whereIn('status', ['approved', 'disbursed', 'completed'])->count();
        }

        return response()->json(array_merge($counts, [
            'total' => array_sum($counts)
        ]));
    }


    // ========== REPAYMENT METHODS ==========

    // GET ACTIVE LOANS
    public function activeLoans()
    {
        // Only disbursed loans are being repaid — approved-but-undisbursed loans
        // are still awaiting the finance/cashier and must not show here.
        $loans = Loan::with(['customer', 'approvals.user', 'user'])
            ->whereNotNull('disbursed_at')
            ->where(function ($query) {
                $query->where('payment_status', '!=', 'completed')
                    ->orWhereNull('payment_status');
            })
            ->get();

        // Round numbers to remove decimals
        foreach ($loans as $loan) {
            $loan->amount = round($loan->amount);
            $loan->total_paid = round($loan->total_paid ?? 0);
            $loan->remaining_balance = round($loan->remaining_balance ?? $loan->amount);
        }

        return response()->json($loans);
    }

    // GET COMPLETED LOANS
    public function completedLoans()
    {
        $loans = Loan::with(['customer', 'approvals.user', 'user'])
            ->where('status', 'completed')
            ->orWhere('remaining_balance', '<=', 0)
            ->orderBy('updated_at', 'desc')
            ->get();

        // Round numbers to remove decimals
        foreach ($loans as $loan) {
            $loan->amount = round($loan->amount);
            $loan->total_paid = round($loan->total_paid ?? $loan->amount);
            $loan->remaining_balance = 0;
        }

        return response()->json($loans);
    }

    // GET LOAN REPAYMENT HISTORY
    public function repaymentHistory($id)
    {
        try {
            $loan = Loan::with(['customer', 'user', 'repayments', 'schedules'])->findOrFail($id);

            $progressPercentage = 0;
            if ($loan->amount > 0 && ($loan->total_paid ?? 0) > 0) {
                $progressPercentage = round((($loan->total_paid ?? 0) / $loan->amount) * 100, 2);
            }

            return response()->json([
                'loan' => $loan,
                'repayments' => $loan->repayments()->orderBy('payment_date', 'desc')->get(),
                'total_paid' => round($loan->total_paid ?? 0),
                'remaining_balance' => round($loan->remaining_balance ?? $loan->amount),
                'progress_percentage' => $progressPercentage,
            ]);
        } catch (\Exception $e) {
            Log::error('repaymentHistory error: ' . $e->getMessage());
            return response()->json([
                'error' => $e->getMessage(),
                'message' => 'Failed to fetch repayment history'
            ], 500);
        }
    }

    // RECORD A REPAYMENT
    public function recordRepayment(Request $request, $id)
    {
        $user = $request->user();
        if (!$user->isFinanceOfficer() && !$user->isAdmin()) {
            return $this->error('Only Finance Officer/Cashier can record payments', 403);
        }

        $data = $request->validate([
            'amount' => 'required|numeric|min:1',
            'payment_date' => 'required|date',
            'payment_method' => 'required|string|in:cash,bank_transfer,mobile_money',
            'transaction_id' => 'nullable|string',
            'notes' => 'nullable|string',
        ]);

        try {
            $loan = Loan::findOrFail($id);
            $result = $this->loanService->recordRepayment($loan, $data, $user);
            return $this->success($result, 'Repayment recorded successfully');
        } catch (\Exception $e) {
            Log::error('recordRepayment error: ' . $e->getMessage());
            return $this->error($e->getMessage(), 500);
        }
    }

    // REVERSE A FAILED REPAYMENT (Finance Officer/Cashier, with authorization note)
    public function reverseRepayment(Request $request, $repaymentId)
    {
        $user = $request->user();
        if (!$user->isFinanceOfficer() && !$user->isAdmin()) {
            return $this->error('Only Finance Officer/Cashier can reverse transactions', 403);
        }

        $data = $request->validate([
            'reason' => 'required|string|min:3',
            'authorized_by' => 'required|string|min:2',
        ]);

        try {
            $repayment = Repayment::findOrFail($repaymentId);
            $result = $this->loanService->reverseRepayment($repayment, $data, $user);
            return $this->success($result, 'Repayment reversed successfully');
        } catch (\Exception $e) {
            Log::error('reverseRepayment error: ' . $e->getMessage());
            return $this->error($e->getMessage(), 500);
        }
    }

    // GET REPAYMENT SUMMARY - FIXED DECIMAL ISSUE
    public function repaymentSummary()
    {
        try {
            // Only loans actually disbursed by finance/cashier count as "disbursed"
            // (status 'approved' = MD-approved but awaiting disbursement, not yet paid out)
            $totalDisbursed = round(Loan::whereNotNull('disbursed_at')->sum('amount'));
            $totalRepaid = round(Loan::whereNotNull('disbursed_at')->sum('total_paid'));
            $outstanding = $totalDisbursed - $totalRepaid;

            $activeLoans = Loan::whereNotNull('disbursed_at')
                ->whereIn('payment_status', ['pending', 'partial'])
                ->count();

            $completedLoans = Loan::where('payment_status', 'completed')->count();

            return response()->json([
                'total_disbursed' => (float) $totalDisbursed,
                'total_repaid' => (float) $totalRepaid,
                'outstanding' => (float) $outstanding,
                'repayment_rate' => $totalDisbursed > 0 ? round(($totalRepaid / $totalDisbursed) * 100, 2) : 0,
                'active_loans' => $activeLoans,
                'completed_loans' => $completedLoans,
                'overdue_loans' => 0,
                'monthly_trend' => $this->buildMonthlyTrend(),
                'portfolio_health' => $this->buildPortfolioHealth(),
            ]);
        } catch (\Exception $e) {
            \Log::error('repaymentSummary error: ' . $e->getMessage());
            return response()->json([
                'total_disbursed' => 0,
                'total_repaid' => 0,
                'outstanding' => 0,
                'repayment_rate' => 0,
                'active_loans' => 0,
                'completed_loans' => 0,
                'overdue_loans' => 0,
                'monthly_trend' => [],
                'portfolio_health' => ['current' => 0, 'at_risk' => 0, 'critical' => 0],
            ]);
        }
    }

    /**
     * Build the last 6 months of disbursed vs repaid totals from real records.
     */
    private function buildMonthlyTrend(): array
    {
        $months = [];
        for ($i = 5; $i >= 0; $i--) {
            $month = now()->copy()->subMonths($i);
            $start = $month->copy()->startOfMonth();
            $end = $month->copy()->endOfMonth();

            $disbursed = round(Loan::where('status', 'approved')
                ->whereBetween('disbursed_at', [$start, $end])
                ->sum('amount'));

            $repaid = round(\App\Models\Repayment::where('status', 'completed')
                ->whereBetween('payment_date', [$start, $end])
                ->sum('amount'));

            $months[] = [
                'name' => $month->format('M'),
                'disbursed' => (float) $disbursed,
                'repaid' => (float) $repaid,
                'outstanding' => (float) max($disbursed - $repaid, 0),
            ];
        }
        return $months;
    }

    /**
     * Classify active loans into Current / At Risk / Critical buckets (as %).
     */
    private function buildPortfolioHealth(): array
    {
        $loans = Loan::where('status', 'approved')
            ->whereIn('payment_status', ['pending', 'partial', 'overdue'])
            ->get(['payment_status', 'next_payment_date']);

        $total = $loans->count();
        if ($total === 0) {
            return ['current' => 0, 'at_risk' => 0, 'critical' => 0];
        }

        $critical = 0;
        $atRisk = 0;
        $current = 0;
        foreach ($loans as $loan) {
            $due = $loan->next_payment_date ? \Carbon\Carbon::parse($loan->next_payment_date) : null;
            if ($loan->payment_status === 'overdue' || ($due && $due->isPast() && $due->diffInDays(now()) > 30)) {
                $critical++;
            } elseif ($due && $due->isPast()) {
                $atRisk++;
            } else {
                $current++;
            }
        }

        return [
            'current' => round(($current / $total) * 100),
            'at_risk' => round(($atRisk / $total) * 100),
            'critical' => round(($critical / $total) * 100),
        ];
    }


    public function uploadPassport(Request $request)
    {
        $request->validate([
            'photo' => 'required|image|mimes:jpg,jpeg,png|max:2048',
            'applicant_name' => 'nullable|string'
        ]);

        $file = $request->file('photo');
        $filename = time() . '_' . preg_replace('/[^a-zA-Z0-9]/', '_', $request->applicant_name ?? 'applicant') . '.' . $file->getClientOriginalExtension();
        $path = $file->storeAs('passports', $filename, 'public');

        return response()->json([
            'photo_url' => Storage::url($path)
        ]);
    }
}