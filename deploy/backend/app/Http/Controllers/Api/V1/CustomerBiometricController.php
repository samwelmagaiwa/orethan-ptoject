<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\CustomerBiometric;
use Illuminate\Http\Request;

class CustomerBiometricController extends Controller
{
    /** GET /biometrics/{customer_id} — list stored fingers (no templates) */
    public function index(int $customerId)
    {
        $records = CustomerBiometric::where('customer_id', $customerId)
            ->select(['id', 'customer_id', 'finger_position', 'device_serial', 'captured_by', 'created_at'])
            ->get();

        return response()->json(['data' => $records]);
    }

    /** GET /biometrics/{customer_id}/{finger} — returns image_b64 only (for display) */
    public function show(int $customerId, string $finger)
    {
        $record = CustomerBiometric::where('customer_id', $customerId)
            ->where('finger_position', $finger)
            ->select(['id', 'finger_position', 'image_b64', 'captured_by', 'created_at'])
            ->first();

        if (!$record) {
            return response()->json(['error' => 'Not found'], 404);
        }

        return response()->json(['data' => $record]);
    }

    /** GET /biometrics/{customer_id}/{finger}/template — returns template for matching */
    public function template(int $customerId, string $finger)
    {
        $record = CustomerBiometric::where('customer_id', $customerId)
            ->where('finger_position', $finger)
            ->first();

        if (!$record) {
            return response()->json(['error' => 'Not found'], 404);
        }

        return response()->json(['template' => $record->template]);
    }

    /**
     * POST /biometrics/store
     * Body: { customer_id, finger_position, template, image_b64, device_serial }
     * Upserts (update if finger already stored for this customer).
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'customer_id'    => 'required|integer',
            'finger_position'=> 'required|string|max:30',
            'template'       => 'required|string',
            'image_b64'      => 'nullable|string',
            'device_serial'  => 'nullable|string|max:60',
        ]);

        $data['captured_by'] = auth()->user()?->name ?? $request->header('X-Cashier', 'unknown');

        $record = CustomerBiometric::updateOrCreate(
            ['customer_id' => $data['customer_id'], 'finger_position' => $data['finger_position']],
            $data
        );

        return response()->json(['data' => $record->only(['id', 'customer_id', 'finger_position', 'captured_by', 'created_at'])], 201);
    }

    /** DELETE /biometrics/{id} */
    public function destroy(int $id)
    {
        $record = CustomerBiometric::findOrFail($id);
        $record->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
