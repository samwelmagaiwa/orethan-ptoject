<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OfficeDelegation extends Model
{
    protected $fillable = [
        'delegator_id', 'delegator_name', 'delegator_title',
        'delegate_id', 'delegate_name', 'delegate_role', 'acting_title',
        'reason', 'from_date', 'to_date', 'responsibilities', 'limitations', 'handover_notes',
        'status', 'decline_reason',
        'delegator_signature_img', 'delegate_signature_img', 'delegator_date', 'delegate_date',
        'created_by',
    ];

    protected $casts = [
        'from_date' => 'date',
        'to_date' => 'date',
        'delegator_date' => 'date',
        'delegate_date' => 'datetime',
    ];

    public function delegator()
    {
        return $this->belongsTo(User::class, 'delegator_id');
    }

    public function delegate()
    {
        return $this->belongsTo(User::class, 'delegate_id');
    }
}
