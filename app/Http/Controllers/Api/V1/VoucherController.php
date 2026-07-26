<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class VoucherController extends Controller
{
    /**
     * GET /v1/vouchers/next?context=repay_cust_3
     *
     * Returns the reserved voucher for the given context, creating one if none exists.
     * Any number of browsers/devices calling with the same context key will always
     * receive the SAME voucher number until it is released via POST /v1/vouchers/release.
     *
     * If no context is provided, a fresh number is issued without storing a reservation.
     */
    public function next(Request $request)
    {
        $context = trim($request->query('context', ''));

        if ($context !== '') {
            // Return existing reservation if present (shared across all devices)
            $existing = DB::table('voucher_reservations')
                ->where('context_key', $context)
                ->first();

            if ($existing) {
                return response()->json([
                    'voucher_number' => $this->pad($existing->voucher_number),
                    'raw'            => $existing->voucher_number,
                ]);
            }
        }

        // Atomically grab the next counter value
        $number = DB::transaction(function () {
            $row     = DB::table('voucher_counter')->where('id', 1)->lockForUpdate()->first();
            $current = $row->next_number;
            DB::table('voucher_counter')->where('id', 1)->update(['next_number' => $current + 1]);
            return $current;
        });

        // Persist the reservation so every subsequent call with the same context returns this number
        if ($context !== '') {
            DB::table('voucher_reservations')->insertOrIgnore([
                'context_key'    => $context,
                'voucher_number' => $number,
                'created_at'     => now(),
            ]);
        }

        return response()->json([
            'voucher_number' => $this->pad($number),
            'raw'            => $number,
        ]);
    }

    /**
     * GET /v1/vouchers/peek
     *
     * Returns the upcoming voucher number WITHOUT consuming it or creating a
     * reservation. Any number of clients can call this simultaneously; they all
     * see the same "next" value. Whoever submits a transaction first will
     * actually receive this number via /next; later submissions get the one after.
     */
    public function peek()
    {
        $row = DB::table('voucher_counter')->where('id', 1)->first();
        return response()->json([
            'voucher_number' => $this->pad((int) $row->next_number),
            'raw'            => (int) $row->next_number,
        ]);
    }

    /**
     * POST /v1/vouchers/release
     * Body: { "context": "repay_cust_3" }
     *
     * Called after a payment is successfully submitted to free the reservation.
     * The next call to /next with the same context will then issue a fresh number.
     */
    public function release(Request $request)
    {
        $context = trim($request->input('context', ''));
        if ($context !== '') {
            DB::table('voucher_reservations')->where('context_key', $context)->delete();
        }
        return response()->json(['ok' => true]);
    }

    /** Zero-pad voucher number to at least 4 digits: 205 → "0205", 1234 → "1234". */
    private function pad(int $number): string
    {
        return str_pad((string) $number, 4, '0', STR_PAD_LEFT);
    }
}
