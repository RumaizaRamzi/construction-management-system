<?php

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';

use App\Models\Customer;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\Request;

$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$user = User::query()->where('email', 'admin@buildtrack.local')->first();
$token = $user->createToken('sale-kernel-test')->plainTextToken;
$customer = Customer::query()->first();
$product = Product::query()->where('available_quantity', '>', 1)->orderByDesc('available_quantity')->first();
$before = (int) $product->fresh()->available_quantity;

$payload = [
    'customer_id' => $customer->id,
    'sale_date' => date('Y-m-d'),
    'items' => [
        [
            'product_id' => $product->id,
            'quantity' => 1,
            'unit_price' => (float) ($product->sale_price ?: 1500),
            'discount' => 0,
        ],
    ],
    'discount' => 0,
    'tax_rate' => 0,
    'paid_amount' => (float) ($product->sale_price ?: 1500),
    'payment_method' => 'Cash',
    'sale_status' => 'Completed',
];

$request = Request::create('/api/sales', 'POST', $payload);
$request->headers->set('Accept', 'application/json');
$request->headers->set('Authorization', 'Bearer '.$token);

$response = $kernel->handle($request);
$body = json_decode($response->getContent(), true);
echo 'POST /api/sales => '.$response->getStatusCode()."\n";
echo json_encode($body, JSON_PRETTY_PRINT)."\n";
$saleId = $body['data']['id'] ?? null;
$product->refresh();
echo "stock {$before} -> {$product->available_quantity}\n";

if ($saleId) {
    $showReq = Request::create("/api/sales/{$saleId}", 'GET');
    $showReq->headers->set('Accept', 'application/json');
    $showReq->headers->set('Authorization', 'Bearer '.$token);
    $showRes = $kernel->handle($showReq);
    echo 'GET /api/sales/{id} => '.$showRes->getStatusCode()."\n";

    // Edit qty 1 -> 2
    $editPayload = $payload;
    $editPayload['items'][0]['quantity'] = 2;
    $editPayload['paid_amount'] = (float) ($product->sale_price ?: 1500) * 2;
    $editReq = Request::create("/api/sales/{$saleId}", 'PUT', $editPayload);
    $editReq->headers->set('Accept', 'application/json');
    $editReq->headers->set('Authorization', 'Bearer '.$token);
    $editRes = $kernel->handle($editReq);
    $product->refresh();
    echo 'PUT /api/sales/{id} => '.$editRes->getStatusCode()." stock={$product->available_quantity} expected=".($before - 2)."\n";

    $delReq = Request::create("/api/sales/{$saleId}", 'DELETE');
    $delReq->headers->set('Accept', 'application/json');
    $delReq->headers->set('Authorization', 'Bearer '.$token);
    $delRes = $kernel->handle($delReq);
    $product->refresh();
    echo 'DELETE /api/sales/{id} => '.$delRes->getStatusCode()." status=".json_decode($delRes->getContent(), true)['data']['sale_status']." stock={$product->available_quantity} expected={$before}\n";
}

// Validation: missing customer
$bad = Request::create('/api/sales', 'POST', ['items' => [['product_id' => $product->id, 'quantity' => 1]]]);
$bad->headers->set('Accept', 'application/json');
$bad->headers->set('Authorization', 'Bearer '.$token);
$badRes = $kernel->handle($bad);
echo 'POST missing customer => '.$badRes->getStatusCode()."\n";

$user->tokens()->where('name', 'sale-kernel-test')->delete();
echo "DONE\n";
