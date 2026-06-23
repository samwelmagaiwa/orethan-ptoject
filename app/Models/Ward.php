<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Ward extends Model
{
    protected $fillable = ['name', 'lga_id'];

    public function lga()
    {
        return $this->belongsTo(Lga::class);
    }

    public function villages()
    {
        return $this->hasMany(Village::class);
    }
}
