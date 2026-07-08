<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Guarantor;
use App\Models\Loan;
use App\Traits\ApiResponse;
use Illuminate\Http\Request;

class GuarantorController extends Controller
{
    use ApiResponse;

    /** GET /guarantors — searchable list for all guarantors */
    public function index(Request $request)
    {
        $q = Guarantor::with('loan:id,loan_account_number,amount,status')
            ->latest();

        if ($request->filled('search')) {
            $s = $request->search;
            $q->where(function ($query) use ($s) {
                $query->where('full_name', 'like', "%$s%")
                      ->orWhere('phone', 'like', "%$s%")
                      ->orWhere('nida_number', 'like', "%$s%")
                      ->orWhere('guarantor_number', 'like', "%$s%");
            });
        }
        if ($request->filled('status')) $q->where('status', $request->status);
        if ($request->filled('loan_id')) $q->where('loan_id', $request->loan_id);

        return $this->success($q->paginate(50));
    }

    /** GET /loans/{loanId}/guarantors */
    public function byLoan(int $loanId)
    {
        $guarantors = Guarantor::where('loan_id', $loanId)->get();
        return $this->success($guarantors);
    }

    /** POST /guarantors */
    public function store(Request $request)
    {
        $data = $request->validate([
            'loan_id'           => 'required|exists:loans,id',
            'full_name'         => 'required|string|max:150',
            'relationship'      => 'nullable|string|max:80',
            'phone'             => 'nullable|string|max:20',
            'nida_number'       => 'nullable|string|max:50',
            'id_type'           => 'nullable|string|max:50',
            'id_number'         => 'nullable|string|max:80',
            'date_of_birth'     => 'nullable|date',
            'gender'            => 'nullable|string|max:20',
            'employment_status' => 'nullable|string|max:80',
            'employer_name'     => 'nullable|string|max:150',
            'employer_phone'    => 'nullable|string|max:20',
            'employer_address'  => 'nullable|string|max:255',
            'monthly_income'    => 'nullable|numeric|min:0',
            'region'            => 'nullable|string|max:100',
            'district'          => 'nullable|string|max:100',
            'ward'              => 'nullable|string|max:100',
            'street'            => 'nullable|string|max:150',
            'house_number'      => 'nullable|string|max:50',
            'status'            => 'nullable|in:active,released,defaulted',
            'notes'             => 'nullable|string',
        ]);

        $data['created_by'] = auth()->id();
        $data['guarantor_number'] = 'GTR-' . strtoupper(substr($data['full_name'], 0, 3)) . '-' . str_pad((string)(Guarantor::count() + 1), 4, '0', STR_PAD_LEFT);

        $guarantor = Guarantor::create($data);
        return $this->success($guarantor, 'Mdhamini ameongezwa', 201);
    }

    /** GET /guarantors/{id} */
    public function show(int $id)
    {
        $g = Guarantor::with('loan:id,loan_account_number,amount,status,name')->findOrFail($id);
        return $this->success($g);
    }

    /** PUT /guarantors/{id} */
    public function update(Request $request, int $id)
    {
        $g = Guarantor::findOrFail($id);
        $data = $request->validate([
            'full_name'         => 'sometimes|string|max:150',
            'relationship'      => 'nullable|string|max:80',
            'phone'             => 'nullable|string|max:20',
            'nida_number'       => 'nullable|string|max:50',
            'employment_status' => 'nullable|string|max:80',
            'employer_name'     => 'nullable|string|max:150',
            'monthly_income'    => 'nullable|numeric|min:0',
            'region'            => 'nullable|string|max:100',
            'district'          => 'nullable|string|max:100',
            'ward'              => 'nullable|string|max:100',
            'street'            => 'nullable|string|max:150',
            'status'            => 'nullable|in:active,released,defaulted',
            'notes'             => 'nullable|string',
        ]);
        $g->update($data);
        return $this->success($g->fresh(), 'Mdhamini imesasishwa');
    }

    /** DELETE /guarantors/{id} */
    public function destroy(int $id)
    {
        $user = auth()->user();
        if (!$user || !in_array($user->role, ['admin', 'loan_manager'])) {
            return $this->error('Huna ruhusa ya kufuta mdhamini', 403);
        }
        Guarantor::findOrFail($id)->delete();
        return $this->success(null, 'Mdhamini amefutwa');
    }

    /** GET /guarantors/stats — summary counts */
    public function stats()
    {
        return $this->success([
            'total'     => Guarantor::count(),
            'active'    => Guarantor::where('status', 'active')->count(),
            'released'  => Guarantor::where('status', 'released')->count(),
            'defaulted' => Guarantor::where('status', 'defaulted')->count(),
        ]);
    }
}
