<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Nuevo rol «Creador» (sop.create): quien sube, crea y edita las revisiones de la SOP.
     * Para no dejar sin acceso a quien ya administraba la SOP, se le concede también el rol de creador;
     * después se puede quitar o dar a otras personas desde la tarjeta de cada usuario.
     */
    public function up(): void
    {
        $id = DB::table('permissions')->where('key', 'sop.create')->value('id');

        if ($id === null) {
            $id = DB::table('permissions')->insertGetId([
                'key' => 'sop.create',
                'name' => 'Crear, subir y editar revisiones de la SOP',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $manage = DB::table('permissions')->where('key', 'sop.manage')->value('id');

        if ($manage === null) {
            return;
        }

        $holders = DB::table('permission_user')->where('permission_id', $manage)->pluck('user_id');

        foreach ($holders as $userId) {
            DB::table('permission_user')->insertOrIgnore(['user_id' => $userId, 'permission_id' => $id]);
        }
    }

    public function down(): void
    {
        $id = DB::table('permissions')->where('key', 'sop.create')->value('id');

        if ($id !== null) {
            DB::table('permission_user')->where('permission_id', $id)->delete();
            DB::table('permissions')->where('id', $id)->delete();
        }
    }
};
