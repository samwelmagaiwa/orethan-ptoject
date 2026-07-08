<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PaymentRequest;
use App\Models\AuditLog;
use App\Services\AccountingService;
use App\Services\Notifier;
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
            // Baada ya MD kuidhinisha, ombi huenda kwa Keshia/Finance kwa malipo
            'md_review' => 'awaiting_disbursement',
            // Keshia akilipa, ombi linakamilika
            'awaiting_disbursement' => 'disbursed',
            default => $current,
        };
    }

    /**
     * Je, mtumiaji anaweza kuamua katika hatua ya sasa?
     */
    private function canDecide($user, string $status): bool
    {
        if ($user->isAdmin())
            return true;
        return match ($status) {
            'manager_review' => $user->isLoanManager(),
            'gm_review' => $user->isGeneralManager(),
            'md_review' => $user->isManagingDirector(),
            // Hatua ya malipo ni ya Finance Officer / Cashier pekee
            'awaiting_disbursement' => $user->isFinanceOfficer(),
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
            'applicant_signature_img' => 'nullable|string',
            'applicant_date' => 'nullable|date',
        ]);

        // Zuia maombi mengi: mtumiaji mmoja anaweza kuwa na ombi moja linalosubiri tu
        $hasPending = PaymentRequest::where('created_by', $user->id)
            ->whereNotIn('status', ['disbursed', 'rejected'])->exists();
        if ($hasPending) {
            return $this->error('Tayari una ombi la malipo linalosubiri. Subiri lishughulikiwe kabla ya kuwasilisha jipya.', 422);
        }

        try {
            // MD and Admin are the highest authority — their own payment requests
            // need no further review, so they go straight to the cashier/finance
            // stage for disbursement.
            $isHighAuthority = $user->isManagingDirector() || $user->isAdmin();
            $data['status'] = $isHighAuthority ? 'awaiting_disbursement' : 'manager_review';
            $data['final_amount'] = $data['amount'];
            $data['applicant_role'] = $user->role;
            $data['created_by'] = $user->id ?? null;
            if (empty($data['applicant_signature'])) {
                $data['applicant_signature'] = $user->name ?? null;
            }
            // Fall back to the applicant's saved profile signature
            if (empty($data['applicant_signature_img'])) {
                $data['applicant_signature_img'] = $user->signature ?? null;
            }

            // Pre-fill the MD's own authorisation fields so the audit trail is complete
            if ($isHighAuthority) {
                $data['md_name'] = $user->name;
                $data['md_comments'] = 'Auto-authorised — submitted by ' . ucwords(str_replace('_', ' ', $user->role));
                $data['md_date'] = now();
                $data['md_signature_img'] = $data['applicant_signature_img'] ?? $user->signature ?? null;
            }

            $pr = PaymentRequest::create($data);

            AuditLog::record(
                'payment_request.created',
                $user,
                $pr,
                'Ombi la malipo limewasilishwa: ' . $pr->payable_to,
                ['amount' => $pr->amount]
            );

            // Notify the appropriate next stage
            if ($isHighAuthority) {
                Notifier::toRoles(
                    'finance_officer',
                    'payment_request',
                    'New payment request awaiting disbursement',
                    $user->name . ' submitted a payment request payable to ' . $pr->payable_to . ' — ready for disbursement.',
                    '/payment-requests',
                    ['id' => $pr->id]
                );
            } else {
                Notifier::toRoles(
                    'loan_manager',
                    'payment_request',
                    'New payment request',
                    $user->name . ' submitted a payment request payable to ' . $pr->payable_to . '.',
                    '/payment-requests',
                    ['id' => $pr->id]
                );
            }

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
            if ($user->isLoanManager())
                $query->where('status', 'manager_review');
            elseif ($user->isGeneralManager())
                $query->where('status', 'gm_review');
            elseif ($user->isManagingDirector())
                $query->where('status', 'md_review');
            elseif ($user->isFinanceOfficer())
                $query->where('status', 'awaiting_disbursement');
            else
                $query->where('created_by', $user->id);
        }

        return response()->json(['requests' => $query->get()]);
    }

    public function show($id)
    {
        return response()->json(PaymentRequest::findOrFail($id));
    }

    /** Admin anaweza kufuta ombi lolote la malipo. */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        if (!$user->isAdmin()) {
            return $this->error('Admin pekee ndiye anaweza kufuta ombi', 403);
        }
        $pr = PaymentRequest::findOrFail($id);
        AuditLog::record('payment_request.deleted', $user, $pr, 'Ombi la malipo limefutwa na admin');
        $pr->delete();
        return $this->success(null, 'Ombi limefutwa');
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
            'cashier_reference' => 'nullable|string|max:255',
            'password' => 'required|string',
        ]);

        // PIN / password re-authentication for every signing stage
        if (!\Illuminate\Support\Facades\Hash::check($data['password'], $user->password)) {
            return $this->error('Nenosiri si sahihi (PIN verification failed)', 422);
        }

        $sig = $user->signature; // snapshot the signer's saved signature

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
                $pr->manager_signature_img = $sig;
            } elseif ($stage === 'gm_review') {
                $pr->gm_name = $user->name;
                $pr->gm_decision = $decision;
                $pr->gm_adjusted_amount = $data['adjusted_amount'] ?? null;
                $pr->gm_comments = $data['comments'] ?? null;
                $pr->gm_date = now();
                $pr->gm_signature_img = $sig;
            } elseif ($stage === 'md_review') {
                $pr->md_name = $user->name;
                $pr->md_comments = $data['comments'] ?? null;
                $pr->md_date = now();
                $pr->md_signature_img = $sig;
            } elseif ($stage === 'awaiting_disbursement') {
                // Keshia/Finance anatoa malipo kwa mwombaji
                $pr->cashier_name = $user->name;
                $pr->cashier_comments = $data['comments'] ?? null;
                $pr->cashier_reference = $data['cashier_reference'] ?? null;
                $pr->cashier_date = now();
                $pr->cashier_signature_img = $sig;
            }

            if ($stage !== 'awaiting_disbursement') {
                $pr->final_amount = $amount;
            }
            $pr->status = $this->nextStatus($stage);
            $pr->save();

            // ── Post to GL when cashier disburses ────────────────────────────
            if ($stage === 'awaiting_disbursement') {
                try {
                    $je = app(AccountingService::class)->postPaymentRequestToGL($pr, $user);
                    $pr->gl_journal_entry_id = $je->id;
                    $pr->save();
                } catch (\Throwable $e) {
                    Log::error('Payment request GL post failed: ' . $e->getMessage());
                }
            }

            $action = $stage === 'awaiting_disbursement' ? 'payment_request.disbursed' : 'payment_request.approved';
            $desc = $stage === 'awaiting_disbursement'
                ? 'Malipo yametolewa kwa mwombaji na keshia'
                : 'Ombi la malipo limeidhinishwa (' . $stage . ')';
            AuditLog::record($action, $user, $pr, $desc, ['decision' => $decision, 'amount' => $pr->final_amount]);

            // Arifa hatua inayofuata / mwombaji
            if ($pr->status === 'disbursed') {
                Notifier::toUsers(
                    [$pr->created_by],
                    'payment_request',
                    'Payment disbursed',
                    'Your payment request payable to ' . $pr->payable_to . ' has been disbursed.',
                    '/payment-requests',
                    ['id' => $pr->id]
                );
            } elseif ($nextRole = Notifier::roleForStatus($pr->status)) {
                Notifier::toRoles(
                    $nextRole,
                    'payment_request',
                    'Payment request awaiting your action',
                    'A payment request payable to ' . $pr->payable_to . ' needs your review.',
                    '/payment-requests',
                    ['id' => $pr->id]
                );
            }

            $msg = match ($pr->status) {
                'awaiting_disbursement' => 'Imeidhinishwa na MD, inasubiri malipo ya keshia',
                'disbursed' => 'Malipo yametolewa kwa mwombaji kikamilifu',
                default => 'Imeidhinishwa, imepelekwa hatua inayofuata',
            };
            return $this->success($pr, $msg);
        } catch (\Exception $e) {
            Log::error('payment request approve error: ' . $e->getMessage());
            return $this->error('Imeshindikana kuidhinisha', 500);
        }
    }

    /**
     * Mwombaji anahariri ombi lililokataliwa kisha kuliwasilisha tena.
     */
    public function update(Request $request, $id)
    {
        $user = $request->user();
        $pr = PaymentRequest::findOrFail($id);

        if ($pr->created_by !== ($user->id ?? null) && !$user->isAdmin()) {
            return $this->error('Unaweza kuhariri maombi yako mwenyewe pekee', 403);
        }
        if ($pr->status !== 'rejected') {
            return $this->error('Maombi yaliyokataliwa pekee ndiyo yanaweza kuhaririwa', 422);
        }
        // Usiruhusu kuwasilisha tena ikiwa kuna ombi jingine linalosubiri
        $hasOtherPending = PaymentRequest::where('created_by', $user->id)
            ->where('id', '!=', $pr->id)
            ->whereNotIn('status', ['disbursed', 'rejected'])->exists();
        if ($hasOtherPending) {
            return $this->error('Una ombi jingine linalosubiri. Huwezi kuwasilisha hili tena kwa sasa.', 422);
        }

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
            $pr->fill($data);
            $pr->final_amount = $data['amount'];
            $pr->rejection_reason = null;

            // MD / Admin: restart directly at the cashier stage
            $isHighAuthority = $user->isManagingDirector() || $user->isAdmin();
            $pr->status = $isHighAuthority ? 'awaiting_disbursement' : 'manager_review';

            // Clear all approval fields
            foreach ([
                'manager_name',
                'manager_decision',
                'manager_adjusted_amount',
                'manager_comments',
                'manager_date',
                'gm_name',
                'gm_decision',
                'gm_adjusted_amount',
                'gm_comments',
                'gm_date',
                'md_name',
                'md_comments',
                'md_date',
                'cashier_name',
                'cashier_comments',
                'cashier_reference',
                'cashier_date',
            ] as $f) {
                $pr->{$f} = null;
            }

            // Re-fill MD's authorisation if they are the submitter
            if ($isHighAuthority) {
                $pr->md_name = $user->name;
                $pr->md_comments = 'Auto-authorised — submitted by ' . ucwords(str_replace('_', ' ', $user->role));
                $pr->md_date = now();
                $pr->md_signature_img = $pr->applicant_signature_img ?? $user->signature ?? null;
            }

            $pr->save();

            AuditLog::record('payment_request.resubmitted', $user, $pr, 'Ombi la malipo limehaririwa na kuwasilishwa tena');

            return $this->success($pr, 'Ombi limehaririwa na kuwasilishwa tena');
        } catch (\Exception $e) {
            Log::error('payment request update error: ' . $e->getMessage());
            return $this->error('Imeshindikana kuhariri ombi', 500);
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

        $data = $request->validate([
            'reason' => 'required|string|min:3',
            'password' => 'required|string',
        ]);

        if (!\Illuminate\Support\Facades\Hash::check($data['password'], $user->password)) {
            return $this->error('Nenosiri si sahihi (PIN verification failed)', 422);
        }

        try {
            $stage = $pr->status;
            if ($stage === 'manager_review') {
                $pr->manager_name = $user->name;
                $pr->manager_decision = 'not_approved';
                $pr->manager_comments = $data['reason'];
                $pr->manager_date = now();
            } elseif ($stage === 'gm_review') {
                $pr->gm_name = $user->name;
                $pr->gm_decision = 'not_approved';
                $pr->gm_comments = $data['reason'];
                $pr->gm_date = now();
            } elseif ($stage === 'md_review') {
                $pr->md_name = $user->name;
                $pr->md_comments = $data['reason'];
                $pr->md_date = now();
            }

            $pr->status = 'rejected';
            $pr->rejection_reason = $data['reason'];
            $pr->save();

            AuditLog::record('payment_request.rejected', $user, $pr, 'Ombi la malipo limekataliwa', ['reason' => $data['reason']]);

            Notifier::toUsers(
                [$pr->created_by],
                'payment_request',
                'Payment request rejected',
                'Your payment request payable to ' . $pr->payable_to . ' was not approved. You can edit and resubmit it.',
                '/payment-requests',
                ['id' => $pr->id]
            );

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
