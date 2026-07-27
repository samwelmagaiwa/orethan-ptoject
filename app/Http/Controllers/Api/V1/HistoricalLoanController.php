<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Loan;
use App\Models\LoanSetting;
use App\Services\HistoricalLoanService;
use Illuminate\Http\Request;

class HistoricalLoanController extends Controller
{
    public function __construct(protected HistoricalLoanService $service) {}

    /**
     * POST /v1/loans/historical
     * Import a pre-system loan. Role must be in historical_loan_roles setting.
     */
    public function store(Request $request)
    {
        $user = $request->user();

        $allowedRoles = LoanSetting::current()->historical_loan_roles
            ?? ['loan_officer', 'loan_manager', 'admin'];

        if (!in_array($user->role, (array) $allowedRoles)) {
            return response()->json(['message' => 'Hauna ruhusa ya kuingiza mkopo wa kihistoria.'], 403);
        }

        $validated = $request->validate([
            'customer_id'          => 'nullable|integer|exists:customers,id',
            'customer_name'        => 'nullable|string|max:255',
            'customer_phone'       => 'required|string|max:20',
            'amount'               => 'required|numeric|min:1',
            'interest_rate'        => 'required|numeric|min:0|max:100',
            'term_months'          => 'required|integer|min:1|max:360',
            'repayment_frequency'  => 'required|in:Monthly,Weekly,Bi-Weekly,Daily,Quarterly',
            'disbursed_at'         => 'required|date|before_or_equal:today',
            'employment'           => 'nullable|in:Ndio,Hapana',
            'guarantor_1_name'     => 'nullable|string|max:255',
            'guarantor_1_phone'    => 'nullable|string|max:20',
            'guarantor_2_name'     => 'nullable|string|max:255',
            'guarantor_2_phone'    => 'nullable|string|max:20',
            'payments'             => 'nullable|array',
            'payments.*.date'      => 'required|date',
            'payments.*.amount'    => 'required|numeric|min:1',
            'payments.*.penalty'   => 'nullable|numeric|min:0',
        ]);

        // Resolve customer_name from existing record if not supplied
        if (empty($validated['customer_name'])) {
            $customer = !empty($validated['customer_id'])
                ? Customer::find($validated['customer_id'])
                : Customer::where('phone_number', $validated['customer_phone'])->first();
            $validated['customer_name'] = $customer?->full_name ?? $validated['customer_phone'];
        }

        $validated['payments'] = $validated['payments'] ?? [];

        // Guard: total normal payments (excluding penalty) must not exceed the principal
        $totalPayments = collect($validated['payments'])->sum('amount');
        if ($totalPayments > (float) $validated['amount']) {
            return response()->json([
                'message' => 'Jumla ya malipo (' . number_format($totalPayments)
                    . ') inazidi kiasi cha mkopo (' . number_format($validated['amount']) . ').',
            ], 422);
        }

        try {
            $loan = $this->service->import($validated, $user);
            return response()->json([
                'message' => 'Mkopo wa kihistoria umerekodiwa kikamilifu.',
                'loan'    => $loan,
            ], 201);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Historical loan import failed: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json(['message' => 'Imeshindwa: ' . $e->getMessage()], 500);
        }
    }

    /**
     * GET /v1/loans/historical
     * List all historical loans (for admin/LM review).
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $allowedRoles = LoanSetting::current()->historical_loan_roles
            ?? ['loan_officer', 'loan_manager', 'admin'];

        if (!in_array($user->role, (array) $allowedRoles)) {
            return response()->json(['message' => 'Hauna ruhusa.'], 403);
        }

        $loans = Loan::with(['customer', 'user', 'disbursement'])
            ->where('is_historical', true)
            ->orderBy('disbursed_at', 'desc')
            ->get();

        return response()->json($loans);
    }

    /**
     * GET /v1/loans/historical/allowed-roles
     * Returns which roles may access the historical loan import feature.
     * Used by the frontend to gate the sidebar entry.
     */
    public function allowedRoles()
    {
        $roles = LoanSetting::current()->historical_loan_roles
            ?? ['loan_officer', 'loan_manager', 'admin'];
        return response()->json(['roles' => $roles]);
    }
}
