<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Customer extends Model
{
    protected $fillable = [
        'full_name',
        'phone_number',
        'nida_number',
        'id_type',
        'id_number',
        'date_of_birth',
        'gender',
        'email',
        'region',
        'district',
        'ward',
        'street',
        'residency_type',
    ];

    public function loans()
    {
        return $this->hasMany(Loan::class);
    }
}
