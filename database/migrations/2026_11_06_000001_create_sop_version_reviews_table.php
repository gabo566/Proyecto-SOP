<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Historial de revisiones de cada versión de SOP: una fila por ronda (aprobada o devuelta),
 * con la nota general y las marcas que el revisor dejó sobre las hojas. Las marcas son una
 * capa de revisión: no forman parte de la SOP que ve el operador.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sop_versions', function (Blueprint $table): void {
            $table->unsignedInteger('review_round')->default(1)->after('review_note');
        });

        Schema::create('sop_version_reviews', function (Blueprint $table): void {
            $table->id();
            $table->string('sop_version_id', 80)->index();
            $table->unsignedInteger('round');
            $table->string('decision', 20);
            $table->text('note')->nullable();
            $table->json('marks')->nullable();
            $table->foreignId('reviewer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reviewer_name')->nullable();
            $table->timestamps();

            $table->foreign('sop_version_id')->references('id')->on('sop_versions')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sop_version_reviews');

        Schema::table('sop_versions', function (Blueprint $table): void {
            $table->dropColumn('review_round');
        });
    }
};
