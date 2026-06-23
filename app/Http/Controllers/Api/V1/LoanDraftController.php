<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\LoanDraft;
use Illuminate\Http\Request;

class LoanDraftController extends Controller
{
    /**
     * Get the authenticated user's draft for a given loan type.
     */
    public function show(Request $request, string $type)
    {
        $draft = LoanDraft::where('user_id', $request->user()->id)
            ->where('type', $type)
            ->first();

        if (!$draft) {
            return response()->json(['draft' => null], 200);
        }

        return response()->json([
            'draft' => [
                'form' => $draft->data,
                'step' => $draft->step,
            ]
        ]);
    }

    /**
     * Save (upsert) the authenticated user's draft.
     */
    public function save(Request $request)
    {
        $request->validate([
            'type' => 'required|string|max:50',
            'data' => 'required|array',
            'step' => 'required|integer|min:0',
        ]);

        LoanDraft::updateOrCreate(
            [
                'user_id' => $request->user()->id,
                'type' => $request->type,
            ],
            [
                'data' => $request->data,
                'step' => $request->step,
            ]
        );

        return response()->json(['message' => 'Draft saved successfully.']);
    }

    /**
     * Delete the draft after a successful loan submission.
     */
    public function destroy(Request $request, string $type)
    {
        LoanDraft::where('user_id', $request->user()->id)
            ->where('type', $type)
            ->delete();

        return response()->json(['message' => 'Draft deleted.']);
    }
}
