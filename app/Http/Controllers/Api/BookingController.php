<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Services\BookingService;
use App\Services\RentalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Throwable;

class BookingController extends Controller
{
    public function __construct(
        private readonly BookingService $bookings,
        private readonly RentalService $rentals
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $perPage = min(100, max(1, (int) $request->query('per_page', 50)));

        $query = Booking::query()
            ->with([
                'customer:id,name,customer_code,phone,email,address',
                'items.product:id,serial_number,name,image,category_id',
                'items.product.category:id,name',
                'rental:id,rental_number,status',
            ])
            ->orderByDesc('booking_date')
            ->orderByDesc('id');

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('booking_number', 'like', "%{$search}%")
                    ->orWhere('notes', 'like', "%{$search}%")
                    ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('items.product', fn ($p) => $p->where('name', 'like', "%{$search}%"));
            });
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($paymentStatus = $request->query('payment_status')) {
            $query->where('payment_status', $paymentStatus);
        }

        if ($customerId = $request->query('customer_id')) {
            $query->where('customer_id', $customerId);
        }

        if ($from = $request->query('start_date_from')) {
            $query->whereDate('start_date', '>=', $from);
        }
        if ($to = $request->query('start_date_to')) {
            $query->whereDate('start_date', '<=', $to);
        }

        $page = $query->paginate($perPage)->through(fn (Booking $b) => $this->bookings->transform($b));

        return $this->success($page, 'Bookings retrieved successfully.');
    }

    public function show(Booking $booking): JsonResponse
    {
        return $this->success(
            $this->bookings->transform($booking),
            'Booking retrieved successfully.'
        );
    }

    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'customer_id' => ['required', 'integer', 'exists:customers,id'],
            'booking_date' => ['nullable', 'date'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'items' => ['nullable', 'array', 'min:1'],
            'items.*.product_id' => ['required_with:items', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['required_with:items', 'integer', 'min:1'],
            'items.*.rental_rate' => ['nullable', 'numeric', 'min:0'],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'quantity' => ['nullable', 'integer', 'min:1'],
            'rental_rate' => ['nullable', 'numeric', 'min:0'],
            'rate' => ['nullable', 'numeric', 'min:0'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'deposit' => ['nullable', 'numeric', 'min:0'],
            'deposit_amount' => ['nullable', 'numeric', 'min:0'],
            'paid_amount' => ['nullable', 'numeric', 'min:0'],
            'payment_amount' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', 'string', 'max:50'],
            'booking_status' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
            'booking_number' => ['nullable', 'string', 'max:50', 'unique:bookings,booking_number'],
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        try {
            $booking = $this->bookings->create($validator->validated());

            return $this->success(
                $this->bookings->transform($booking),
                'Booking created successfully.',
                201
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to create booking. Please try again.', 500);
        }
    }

    public function update(Request $request, Booking $booking): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'customer_id' => ['sometimes', 'integer', 'exists:customers,id'],
            'booking_date' => ['nullable', 'date'],
            'start_date' => ['sometimes', 'date'],
            'end_date' => ['sometimes', 'date'],
            'items' => ['nullable', 'array', 'min:1'],
            'items.*.product_id' => ['required_with:items', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['required_with:items', 'integer', 'min:1'],
            'items.*.rental_rate' => ['nullable', 'numeric', 'min:0'],
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'quantity' => ['nullable', 'integer', 'min:1'],
            'rental_rate' => ['nullable', 'numeric', 'min:0'],
            'rate' => ['nullable', 'numeric', 'min:0'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'deposit' => ['nullable', 'numeric', 'min:0'],
            'deposit_amount' => ['nullable', 'numeric', 'min:0'],
            'paid_amount' => ['nullable', 'numeric', 'min:0'],
            'payment_amount' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', 'string', 'max:50'],
            'booking_status' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        try {
            $updated = $this->bookings->update($booking, $validator->validated());

            return $this->success(
                $this->bookings->transform($updated),
                'Booking updated successfully.'
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to update booking. Please try again.', 500);
        }
    }

    public function destroy(Booking $booking): JsonResponse
    {
        try {
            $this->bookings->delete($booking);

            return $this->success(null, 'Booking deleted successfully.');
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to delete booking. Please try again.', 500);
        }
    }

    public function updateStatus(Request $request, Booking $booking): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'status' => ['required', 'string', 'max:50'],
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        try {
            $updated = $this->bookings->updateStatus($booking, $validator->validated()['status']);

            return $this->success(
                $this->bookings->transform($updated),
                'Booking status updated successfully.'
            );
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to update booking status. Please try again.', 500);
        }
    }

    public function convertToRental(Request $request, Booking $booking): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'payment_method' => ['nullable', 'string', 'max:100'],
            'rental_status' => ['nullable', 'string', 'max:50'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'expected_return_date' => ['nullable', 'date'],
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        try {
            $result = $this->bookings->convertToRental($booking, $validator->validated());

            return $this->success([
                'booking' => $this->bookings->transform($result['booking']),
                'rental' => $this->rentals->transform($result['rental']),
            ], 'Booking converted to rental successfully.');
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to convert booking to rental. Please try again.', 500);
        }
    }

    public function availability(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'exclude_booking_id' => ['nullable', 'integer'],
        ]);

        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        $data = $validator->validated();

        try {
            $snap = $this->bookings->checkAvailability(
                (int) $data['product_id'],
                $data['start_date'],
                $data['end_date'],
                isset($data['exclude_booking_id']) ? (int) $data['exclude_booking_id'] : null
            );

            return $this->success($snap, 'Availability retrieved successfully.');
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to check availability. Please try again.', 500);
        }
    }
}
