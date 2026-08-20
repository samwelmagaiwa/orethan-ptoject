<?php

namespace App\Sms;

/**
 * Every customer-facing SMS message, in Swahili, in one place. Business logic
 * (LoanService, controllers) never builds message text itself -- it calls
 * SmsService, which calls here. Edit wording without touching anything else.
 */
class SmsTemplates
{
    /** Map a role slug to a human-readable Swahili label for SMS greetings. */
    public static function roleLabel(string $role): string
    {
        return match ($role) {
            'loan_officer'      => 'Afisa Mikopo',
            'loan_manager'      => 'Meneja wa Mikopo',
            'general_manager'   => 'Mkurugenzi Mkuu',
            'managing_director' => 'Mkurugenzi Mtendaji',
            'finance_officer'   => 'Afisa Fedha',
            'accountant'        => 'Mhasibu',
            'cashier'           => 'Kasisi',
            'admin'             => 'Msimamizi',
            default             => ucwords(str_replace('_', ' ', $role)),
        };
    }

    private static function money(float $amount): string
    {
        return number_format($amount, 0, '.', ',');
    }

    private static function date(?string $date): string
    {
        if (!$date) {
            return '--';
        }
        try {
            return \Carbon\Carbon::parse($date)->format('d/m/Y');
        } catch (\Throwable) {
            return $date;
        }
    }

    /** Loan disbursed and funds released. */
    public static function disbursement(string $customerName, string $loanAccountNumber, float $netAmount, ?string $firstDueDate): string
    {
        return "Mpendwa {$customerName}, mkopo wako (Akaunti: {$loanAccountNumber}) wa TZS " . self::money($netAmount)
            . " umetolewa. Malipo ya kwanza yanatakiwa tarehe " . self::date($firstDueDate)
            . ". Asante kwa kuchagua Orethan Microfinance.";
    }

    /** Repayment received -- covers both partial and fully-paid-off cases. */
    public static function repaymentReceived(string $customerName, string $loanAccountNumber, float $amountPaid, float $balanceAfter, ?string $nextDueDate, bool $fullyPaid): string
    {
        $balanceLine = $fullyPaid
            ? 'Hongera! Mkopo wako umelipwa kikamilifu.'
            : 'Salio lililobaki: TZS ' . self::money($balanceAfter) . '. Malipo yanayofuata: ' . self::date($nextDueDate) . '.';

        return "Mpendwa {$customerName}, tumepokea malipo ya TZS " . self::money($amountPaid)
            . " kwa mkopo (Akaunti: {$loanAccountNumber}). {$balanceLine} Asante - Orethan Microfinance.";
    }

    /** Staff notification: a repayment has been recorded (sent to LM/GM/MD). */
    public static function repaymentRecordedStaff(string $roleLabel, string $customerName, string $loanNumber, float $amountPaid, float $balanceAfter, bool $fullyPaid): string
    {
        $statusLine = $fullyPaid
            ? 'Mkopo umelipwa KIKAMILIFU.'
            : 'Salio: TZS ' . self::money($balanceAfter) . '.';

        return "{$roleLabel}, malipo ya TZS " . self::money($amountPaid)
            . " yamerekodiwa kwa {$customerName} (Mkopo: {$loanNumber}). {$statusLine} - Orethan Microfinance.";
    }

    /** Loan has cleared every approval stage and is ready for disbursement. */
    public static function loanApproved(string $customerName, float $amount): string
    {
        return "Mpendwa {$customerName}, ombi lako la mkopo wa TZS " . self::money($amount)
            . " limekubaliwa rasmi. Tafadhali wasiliana na ofisi yetu kwa taratibu za malipo. Asante - Orethan Microfinance.";
    }

    /** Reminder sent ahead of an upcoming due date. */
    public static function paymentReminder(string $customerName, string $loanAccountNumber, float $amountDue, ?string $dueDate): string
    {
        return "Mpendwa {$customerName}, tunakukumbusha malipo ya mkopo wako (Akaunti: {$loanAccountNumber}) ya TZS "
            . self::money($amountDue) . " yanatakiwa kulipwa tarehe " . self::date($dueDate)
            . ". Tafadhali fanya malipo kwa wakati. Asante - Orethan Microfinance.";
    }

    /** Notice sent once a payment is already past its due date. */
    public static function paymentOverdue(string $customerName, string $loanAccountNumber, float $amountOverdue, int $daysOverdue): string
    {
        return "Mpendwa {$customerName}, mkopo wako (Akaunti: {$loanAccountNumber}) una malipo yaliyochelewa ya TZS "
            . self::money($amountOverdue) . " kwa siku {$daysOverdue}. Tafadhali lipa haraka iwezekanavyo kuepuka adhabu. Asante - Orethan Microfinance.";
    }

    /** Sent to a loan's guarantor(s) once the client misses a repayment due date. */
    public static function guarantorOverdueNotice(string $guarantorName, string $clientName, float $dailyPenaltyAmount, float $remainingBalance): string
    {
        $penalty = self::money($dailyPenaltyAmount);
        $balance = self::money($remainingBalance);

        return "Mpendwa {$guarantorName}, {$clientName} ambaye ulimdhamini hajafanya marejesho ya mkopo wake, "
            . "hivyo adhabu ya TZS {$penalty}/siku inaendelea kuongezwa kama sera inavyosema. "
            . "Deni la sasa ni TZS {$balance}. Tunakuomba umkumbushe kufanya marejesho ili kuepuka usumbufu. "
            . "Asante - Orethan Microfinance.";
    }

    /** Pre-due reminder sent 3 days before the installment due date. */
    public static function paymentReminder3Days(string $customerName, string $loanNo, float $amountDue, string $dueDate): string
    {
        return "Mpendwa {$customerName}, ukumbusho: malipo ya mkopo wako ({$loanNo}) ya TZS "
            . self::money($amountDue) . " yanatakiwa kulipwa tarehe " . self::date($dueDate)
            . " (siku 3 zijazo). Tafadhali jiandae kulipa kwa wakati ili kuepuka adhabu. Asante - Orethan Microfinance.";
    }

    /** Due-today reminder sent on the morning of the installment due date. */
    public static function paymentReminderToday(string $customerName, string $loanNo, float $amountDue, string $dueDate): string
    {
        return "Mpendwa {$customerName}, LEO " . self::date($dueDate)
            . " ni siku ya malipo ya mkopo wako ({$loanNo}) ya TZS " . self::money($amountDue)
            . ". Tafadhali lipa sasa ili kuepuka adhabu ya kuchelewa. Asante - Orethan Microfinance.";
    }

    /** Daily penalty-update SMS sent to guarantors while an installment remains overdue. */
    public static function guarantorPenaltyUpdate(
        string $guarantorName,
        string $clientName,
        string $loanNo,
        float  $overdueAmount,
        float  $penaltyAccrued,
        int    $penaltyDays
    ): string {
        $totalDue = $overdueAmount + $penaltyAccrued;
        return "Mpendwa {$guarantorName}, siku ya {$penaltyDays} ya uchelewaji: "
            . "{$clientName} (Mkopo: {$loanNo}) hajalipa. "
            . "Deni la awali: TZS " . self::money($overdueAmount) . ". "
            . "Adhabu (TZS 1,000/siku × {$penaltyDays} siku): TZS " . self::money($penaltyAccrued) . ". "
            . "JUMLA INAYODAIWA: TZS " . self::money($totalDue) . ". "
            . "Tafadhali mhimize alipe leo kuepuka ongezeko zaidi. Asante - Orethan Microfinance.";
    }

    /** Sent to Loan Manager(s) when a Loan Officer submits a Branch Report for approval. */
    public static function branchReportPending(
        string $lmName,
        string $officerName,
        string $branch,
        string $reportType,
        string $period
    ): string {
        $typeLabel = match ($reportType) {
            'daily'   => 'ya Kila Siku',
            'weekly'  => 'ya Wiki',
            'monthly' => 'ya Mwezi',
            default   => $reportType,
        };
        return "Ripoti {$typeLabel} ({$branch}, {$period}) imewasilishwa na {$officerName}. Ingia kwenye mfumo kuendelea kuikagua. - Orethan";
    }

    /** OTP code for forgot-password or first-login verification. */
    public static function otp(string $name, string $otp, string $context = 'otp'): string
    {
        return "Orethan: Nambari yako ya OTP ni {$otp}. Halali kwa dakika 10. Usimwambie mtu. - Orethan Microfinance";
    }

    /** Sent immediately after a borrower's loan application is submitted. */
    public static function loanApplicationReceived(string $customerName, string $loanAccountNumber, float $amount): string
    {
        return "Mpendwa {$customerName}, ombi lako la mkopo wa TZS " . self::money($amount)
            . " (Namba: {$loanAccountNumber}) limepokelewa na linafanyiwa kazi. "
            . "Utapokea ujumbe mwingine ukitaarifu matokeo. Asante - Orethan Microfinance.";
    }

    /** Sent when a loan application is rejected at any approval stage. */
    public static function loanRejected(string $customerName, string $loanAccountNumber, string $reason = ''): string
    {
        $reasonLine = $reason ? " Sababu: {$reason}." : '';
        return "Mpendwa {$customerName}, ombi lako la mkopo (Namba: {$loanAccountNumber}) "
            . "haukuidhinishwa.{$reasonLine} "
            . "Tafadhali wasiliana na ofisi yetu kwa maelezo zaidi. Asante - Orethan Microfinance.";
    }

    /** Sent to the staff member whose loan submission was returned for corrections. */
    public static function loanReturnedToStaff(string $staffRoleLabel, string $applicantName, string $loanNo, string $reason = ''): string
    {
        $reasonLine = $reason ? " Sababu: {$reason}." : '';
        return "Mpendwa {$staffRoleLabel}, ombi la mkopo ({$loanNo}, {$applicantName}) "
            . "limerudishwa kwako kwa marekebisho.{$reasonLine} Tafadhali rekebisha na utume tena. - Orethan Microfinance.";
    }

    /** Sent to the staff member whose loan submission was returned for corrections. */
    public static function loanApplicationPendingReview(string $managerRoleLabel, string $applicantName, float $amount, string $loanNo): string
    {
        return "Mpendwa {$managerRoleLabel}, mkopo mpya TZS " . self::money($amount) . " ({$loanNo}, {$applicantName}) unasubiri ukaguzi wako. Ingia kwenye mfumo kuendelea. - Orethan";
    }

    /** Sent to General Manager(s) when Loan Manager approves and escalates to GM stage. */
    public static function loanPendingGmReview(string $gmRoleLabel, string $applicantName, float $amount, string $loanNo): string
    {
        return "Mpendwa {$gmRoleLabel}, mkopo TZS " . self::money($amount) . " ({$loanNo}, {$applicantName}) unahitaji idhini yako. Ingia kwenye mfumo kuendelea. - Orethan";
    }

    /** Sent to Managing Director(s) when GM approves and escalates to MD stage. */
    public static function loanPendingMdReview(string $mdRoleLabel, string $applicantName, float $amount, string $loanNo): string
    {
        return "Mpendwa {$mdRoleLabel}, mkopo TZS " . self::money($amount) . " ({$loanNo}, {$applicantName}) unahitaji idhini yako ya mwisho. Ingia kwenye mfumo kuendelea. - Orethan";
    }

    /** Sent to the original submitter when the Loan Manager approves their Branch Report. */
    public static function branchReportApproved(
        string $officerRoleLabel,
        string $branch,
        string $reportType,
        string $period,
        string $approverRoleLabel
    ): string {
        $typeLabel = match ($reportType) {
            'daily'   => 'ya Kila Siku',
            'weekly'  => 'ya Wiki',
            'monthly' => 'ya Mwezi',
            default   => $reportType,
        };
        return "Mpendwa {$officerRoleLabel}, ripoti yako {$typeLabel} ya tawi la {$branch} kwa kipindi "
            . "cha {$period} imeidhinishwa na {$approverRoleLabel}. Asante kwa kazi nzuri - Orethan Microfinance.";
    }

    /** SMS to the next approver when a payment request is submitted or advanced. */
    public static function paymentRequestPending(string $approverRoleLabel, string $applicantRoleLabel, float $amount, string $payableTo): string
    {
        return "Mpendwa {$approverRoleLabel}, ombi la malipo TZS " . self::money($amount) . " ({$applicantRoleLabel}) linasubiri idhini yako. Ingia kwenye mfumo kuendelea. - Orethan";
    }

    /** SMS to the applicant when their payment request is fully disbursed. */
    public static function paymentRequestDisbursed(string $applicantRoleLabel, float $amount, string $payableTo, ?string $voucherNumber = null, ?string $cashierName = null): string
    {
        $ref      = $voucherNumber ? " (Vocha: {$voucherNumber})" : "";
        $cashier  = $cashierName   ? " na {$cashierName}"         : "";
        return "Mpendwa {$applicantRoleLabel}, malipo ya TZS " . self::money($amount)
            . " kwa {$payableTo} yamelipwa{$cashier}{$ref}. Unaweza kuendelea. Asante - Orethan Microfinance.";
    }

    /** SMS to the applicant when their payment request is rejected. */
    public static function paymentRequestRejected(string $applicantRoleLabel, float $amount, string $reason): string
    {
        return "Mpendwa {$applicantRoleLabel}, ombi lako la malipo la TZS " . self::money($amount)
            . " limekataliwa. Sababu: {$reason}. Unaweza kuhariri na kuliwasilisha tena. Asante - Orethan Microfinance.";
    }

    /** SMS to the next approver when a leave request is submitted or advanced. */
    public static function leaveRequestPending(string $approverRoleLabel, string $employeeRoleLabel, string $absenceType, string $from, string $to): string
    {
        return "Mpendwa {$approverRoleLabel}, ombi la likizo ({$absenceType}) kutoka {$employeeRoleLabel} ({$from}-{$to}) linasubiri idhini yako. Ingia kwenye mfumo kuendelea. - Orethan";
    }

    /** SMS to the applicant when their leave request is fully authorized. */
    public static function leaveRequestAuthorized(string $employeeRoleLabel, string $from, string $to): string
    {
        return "Mpendwa {$employeeRoleLabel}, ombi lako la likizo kuanzia {$from} hadi {$to} "
            . "limeidhinishwa kikamilifu. Likizo njema! Asante - Orethan Microfinance.";
    }

    /** SMS to the applicant when their leave request is rejected. */
    public static function leaveRequestRejected(string $employeeRoleLabel, string $reason): string
    {
        return "Mpendwa {$employeeRoleLabel}, ombi lako la likizo limekataliwa. "
            . "Sababu: {$reason}. Unaweza kuhariri na kuliwasilisha tena. Asante - Orethan Microfinance.";
    }

    public static function branchReportRejected(
        string $officerRoleLabel,
        string $branch,
        string $reportType,
        string $period,
        string $rejectorRoleLabel,
        string $reason
    ): string {
        $typeLabel = match ($reportType) {
            'daily'   => 'ya Kila Siku',
            'weekly'  => 'ya Wiki',
            'monthly' => 'ya Mwezi',
            default   => $reportType,
        };
        return "Mpendwa {$officerRoleLabel}, ripoti yako {$typeLabel} ya tawi la {$branch} kwa kipindi "
            . "cha {$period} imekataliwa na {$rejectorRoleLabel}. Sababu: {$reason}. Tafadhali ihariri na uiwasilishe tena - Orethan Microfinance.";
    }

    /** Sent to LM or LO when GM/MD returns an approved branch report for rework. */
    public static function branchReportReturned(
        string $recipientRoleLabel,
        string $branch,
        string $reportType,
        string $period,
        string $returnerRoleLabel,
        string $stageLabel,
        string $reason
    ): string {
        $typeLabel = match ($reportType) {
            'daily'   => 'ya Kila Siku',
            'weekly'  => 'ya Wiki',
            'monthly' => 'ya Mwezi',
            default   => $reportType,
        };
        return "Mpendwa {$recipientRoleLabel}, ripoti {$typeLabel} ya tawi la {$branch} ({$period}) "
            . "imerudishwa na {$returnerRoleLabel} kwa {$stageLabel} kwa marekebisho. "
            . "Sababu: {$reason}. - Orethan Microfinance.";
    }

    /**
     * Sent to every staff member when a historical loan is imported into the system.
     * The customer does NOT receive this SMS — only staff are notified.
     */
    public static function historicalLoanStaffNotice(
        string $staffName,
        string $customerName,
        string $loanAccountNumber,
        float  $amount,
        float  $remainingBalance,
        string $disbursedAt,
        string $importedBy
    ): string {
        return "Mpendwa {$staffName}, mkopo wa kihistoria umerekodiwa mfumoni. "
            . "Mteja: {$customerName}, Akaunti: {$loanAccountNumber}, "
            . "Kiasi: TZS " . self::money($amount) . ", "
            . "Salio: TZS " . self::money($remainingBalance) . ", "
            . "Tarehe ya mkopo: " . self::date($disbursedAt) . ". "
            . "Imerekodiwa na: {$importedBy}. - Orethan Microfinance.";
    }

    /** Sent to a newly created system user so they know their login credentials. */
    public static function welcomeNewUser(string $name): string
    {
        return "Karibu {$name}! Akaunti yako ya mfumo wa Orethan Microfinance imeundwa. "
            . "Ingia kwa akaunti yako na ubadilishe neno la siri kabla ya kuendelea. "
            . "Neno lako la siri la muda ni: ORETHAN (herufi kubwa). - Orethan Microfinance.";
    }

    /** Sent when an admin resets a user's password back to the default. */
    public static function passwordReset(string $name): string
    {
        return "Habari {$name}! Nenosiri lako la mfumo wa Orethan Microfinance limewekwa upya na msimamizi. "
            . "Nenosiri lako la muda ni: ORETHAN (herufi kubwa). "
            . "Ingia na ubadilishe nenosiri kabla ya masaa 12 au utafungiwa nje. - Orethan Microfinance.";
    }
}
