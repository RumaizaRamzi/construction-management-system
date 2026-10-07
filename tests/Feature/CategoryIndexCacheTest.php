<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CategoryIndexCacheTest extends TestCase
{
    use RefreshDatabase;

    public function test_cached_first_page_still_returns_categories(): void
    {
        config([
            'cache.stores.array.serialize' => true,
            'cache.serializable_classes' => false,
        ]);
        Cache::forgetDriver('array');

        $this->seed(RolesAndPermissionsSeeder::class);
        Sanctum::actingAs(User::query()->where('email', 'admin@buildtrack.local')->firstOrFail());

        Category::query()->create(['name' => 'Power Tools', 'status' => 'Active']);
        Category::query()->create(['name' => 'Ladders', 'status' => 'Active']);

        foreach ([1, 2] as $_) {
            $this->getJson('/api/categories?per_page=100&page=1')
                ->assertOk()
                ->assertJsonCount(2, 'data.data')
                ->assertJsonPath('data.total', 2)
                ->assertJsonPath('data.data.0.name', 'Ladders');
        }
    }
}
