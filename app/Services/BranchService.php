<?php

namespace App\Services;

use App\Models\Branch;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

class BranchService
{
    /** Tables that reference branches through branch_id. */
    private const BRANCHED_TABLES = [
        'products' => 'product',
        'sales' => 'sale',
        'rentals' => 'rental',
        'bookings' => 'booking',
        'expenses' => 'expense',
        'income' => 'income record',
        'users' => 'user',
    ];

    public function transform(Branch $branch): array
    {
        return [
            'id' => $branch->id,
            'name' => $branch->name,
            'code' => $branch->code,
            'address' => $branch->address,
            'phone' => $branch->phone,
            'status' => $branch->status,
            'created_at' => optional($branch->created_at)?->toIso8601String(),
            'updated_at' => optional($branch->updated_at)?->toIso8601String(),
        ];
    }

    /**
     * @throws Throwable
     */
    public function create(array $data): Branch
    {
        return DB::transaction(fn () => Branch::query()->create([
            'name' => trim((string) $data['name']),
            'code' => $this->clean($data['code'] ?? null),
            'address' => $this->clean($data['address'] ?? null),
            'phone' => $this->clean($data['phone'] ?? null),
            'status' => $data['status'] ?? 'Active',
        ]));
    }

    /**
     * @throws Throwable
     */
    public function update(Branch $branch, array $data): Branch
    {
        return DB::transaction(function () use ($branch, $data) {
            if (array_key_exists('name', $data)) {
                $branch->name = trim((string) $data['name']);
            }
            foreach (['code', 'address', 'phone'] as $field) {
                if (array_key_exists($field, $data)) {
                    $branch->{$field} = $this->clean($data[$field]);
                }
            }
            if (! empty($data['status'])) {
                $branch->status = $data['status'];
            }
            $branch->save();

            return $branch->fresh();
        });
    }

    /**
     * @throws ValidationException|Throwable
     */
    public function delete(Branch $branch): void
    {
        DB::transaction(function () use ($branch) {
            $usage = [];
            foreach (self::BRANCHED_TABLES as $table => $label) {
                $count = DB::table($table)->where('branch_id', $branch->id)->count();
                if ($count > 0) {
                    $usage[] = "{$count} {$label}(s)";
                }
            }

            if ($usage) {
                throw ValidationException::withMessages([
                    'branch' => [
                        'Cannot delete this branch because it is used by '.implode(', ', $usage).'. Mark it Inactive instead.',
                    ],
                ]);
            }

            $branch->delete();
        });
    }

    private function clean(mixed $value): ?string
    {
        $value = trim((string) ($value ?? ''));

        return $value === '' ? null : $value;
    }
}
