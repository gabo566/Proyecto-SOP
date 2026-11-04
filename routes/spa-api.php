<?php

use App\Http\Controllers\AuditEventController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\EvidenceController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\RecordController;
use App\Http\Controllers\WorkItemController;
use App\Http\Controllers\SopCatalogController;
use App\Http\Controllers\SopSourceController;
use App\Http\Controllers\SopVersionController;
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

    Route::patch('/profile', [ProfileController::class, 'update']);
    Route::patch('/profile/password', [ProfileController::class, 'updatePassword'])->middleware('throttle:5,1');
    Route::post('/profile/avatar', [ProfileController::class, 'storeAvatar']);
    Route::delete('/profile/avatar', [ProfileController::class, 'destroyAvatar']);
    Route::get('/users/{user}/avatar', [ProfileController::class, 'showAvatar']);

    Route::get('/sop-versions', [SopVersionController::class, 'index']);
    Route::get('/sop-versions/{version}/pdf', [SopVersionController::class, 'pdf']);
    Route::get('/sop-catalog', [SopCatalogController::class, 'index']);
    Route::get('/sop-roles', [SopVersionController::class, 'roles']);
    Route::get('/sop-source', [SopSourceController::class, 'show']);
    Route::get('/sop-source/file', [SopSourceController::class, 'file']);

    Route::get('/work-items', [WorkItemController::class, 'index']);
    Route::put('/work-items/{id}', [WorkItemController::class, 'update']);
    Route::get('/records', [RecordController::class, 'index']);
    Route::put('/records/{id}', [RecordController::class, 'update']);
    Route::post('/evidence', [EvidenceController::class, 'store']);
    Route::get('/evidence/{id}', [EvidenceController::class, 'show']);
    Route::delete('/evidence/{id}', [EvidenceController::class, 'destroy']);
    Route::get('/audit-events', [AuditEventController::class, 'index']);
    Route::post('/audit-events', [AuditEventController::class, 'store']);

    // Editor y revisor pueden revisar; la guarda está en SopVersionController::canReview.
    // Subir una revisión: editor o revisor (guarda en SopVersionController::canUpload).
    Route::post('/sop-versions', [SopVersionController::class, 'store']);
    Route::post('/sop-versions/{version}/review', [SopVersionController::class, 'review']);
    Route::post('/sop-versions/{version}/publish', [SopVersionController::class, 'publish'])->middleware('permission:sop.publish');

    Route::middleware('permission:sop.manage')->group(function (): void {
        Route::delete('/sop-versions/{version}', [SopVersionController::class, 'destroy']);
        Route::put('/sop-catalog', [SopCatalogController::class, 'update']);
        Route::post('/sop-source', [SopSourceController::class, 'store']);
        // Solo quien administra la SOP concede las funciones de revisor y publicador.
        Route::patch('/users/{user}/sop-roles', [UserController::class, 'updateSopRoles']);
        Route::patch('/users/{user}/admin', [UserController::class, 'updateAdmin']);
    });

    Route::middleware('permission:users.manage')->group(function (): void {
        Route::get('/users', [UserController::class, 'index']);
        Route::post('/users', [UserController::class, 'store']);
        Route::patch('/users/{user}/password', [UserController::class, 'updatePassword']);
        Route::patch('/users/{user}/active', [UserController::class, 'updateActive']);
        Route::delete('/users/{user}', [UserController::class, 'destroy']);
    });
});
