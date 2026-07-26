<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\User;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BranchController extends Controller
{
    use ApiResponse;

    /** GET /branches — list all branches with officer count */
    public function index(Request $request)
    {
        $branches = Branch::withCount('users')
            ->withCount('officers')
            ->orderBy('name')
            ->get()
            ->map(fn($b) => [
                'id'           => $b->id,
                'name'         => $b->name,
                'code'         => $b->code,
                'region'       => $b->region,
                'address'      => $b->address,
                'phone'        => $b->phone,
                'manager_name' => $b->manager_name,
                'is_active'    => $b->is_active,
                'users_count'  => $b->users_count,
                'officers_count' => $b->officers_count,
            ]);

        return $this->success($branches);
    }

    /** POST /branches */
    public function store(Request $request)
    {
        if ($request->user()->role !== 'admin') return $this->error('Forbidden', 403);

        $data = $request->validate([
            'name'         => 'required|string|max:120',
            'code'         => 'required|string|max:20|unique:branches,code',
            'region'       => 'nullable|string|max:100',
            'address'      => 'nullable|string|max:255',
            'phone'        => 'nullable|string|max:20',
            'manager_name' => 'nullable|string|max:120',
            'is_active'    => 'boolean',
        ]);

        $branch = Branch::create($data);
        return $this->success($branch, 'Tawi limeundwa', 201);
    }

    /** PUT /branches/{id} */
    public function update(Request $request, int $id)
    {
        if ($request->user()->role !== 'admin') return $this->error('Forbidden', 403);

        $branch = Branch::findOrFail($id);
        $data = $request->validate([
            'name'         => 'sometimes|string|max:120',
            'code'         => 'sometimes|string|max:20|unique:branches,code,' . $id,
            'region'       => 'nullable|string|max:100',
            'address'      => 'nullable|string|max:255',
            'phone'        => 'nullable|string|max:20',
            'manager_name' => 'nullable|string|max:120',
            'is_active'    => 'boolean',
        ]);

        $branch->update($data);
        return $this->success($branch, 'Tawi limesasishwa');
    }

    /** DELETE /branches/{id} */
    public function destroy(Request $request, int $id)
    {
        if ($request->user()->role !== 'admin') return $this->error('Forbidden', 403);

        $branch = Branch::findOrFail($id);
        // Move users to null before deleting
        User::where('branch_id', $id)->update(['branch_id' => null]);
        $branch->delete();
        return $this->success(null, 'Tawi limefutwa');
    }

    /** PUT /branches/{id}/assign-user — assign a user to a branch */
    public function assignUser(Request $request, int $id)
    {
        if ($request->user()->role !== 'admin') return $this->error('Forbidden', 403);

        $branch = Branch::findOrFail($id);
        $data = $request->validate(['user_id' => 'required|exists:users,id']);

        User::where('id', $data['user_id'])->update(['branch_id' => $id]);
        return $this->success(null, 'Mtumiaji amepewa tawi');
    }

    /** GET /branches/{id}/stats — branch-level KPIs */
    public function stats(Request $request, int $id)
    {
        $branch = Branch::findOrFail($id);
        $officerIds = User::where('branch_id', $id)->pluck('id');

        $loanStats = DB::table('loans')
            ->whereIn('user_id', $officerIds)
            ->selectRaw('
                COUNT(*) as total_loans,
                SUM(CASE WHEN status IN ("disbursed","active") THEN 1 ELSE 0 END) as active_loans,
                SUM(CASE WHEN status IN ("disbursed","active") THEN amount ELSE 0 END) as active_portfolio,
                SUM(CASE WHEN status IN ("disbursed","active") AND next_payment_date < CURDATE() THEN 1 ELSE 0 END) as overdue_count,
                SUM(CASE WHEN status = "fully_paid" OR status = "closed" THEN 1 ELSE 0 END) as completed_loans
            ')->first();

        $collected = DB::table('repayments')
            ->join('loans', 'repayments.loan_id', '=', 'loans.id')
            ->whereIn('loans.user_id', $officerIds)
            ->where('repayments.status', 'completed')
            ->sum('repayments.amount');

        return $this->success([
            'branch'          => $branch,
            'officers_count'  => $officerIds->count(),
            'total_loans'     => (int) ($loanStats->total_loans ?? 0),
            'active_loans'    => (int) ($loanStats->active_loans ?? 0),
            'active_portfolio' => round((float) ($loanStats->active_portfolio ?? 0)),
            'overdue_count'   => (int) ($loanStats->overdue_count ?? 0),
            'completed_loans' => (int) ($loanStats->completed_loans ?? 0),
            'total_collected' => round((float) $collected),
        ]);
    }
}
