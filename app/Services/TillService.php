<?php

namespace App\Services;

use App\Models\LoanDisbursement;
use App\Models\Repayment;
use App\Models\TillSession;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Per-cashier cash drawer management. A cashier opens one till session at a time
 * with a declared opening float, then every CASH repayment they record adds to
 * the till and every CASH disbursement they pay out removes from it. At close the
 * cashier physically counts the drawer; the variance (counted − expected) flags
 * any shortage or overage for supervisor review.
 *
 * Cash movements are derived from the repayments/disbursements the cashier
 * actually keyed in during the session window, so the figures reconcile to real
 * transactions rather than a separately-maintained running total.
 */
class TillService
{
    /** The cashier's currently-open session, if any. */
    public function currentSession(User $user): ?TillSession
    {
        return TillSession::where('user_id', $user->id)->where('status', 'open')->latest('opened_at')->first();
    }

    /** Live cash-in / cash-out for a session up to $asOf (defaults to now). */
    public function movements(TillSession $session, ?Carbon $asOf = null): array
    {
        $from = $session->opened_at ?? $session->created_at;
        $to = $asOf ?? ($session->closed_at ?? Carbon::now());

        $cashIn = (float) Repayment::where('recorded_by', $session->user_id)
            ->where('payment_method', 'cash')
            ->where('status', '!=', 'reversed')
            ->whereBetween('created_at', [$from, $to])
            ->sum('amount');

        // Actual cash leaving the drawer is the net amount handed to the client.
        $cashOut = (float) LoanDisbursement::where('disbursed_by', $session->user_id)
            ->whereRaw('LOWER(method) = ?', ['cash'])
            ->whereBetween('created_at', [$from, $to])
            ->sum('net_amount');

        $expected = round((float) $session->opening_float + $cashIn - $cashOut, 2);

        return [
            'cash_in' => round($cashIn, 2),
            'cash_out' => round($cashOut, 2),
            'expected_close' => $expected,
        ];
    }

    /** Snapshot for the API: session + live movements + counts. */
    public function snapshot(User $user): array
    {
        $session = $this->currentSession($user);
        if (!$session) {
            return ['open' => false, 'session' => null];
        }
        $m = $this->movements($session);
        return [
            'open' => true,
            'session' => $session,
            'opening_float' => (float) $session->opening_float,
            'cash_in' => $m['cash_in'],
            'cash_out' => $m['cash_out'],
            'expected_close' => $m['expected_close'],
        ];
    }

    public function open(User $user, float $openingFloat, ?string $notes = null): TillSession
    {
        if ($this->currentSession($user)) {
            throw new \Exception('You already have an open till. Close it before opening a new one.');
        }
        if ($openingFloat < 0) {
            throw new \Exception('Opening float cannot be negative');
        }

        return TillSession::create([
            'user_id' => $user->id,
            'status' => 'open',
            'opening_float' => round($openingFloat, 2),
            'open_notes' => $notes,
            'opened_at' => now(),
        ]);
    }

    public function close(User $user, float $countedAmount, ?string $notes = null): TillSession
    {
        return DB::transaction(function () use ($user, $countedAmount, $notes) {
            $session = $this->currentSession($user);
            if (!$session) {
                throw new \Exception('You have no open till to close');
            }
            $m = $this->movements($session, Carbon::now());

            $session->cash_in = $m['cash_in'];
            $session->cash_out = $m['cash_out'];
            $session->expected_close = $m['expected_close'];
            $session->counted_close = round($countedAmount, 2);
            $session->variance = round($countedAmount - $m['expected_close'], 2);
            $session->close_notes = $notes;
            $session->status = 'closed';
            $session->closed_at = now();
            $session->save();

            return $session;
        });
    }

    /** Recent sessions for a cashier (or all, for a supervisor). */
    public function history(?User $user = null, int $limit = 50)
    {
        $query = TillSession::with('user:id,name')->orderByDesc('opened_at');
        if ($user) {
            $query->where('user_id', $user->id);
        }
        return $query->limit($limit)->get();
    }
}
