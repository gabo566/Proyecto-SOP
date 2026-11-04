<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

/*
 * API JSON de la SPA. Se carga con el prefijo /api dentro del grupo "web"
 * (sesión por cookie + CSRF), igual que Burn Track pero con respuestas JSON.
 */

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');
// /me responde 200 también sin sesión ({user: null}) para no llenar la consola de 401 al abrir la app.
Route::get('/me', [AuthController::class, 'me']);

Route::middleware(['auth', 'account.active'])->group(function (): void {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/users/verify', [AuthController::class, 'verify'])->middleware('throttle:login');

    Route::middleware('permission:users.manage')->group(function (): void {
        Route::get('/users', [UserController::class, 'index']);
        Route::post('/users', [UserController::class, 'store']);
        Route::patch('/users/{user}/password', [UserController::class, 'updatePassword']);
        Route::patch('/users/{user}/active', [UserController::class, 'updateActive']);
    });
});
