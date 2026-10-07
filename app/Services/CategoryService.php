<?php

namespace App\Services;

use App\Models\Category;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

class CategoryService
{
    public function transform(Category $category): array
    {
        return [
            'id' => $category->id,
            'name' => $category->name,
            'description' => $category->description,
            'status' => $category->status,
            'products_count' => (int) ($category->products_count ?? $category->products()->count()),
            'created_at' => optional($category->created_at)?->toIso8601String(),
            'updated_at' => optional($category->updated_at)?->toIso8601String(),
        ];
    }

    /**
     * @throws ValidationException|Throwable
     */
    public function create(array $data): Category
    {
        return DB::transaction(function () use ($data) {
            $name = trim((string) ($data['name'] ?? ''));
            if ($name === '') {
                throw ValidationException::withMessages([
                    'name' => ['Category name is required.'],
                ]);
            }

            $category = Category::query()->create([
                'name' => $name,
                'description' => $data['description'] ?? null,
                'status' => $data['status'] ?? 'Active',
            ]);

            Cache::forget('categories.index.first');

            return $category;
        });
    }

    /**
     * @throws ValidationException|Throwable
     */
    public function update(Category $category, array $data): Category
    {
        return DB::transaction(function () use ($category, $data) {
            if (array_key_exists('name', $data)) {
                $name = trim((string) $data['name']);
                if ($name === '') {
                    throw ValidationException::withMessages([
                        'name' => ['Category name is required.'],
                    ]);
                }
                $category->name = $name;
            }
            if (array_key_exists('description', $data)) {
                $category->description = $data['description'];
            }
            if (array_key_exists('status', $data) && $data['status']) {
                $category->status = $data['status'];
            }
            $category->save();
            Cache::forget('categories.index.first');

            return $category->fresh();
        });
    }

    /**
     * @throws ValidationException|Throwable
     */
    public function delete(Category $category): void
    {
        DB::transaction(function () use ($category) {
            $count = $category->products()->count();
            if ($count > 0) {
                throw ValidationException::withMessages([
                    'category' => [
                        "Cannot delete this category because {$count} product(s) still use it. Reassign or remove those products first.",
                    ],
                ]);
            }
            $category->delete();
            Cache::forget('categories.index.first');
        });
    }
}
