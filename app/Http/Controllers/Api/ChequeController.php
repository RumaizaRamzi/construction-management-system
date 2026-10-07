<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Cheque;
use App\Models\Customer;
use App\Models\Supplier;
use App\Services\ChequeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

class ChequeController extends Controller
{
    public function __construct(private readonly ChequeService $cheques)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $sort = $request->query('sort') === 'oldest' ? 'asc' : ($request->query('sort') === 'newest' ? 'desc' : null);

        $query = $this->cheques->filtered($request);
        $sort
            ? $query->orderBy('cheque_date', $sort)->orderBy('id', $sort)
            : $query->orderByRaw("CASE WHEN status = 'Pending' THEN 0 WHEN status = 'Deposited' THEN 1 ELSE 2 END")
                ->orderBy('cheque_date')->orderBy('id');

        $page = $query->paginate($perPage)->through(fn (Cheque $c) => $this->cheques->transform($c));

        return $this->success($page, 'Cheques retrieved successfully.');
    }

    public function summary(): JsonResponse
    {
        return $this->success([
            ...$this->cheques->summary(),
            'statuses' => Cheque::STATUSES,
            'types' => Cheque::TYPES,
            'customers' => Customer::query()->orderBy('name')->get(['id', 'name']),
            'suppliers' => Supplier::query()->orderBy('name')->get(['id', 'name']),
        ], 'Cheque summary retrieved successfully.');
    }

    public function show(Cheque $cheque): JsonResponse
    {
        return $this->success(
            $this->cheques->transform($cheque->load(['customer', 'supplier', 'creator'])),
            'Cheque retrieved successfully.'
        );
    }

    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), $this->rules(), $this->messages());
        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        return $this->guard(function () use ($validator) {
            $cheque = $this->cheques->create($validator->validated());

            return $this->success($this->cheques->transform($cheque), 'Cheque added successfully.', 201);
        }, 'Unable to add cheque. Please try again.');
    }

    public function update(Request $request, Cheque $cheque): JsonResponse
    {
        $validator = Validator::make($request->all(), $this->rules($cheque), $this->messages());
        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        return $this->guard(function () use ($cheque, $validator) {
            $updated = $this->cheques->update($cheque, $validator->validated());

            return $this->success($this->cheques->transform($updated), 'Cheque updated successfully.');
        }, 'Unable to update cheque. Please try again.');
    }

    public function updateStatus(Request $request, Cheque $cheque): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'status' => ['required', Rule::in(Cheque::STATUSES)],
            'note' => ['nullable', 'string', 'max:500'],
        ], [
            'status.required' => 'Please choose the new cheque status.',
            'status.in' => 'Cheque status must be Pending, Deposited, Cleared or Bounced.',
        ]);
        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        return $this->guard(function () use ($cheque, $validator) {
            $data = $validator->validated();
            $updated = $this->cheques->updateStatus($cheque, $data['status'], $data['note'] ?? null);

            return $this->success($this->cheques->transform($updated), "Cheque marked as {$updated->status}.");
        }, 'Unable to update cheque status. Please try again.');
    }

    public function destroy(Cheque $cheque): JsonResponse
    {
        return $this->guard(function () use ($cheque) {
            $this->cheques->delete($cheque);

            return $this->success(null, 'Cheque deleted successfully.');
        }, 'Unable to delete cheque. Please try again.');
    }

    public function linkOptions(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'type' => ['required', Rule::in(array_keys(Cheque::REFERENCE_TYPES))],
            'search' => ['nullable', 'string', 'max:100'],
        ]);
        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        return $this->success(
            $this->cheques->linkOptions($request->query('type'), trim((string) $request->query('search', ''))),
            'Link options retrieved successfully.'
        );
    }

    public function report(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'status' => ['nullable', Rule::in([...Cheque::STATUSES, 'Overdue', 'all'])],
            'type' => ['nullable', Rule::in([...Cheque::TYPES, 'all'])],
            'customer_id' => ['nullable', 'integer'],
            'supplier_id' => ['nullable', 'integer'],
        ], ['to.after_or_equal' => 'The end date must be on or after the start date.']);
        if ($validator->fails()) {
            return $this->error('Validation failed.', 422, $validator->errors());
        }

        return $this->success($this->cheques->report($request), 'Cheque report retrieved successfully.');
    }

    private function rules(?Cheque $cheque = null): array
    {
        $required = $cheque ? ['sometimes', 'required'] : ['required'];

        return [
            'cheque_number' => [...$required, 'string', 'max:50'],
            'bank' => [...$required, 'string', 'max:100'],
            'amount' => [...$required, 'numeric', 'min:0.01', 'max:999999999999'],
            'cheque_date' => [...$required, 'date'],
            'type' => [...$required, Rule::in(Cheque::TYPES)],
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'supplier_id' => ['nullable', 'integer', 'exists:suppliers,id'],
            'status' => ['nullable', Rule::in(Cheque::STATUSES)],
            'notes' => ['nullable', 'string', 'max:2000'],
            'reference_type' => ['nullable', Rule::in(array_keys(Cheque::REFERENCE_TYPES))],
            'reference_id' => ['nullable', 'integer', 'required_with:reference_type'],
        ];
    }

    private function messages(): array
    {
        return [
            'cheque_number.required' => 'Please enter the cheque number.',
            'bank.required' => 'Please enter the bank name.',
            'amount.required' => 'Please enter the cheque amount.',
            'amount.min' => 'The cheque amount must be greater than zero.',
            'cheque_date.required' => 'Please enter the cheque date.',
            'type.required' => 'Please choose whether the cheque was received or issued.',
            'type.in' => 'Cheque type must be received or issued.',
            'customer_id.exists' => 'The selected customer does not exist.',
            'supplier_id.exists' => 'The selected supplier does not exist.',
            'reference_id.required_with' => 'Please choose the record to link this cheque to.',
        ];
    }

    private function guard(callable $callback, string $failure): JsonResponse
    {
        try {
            return $callback();
        } catch (ValidationException $e) {
            return $this->error('Validation failed.', 422, $e->errors());
        } catch (Throwable $e) {
            report($e);

            return $this->error($failure, 500);
        }
    }
}
