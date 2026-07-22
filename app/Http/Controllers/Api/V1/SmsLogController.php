<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SmsLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class SmsLogController extends Controller
{
    /**
     * GET /sms-logs
     *
     * Optional filters: loan_id, customer_id, type, per_page (default 50)
     * Returns newest-first, paginated.
     */
    public function index(Request $request)
    {
        $q = SmsLog::orderByDesc('created_at');

        if ($request->filled('loan_id'))     $q->where('loan_id', $request->loan_id);
        if ($request->filled('customer_id')) $q->where('customer_id', $request->customer_id);
        if ($request->filled('type'))        $q->where('type', $request->type);

        $perPage = max(1, min(200, (int) ($request->per_page ?? 50)));

        return response()->json(['data' => $q->paginate($perPage)]);
    }

    /**
     * POST /sms/delivery-receipt  (public — Kilakona POSTs to this URL)
     *
     * Kilakona DLR payload fields:
     *   shootId / messageId / message_id  — matches provider_message_id in sms_logs
     *   status / Status                   — DELIVERED | FAILED | UNDELIVERABLE | EXPIRED | REJECTED | Operator Submitted
     *   mobile / to / msisdn              — recipient MSISDN
     *
     * Also accepts legacy NextSMS format for backwards compatibility.
     * Returns 200 always so the gateway does not retry on our errors.
     */
    public function deliveryReceipt(Request $request)
    {
        // Kilakona uses shootId; NextSMS used messageId
        $messageId = $request->input('shootId')
            ?? $request->input('messageId')
            ?? $request->input('message_id')
            ?? null;

        $gatewayStatus = strtoupper((string) ($request->input('status') ?? $request->input('Status') ?? ''));

        if (!$messageId) {
            Log::warning('SMS DLR received with no messageId/shootId', $request->all());
            return response()->json(['ok' => false, 'reason' => 'missing messageId'], 200);
        }

        $internalStatus = match(true) {
            $gatewayStatus === 'DELIVERED'                          => 'delivered',
            in_array($gatewayStatus, ['FAILED', 'UNDELIVERABLE',
                'EXPIRED', 'REJECTED'])                            => 'failed',
            str_contains($gatewayStatus, 'OPERATOR SUBMITTED')     => 'sent', // in transit
            default                                                 => null,   // unknown — leave unchanged
        };

        if ($internalStatus) {
            // Never downgrade delivered → failed due to duplicate/out-of-order receipts
            $query = SmsLog::where('provider_message_id', $messageId);
            if ($internalStatus === 'failed') {
                $query->whereIn('status', ['sent', 'pending']);
            } elseif ($internalStatus === 'delivered') {
                $query->whereIn('status', ['sent', 'pending']);
            }
            $query->update(['status' => $internalStatus]);
        }

        Log::info("SMS DLR: id={$messageId} gateway={$gatewayStatus} mapped={$internalStatus}");

        return response()->json(['ok' => true], 200);
    }
}
