<?php

use App\Http\Middleware\EnsureUserHasPermission;
use App\Http\Middleware\EnsureUserIsActive;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // cloudflared y el servidor local llegan por loopback: confiar solo ahí
        // en X-Forwarded-* para que los límites de intentos usen la IP real.
        $middleware->trustProxies(at: ['127.0.0.1', '::1']);

        // Los documentos de trabajos, registros y revisiones se guardan tal como los arma el front:
        // convertir "" en null (y recortar espacios) rompía llamadas como form.nodeNumber.trim().
        $middleware->convertEmptyStringsToNull(except: [fn (Request $request) => $request->is('api/*')]);
        $middleware->trimStrings(except: [fn (Request $request) => $request->is('api/*')]);

        $middleware->alias([
            'permission' => EnsureUserHasPermission::class,
            'account.active' => EnsureUserIsActive::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
