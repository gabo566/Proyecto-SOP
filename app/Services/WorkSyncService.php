<?php

namespace App\Services;

use App\Models\Permission;
use App\Models\User;
use App\Models\ValidationRecord;
use App\Models\WorkItem;
use Illuminate\Database\Eloquent\Model;

/**
 * Persistencia de trabajos y registros de validación. El front sigue siendo
 * quien arma el documento (reglas del recorrido guiado); aquí se garantiza lo
 * que no debe depender del navegador: quién escribe, quién puede aprobar una
 * revisión y que dos personas no se pisen (revisión optimista).
 */
class WorkSyncService
{
    /**
     * @param  array<string, mixed>  $item
     * @return array{ok: bool, code?: string, revision: int, stored?: array<string, mixed>}
     */
    public function saveWorkItem(User $actor, string $id, array $item, ?int $baseRevision): array
    {
        $existing = WorkItem::find($id);

        $guard = $this->guard($actor, $existing, (string) ($item['employeeNumber'] ?? ''), $baseRevision);
        if ($guard) {
            return $guard + ['revision' => $existing?->revision ?? 0];
        }

        // Aprobar o pedir corrección sobre una evidencia pendiente es del supervisor.
        if ($existing && $existing->status === 'Pendiente de revisión'
            && ($item['status'] ?? null) !== 'Pendiente de revisión'
            && ! $actor->hasPermissionTo(Permission::EVIDENCE_REVIEW)) {
            return ['ok' => false, 'code' => 'forbidden', 'revision' => $existing->revision];
        }

        $record = $existing ?? new WorkItem(['id' => $id, 'revision' => 0]);
        $record->fill([
            'employee_number' => (string) $item['employeeNumber'],
            'status' => $item['status'],
            'serial' => $this->text($item['serial'] ?? null, 120),
            'node_number' => $this->text($item['nodeNumber'] ?? null, 120),
            'sop_version_id' => $this->text($item['sopVersionId'] ?? null, 80),
            'created_ms' => $existing?->created_ms ?? $this->millis($item['createdAt'] ?? null),
            'updated_ms' => $this->millis($item['updatedAt'] ?? null),
            'revision' => $record->revision + 1,
            'data' => $item,
        ])->save();

        return ['ok' => true, 'revision' => $record->revision];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{ok: bool, code?: string, revision: int, stored?: array<string, mixed>}
     */
    public function saveRecord(User $actor, string $id, array $data, ?int $baseRevision): array
    {
        $existing = ValidationRecord::find($id);

        $guard = $this->guard($actor, $existing, (string) ($data['employeeNumber'] ?? ''), $baseRevision);
        if ($guard) {
            return $guard + ['revision' => $existing?->revision ?? 0];
        }

        // Cambiar quién revisó o la nota de revisión requiere permiso de revisión.
        if ($existing && ! $actor->hasPermissionTo(Permission::EVIDENCE_REVIEW)) {
            foreach (['reviewedBy', 'reviewedAt', 'reviewNote'] as $field) {
                if (($existing->data[$field] ?? null) !== ($data[$field] ?? null)) {
                    return ['ok' => false, 'code' => 'forbidden', 'revision' => $existing->revision];
                }
            }
        }

        $record = $existing ?? new ValidationRecord(['id' => $id, 'revision' => 0]);
        $record->fill([
            'employee_number' => (string) $data['employeeNumber'],
            'status' => $data['status'],
            'record_type' => $this->text($data['recordType'] ?? null, 80),
            'serial' => $this->text($data['serial'] ?? null, 120),
            'node_number' => $this->text($data['nodeNumber'] ?? null, 120),
            'work_item_id' => $this->text($data['workItemId'] ?? null, 64),
            'sop_version_id' => $this->text($data['sopVersionId'] ?? null, 80),
            'record_date' => $this->text($data['date'] ?? null, 10),
            'shift' => $this->text($data['shift'] ?? null, 10),
            'created_ms' => $existing?->created_ms ?? $this->millis($data['declaredAt'] ?? null),
            'revision' => $record->revision + 1,
            'data' => $data,
        ])->save();

        return ['ok' => true, 'revision' => $record->revision];
    }

    /**
     * Reglas comunes: una pieza nueva se registra a nombre de quien escribe y
     * una existente solo se actualiza sobre la revisión que el cliente conoce.
     *
     * @return array{ok: false, code: string, stored?: array<string, mixed>}|null
     */
    private function guard(User $actor, ?Model $existing, string $ownerEmployee, ?int $baseRevision): ?array
    {
        if (! $existing) {
            if ($ownerEmployee !== $actor->employee_number && ! $actor->hasPermissionTo(Permission::USERS_MANAGE)) {
                return ['ok' => false, 'code' => 'forbidden'];
            }

            return null;
        }

        if ($baseRevision !== $existing->revision) {
            return ['ok' => false, 'code' => 'conflict', 'stored' => $existing->data];
        }

        return null;
    }

    private function text(mixed $value, int $max): ?string
    {
        $text = trim((string) ($value ?? ''));

        return $text === '' ? null : mb_substr($text, 0, $max);
    }

    private function millis(mixed $value): int
    {
        if (is_numeric($value)) {
            return (int) $value;
        }

        $parsed = is_string($value) ? strtotime($value) : false;

        return $parsed ? $parsed * 1000 : (int) (microtime(true) * 1000);
    }
}
