<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
 * La interfaz del SOP es una SPA estática (resources/spa/index.html) que carga
 * ./src/* y ./public/* desde public/. Laravel solo entrega el documento; los
 * datos pasarán a /api/* en las fases siguientes.
 */
$spa = static fn () => response()->file(resource_path('spa/index.html'), [
    'Content-Type' => 'text/html; charset=UTF-8',
    'Cache-Control' => 'no-cache',
]);

Route::get('/', $spa);

// Mismo criterio que worker/index.js: una navegación HTML desconocida vuelve
// al shell; /api/* y los recursos que no son HTML responden 404 reales.
Route::fallback(function (Request $request) use ($spa) {
    abort_if($request->is('api/*') || ! $request->acceptsHtml(), 404);

    return $spa();
});
