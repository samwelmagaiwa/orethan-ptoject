<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\LoanSetting;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;

class LoanSettingController extends Controller
{
    use ApiResponse;

    /**
     * Public on purpose — the landing-page calculator pre-fills its default
     * interest rate from here before a visitor has even logged in. Nothing
     * returned is sensitive, just published loan-product terms.
     */
    public function show()
    {
        return $this->success(LoanSetting::current(), 'Loan settings loaded');
    }

    public function update(Request $request)
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return $this->error('Admin pekee ndiye anaweza kubadilisha mipangilio ya mkopo', 403);
        }

        $data = $request->validate([
            'penalty_rate' => 'required|numeric|min:0|max:100',
            'default_interest_rate' => 'required|numeric|min:0|max:100',
            'default_processing_fee_rate' => 'required|numeric|min:0|max:100',
        ]);

        $settings = LoanSetting::current();
        $before = $settings->only(['penalty_rate', 'default_interest_rate', 'default_processing_fee_rate']);

        $settings->fill($data);
        $settings->updated_by = $user->id;
        $settings->save();
        LoanSetting::forgetCache();

        AuditLog::record(
            'loan_settings.updated',
            $user,
            $settings,
            'Mipangilio ya riba/adhabu ya mkopo imebadilishwa',
            ['before' => $before, 'after' => $data]
        );

        return $this->success(LoanSetting::current(), 'Mipangilio imehifadhiwa');
    }
}
