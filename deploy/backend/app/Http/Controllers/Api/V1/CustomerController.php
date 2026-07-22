<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Customer;
use App\Models\Loan;
use App\Models\SmsLog;
use App\Services\ActivityLogger;

class CustomerController extends Controller
{
    // GET ALL CUSTOMERS WITH SUMMARY
    public function index()
    {
        $customers = Customer::with([
            'loans' => function ($q) {
                $q->with(['approvals.user', 'user', 'disbursement'])->orderBy('created_at', 'desc');
            }
        ])->get();

        $totalLoaned = 0;
        $totalArrears = 0;
        $activeCustomersCount = 0;

        // Attach latest SMS status to every loan in one query
        $allLoanIds = $customers->flatMap(fn($c) => $c->loans->pluck('id'));
        $latestSmsByLoan = SmsLog::whereIn('loan_id', $allLoanIds)
            ->orderByDesc('created_at')
            ->get()
            ->groupBy('loan_id')
            ->map(fn($logs) => $logs->first());

        $customers->each(function ($customer) use (&$totalLoaned, &$totalArrears, &$activeCustomersCount, $latestSmsByLoan) {
            // Stamp sms_status on each loan
            $customer->loans->each(function ($loan) use ($latestSmsByLoan) {
                $sms = $latestSmsByLoan->get($loan->id);
                $loan->sms_status = $sms?->status;
                $loan->sms_type   = $sms?->type;
            });

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

        $latestSmsByLoan = SmsLog::whereIn('loan_id', $customer->loans->pluck('id'))
            ->orderByDesc('created_at')
            ->get()
            ->groupBy('loan_id')
            ->map(fn($logs) => $logs->first());

        $customer->loans->each(function ($loan) use ($latestSmsByLoan) {
            $loan->arrears    = $loan->getArrearsAmount();
            $loan->penalty    = $loan->calculatePenalty();
            $sms = $latestSmsByLoan->get($loan->id);
            $loan->sms_status = $sms?->status;
            $loan->sms_type   = $sms?->type;
        });

        return response()->json($customer);
    }

    // DELETE CUSTOMER (admin only — cascades to loans and related records via DB constraints)
    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        if (!$user || $user->role !== 'admin') {
            return response()->json(['message' => 'Admin pekee anaweza kufuta mteja.'], 403);
        }

        $customer = Customer::findOrFail($id);
        $name = $customer->full_name ?? $customer->name ?? "ID #{$id}";
        ActivityLogger::log($user, 'delete', 'Customer', "Deleted customer {$name}", $id, $name);
        $customer->delete();

        return response()->json(['message' => 'Mteja amefutwa.']);
    }
}
