<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PaymentRequest;
use App\Models\AuditLog;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class PaymentRequestController extends Controller
{
    use ApiResponse;

    /**
     * Hatua inayofuata baada ya idhini kwenye hatua ya sasa.
     */
    private function nextStatus(string $current): string
    {
        return match ($current) {
            'manager_review' => 'gm_review',
            'gm_review' => 'md_review',
            'md_review' => 'authorized',
            default => $current,
        };
    }

    /**
     * Je, mtumiaji anaweza kuamua katika hatua ya sasa?
     */
    private function canDecide($user, string $status): bool
    {
        if ($user->isAdmin()) return true;
        return match ($status) {
            'manager_review' => $user->isLoanManager(),
            'gm_review' => $user->isGeneralManager(),
            'md_review' => $user->isManagingDirector(),
            default => false,
        };
    }

    /**
     * Wasilisha ombi jipya la malipo.
     */
    public function store(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'applicant_name' => 'required|string|max:255',
            'department' => 'nullable|string|max:255',
            'section' => 'nullable|string|max:255',
            'activity_type' => 'required|string|max:255',
            'activity_detail' => 'nullable|string',
            'loan_applicant_name' => 'nullable|string|max:255',
            'invoice_path' => 'nullable|string',
            'mode_of_payment' => 'required|string|in:cash,cheque,bank_transfer',
            'payable_to' => 'required|string|max:255',
            'currency' => 'required|string|in:TZS,USD',
            'amount' => 'required|numeric|min:1',
            'amount_in_words' => 'nullable|string',
            'applicant_signature' => 'nullable|string|max:255',
            'applicant_date' => 'nullable|date',
        ]);

        try {
            $data['status'] = 'manager_review';
            $data['final_amount'] = $data['amount'];
            $data['created_by'] = $user->id ?? null;
            if (empty($data['applicant_signature'])) {
                $data['applicant_signature'] = $user->name ?? null;
            }

            $pr = PaymentRequest::create($data);

            AuditLog::record('payment_request.created', $user, $pr,
                'Ombi la malipo limewasilishwa: ' . $pr->payable_to, ['amount' => $pr->amount]);

            return $this->success($pr, 'Ombi la malipo limewasilishwa');
        } catch (\Exception $e) {
            Log::error('payment request store error: ' . $e->getMessage());
            return $this->error('Imeshindikana kuwasilisha ombi', 500);
        }
    }

    /**
     * Orodha kwa hatua/jukumu la mtumiaji (queue ya idhini) au yangu mwenyewe.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $scope = $request->query('scope', 'queue'); // queue | mine | all

        $query = PaymentRequest::query()->orderByDesc('created_at');

        if ($scope === 'mine') {
            $query->where('created_by', $user->id);
        } elseif ($scope === 'queue' && !$user->isAdmin()) {
            // Onyesha tu zilizo kwenye hatua ya jukumu husika
            if ($user->isLoanManager()) $query->where('status', 'manager_review');
            elseif ($user->isGeneralManager()) $query->where('status', 'gm_review');
            elseif ($user->isManagingDirector()) $query->where('status', 'md_review');
            else $query->where('created_by', $user->id);
        }

        return response()->json(['requests' => $query->get()]);
    }

    public function show($id)
    {
        return response()->json(PaymentRequest::findOrFail($id));
    }

    /**
     * Idhinisha / Rekebisha kiasi katika hatua ya sasa (Manager, GM, au MD).
     */
    public function approve(Request $request, $id)
    {
        $user = $request->user();
        $pr = PaymentRequest::findOrFail($id);

        if (!$this->canDecide($user, $pr->status)) {
            return $this->error('Huna ruhusa ya kuidhinisha hatua hii', 403);
        }

        $data = $request->validate([
            'adjusted_amount' => 'nullable|numeric|min:1',
            'comments' => 'nullable|string',
        ]);

        try {
            $stage = $pr->status;
            $decision = !empty($data['adjusted_amount']) && (float) $data['adjusted_amount'] != (float) $pr->final_amount
                ? 'adjusted' : 'approved';
            $amount = $data['adjusted_amount'] ?? $pr->final_amount;

            if ($stage === 'manager_review') {
                $pr->manager_name = $user->name;
                $pr->manager_decision = $decision;
                $pr->manager_adjusted_amount = $data['adjusted_amount'] ?? null;
                $pr->manager_comments = $data['comments'] ?? null;
                $pr->manager_date = now();
            } elseif ($stage === 'gm_review') {
                $pr->gm_name = $user->name;
                $pr->gm_decision = $decision;
                $pr->gm_adjusted_amount = $data['adjusted_amount'] ?? null;
                $pr->gm_comments = $data['comments'] ?? null;
                $pr->gm_date = now();
            } elseif ($stage === 'md_review') {
                $pr->md_name = $user->name;
                $pr->md_comments = $data['comments'] ?? null;
                $pr->md_date = now();
            }

            $pr->final_amount = $amount;
            $pr->status = $this->nextStatus($stage);
            $pr->save();

            AuditLog::record('payment_request.approved', $user, $pr,
                'Ombi la malipo limeidhinishwa (' . $stage . ')', ['decision' => $decision, 'amount' => $amount]);

            return $this->success($pr, $pr->status === 'authorized' ? 'Malipo yameidhinishwa kikamilifu' : 'Imeidhinishwa, imepelekwa hatua inayofuata');
        } catch (\Exception $e) {
            Log::error('payment request approve error: ' . $e->getMessage());
            return $this->error('Imeshindikana kuidhinisha', 500);
        }
    }

    /**
     * Kataa ombi katika hatua ya sasa.
     */
    public function reject(Request $request, $id)
    {
        $user = $request->user();
        $pr = PaymentRequest::findOrFail($id);

        if (!$this->canDecide($user, $pr->status)) {
            return $this->error('Huna ruhusa ya kukataa hatua hii', 403);
        }

        $data = $request->validate(['reason' => 'required|string|min:3']);

        try {
            $stage = $pr->status;
            if ($stage === 'manager_review') { $pr->manager_name = $user->name; $pr->manager_decision = 'not_approved'; $pr->manager_comments = $data['reason']; $pr->manager_date = now(); }
            elseif ($stage === 'gm_review') { $pr->gm_name = $user->name; $pr->gm_decision = 'not_approved'; $pr->gm_comments = $data['reason']; $pr->gm_date = now(); }
            elseif ($stage === 'md_review') { $pr->md_name = $user->name; $pr->md_comments = $data['reason']; $pr->md_date = now(); }

            $pr->status = 'rejected';
            $pr->rejection_reason = $data['reason'];
            $pr->save();

            AuditLog::record('payment_request.rejected', $user, $pr, 'Ombi la malipo limekataliwa', ['reason' => $data['reason']]);

            return $this->success($pr, 'Ombi limekataliwa');
        } catch (\Exception $e) {
            Log::error('payment request reject error: ' . $e->getMessage());
            return $this->error('Imeshindikana kukataa ombi', 500);
        }
    }

    /**
     * Pakia ankara (invoice) ya ombi.
     */
    public function uploadInvoice(Request $request)
    {
        $request->validate(['file' => 'required|file|mimes:jpg,jpeg,png,pdf|max:4096']);
        $file = $request->file('file');
        $path = $file->storeAs('payment_invoices', time() . '_' . $file->getClientOriginalName(), 'public');
        return response()->json(['path' => Storage::url($path)]);
    }
}
