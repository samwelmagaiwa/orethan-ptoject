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
    ];

    // Helper methods for role checking
    public function isAdmin()
    {
        return $this->role === 'admin';
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
}