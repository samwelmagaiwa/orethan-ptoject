<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Place extends Model
{
    protected $fillable = ['name', 'village_id'];

    public function village()
    {
        return $this->belongsTo(Village::class);
    }
}
