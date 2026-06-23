<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Customer extends Model
{
    protected $fillable = [
        'customer_number',
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

    /**
     * Always expose a customer number, falling back to a computed one
     * (CUST-000123) when the stored value is missing.
     */
    public function getCustomerNumberAttribute($value)
    {
        return $value ?: 'CUST-' . str_pad((string) $this->id, 6, '0', STR_PAD_LEFT);
    }
}
