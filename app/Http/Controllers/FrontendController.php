<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Serves the built React app (public/index.html) for every non-API page so
 * React Router can handle deep links such as /sales/12 or /calendar.
 */
class FrontendController extends Controller
{
    public function __invoke(Request $request): BinaryFileResponse
    {
        if ($request->is('api', 'api/*', 'storage/*', 'assets/*', 'images/*')) {
            abort(404);
        }

        $index = public_path('index.html');

        abort_unless(is_file($index), 404, 'Frontend build not found. Run "npm run build" in the project root.');

        return response()->file($index, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
        ]);
    }
}
