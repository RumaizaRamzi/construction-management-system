<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SearchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class SearchController extends Controller
{
    public function __construct(private readonly SearchService $search)
    {
    }

    public function __invoke(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', $request->query('query', '')));
        $type = $request->query('type');
        $limit = (int) $request->query('limit', 8);

        $typeKey = $type ? strtolower((string) $type) : null;
        if ($typeKey && isset($this->search->entityMap()[$typeKey]) && ! $this->search->canSearch($request->user(), $typeKey)) {
            return $this->error('You do not have permission to search this module.', 403);
        }

        if (mb_strlen($q) < 2) {
            return $this->success([
                'query' => $q,
                'results' => [],
                'groups' => [],
                'total' => 0,
            ], 'Query too short.');
        }

        if (mb_strlen($q) > 100) {
            return $this->error('Search query is too long.', 422);
        }

        try {
            $payload = $this->search->search($request->user(), $q, $type ? (string) $type : null, $limit);

            return $this->success($payload, 'Search completed successfully.');
        } catch (Throwable $e) {
            report($e);

            return $this->error('Unable to complete search. Please try again.', 500);
        }
    }
}
