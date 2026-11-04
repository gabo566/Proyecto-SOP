<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Control de dos personas: quien edita envía la revisión, otra persona la revisa y una tercera la publica.
        // Las revisiones que ya existían quedan como «published» (valor por defecto).
        Schema::table('sop_versions', function (Blueprint $table): void {
            $table->string('status', 20)->default('published')->after('procedures');
            $table->foreignId('submitted_by')->nullable()->after('created_by_name')->constrained('users')->nullOnDelete();
            $table->string('submitted_by_name', 100)->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reviewed_by_name', 100)->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->text('review_note')->nullable();
            $table->foreignId('published_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('published_by_name', 100)->nullable();
            $table->timestamp('published_at')->nullable();
            $table->json('change_summary')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('sop_versions', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('submitted_by');
            $table->dropConstrainedForeignId('reviewed_by');
            $table->dropConstrainedForeignId('published_by');
            $table->dropColumn([
                'status', 'submitted_by_name', 'submitted_at', 'reviewed_by_name', 'reviewed_at',
                'review_note', 'published_by_name', 'published_at', 'change_summary',
            ]);
        });
    }
};
