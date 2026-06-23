<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Customer;
use App\Models\Loan;

class CustomerController extends Controller
{
    // GET ALL CUSTOMERS WITH SUMMARY
    public function index()
    {
        $customers = Customer::with([
            'loans' => function ($q) {
                $q->with(['approvals.user', 'user'])->orderBy('created_at', 'desc');
            }
        ])->get();

        $totalLoaned = 0;
        $totalArrears = 0;
        $activeCustomersCount = 0;

        $customers->each(function ($customer) use (&$totalLoaned, &$totalArrears, &$activeCustomersCount) {
            $activeLoans = $customer->loans->where('status', 'disbursed');
            $customer->active_loans_count = $activeLoans->count();

            $customerDebt = $activeLoans->sum('remaining_balance');
            $customer->total_remaining_balance = $customerDebt;
            $totalLoaned += $customerDebt;

            $customerArrears = $activeLoans->map(function ($loan) {
                return $loan->getArrearsAmount();
            })->sum();
            $customer->total_arrears = $customerArrears;
            $totalArrears += $customerArrears;

            if ($customer->active_loans_count > 0) {
                $activeCustomersCount++;
            }
        });

        return response()->json([
            'customers' => $customers,
            'stats' => [
                'total_loaned' => $totalLoaned,
                'total_arrears' => $totalArrears,
                'active_customers' => $activeCustomersCount,
            ]
        ]);
    }

    // GET SINGLE CUSTOMER WITH FULL HISTORY
    public function show($id)
    {
        $customer = Customer::with(['loans.repayments', 'loans.approvals.user', 'loans.user', 'loans.disbursement', 'loans.schedules'])->findOrFail($id);

        $customer->loans->each(function ($loan) {
            $loan->arrears = $loan->getArrearsAmount();
            $loan->penalty = $loan->calculatePenalty();
        });

        return response()->json($customer);
    }
}
