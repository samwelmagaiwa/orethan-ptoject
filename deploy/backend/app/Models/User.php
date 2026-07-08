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
        'sidebar_permissions' => 'array',
        'full_sidebar_access' => 'boolean',
    ];

    /** All keys configurable via the per-user sidebar permission overrides. */
    public const SIDEBAR_KEYS = [
        'dashboard',
        'finance_collections',
        'requests',
        'users',
        'loan_settings',
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
        'profile',
        'logout',
    ];

    // Helper methods for role checking
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