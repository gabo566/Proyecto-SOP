<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Fotos de evidencia. El trabajo o registro que las usa las referencia por
        // id dentro de su documento JSON; aquí queda quién subió cada archivo.
        Schema::create('evidence_files', function (Blueprint $table): void {
            $table->string('id', 64)->primary();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('employee_number', 40)->index();
            $table->string('original_name', 255);
            $table->string('mime', 40);
            $table->unsignedInteger('size');
            $table->string('path');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('evidence_files');
    }
};
