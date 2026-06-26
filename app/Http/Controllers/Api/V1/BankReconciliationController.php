<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\BankReconciliation;
use App\Models\ChartOfAccount;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class BankReconciliationController extends Controller
{
    use ApiResponse;

    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user->canAccessAccounting()) {
            return $this->error('You do not have access to Bank Reconciliation', 403);
        }

        $reconciliations = BankReconciliation::with(['account', 'items', 'reconciler'])
            ->orderByDesc('statement_date')
            ->get();

        return $this->success($reconciliations, 'Bank Reconciliations loaded');
    }

    public function show(Request $request, $id)
    {
        $user = $request->user();
        if (!$user->canAccessAccounting()) {
            return $this->error('You do not have access to Bank Reconciliation', 403);
        }

        $reconciliation = BankReconciliation::with(['account', 'items', 'reconciler'])->findOrFail($id);
        return $this->success($reconciliation, 'Bank Reconciliation loaded');
    }

    public function store(Request $request)
    {
        $user = $request->user();
        if (!$user->canAccessAccounting()) {
            return $this->error('You do not have access to Bank Reconciliation', 403);
        }

        $data = $request->validate([
            'chart_of_account_id' => 'required|exists:chart_of_accounts,id',
            'statement_date' => 'required|date',
            'statement_balance' => 'required|numeric',
            'notes' => 'nullable|string',
            'items' => 'nullable|array',
            'items.*.type' => 'required_with:items|in:deposit_in_transit,outstanding_payment',
            'items.*.description' => 'required_with:items|string|max:255',
            'items.*.amount' => 'required_with:items|numeric|min:0.01',
            'items.*.date' => 'required_with:items|date',
        ]);

        try {
            $reconciliation = DB::transaction(function () use ($data, $user) {
                $account = ChartOfAccount::findOrFail($data['chart_of_account_id']);
                if (!$account->is_cash_account) {
                    throw new \Exception('Bank Reconciliation can only be run against a Cash/Bank account');
                }

                $bookBalance = $account->balance($data['statement_date']);

                $items = $data['items'] ?? [];
                $depositsInTransit = array_sum(array_map(fn($i) => (float) $i['amount'], array_filter($items, fn($i) => $i['type'] === 'deposit_in_transit')));
                $outstandingPayments = array_sum(array_map(fn($i) => (float) $i['amount'], array_filter($items, fn($i) => $i['type'] === 'outstanding_payment')));

                $adjustedBalance = round($bookBalance + $depositsInTransit - $outstandingPayments, 2);
                $difference = round((float) $data['statement_balance'] - $adjustedBalance, 2);
                $isReconciled = abs($difference) < 0.01;

                $reconciliation = BankReconciliation::create([
                    'chart_of_account_id' => $account->id,
                    'statement_date' => $data['statement_date'],
                    'statement_balance' => $data['statement_balance'],
                    'book_balance' => $bookBalance,
                    'adjusted_balance' => $adjustedBalance,
                    'difference' => $difference,
                    'status' => $isReconciled ? 'reconciled' : 'draft',
                    'notes' => $data['notes'] ?? null,
                    'reconciled_by' => $isReconciled ? $user->id : null,
                    'reconciled_at' => $isReconciled ? now() : null,
                ]);

                foreach ($items as $item) {
                    $reconciliation->items()->create($item);
                }

                return $reconciliation->load('items', 'account');
            });

            return $this->success($reconciliation, 'Bank Reconciliation saved', 201);
        } catch (\Exception $e) {
            Log::error('BankReconciliation store error: ' . $e->getMessage());
            return $this->error($e->getMessage(), 422);
        }
    }
}
