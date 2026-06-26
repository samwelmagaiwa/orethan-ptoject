<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ChartOfAccount;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class ChartOfAccountController extends Controller
{
    use ApiResponse;

    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user->canAccessAccounting()) {
            return $this->error('You do not have access to the Chart of Accounts', 403);
        }

        $query = ChartOfAccount::query()->orderBy('code');
        if ($request->boolean('active_only')) {
            $query->where('is_active', true);
        }
        if ($type = $request->query('type')) {
            $query->where('type', $type);
        }

        return $this->success($query->get(), 'Chart of Accounts loaded');
    }

    public function store(Request $request)
    {
        $user = $request->user();
        if (!$user->canAccessAccounting()) {
            return $this->error('You do not have access to the Chart of Accounts', 403);
        }

        $data = $request->validate([
            'code' => 'required|string|max:20|unique:chart_of_accounts,code',
            'name' => 'required|string|max:255',
            'type' => 'required|in:asset,liability,equity,income,expense',
            'normal_balance' => 'required|in:debit,credit',
            'parent_id' => 'nullable|exists:chart_of_accounts,id',
            'is_cash_account' => 'boolean',
            'description' => 'nullable|string',
        ]);

        try {
            $account = ChartOfAccount::create($data);
            return $this->success($account, 'Account created successfully', 201);
        } catch (\Exception $e) {
            Log::error('ChartOfAccount store error: ' . $e->getMessage());
            return $this->error('Failed to create account', 500);
        }
    }

    public function update(Request $request, $id)
    {
        $user = $request->user();
        if (!$user->canAccessAccounting()) {
            return $this->error('You do not have access to the Chart of Accounts', 403);
        }

        $account = ChartOfAccount::findOrFail($id);

        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'parent_id' => 'nullable|exists:chart_of_accounts,id',
            'is_cash_account' => 'boolean',
            'is_active' => 'boolean',
            'description' => 'nullable|string',
        ]);

        if ($account->is_system && $request->has('is_active') && !$request->boolean('is_active')) {
            return $this->error('This is a system account required for automatic postings and cannot be deactivated', 422);
        }

        try {
            $account->update($data);
            return $this->success($account, 'Account updated successfully');
        } catch (\Exception $e) {
            Log::error('ChartOfAccount update error: ' . $e->getMessage());
            return $this->error('Failed to update account', 500);
        }
    }

    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        if (!$user->canAccessAccounting()) {
            return $this->error('You do not have access to the Chart of Accounts', 403);
        }

        $account = ChartOfAccount::findOrFail($id);

        if ($account->is_system) {
            return $this->error('This is a system account required for automatic postings and cannot be deleted', 422);
        }
        if ($account->journalEntryLines()->exists()) {
            return $this->error('This account has posted journal entries and cannot be deleted', 422);
        }

        $account->delete();
        return $this->success(null, 'Account deleted successfully');
    }
}
