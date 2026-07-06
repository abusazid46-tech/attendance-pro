<?php

namespace App\Http\Middleware;

use App\Support\JwtService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ApiAuthenticate
{
    public function handle(Request $request, Closure $next): Response
    {
        $header = $request->header('Authorization', '');
        if (!str_starts_with($header, 'Bearer ')) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        try {
            $request->attributes->set('auth', JwtService::verifyAccessToken(substr($header, 7)));
        } catch (\Throwable) {
            return response()->json(['message' => 'Invalid or expired token'], 401);
        }

        return $next($request);
    }
}
