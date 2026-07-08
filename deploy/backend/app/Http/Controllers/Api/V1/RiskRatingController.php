<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Services\RiskRatingService;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;

class RiskRatingController extends Controller
{
    use ApiResponse;

    public function __construct(private RiskRatingService $rrs) {}

    /** POST /risk/score/{customerId} — score one customer */
    public function score(int $customerId)
    {
        $customer = Customer::findOrFail($customerId);
        $result   = $this->rrs->score($customer);
        return $this->success(array_merge($result, ['customer' => $customer->fresh()]), 'Alama ya hatari imehesabiwa');
    }

    /** POST /risk/score-all — score all customers (admin only) */
    public function scoreAll(Request $request)
    {
        $user = $request->user();
        if (!$user || !in_array($user->role, ['admin', 'general_manager', 'managing_director'])) {
            return $this->error('Huna ruhusa ya kuhesabu alama zote', 403);
        }
        $count = $this->rrs->scoreAll();
        return $this->success(['scored' => $count], "Wateja $count wamepata alama za hatari");
    }

    /** GET /risk/portfolio — grade distribution for dashboard */
    public function portfolio()
    {
        $customers = Customer::whereNotNull('risk_score')->get();

        $distribution = $customers->groupBy('risk_grade')->map->count();
        $avgScore     = $customers->avg('risk_score');
        $unrated      = Customer::whereNull('risk_score')->count();

        $grades = ['A', 'B', 'C', 'D', 'E'];
        $dist   = collect($grades)->mapWithKeys(fn($g) => [$g => $distribution->get($g, 0)]);

        return $this->success([
            'grade_distribution' => $dist,
            'average_score'      => round($avgScore ?? 0, 1),
            'total_rated'        => $customers->count(),
            'total_unrated'      => $unrated,
            'high_risk_count'    => ($distribution->get('D', 0) + $distribution->get('E', 0)),
            'labels' => [
                'A' => 'Excellent (85–100)',
                'B' => 'Good (70–84)',
                'C' => 'Fair (55–69)',
                'D' => 'Poor (40–54)',
                'E' => 'High Risk (0–39)',
            ],
            'colors' => [
                'A' => '#059669', 'B' => '#0ea5e9',
                'C' => '#f59e0b', 'D' => '#ef4444', 'E' => '#7c3aed',
            ],
        ]);
    }
}
