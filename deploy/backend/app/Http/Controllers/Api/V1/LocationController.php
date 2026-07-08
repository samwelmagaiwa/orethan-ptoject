<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\State;
use App\Models\Lga;
use App\Models\Ward;
use App\Models\Village;
use Illuminate\Http\Request;

class LocationController extends Controller
{
    public function getRegions()
    {
        return response()->json(State::orderBy('name')->get());
    }

    public function getDistricts($regionId)
    {
        return response()->json(Lga::where('state_id', $regionId)->orderBy('name')->get());
    }

    public function getWards($districtId)
    {
        return response()->json(Ward::where('lga_id', $districtId)->orderBy('name')->get());
    }

    public function getStreets($wardId)
    {
        return response()->json(Village::where('ward_id', $wardId)->orderBy('name')->get());
    }
}
