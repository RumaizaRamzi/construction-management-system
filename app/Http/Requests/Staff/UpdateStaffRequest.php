<?php

namespace App\Http\Requests\Staff;

class UpdateStaffRequest extends StoreStaffRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('staff.update') ?? false;
    }

    public function rules(): array
    {
        return $this->staffRules($this->route('staff')?->id, ['sometimes', 'required']);
    }
}
