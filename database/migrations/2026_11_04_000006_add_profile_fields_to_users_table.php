<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('phone', 30)->nullable()->after('email');
            $table->string('shift', 10)->nullable()->after('position');
            $table->string('area', 80)->nullable()->after('shift');
            $table->string('avatar_path')->nullable()->after('area');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn(['phone', 'shift', 'area', 'avatar_path']);
        });
    }
};
