<?php

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Category;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\User;
use App\Services\ProductService;
use App\Services\SaleService;
use App\Services\StockMovementService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

$user = User::query()->where('email', 'admin@buildtrack.local')->firstOrFail();
Auth::login($user);
$token = $user->createToken('phase23-test')->plainTextToken;

function api(Illuminate\Contracts\Http\Kernel $kernel, string $method, string $uri, string $token, array $data = []): array
{
    $request = Request::create($uri, $method, $data);
    $request->headers->set('Accept', 'application/json');
    $request->headers->set('Authorization', 'Bearer '.$token);
    $response = $kernel->handle($request);

    return [
        'status' => $response->getStatusCode(),
        'body' => json_decode($response->getContent(), true),
    ];
}

echo "=== Category CRUD ===\n";
$catRes = api($kernel, 'POST', '/api/categories', $token, [
    'name' => 'Phase23 Test Cat '.uniqid(),
    'description' => 'Automated test',
]);
echo "Create category => {$catRes['status']}\n";
$catId = $catRes['body']['data']['id'] ?? null;
if (! $catId) {
    echo json_encode($catRes['body'])."\n";
    exit(1);
}

echo "=== Supplier CRUD ===\n";
$supRes = api($kernel, 'POST', '/api/suppliers', $token, [
    'name' => 'Phase23 Supplier '.uniqid(),
    'contact_person' => 'Test Contact',
    'phone' => '+94 11 000 0000',
    'email' => 'phase23@example.com',
]);
echo "Create supplier => {$supRes['status']}\n";
$supId = $supRes['body']['data']['id'] ?? null;

echo "=== Product CRUD ===\n";
$serialNumber = 'P23-'.strtoupper(substr(uniqid(), -6));
$prodRes = api($kernel, 'POST', '/api/products', $token, [
    'name' => 'Phase23 Test Product',
    'serial_number' => $serialNumber,
    'category_id' => $catId,
    'supplier_id' => $supId,
    'quantity' => 10,
    'minimum_stock' => 2,
    'purchase_price' => 1000,
    'sale_price' => 1500,
    'rental_price' => 100,
    'condition' => 'New',
    'status' => 'Available',
    'unit' => 'Unit',
]);
echo "Create product => {$prodRes['status']} serial_number={$serialNumber}\n";
$productId = $prodRes['body']['data']['id'] ?? null;
if (! $productId) {
    echo json_encode($prodRes['body'])."\n";
    exit(1);
}
$available = (int) ($prodRes['body']['data']['available_quantity'] ?? 0);
echo "Available after create={$available}\n";

$movements = StockMovement::query()->where('product_id', $productId)->count();
echo "Opening stock movements={$movements}\n";

$adj = api($kernel, 'POST', "/api/products/{$productId}/adjust-stock", $token, [
    'quantity_delta' => 5,
    'reason' => 'Phase23 restock test',
    'movement_type' => 'RESTOCK',
]);
echo "Adjust +5 => {$adj['status']} available=".($adj['body']['data']['available_quantity'] ?? '?')."\n";

$neg = api($kernel, 'POST', "/api/products/{$productId}/adjust-stock", $token, [
    'quantity_delta' => -9999,
    'reason' => 'Should fail',
]);
echo "Adjust -9999 => {$neg['status']} (expect 422)\n";

$blockCat = api($kernel, 'DELETE', "/api/categories/{$catId}", $token);
echo "Delete used category => {$blockCat['status']} (expect 422)\n";

echo "=== Sales regression ===\n";
$customerId = \App\Models\Customer::query()->value('id');
$saleService = app(SaleService::class);
$beforeSale = (int) Product::query()->find($productId)->available_quantity;
$sale = $saleService->create([
    'customer_id' => $customerId,
    'items' => [['product_id' => $productId, 'quantity' => 2, 'unit_price' => 1500]],
    'paid_amount' => 3000,
    'payment_method' => 'Cash',
    'sale_status' => 'Completed',
]);
$afterSale = (int) Product::query()->find($productId)->available_quantity;
echo "Sale {$sale->invoice_number}: stock {$beforeSale} -> {$afterSale}\n";
$saleMoves = StockMovement::query()->where('product_id', $productId)->where('movement_type', 'SALE')->count();
echo "SALE movements={$saleMoves}\n";

$saleService->cancel($sale);
$afterCancel = (int) Product::query()->find($productId)->available_quantity;
echo "After cancel stock={$afterCancel} (expect {$beforeSale})\n";

$list = api($kernel, 'GET', '/api/stock-movements?per_page=5', $token);
echo "Stock movements list => {$list['status']} rows=".count($list['body']['data']['data'] ?? $list['body']['data'] ?? [])."\n";

// cleanup product (deactivate if needed)
api($kernel, 'DELETE', "/api/products/{$productId}", $token);
echo "DONE\n";

$user->tokens()->where('name', 'phase23-test')->delete();
