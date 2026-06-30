<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TillSession extends Model
{
    protected $fillable = [
        'user_id', 'status', 'opening_float', 'cash_in', 'cash_out',
        'expected_close', 'counted_close', 'variance',
        'open_notes', 'close_notes', 'opened_at', 'closed_at',
    ];

    protected $casts = [
        'opening_float' => 'decimal:2',
        'cash_in' => 'decimal:2',
        'cash_out' => 'decimal:2',
        'expected_close' => 'decimal:2',
        'counted_close' => 'decimal:2',
        'variance' => 'decimal:2',
        'opened_at' => 'datetime',
        'closed_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
