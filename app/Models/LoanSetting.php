<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

/**
 * Single-row table of admin-configurable loan policy rates (penalty,
 * default interest, default processing fee). Every place in the app that
 * used to hardcode one of these reads it from here instead via current().
 *
 * Penalty is a FLAT daily amount in TZS (not a percentage).
 * penalty_rate column stores the TZS amount, e.g. 1000 = TZS 1,000/day.
 */
class LoanSetting extends Model
{
    const CACHE_KEY = 'loan_settings.current';

    // Flat daily penalty in TZS applied to any overdue installment.
    const DEFAULT_DAILY_PENALTY = 1000.0;

    protected $fillable = [
        'penalty_rate',
        'default_interest_rate',
        'default_processing_fee_rate',
        'compliance_roles',
        'payroll_access_roles',
        'branch_report_roles',
        'branch_report_permissions',
        'salary_bank_account_code',
        'salary_cash_account_code',
        'paye_payable_account_code',
        'nssf_payable_account_code',
        // Organisation identity
        'company_name',
        'company_branch',
        'company_tagline',
        'company_address',
        'company_phone',
        'company_email',
        'company_website',
        'company_logo',
        'company_registration_no',
        'company_tin',
        // Display / regional
        'currency_code',
        'date_format',
        'timezone',
        'fiscal_year_start_month',
        'brand_color',
        'session_timeout_minutes',
        'historical_loan_roles',
        'updated_by',
    ];

    protected $casts = [
        'penalty_rate' => 'decimal:2',
        'default_interest_rate' => 'decimal:2',
        'default_processing_fee_rate' => 'decimal:2',
        'compliance_roles'           => 'array',
        'payroll_access_roles'       => 'array',
        'branch_report_roles'        => 'array',
        'branch_report_permissions'  => 'array',
        'historical_loan_roles'      => 'array',
    ];

    /** The active settings row, cached — creates the default row if the table is ever empty. */
    public static function current(): self
    {
        return Cache::rememberForever(self::CACHE_KEY, function () {
            return self::query()->firstOrCreate([], [
                'penalty_rate'               => self::DEFAULT_DAILY_PENALTY,
                'default_interest_rate'      => 3.00,
                'default_processing_fee_rate'=> 0.00,
            ]);
        });
    }

    /** Call after any update so the next current() call re-reads from the DB. */
    public static function forgetCache(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    /**
     * Flat daily penalty in TZS (e.g. 1000.0).
     * penalty_rate column stores the TZS amount directly — NOT a percentage.
     */
    public function dailyPenaltyAmount(): float
    {
        $val = (float) $this->penalty_rate;
        return $val > 0 ? $val : self::DEFAULT_DAILY_PENALTY;
    }

    /** @deprecated Use dailyPenaltyAmount() — kept temporarily so old callers do not crash. */
    public function penaltyRateFraction(): float
    {
        // Return the flat amount expressed as a multiplier of 1 (i.e. the amount itself).
        // Callers that do  amount * penaltyRateFraction()  will get wrong results —
        // they must be updated to use dailyPenaltyAmount() directly.
        return $this->dailyPenaltyAmount();
    }

    public function defaultInterestRateFraction(): float
    {
        return (float) $this->default_interest_rate / 100;
    }

    public function defaultProcessingFeeRateFraction(): float
    {
        return (float) $this->default_processing_fee_rate / 100;
    }
}
