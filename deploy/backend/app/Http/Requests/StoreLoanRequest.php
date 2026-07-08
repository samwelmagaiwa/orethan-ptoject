<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreLoanRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'phone' => 'required|string|max:20',
            'amount' => 'required|numeric|min:1',
            'type' => 'required|string|max:50',
            'details' => 'required|array',
            'passport_photo' => 'nullable|string',
            'guarantor_1_photo' => 'nullable|string',
            'guarantor_2_photo' => 'nullable|string',
        ];
    }
}
