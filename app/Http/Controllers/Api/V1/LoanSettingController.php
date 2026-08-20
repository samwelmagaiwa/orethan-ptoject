<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\LoanSetting;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class LoanSettingController extends Controller
{
    use ApiResponse;

    /**
     * Public on purpose — the landing-page calculator pre-fills its default
     * interest rate from here before a visitor has even logged in.
     */
    public function show()
    {
        $settings = LoanSetting::current();

        // Resolve logo to a public URL so the frontend can render <img>
        if ($settings->company_logo && Storage::disk('public')->exists($settings->company_logo)) {
            $data = $settings->toArray();
            $data['company_logo_url'] = Storage::disk('public')->url($settings->company_logo);
        } else {
            $data = $settings->toArray();
            $data['company_logo_url'] = null;
        }

        return $this->success($data, 'Loan settings loaded');
    }

    public function update(Request $request)
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return $this->error('Admin pekee ndiye anaweza kubadilisha mipangilio ya mkopo', 403);
        }

        $data = $request->validate([
            // Loan policy — penalty_rate is a flat TZS amount per day (not a percentage)
            'penalty_rate'                 => 'required|numeric|min:0|max:9999999',
            'default_interest_rate'        => 'required|numeric|min:0|max:100',
            'default_processing_fee_rate'  => 'required|numeric|min:0|max:100',
            // Access control
            'compliance_roles'             => 'nullable|array',
            'compliance_roles.*'           => 'string',
            'payroll_access_roles'         => 'nullable|array',
            'payroll_access_roles.*'       => 'string',
            'branch_report_roles'                   => 'nullable|array',
            'branch_report_roles.*'                 => 'string',
            'branch_report_permissions'                    => 'nullable|array',
            'branch_report_permissions.submit'             => 'nullable|array',
            'branch_report_permissions.view_all'           => 'nullable|array',
            'branch_report_permissions.print'              => 'nullable|array',
            'branch_report_permissions.approve'            => 'nullable|array',
            'branch_report_permissions.delete'             => 'nullable|array',
            'branch_report_permissions.skip_approval'      => 'nullable|array',
            'historical_loan_roles'                        => 'nullable|array',
            'historical_loan_roles.*'                      => 'string',
            'disburse_loan_roles'                          => 'nullable|array',
            'disburse_loan_roles.*'                        => 'string',
            'record_repayment_roles'                       => 'nullable|array',
            'record_repayment_roles.*'                     => 'string',
            'approve_payment_roles'                        => 'nullable|array',
            'approve_payment_roles.*'                      => 'string',
            'reschedule_loan_roles'                        => 'nullable|array',
            'reschedule_loan_roles.*'                      => 'string',
            'writeoff_loan_roles'                          => 'nullable|array',
            'writeoff_loan_roles.*'                        => 'string',
            'topup_loan_roles'                             => 'nullable|array',
            'topup_loan_roles.*'                           => 'string',
            'manage_users_roles'                           => 'nullable|array',
            'manage_users_roles.*'                         => 'string',
            'lock_users_roles'                             => 'nullable|array',
            'lock_users_roles.*'                           => 'string',
            'edit_loan_rates_roles'                        => 'nullable|array',
            'edit_loan_rates_roles.*'                      => 'string',
            'edit_access_control_roles'                    => 'nullable|array',
            'edit_access_control_roles.*'                  => 'string',
            'manage_till_roles'                            => 'nullable|array',
            'manage_till_roles.*'                          => 'string',
            'add_historical_loan_roles'                    => 'nullable|array',
            'add_historical_loan_roles.*'                  => 'string',
            // Payroll GL accounts
            'salary_bank_account_code'     => 'nullable|string|max:20',
            'salary_cash_account_code'     => 'nullable|string|max:20',
            'paye_payable_account_code'    => 'nullable|string|max:20',
            'nssf_payable_account_code'    => 'nullable|string|max:20',
            // Organisation identity
            'company_name'                 => 'nullable|string|max:150',
            'company_branch'               => 'nullable|string|max:150',
            'company_tagline'              => 'nullable|string|max:200',
            'company_address'              => 'nullable|string|max:500',
            'company_phone'                => 'nullable|string|max:50',
            'company_email'                => 'nullable|email|max:100',
            'company_website'              => 'nullable|url|max:150',
            'company_registration_no'      => 'nullable|string|max:80',
            'company_tin'                  => 'nullable|string|max:50',
            // Display / regional
            'currency_code'                => 'nullable|string|max:10',
            'date_format'                  => 'nullable|string|max:20',
            'timezone'                     => 'nullable|string|max:60',
            'fiscal_year_start_month'      => 'nullable|integer|min:1|max:12',
            'brand_color'                  => 'nullable|string|max:20',
            'session_timeout_minutes'      => 'nullable|integer|min:1|max:480',
        ]);

        $settings = LoanSetting::current();
        $before = $settings->only([
            'penalty_rate', 'default_interest_rate', 'default_processing_fee_rate',
            'company_name', 'compliance_roles', 'payroll_access_roles',
            'branch_report_roles', 'branch_report_permissions',
        ]);

        $settings->fill($data);
        $settings->updated_by = $user->id;
        $settings->save();
        LoanSetting::forgetCache();

        AuditLog::record(
            'loan_settings.updated',
            $user,
            $settings,
            'Mipangilio ya mfumo imebadilishwa',
            ['before' => $before, 'after' => $data]
        );

        return $this->success(LoanSetting::current(), 'Mipangilio imehifadhiwa');
    }

    /**
     * POST /loan-settings/logo
     * Accepts a single file upload (image/png, image/jpeg, image/svg+xml, max 2 MB).
     * Stores under storage/app/public/logos/ — accessible via /storage/logos/...
     */
    public function uploadLogo(Request $request)
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return $this->error('Admin only', 403);
        }

        $request->validate([
            'logo' => 'required|file|mimes:png,jpg,jpeg,svg,webp|max:2048',
        ]);

        $settings = LoanSetting::current();

        // Delete previous logo file if it exists
        if ($settings->company_logo && Storage::disk('public')->exists($settings->company_logo)) {
            Storage::disk('public')->delete($settings->company_logo);
        }

        $path = $request->file('logo')->store('logos', 'public');

        $settings->company_logo = $path;
        $settings->updated_by   = $user->id;
        $settings->save();
        LoanSetting::forgetCache();

        return $this->success([
            'company_logo'     => $path,
            'company_logo_url' => Storage::disk('public')->url($path),
        ], 'Logo uploaded successfully');
    }
}
