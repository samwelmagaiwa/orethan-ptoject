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
     * POST /sms/delivery-receipt  (public — NextSMS POSTs to this URL)
     *
     * NextSMS Delivery Receipt payload fields:
     *   messageId   — matches provider_message_id stored in sms_logs
     *   status      — DELIVERED | FAILED | UNDELIVERABLE | EXPIRED | REJECTED
     *   to          — recipient MSISDN (for logging / cross-check)
     *
     * Maps the gateway status to our internal vocabulary and updates the row.
     * Returns 200 always so NextSMS does not retry on our errors.
     */
    public function deliveryReceipt(Request $request)
    {
        $messageId     = $request->input('messageId') ?? $request->input('message_id') ?? null;
        $gatewayStatus = strtoupper((string) ($request->input('status') ?? ''));

        if (!$messageId) {
            Log::warning('SMS delivery receipt received with no messageId', $request->all());
            return response()->json(['ok' => false, 'reason' => 'missing messageId'], 200);
        }

        $internalStatus = match($gatewayStatus) {
            'DELIVERED'              => 'delivered',
            'FAILED', 'UNDELIVERABLE',
            'EXPIRED', 'REJECTED'   => 'failed',
            default                  => null, // unknown — leave unchanged
        };

        if ($internalStatus) {
            SmsLog::where('provider_message_id', $messageId)
                ->whereIn('status', ['sent', 'pending']) // never downgrade delivered→failed due to duplicate receipts
                ->update(['status' => $internalStatus]);
        }

        Log::info("SMS DLR: messageId={$messageId} gatewayStatus={$gatewayStatus} mapped={$internalStatus}");

        return response()->json(['ok' => true], 200);
    }
}
