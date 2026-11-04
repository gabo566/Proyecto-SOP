<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Revisiones de SOP cargadas por quien administra. La SOP incluida en el
        // proyecto (public/assets) sigue siendo estática y no vive aquí. El id lo
        // genera el front ("sop-version-<uuid>") y los trabajos lo referencian.
        Schema::create('sop_versions', function (Blueprint $table): void {
            $table->string('id', 80)->primary();
            $table->json('document');
            $table->json('procedures');
            $table->string('pdf_path')->nullable();
            $table->string('pdf_name')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('created_by_name', 100)->nullable();
            $table->timestamps();
        });

        // Estación asignada y disponibilidad de cada revisión (incluida la SOP
        // estática, por eso version_id no es una llave foránea).
        Schema::create('sop_catalog', function (Blueprint $table): void {
            $table->string('version_id', 80)->primary();
            $table->string('station_assignment', 160)->nullable();
            $table->boolean('enabled')->default(false);
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('settings', function (Blueprint $table): void {
            $table->string('key', 80)->primary();
            $table->json('value');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
        Schema::dropIfExists('sop_catalog');
        Schema::dropIfExists('sop_versions');
    }
};
