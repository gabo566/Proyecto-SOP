<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Trabajos en curso, detenidos o en retrabajo. El documento completo vive
        // en `data` (lo que hoy edita el front); las columnas sueltas son las que
        // se filtran o se reportan. `revision` detecta escrituras concurrentes.
        Schema::create('work_items', function (Blueprint $table): void {
            $table->string('id', 64)->primary();
            $table->string('employee_number', 40)->index();
            $table->string('status', 40)->index();
            $table->string('serial', 120)->nullable()->index();
            $table->string('node_number', 120)->nullable();
            $table->string('sop_version_id', 80)->nullable();
            $table->unsignedBigInteger('created_ms');
            $table->unsignedBigInteger('updated_ms')->default(0);
            $table->unsignedInteger('revision')->default(1);
            $table->json('data');
            $table->timestamps();
        });

        // Declaraciones de validación que firma el operador al terminar.
        Schema::create('validation_records', function (Blueprint $table): void {
            $table->string('id', 64)->primary();
            $table->string('employee_number', 40)->index();
            $table->string('status', 40)->index();
            $table->string('record_type', 80)->nullable();
            $table->string('serial', 120)->nullable()->index();
            $table->string('node_number', 120)->nullable();
            $table->string('work_item_id', 64)->nullable()->index();
            $table->string('sop_version_id', 80)->nullable();
            $table->string('record_date', 10)->nullable()->index();
            $table->string('shift', 10)->nullable();
            $table->unsignedBigInteger('created_ms');
            $table->unsignedInteger('revision')->default(1);
            $table->json('data');
            $table->timestamps();
        });

        // Bitácora de auditoría: solo se inserta, nunca se actualiza ni se borra.
        Schema::create('audit_events', function (Blueprint $table): void {
            $table->string('id', 64)->primary();
            $table->string('action', 60)->index();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_employee', 40)->index();
            $table->string('session_id', 80)->nullable();
            $table->string('work_item_id', 64)->nullable()->index();
            $table->string('record_id', 64)->nullable();
            $table->timestamp('occurred_at', 3)->index();
            $table->json('payload');
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_events');
        Schema::dropIfExists('validation_records');
        Schema::dropIfExists('work_items');
    }
};
