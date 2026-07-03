<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Loan;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;

class CustomerStatementController extends Controller
{
    use ApiResponse;

    /**
     * GET /customers/{id}/statement?from=YYYY-MM-DD&to=YYYY-MM-DD
     * Returns all loan transactions for the customer in the given period.
     */
    public function generate(Request $request, int $customerId)
    {
        $customer = Customer::findOrFail($customerId);

        $from = $request->filled('from') ? $request->from : null;
        $to   = $request->filled('to')   ? $request->to   : now()->toDateString();

        // All loans linked by customer_id OR phone number
        $loans = Loan::where(function ($q) use ($customer) {
                $q->where('customer_id', $customer->id)
                  ->orWhere('phone', $customer->phone_number);
            })
            ->with(['repayments' => function ($q) use ($from, $to) {
                if ($from) $q->where('payment_date', '>=', $from);
                $q->where('payment_date', '<=', $to)->orderBy('payment_date');
            }])
            ->get();

        $transactions = [];

        foreach ($loans as $loan) {
            // Disbursement event
            if ($loan->disbursed_at && (!$from || $loan->disbursed_at >= $from) && $loan->disbursed_at <= $to) {
                $transactions[] = [
                    'date'        => $loan->disbursed_at,
                    'type'        => 'disbursement',
                    'description' => "Mkopo uliotolewa — {$loan->loan_account_number}",
                    'debit'       => 0,
                    'credit'      => (float) $loan->amount,
                    'loan_ref'    => $loan->loan_account_number,
                    'loan_status' => $loan->status,
                ];
            }

            // Repayments
            foreach ($loan->repayments as $r) {
                $transactions[] = [
                    'date'        => $r->payment_date,
                    'type'        => 'repayment',
                    'description' => "Malipo ya mkopo — {$loan->loan_account_number}",
                    'debit'       => (float) $r->amount,
                    'credit'      => 0,
                    'loan_ref'    => $loan->loan_account_number,
                    'receipt_no'  => $r->receipt_number ?? null,
                    'loan_status' => $loan->status,
                ];
                if ((float)($r->penalty_amount ?? 0) > 0) {
                    $transactions[] = [
                        'date'        => $r->payment_date,
                        'type'        => 'penalty',
                        'description' => "Faini ya mkopo — {$loan->loan_account_number}",
                        'debit'       => (float) $r->penalty_amount,
                        'credit'      => 0,
                        'loan_ref'    => $loan->loan_account_number,
                        'loan_status' => $loan->status,
                    ];
                }
            }
        }

        // Sort by date
        usort($transactions, fn($a, $b) => strcmp($a['date'], $b['date']));

        $totalDisbursed = collect($transactions)->where('type', 'disbursement')->sum('credit');
        $totalRepaid    = collect($transactions)->where('type', 'repayment')->sum('debit');
        $totalPenalties = collect($transactions)->where('type', 'penalty')->sum('debit');
        $balance        = $totalDisbursed - $totalRepaid;

        return $this->success([
            'customer'         => $customer,
            'period_from'      => $from,
            'period_to'        => $to,
            'transactions'     => $transactions,
            'summary' => [
                'total_loans'      => $loans->count(),
                'active_loans'     => $loans->whereIn('status', ['disbursed', 'active'])->count(),
                'total_disbursed'  => $totalDisbursed,
                'total_repaid'     => $totalRepaid,
                'total_penalties'  => $totalPenalties,
                'outstanding'      => max(0, $balance),
            ],
        ]);
    }
}
