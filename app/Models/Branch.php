<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Branch extends Model
{
    protected $fillable = [
        'name', 'code', 'region', 'address', 'phone', 'manager_name', 'is_active',
    ];

    protected $casts = ['is_active' => 'boolean'];

    public function users()
    {
        return $this->hasMany(User::class);
    }

    public function officers()
    {
        return $this->hasMany(User::class)->where('role', 'loan_officer');
    }
}
