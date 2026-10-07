<?php

namespace App\Services;

use App\Models\Expense;
use App\Models\Product;
use App\Models\Supplier;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

class SupplierService
{
    public function nextSupplierCode(): string
    {
        $latest = Supplier::query()
            ->where('supplier_code', 'like', 'SUP-%')
            ->orderByDesc('supplier_code')
            ->value('supplier_code');

        $next = 1;
        if ($latest && preg_match('/SUP-(\d+)/', $latest, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return 'SUP-'.str_pad((string) $next, 3, '0', STR_PAD_LEFT);
    }

    public function transform(Supplier $supplier): array
    {
        return [
            'id' => $supplier->id,
            'supplier_code' => $supplier->supplier_code,
            'name' => $supplier->name,
            'phone' => $supplier->phone,
            'email' => $supplier->email,
            'address' => $supplier->address,
            'company_name' => $supplier->company_name,
            'contact_person' => $supplier->contact_person,
            'products_supplied' => $supplier->products_supplied,
            'status' => $supplier->status,
            'outstanding' => (float) $supplier->outstanding,
            'notes' => $supplier->notes,
            'products_count' => (int) ($supplier->products_count ?? $supplier->products()->count()),
            'created_at' => optional($supplier->created_at)?->toIso8601String(),
            'updated_at' => optional($supplier->updated_at)?->toIso8601String(),
        ];
    }

    /**
     * @throws ValidationException|Throwable
     */
    public function create(array $data): Supplier
    {
        return DB::transaction(function () use ($data) {
            $name = trim((string) ($data['name'] ?? ''));
            if ($name === '') {
                throw ValidationException::withMessages([
                    'name' => ['Supplier name is required.'],
                ]);
            }

            return Supplier::query()->create([
                'supplier_code' => $data['supplier_code'] ?? $this->nextSupplierCode(),
                'name' => $name,
                'phone' => $data['phone'] ?? null,
                'email' => $data['email'] ?? null,
                'address' => $data['address'] ?? null,
                'company_name' => $data['company_name'] ?? $name,
                'contact_person' => $data['contact_person'] ?? $data['contact'] ?? null,
                'products_supplied' => $data['products_supplied'] ?? null,
                'status' => $data['status'] ?? 'Active',
                'outstanding' => (float) ($data['outstanding'] ?? 0),
                'notes' => $data['notes'] ?? null,
            ]);
        });
    }

    /**
     * @throws ValidationException|Throwable
     */
    public function update(Supplier $supplier, array $data): Supplier
    {
        return DB::transaction(function () use ($supplier, $data) {
            if (array_key_exists('name', $data)) {
                $name = trim((string) $data['name']);
                if ($name === '') {
                    throw ValidationException::withMessages([
                        'name' => ['Supplier name is required.'],
                    ]);
                }
                $supplier->name = $name;
            }
            foreach (['phone', 'email', 'address', 'company_name', 'products_supplied', 'notes', 'status'] as $field) {
                if (array_key_exists($field, $data)) {
                    $supplier->{$field} = $data[$field];
                }
            }
            if (array_key_exists('contact_person', $data) || array_key_exists('contact', $data)) {
                $supplier->contact_person = $data['contact_person'] ?? $data['contact'] ?? null;
            }
            if (array_key_exists('outstanding', $data)) {
                $supplier->outstanding = (float) $data['outstanding'];
            }
            if (array_key_exists('supplier_code', $data) && $data['supplier_code']) {
                $supplier->supplier_code = $data['supplier_code'];
            }
            $supplier->save();

            return $supplier->fresh();
        });
    }

    /**
     * Soft-deactivate when referenced; otherwise hard delete.
     *
     * @throws ValidationException|Throwable
     */
    public function delete(Supplier $supplier): array
    {
        return DB::transaction(function () use ($supplier) {
            $productCount = Product::query()->where('supplier_id', $supplier->id)->count();
            $expenseCount = Expense::query()->where('supplier_id', $supplier->id)->count();
            $purchaseCount = $supplier->purchases()->count();

            if ($productCount > 0 || $expenseCount > 0) {
                $supplier->status = 'Inactive';
                $supplier->save();

                return [
                    'deactivated' => true,
                    'supplier' => $supplier->fresh(),
                    'message' => 'Supplier is linked to products or expenses and was deactivated instead of deleted.',
                ];
            }
            if ($purchaseCount > 0) {
                $supplier->status = 'Inactive';
                $supplier->save();

                return [
                    'deactivated' => true,
                    'supplier' => $supplier->fresh(),
                    'message' => 'Supplier has purchase records and was deactivated instead of deleted.',
                ];
            }

            $supplier->delete();

            return [
                'deactivated' => false,
                'supplier' => null,
                'message' => 'Supplier deleted successfully.',
            ];
        });
    }
}
