<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Historial de tarjetas por nodo: cada validación de tarjeta y cada reemplazo queda como un evento.
     */
    public function up(): void
    {
        Schema::create('card_events', function (Blueprint $table): void {
            $table->id();
            $table->string('type', 20);                 // validation | replacement
            $table->string('node_serial', 80)->index();
            $table->string('node_part_number', 80)->nullable();
            $table->string('node_number', 80)->nullable();
            $table->string('station_assignment', 40)->nullable();
            $table->string('card_type', 60);            // BMC, Interposer, PDB, ...
            $table->string('card_part_number', 80)->nullable();
            $table->string('card_serial', 80)->nullable();
            $table->string('result', 20)->nullable();   // ok | damage | failure (validaciones)
            $table->string('reason', 20)->nullable();   // direct | damage | failure (reemplazos)
            $table->text('note')->nullable();           // p. ej. "daño físico en BMC"
            $table->string('removed_part_number', 80)->nullable();
            $table->string('removed_serial', 80)->nullable();
            $table->foreignId('validation_id')->nullable()->constrained('card_events')->nullOnDelete();
            $table->json('sheets')->nullable();         // hojas de la SOP que el operador eligió
            $table->foreignId('operator_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('operator_name', 120)->nullable();
            $table->string('employee_number', 40)->nullable();
            $table->timestamp('occurred_at')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('card_events');
    }
};
