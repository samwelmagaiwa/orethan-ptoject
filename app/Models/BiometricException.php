<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BiometricException extends Model
{
    protected $fillable = [
        'loan_id', 'person_type', 'person_id', 'reason', 'notes',
        'authorized_by', 'operator_id', 'ip_address',
    ];

    public function loan() { return $this->belongsTo(Loan::class); }
    public function authorizer() { return $this->belongsTo(User::class, 'authorized_by'); }
    public function operator() { return $this->belongsTo(User::class, 'operator_id'); }
}
