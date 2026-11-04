<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('employee_number', 40)->unique()->after('id');
            $table->string('position', 80)->default('Técnico de FA')->after('name');
            $table->foreignId('role_id')->after('email')->constrained()->restrictOnDelete();
            $table->boolean('is_active')->default(true)->index()->after('password');
            $table->string('email')->nullable()->change();
        });

        // Permisos concedidos a una persona concreta, además de los de su rol
        // (p. ej. sop.manage, que hoy solo tiene el empleado 140784).
        Schema::create('permission_user', function (Blueprint $table): void {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('permission_id')->constrained()->cascadeOnDelete();
            $table->primary(['user_id', 'permission_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('permission_user');

        Schema::table('users', function (Blueprint $table): void {
            $table->dropForeign(['role_id']);
            $table->dropColumn(['employee_number', 'position', 'role_id', 'is_active']);
        });
    }
};
