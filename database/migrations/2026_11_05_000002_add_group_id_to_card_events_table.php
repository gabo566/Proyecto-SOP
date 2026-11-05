<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Una sesión puede validar o reemplazar varias tarjetas del mismo nodo: todas comparten el group_id.
     */
    public function up(): void
    {
        Schema::table('card_events', function (Blueprint $table): void {
            $table->string('group_id', 40)->nullable()->after('sheets')->index();
        });
    }

    public function down(): void
    {
        Schema::table('card_events', function (Blueprint $table): void {
            $table->dropIndex(['group_id']);
            $table->dropColumn('group_id');
        });
    }
};
