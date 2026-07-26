<?php

namespace App\Console\Commands;

use App\Models\DelinquencyEscalation;
use App\Models\Loan;
use App\Models\User;
use App\Sms\SmsService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * Checks all active overdue loans and auto-escalates to the appropriate role:
 *   7–29  DPD → loan_manager
 *   30–59 DPD → general_manager
 *   60+   DPD → managing_director
 *
 * Idempotent: one escalation record per loan × level × calendar-day.
 */
class EscalateDelinquency extends Command
{
    protected $signature   = 'loans:escalate-delinquency';
    protected $description = 'Auto-flag overdue loans to manager chain based on days past due';

    // DPD thresholds → role to notify
    const THRESHOLDS = [
        ['min' => 60, 'level' => 'managing_director', 'role' => 'managing_director'],
        ['min' => 30, 'level' => 'general_manager',   'role' => 'general_manager'],
        ['min' => 7,  'level' => 'loan_manager',       'role' => 'loan_manager'],
    ];

    public function handle(SmsService $sms): int
    {
        $today = now()->toDateString();
        $processed = 0;

        $loans = Loan::whereIn('status', ['disbursed', 'active'])
            ->whereHas('schedules', fn($q) =>
                $q->where('status', '!=', 'paid')->whereDate('due_date', '<', $today)
            )
            ->with([
                'schedules' => fn($q) =>
                    $q->where('status', '!=', 'paid')->whereDate('due_date', '<', $today)->orderBy('due_date'),
                'customer:id,full_name,phone_number',
            ])
            ->get();

        foreach ($loans as $loan) {
            $earliest = $loan->schedules->first();
            if (!$earliest) continue;

            $dpd = (int) Carbon::parse($earliest->due_date)->diffInDays($today);

            foreach (self::THRESHOLDS as $thresh) {
                if ($dpd < $thresh['min']) continue;

                $level = $thresh['level'];

                // Skip if already escalated to this level today
                $alreadyDone = DelinquencyEscalation::where('loan_id', $loan->id)
                    ->where('escalation_level', $level)
                    ->where('escalation_date', $today)
                    ->exists();
                if ($alreadyDone) break; // already handled highest applicable level today

                // Find users at this role to notify
                $recipients = User::where('role', $thresh['role'])->get();

                foreach ($recipients as $recipient) {
                    DelinquencyEscalation::create([
                        'loan_id'          => $loan->id,
                        'days_overdue'     => $dpd,
                        'escalation_level' => $level,
                        'escalated_to'     => $recipient->id,
                        'notes'            => "Auto-escalated: {$dpd} DPD — {$loan->loan_account_number}",
                        'escalated_at'     => now(),
                        'escalation_date'  => $today,
                    ]);

                    // Send SMS to the manager
                    try {
                        $borrower = $loan->customer?->full_name ?? $loan->name;
                        $phone    = $loan->customer?->phone_number ?? $loan->phone;
                        $roleName = str_replace('_', ' ', strtoupper($level));
                        $msg = "TAARIFA YA MKOPO ULIOCHELEWA [{$roleName}]: Mkopo {$loan->loan_account_number} ({$borrower}, {$phone}) umechelewa siku {$dpd}. Tafadhali fanya hatua. - Mfumo wa Mkopo";
                        $sms->sendRaw($recipient->phone ?? '', $msg);
                    } catch (\Throwable $e) {
                        Log::warning("EscalateDelinquency SMS failed for loan {$loan->id}: " . $e->getMessage());
                    }
                }

                $processed++;
                break; // apply only the highest matching threshold per loan per day
            }
        }

        $this->info("Escalated {$processed} loan(s) on {$today}.");
        return self::SUCCESS;
    }
}
