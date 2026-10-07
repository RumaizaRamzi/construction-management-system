<?php

use App\Http\Controllers\FrontendController;
use Illuminate\Support\Facades\Route;

/*
| The React frontend is built into public/ (npm run build at the project root).
| Every non-API page is served by public/index.html and React Router takes over.
| The pattern must never match /api so API 404/405 responses stay unchanged.
*/
Route::get('/', FrontendController::class);
Route::get('{path}', FrontendController::class)
    ->where('path', '(?!api(?:/|$)).*')
    ->fallback();
