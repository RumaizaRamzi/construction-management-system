<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class CustomerController extends Controller
{
    private const ID_PHOTO_DISK = 'local';

    private const ID_PHOTO_DIRECTORY = 'customer-id-photos';

    public function index(Request $request): JsonResponse
    {
        $perPage = min(100, max(1, (int) $request->query('per_page', 50)));

        $customers = Customer::query()
            ->withSum('sales as sales_total', 'total_amount')
            ->withSum('sales as sales_balance', 'balance')
            ->withSum('rentals as rentals_balance', 'balance')
            ->withCount('rentals as rentals_count')
            ->orderBy('name')
            ->paginate($perPage)
            ->through(fn (Customer $customer) => $this->transformCustomer($customer));

        return $this->success($customers, 'Customers retrieved successfully.');
    }

    public function show(Customer $customer): JsonResponse
    {
        $customer->loadCount('rentals as rentals_count');
        $customer->loadSum('sales as sales_total', 'total_amount');
        $customer->loadSum('sales as sales_balance', 'balance');
        $customer->loadSum('rentals as rentals_balance', 'balance');

        return $this->success(
            $this->transformCustomer($customer),
            'Customer retrieved successfully.'
        );
    }

    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), $this->rules());

        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        $data = $validator->validated();
        $data['customer_code'] = $data['customer_code'] ?? $this->nextCustomerCode();
        $data['customer_type'] = $data['customer_type'] ?? 'Company';
        $data['status'] = $data['status'] ?? 'Active';
        $data['company_name'] = $data['company_name'] ?? $data['name'];

        $customer = Customer::query()->create($data);

        return $this->success(
            $this->transformCustomer($customer->fresh()),
            'Customer created successfully.',
            201
        );
    }

    public function update(Request $request, Customer $customer): JsonResponse
    {
        $validator = Validator::make($request->all(), $this->rules($customer->id));

        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        $data = $validator->validated();
        if (empty($data['company_name'])) {
            $data['company_name'] = $data['name'] ?? $customer->name;
        }

        $customer->update($data);

        $customer->loadCount('rentals as rentals_count');
        $customer->loadSum('sales as sales_total', 'total_amount');
        $customer->loadSum('sales as sales_balance', 'balance');
        $customer->loadSum('rentals as rentals_balance', 'balance');

        return $this->success(
            $this->transformCustomer($customer->fresh()),
            'Customer updated successfully.'
        );
    }

    public function destroy(Customer $customer): JsonResponse
    {
        try {
            if ($customer->hasRelatedTransactions()) {
                $customer->update(['status' => 'Inactive']);

                $customer->loadCount('rentals as rentals_count');
                $customer->loadSum('sales as sales_total', 'total_amount');
                $customer->loadSum('sales as sales_balance', 'balance');
                $customer->loadSum('rentals as rentals_balance', 'balance');

                return $this->success(
                    $this->transformCustomer($customer->fresh()),
                    'This customer cannot be deleted because related transactions already exist. The customer was set to Inactive instead.',
                    200
                );
            }

            $photoPath = $customer->id_photo_path;
            $customer->delete();
            if ($photoPath) {
                Storage::disk(self::ID_PHOTO_DISK)->delete($photoPath);
            }

            return $this->success(null, 'Customer deleted successfully.');
        } catch (Throwable $e) {
            report($e);

            return $this->error(
                'This customer cannot be deleted because related transactions already exist.',
                409
            );
        }
    }

    public function showIdPhoto(Customer $customer): Response
    {
        $disk = Storage::disk(self::ID_PHOTO_DISK);
        if (! $customer->id_photo_path || ! $disk->exists($customer->id_photo_path)) {
            return $this->error('No ID photo has been uploaded for this customer.', 404);
        }

        return $disk->response($customer->id_photo_path, 'customer-'.$customer->id.'-id-photo', [
            'Cache-Control' => 'private, no-store, max-age=0',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function uploadIdPhoto(Request $request, Customer $customer): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'id_photo' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ], [
            'id_photo.image' => 'The ID photo must be an image (JPG, PNG or WEBP).',
            'id_photo.mimes' => 'The ID photo must be a JPG, PNG or WEBP image.',
            'id_photo.max' => 'The ID photo must not be larger than 5 MB.',
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        $disk = Storage::disk(self::ID_PHOTO_DISK);
        $newPath = $request->file('id_photo')->store(self::ID_PHOTO_DIRECTORY, self::ID_PHOTO_DISK);
        if (! $newPath) {
            return $this->error('Unable to store the ID photo. Please try again.', 500);
        }

        $oldPath = $customer->id_photo_path;
        $customer->id_photo_path = $newPath;
        $customer->save();
        if ($oldPath && $oldPath !== $newPath) {
            $disk->delete($oldPath);
        }

        return $this->success($this->freshTransformed($customer), 'ID photo uploaded successfully.');
    }

    public function destroyIdPhoto(Customer $customer): JsonResponse
    {
        if ($customer->id_photo_path) {
            Storage::disk(self::ID_PHOTO_DISK)->delete($customer->id_photo_path);
            $customer->id_photo_path = null;
            $customer->save();
        }

        return $this->success($this->freshTransformed($customer), 'ID photo removed successfully.');
    }

    private function freshTransformed(Customer $customer): array
    {
        $customer = $customer->fresh();
        $customer->loadCount('rentals as rentals_count');
        $customer->loadSum('sales as sales_total', 'total_amount');
        $customer->loadSum('sales as sales_balance', 'balance');
        $customer->loadSum('rentals as rentals_balance', 'balance');

        return $this->transformCustomer($customer);
    }

    private function rules(?int $customerId = null): array
    {
        return [
            'customer_code' => [
                'sometimes',
                'nullable',
                'string',
                'max:50',
                Rule::unique('customers', 'customer_code')->ignore($customerId),
            ],
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string', 'max:500'],
            'city' => ['nullable', 'string', 'max:100'],
            'company_name' => ['nullable', 'string', 'max:255'],
            'customer_type' => ['nullable', Rule::in(['Individual', 'Company'])],
            'status' => ['nullable', Rule::in(['Active', 'Inactive'])],
            'notes' => ['nullable', 'string', 'max:2000'],
            'id_number' => ['nullable', 'string', 'max:100'],
        ];
    }

    private function nextCustomerCode(): string
    {
        $latest = Customer::query()
            ->where('customer_code', 'like', 'CUST-%')
            ->orderByDesc('id')
            ->value('customer_code');

        $next = 1;
        if ($latest && preg_match('/CUST-(\d+)/', $latest, $matches)) {
            $next = ((int) $matches[1]) + 1;
        }

        return 'CUST-'.str_pad((string) $next, 3, '0', STR_PAD_LEFT);
    }

    private function transformCustomer(Customer $customer): array
    {
        $salesTotal = (float) ($customer->sales_total ?? 0);
        $salesBalance = (float) ($customer->sales_balance ?? 0);
        $rentalsBalance = (float) ($customer->rentals_balance ?? 0);
        $rentalsCount = (int) ($customer->rentals_count ?? 0);

        return [
            'id' => $customer->id,
            'customer_code' => $customer->customer_code,
            'name' => $customer->name,
            'phone' => $customer->phone,
            'email' => $customer->email,
            'address' => $customer->address,
            'city' => $customer->city,
            'company_name' => $customer->company_name,
            'customer_type' => $customer->customer_type ?: 'Company',
            'status' => $customer->status ?: 'Active',
            'notes' => $customer->notes,
            'id_number' => $customer->id_number,
            'has_id_photo' => (bool) $customer->id_photo_path,
            'total_purchases' => $salesTotal,
            'total_rentals' => $rentalsCount,
            'pending_payment' => max(0, $salesBalance + $rentalsBalance),
            'created_at' => $customer->created_at,
            'updated_at' => $customer->updated_at,
        ];
    }
}
