<?php

namespace App\Services;

use App\Models\AuditEvent;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * Bitácora inmutable. El actor siempre es quien tiene la sesión abierta: lo que
 * el navegador mande como "actor" se sustituye, así nadie registra acciones a
 * nombre de otra persona. Las inserciones son idempotentes (reintentos de red).
 */
class AuditTrailService
{
    public const MAX_READ = 1000;

    /**
     * @param  list<array<string, mixed>>  $events
     */
    public function record(User $actor, array $events): int
    {
        $actor->loadMissing('role');
        $snapshot = [
            'id' => $actor->id,
            'name' => $actor->name,
            'employeeNumber' => $actor->employee_number,
            'position' => $actor->position,
            'role' => $actor->role->key,
        ];

        $created = 0;

        foreach ($events as $event) {
            $event['actor'] = $snapshot;

            $row = AuditEvent::firstOrCreate(['id' => $event['id']], [
                'action' => $event['action'],
                'actor_id' => $actor->id,
                'actor_employee' => $actor->employee_number,
                'session_id' => $this->text($event['sessionId'] ?? null, 80),
                'work_item_id' => $this->text($event['workItemId'] ?? null, 64),
                'record_id' => $this->text($event['recordId'] ?? null, 64),
                'occurred_at' => $this->when($event['at'] ?? null),
                'payload' => $event,
            ]);

            $created += $row->wasRecentlyCreated ? 1 : 0;
        }

        return $created;
    }

    /**
     * Los últimos eventos, del más antiguo al más reciente (como los leía el front).
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function latest(int $limit = self::MAX_READ): Collection
    {
        return AuditEvent::orderByDesc('occurred_at')->orderByDesc('created_at')->limit(min($limit, self::MAX_READ))
            ->get()->reverse()->values()->map(fn (AuditEvent $event) => $event->payload);
    }

    private function when(mixed $value): Carbon
    {
        try {
            $moment = Carbon::parse((string) $value);
        } catch (\Throwable) {
            return now();
        }

        // Un reloj del navegador desfasado no debe falsear la línea de tiempo.
        return $moment->greaterThan(now()->addMinutes(5)) ? now() : $moment;
    }

    private function text(mixed $value, int $max): ?string
    {
        $text = trim((string) ($value ?? ''));

        return $text === '' ? null : mb_substr($text, 0, $max);
    }
}
