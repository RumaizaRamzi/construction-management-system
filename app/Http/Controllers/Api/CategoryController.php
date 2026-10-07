<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Categories\StoreCategoryRequest;
use App\Http\Requests\Categories\UpdateCategoryRequest;
use App\Models\Category;
use App\Services\CategoryService;
use App\Support\QuerySafety;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;
use Throwable;

class CategoryController extends Controller
{
    public function __construct(private readonly CategoryService $categories)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $perPage = QuerySafety::perPage($request->query('per_page'), 50, 100);

        if ((int) $request->query('page', 1) === 1 && $perPage >= 50 && ! $request->query('search')) {
            $categories = Cache::remember('categories.index.first', now()->addMinutes(5), function () use ($perPage) {
                return Category::query()
                    ->withCount('products')
                    ->orderBy('name')
                    ->paginate($perPage)
                    ->through(fn (Category $c) => $this->categories->transform($c))
                    ->toArray();
            });

            return $this->success($categories, 'Categories retrieved successfully.');
        }

        $query = Category::query()->withCount('products')->orderBy('name');

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        $page = $query->paginate($perPage)->through(
            fn (Category $c) => $this->categories->transform($c)
        );

        return $this->success($page, 'Categories retrieved successfully.');
    }

    public function show(Category $category): JsonResponse
    {
        $category->loadCount('products');

        return $this->success(
            $this->categories->transform($category),
            'Category retrieved successfully.'
        );
    }

    public function store(StoreCategoryRequest $request): JsonResponse
    {
        try {
            $category = $this->categories->create($request->validated());
            $category->loadCount('products');

            return $this->success(
                $this->categories->transform($category),
                'Category created successfully.',
                201
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to create category. Please try again.', 500);
        }
    }

    public function update(UpdateCategoryRequest $request, Category $category): JsonResponse
    {
        try {
            $updated = $this->categories->update($category, $request->validated());
            $updated->loadCount('products');

            return $this->success(
                $this->categories->transform($updated),
                'Category updated successfully.'
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to update category. Please try again.', 500);
        }
    }

    public function destroy(Category $category): JsonResponse
    {
        try {
            $this->categories->delete($category);

            return $this->success(null, 'Category deleted successfully.');
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to delete category. Please try again.', 500);
        }
    }
}
