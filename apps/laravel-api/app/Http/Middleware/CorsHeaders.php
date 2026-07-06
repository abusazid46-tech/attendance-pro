<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CorsHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $origin = $request->headers->get('Origin', '*');
        $allowed = array_map('trim', explode(',', (string) config('app.cors_origins', '*')));
        $allowOrigin = in_array('*', $allowed, true) || in_array($origin, $allowed, true) ? $origin : $allowed[0] ?? '*';

        if ($request->isMethod('OPTIONS')) {
            $response = response('', 204);
        } else {
            $response = $next($request);
        }

        $response->headers->set('Access-Control-Allow-Origin', $allowOrigin);
        $response->headers->set('Access-Control-Allow-Credentials', 'true');
        $response->headers->set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');
        $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');

        return $response;
    }
}
