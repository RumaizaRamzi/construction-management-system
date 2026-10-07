<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated.', 'data' => null], 401);
        }

        if (! $user->isActive()) {
            return response()->json(['success' => false, 'message' => 'Your account is inactive.', 'data' => null], 403);
        }

        if ($user->must_change_password) {
            return response()->json([
                'success' => false,
                'message' => 'You must change your password before continuing.',
                'code' => 'password_change_required',
                'data' => null,
            ], 403);
        }

        if (! $user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Only administrators can access this area.',
                'data' => null,
            ], 403);
        }

        return $next($request);
    }
}
