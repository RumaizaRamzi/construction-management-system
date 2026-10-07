<?php

namespace App\Support;

class QuerySafety
{
    /**
     * Escape LIKE wildcards so user search cannot broaden results unintentionally.
     */
    public static function escapeLike(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
    }

    /**
     * Build a safe LIKE pattern from user input.
     */
    public static function likeContains(string $value): string
    {
        return '%'.self::escapeLike(trim($value)).'%';
    }

    /**
     * Cap per_page query param.
     */
    public static function perPage(mixed $value, int $default = 50, int $max = 100): int
    {
        return min($max, max(1, (int) ($value ?: $default)));
    }
}
