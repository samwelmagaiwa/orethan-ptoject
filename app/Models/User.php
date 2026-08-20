<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;  // 👈 ONAMBA HII LINE (SANCTUM)

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;  // 👈 ONAMBA HII LINE (HASAPITOKENS)

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'phone',
        'signature',
        'avatar',
        'is_locked',
        'locked_at',
        'locked_reason',
        'otp_code',
        'otp_expires_at',
        'first_login',
        'must_change_password',
        'branch_id',
        'sidebar_permissions',
        'full_sidebar_access',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'is_locked' => 'boolean',
        'locked_at' => 'datetime',
        'otp_expires_at' => 'datetime',
        'first_login' => 'boolean',
        'must_change_password' => 'boolean',
        'password_expires_at' => 'datetime',
        'sidebar_permissions' => 'array',
        'full_sidebar_access' => 'boolean',
    ];

    /** All keys configurable via the per-user sidebar permission overrides. */
    public const SIDEBAR_KEYS = [
        'dashboard',
        'finance_collections',
        'requests',
        'users',
        'global_settings',
        'loans_form',
        'manager_review',
        'gm_review',
        'md_auth',
        'wateja',
        'accounting',
        'regulator_reports',
        'loan_lifecycle',
        'disburse_payments',
        'cash_till',
        'can_disburse',
        'historical_loan',
        'profile',
        'logout',
    ];

    // Helper methods for role checking
    public function branch()
    {
        return $this->belongsTo(\App\Models\Branch::class);
    }

    public function isAdmin()
    {
        return $this->role === 'admin';
    }

    public function isLocked()
    {
        return (bool) $this->is_locked;
    }

    public function isLoanOfficer()
    {
        return $this->role === 'loan_officer';
    }

    public function isLoanManager()
    {
        return $this->role === 'loan_manager';
    }

    public function isGeneralManager()
    {
        return $this->role === 'general_manager';
    }

    public function isManagingDirector()
    {
        return $this->role === 'managing_director';
    }

    public function isFinanceOfficer()
    {
        return $this->role === 'finance_officer';
    }

    /**
     * Returns true when the user may disburse loans.
     * Granted to: admin, finance_officer by role, roles listed in disburse_loan_roles setting,
     * or any user with the per-user sidebar_permissions.can_disburse_loan override.
     * Falls back to the legacy can_disburse flag for backward compatibility.
     */
    public function canDisburseLoan(): bool
    {
        if ($this->isAdmin() || $this->isFinanceOfficer()) return true;
        if ($this->full_sidebar_access) return true;
        $perms = $this->sidebar_permissions;
        if (is_array($perms) && !empty($perms['can_disburse_loan'])) return true;
        if (is_array($perms) && !empty($perms['can_disburse'])) return true; // legacy
        $roles = \App\Models\LoanSetting::current()->disburse_loan_roles ?? [];
        return in_array($this->role, $roles);
    }

    /**
     * Returns true when the user may record repayments.
     * Granted to: admin, finance_officer by role, roles listed in record_repayment_roles setting,
     * or any user with the per-user sidebar_permissions.can_record_repayment override.
     * Falls back to the legacy can_disburse flag for backward compatibility.
     */
    public function canRecordRepayment(): bool
    {
        if ($this->isAdmin() || $this->isFinanceOfficer()) return true;
        if ($this->full_sidebar_access) return true;
        $perms = $this->sidebar_permissions;
        if (is_array($perms) && !empty($perms['can_record_repayment'])) return true;
        if (is_array($perms) && !empty($perms['can_disburse'])) return true; // legacy
        $roles = \App\Models\LoanSetting::current()->record_repayment_roles ?? [];
        return in_array($this->role, $roles);
    }

    /**
     * Returns true when the user may approve payment requests.
     * Granted to: admin, finance_officer by role, GM, MD, roles listed in approve_payment_roles,
     * or any user with the per-user sidebar_permissions.can_approve_payment override.
     * Falls back to the legacy can_disburse flag for backward compatibility.
     */
    public function canApprovePayment(): bool
    {
        if ($this->isAdmin() || $this->isFinanceOfficer()) return true;
        if ($this->isGeneralManager() || $this->isManagingDirector()) return true;
        if ($this->full_sidebar_access) return true;
        $perms = $this->sidebar_permissions;
        if (is_array($perms) && !empty($perms['can_approve_payment'])) return true;
        if (is_array($perms) && !empty($perms['can_disburse'])) return true; // legacy
        $roles = \App\Models\LoanSetting::current()->approve_payment_roles ?? [];
        return in_array($this->role, $roles);
    }

    /** @deprecated Use canDisburseLoan(), canRecordRepayment(), or canApprovePayment() */
    public function canDisburse(): bool
    {
        return $this->canDisburseLoan();
    }

    // ── Loan Restructuring (granular) ─────────────────────────────────────────

    public function canRescheduleLoan(): bool
    {
        if ($this->isAdmin()) return true;
        if ($this->full_sidebar_access) return true;
        $perms = $this->sidebar_permissions;
        if (is_array($perms) && !empty($perms['can_reschedule_loan'])) return true;
        $roles = \App\Models\LoanSetting::current()->reschedule_loan_roles ?? [];
        if (!empty($roles)) return in_array($this->role, $roles);
        return $this->canManageLoanLifecycle(); // legacy fallback
    }

    public function canWriteOffLoan(): bool
    {
        if ($this->isAdmin()) return true;
        if ($this->full_sidebar_access) return true;
        $perms = $this->sidebar_permissions;
        if (is_array($perms) && !empty($perms['can_writeoff_loan'])) return true;
        $roles = \App\Models\LoanSetting::current()->writeoff_loan_roles ?? [];
        if (!empty($roles)) return in_array($this->role, $roles);
        return $this->canManageLoanLifecycle();
    }

    public function canTopUpLoan(): bool
    {
        if ($this->isAdmin()) return true;
        if ($this->full_sidebar_access) return true;
        $perms = $this->sidebar_permissions;
        if (is_array($perms) && !empty($perms['can_topup_loan'])) return true;
        $roles = \App\Models\LoanSetting::current()->topup_loan_roles ?? [];
        if (!empty($roles)) return in_array($this->role, $roles);
        return $this->canManageLoanLifecycle();
    }

    // ── Users Management (granular) ───────────────────────────────────────────

    public function canManageUsers(): bool
    {
        if ($this->isAdmin()) return true;
        if ($this->full_sidebar_access) return true;
        $perms = $this->sidebar_permissions;
        if (is_array($perms) && !empty($perms['can_manage_users'])) return true;
        $roles = \App\Models\LoanSetting::current()->manage_users_roles ?? [];
        return !empty($roles) && in_array($this->role, $roles);
    }

    public function canLockUsers(): bool
    {
        if ($this->isAdmin()) return true;
        if ($this->full_sidebar_access) return true;
        $perms = $this->sidebar_permissions;
        if (is_array($perms) && !empty($perms['can_lock_users'])) return true;
        $roles = \App\Models\LoanSetting::current()->lock_users_roles ?? [];
        return !empty($roles) && in_array($this->role, $roles);
    }

    // ── Global Settings (granular) ────────────────────────────────────────────

    public function canEditLoanRates(): bool
    {
        if ($this->isAdmin()) return true;
        if ($this->full_sidebar_access) return true;
        $perms = $this->sidebar_permissions;
        if (is_array($perms) && !empty($perms['can_edit_loan_rates'])) return true;
        $roles = \App\Models\LoanSetting::current()->edit_loan_rates_roles ?? [];
        return !empty($roles) && in_array($this->role, $roles);
    }

    public function canEditAccessControl(): bool
    {
        if ($this->isAdmin()) return true;
        if ($this->full_sidebar_access) return true;
        $perms = $this->sidebar_permissions;
        if (is_array($perms) && !empty($perms['can_edit_access_control'])) return true;
        $roles = \App\Models\LoanSetting::current()->edit_access_control_roles ?? [];
        return !empty($roles) && in_array($this->role, $roles);
    }

    // ── Cashier Till ──────────────────────────────────────────────────────────

    public function canManageTill(): bool
    {
        if ($this->isAdmin() || $this->isFinanceOfficer()) return true;
        if ($this->full_sidebar_access) return true;
        $perms = $this->sidebar_permissions;
        if (is_array($perms) && !empty($perms['can_manage_till'])) return true;
        $roles = \App\Models\LoanSetting::current()->manage_till_roles ?? [];
        return !empty($roles) && in_array($this->role, $roles);
    }

    // ── Mikopo ya Zamani ──────────────────────────────────────────────────────

    public function canAddHistoricalLoan(): bool
    {
        if ($this->isAdmin()) return true;
        if ($this->full_sidebar_access) return true;
        $perms = $this->sidebar_permissions;
        if (is_array($perms) && !empty($perms['can_add_historical_loan'])) return true;
        $roles = \App\Models\LoanSetting::current()->add_historical_loan_roles
            ?? \App\Models\LoanSetting::current()->historical_loan_roles
            ?? [];
        return !empty($roles) && in_array($this->role, $roles);
    }

    /**
     * True when the user may approve/reject loans at the MD stage.
     * Covers the MD role itself, admins, and any user granted md_auth sidebar access.
     */
    public function canActAsMd(): bool
    {
        if ($this->isManagingDirector() || $this->isAdmin()) return true;
        if ($this->full_sidebar_access) return true;
        $perms = $this->sidebar_permissions;
        return is_array($perms) && !empty($perms['md_auth']);
    }

    /**
     * Accounting module, Risk Reports, and Financial Reports are shared by
     * Admin, Finance Officer/Cashier, Managing Director, and General Manager.
     */
    public function canAccessAccounting()
    {
        return $this->isAdmin() || $this->isFinanceOfficer() || $this->isManagingDirector() || $this->isGeneralManager();
    }

    /**
     * Loan-lifecycle actions (reschedule / write-off / top-up) and BOT regulator
     * reporting are management decisions: Admin, Loan Manager, GM and MD only.
     */
    public function canManageLoanLifecycle()
    {
        return $this->isAdmin() || $this->isLoanManager() || $this->isGeneralManager() || $this->isManagingDirector();
    }
}