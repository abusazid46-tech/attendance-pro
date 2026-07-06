<?php

use App\Http\Middleware\ApiAuthenticate;
use App\Http\Middleware\CorsHeaders;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        apiPrefix: ''
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->api(append: [CorsHeaders::class]);
        $middleware->alias([
            'api.auth' => ApiAuthenticate::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })
    ->create();
