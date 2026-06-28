<?php

namespace App\Sms;

/**
 * Every customer-facing SMS message, in Swahili, in one place. Business logic
 * (LoanService, controllers) never builds message text itself — it calls
 * SmsService, which calls here. Edit wording without touching anything else.
 */
class SmsTemplates
{
    private static function money(float $amount): string
    {
        return number_format($amount, 0, '.', ',');
    }

    private static function date(?string $date): string
    {
        if (!$date) {
            return '—';
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

    /** Repayment received — covers both partial and fully-paid-off cases. */
    public static function repaymentReceived(string $customerName, string $loanAccountNumber, float $amountPaid, float $balanceAfter, ?string $nextDueDate, bool $fullyPaid): string
    {
        $balanceLine = $fullyPaid
            ? 'Hongera! Mkopo wako umelipwa kikamilifu.'
            : 'Salio lililobaki: TZS ' . self::money($balanceAfter) . '. Malipo yanayofuata: ' . self::date($nextDueDate) . '.';

        return "Mpendwa {$customerName}, tumepokea malipo ya TZS " . self::money($amountPaid)
            . " kwa mkopo (Akaunti: {$loanAccountNumber}). {$balanceLine} Asante - Orethan Microfinance.";
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
}
