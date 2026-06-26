<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\JournalEntry;
use App\Services\AccountingService;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class JournalEntryController extends Controller
{
    use ApiResponse;

    public function __construct(protected AccountingService $accounting)
    {
    }

    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user->canAccessAccounting()) {
            return $this->error('You do not have access to Journal Entries', 403);
        }

        $query = JournalEntry::with(['lines.account', 'creator'])->orderByDesc('entry_date')->orderByDesc('id');

        if ($from = $request->query('from')) {
            $query->whereDate('entry_date', '>=', $from);
        }
        if ($to = $request->query('to')) {
            $query->whereDate('entry_date', '<=', $to);
        }
        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }
        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('entry_number', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        return $this->success($query->paginate(25), 'Journal Entries loaded');
    }

    public function show(Request $request, $id)
    {
        $user = $request->user();
        if (!$user->canAccessAccounting()) {
            return $this->error('You do not have access to Journal Entries', 403);
        }

        $entry = JournalEntry::with(['lines.account', 'creator', 'reverser', 'reversalOf'])->findOrFail($id);
        return $this->success($entry, 'Journal Entry loaded');
    }

    /**
     * Create a manual journal entry (e.g. accruals, expense recognition, opening
     * balances). Entries auto-posted from disbursements/repayments do not go
     * through this endpoint.
     */
    public function store(Request $request)
    {
        $user = $request->user();
        if (!$user->canAccessAccounting()) {
            return $this->error('You do not have access to Journal Entries', 403);
        }

        $data = $request->validate([
            'entry_date' => 'required|date',
            'description' => 'required|string|max:255',
            'lines' => 'required|array|min:2',
            'lines.*.chart_of_account_id' => 'required|exists:chart_of_accounts,id',
            'lines.*.debit' => 'required|numeric|min:0',
            'lines.*.credit' => 'required|numeric|min:0',
            'lines.*.description' => 'nullable|string|max:255',
        ]);

        try {
            $entry = $this->accounting->postJournalEntry(array_merge($data, ['reference_type' => 'manual']), $user);
            return $this->success($entry, 'Journal Entry posted successfully', 201);
        } catch (\Exception $e) {
            Log::error('JournalEntry store error: ' . $e->getMessage());
            return $this->error($e->getMessage(), 422);
        }
    }

    public function reverse(Request $request, $id)
    {
        $user = $request->user();
        if (!$user->canAccessAccounting()) {
            return $this->error('You do not have access to Journal Entries', 403);
        }

        $data = $request->validate([
            'reason' => 'nullable|string|max:255',
        ]);

        try {
            $entry = JournalEntry::findOrFail($id);
            $reversal = $this->accounting->reverseJournalEntry($entry, $user, $data['reason'] ?? null);
            return $this->success($reversal, 'Journal Entry reversed successfully');
        } catch (\Exception $e) {
            Log::error('JournalEntry reverse error: ' . $e->getMessage());
            return $this->error($e->getMessage(), 422);
        }
    }
}
