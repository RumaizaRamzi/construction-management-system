<?php

require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Customer;
use App\Models\Product;
use App\Models\Sale;
use App\Models\StockMovement;
use App\Models\User;
use App\Services\SaleService;
use Illuminate\Support\Facades\Auth;

$user = User::query()->where('email', 'admin@buildtrack.local')->first();
if (! $user) {
    fwrite(STDERR, "Admin user missing\n");
    exit(1);
}
Auth::login($user);

$customer = Customer::query()->where('status', 'Active')->first();
$product = Product::query()->where('available_quantity', '>', 2)->orderBy('id')->first();

if (! $customer || ! $product) {
    fwrite(STDERR, "Need active customer and product with stock\n");
    exit(1);
}

$before = (int) $product->available_quantity;
echo "Customer #{$customer->id} {$customer->name}\n";
echo "Product #{$product->id} {$product->name} available={$before}\n";

$service = app(SaleService::class);

$sale = $service->create([
    'customer_id' => $customer->id,
    'sale_date' => now()->toDateString(),
    'items' => [
        [
            'product_id' => $product->id,
            'quantity' => 2,
            'unit_price' => (float) ($product->sale_price ?: 1000),
            'discount' => 0,
        ],
    ],
    'discount' => 0,
    'tax_rate' => 0,
    'paid_amount' => 500,
    'payment_method' => 'Cash',
    'sale_status' => 'Completed',
    'notes' => 'Automated sales persistence test',
]);

$product->refresh();
$after = (int) $product->available_quantity;
$movements = StockMovement::query()->where('reference_id', $sale->id)->count();

echo "Created sale #{$sale->id} {$sale->invoice_number}\n";
echo "Total={$sale->total_amount} Paid={$sale->paid_amount} Balance={$sale->balance} Status={$sale->payment_status}\n";
echo "Stock before={$before} after={$after} expected=".($before - 2)."\n";
echo "Stock movements={$movements}\n";

// Insufficient stock should fail
try {
    $service->create([
        'customer_id' => $customer->id,
        'items' => [
            [
                'product_id' => $product->id,
                'quantity' => 999999,
                'unit_price' => 100,
            ],
        ],
        'paid_amount' => 0,
        'sale_status' => 'Completed',
    ]);
    echo "FAIL: oversell was allowed\n";
    exit(1);
} catch (Illuminate\Validation\ValidationException $e) {
    echo "OK: oversell rejected\n";
}

// Cancel restores stock
$cancelled = $service->cancel($sale);
$product->refresh();
echo "Cancelled status={$cancelled->sale_status} stock after cancel={$product->available_quantity} expected={$before}\n";

$saleCount = Sale::query()->count();
echo "Sales in DB={$saleCount}\n";
echo "DONE\n";
