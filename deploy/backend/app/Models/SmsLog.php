<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Audit trail of every SMS the app has attempted to send (sent or failed). */
class SmsLog extends Model
{
    protected $fillable = [
        'customer_id',
        'loan_id',
        'payment_request_id',
        'leave_request_id',
        'branch_report_id',
        'phone',
        'type',
        'message',
        'status',
        'provider_message_id',
        'provider_response',
        'error',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function loan()
    {
        return $this->belongsTo(Loan::class);
    }
}
