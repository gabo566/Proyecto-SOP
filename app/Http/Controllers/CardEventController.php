<?php

namespace App\Http\Controllers;

use App\Models\CardEvent;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CardEventController extends Controller
{
    private const MAX_BATCH = 20;

    private const MAX_REPORT_ROWS = 500;

    public function index(Request $request): JsonResponse
    {
        $data = $request->validate(['nodeSerial' => ['required', 'string', 'max:80']]);

        $events = CardEvent::where('node_serial', $data['nodeSerial'])
            ->orderByDesc('occurred_at')->orderByDesc('id')->get();

        $validations = $events->where('type', CardEvent::TYPE_VALIDATION);
        $replacements = $events->where('type', CardEvent::TYPE_REPLACEMENT);

        return response()->json([
            'ok' => true,
            'events' => $events->map->toClientArray()->values(),
            'summary' => [
                'validations' => $validations->count(),
                'replacements' => $replacements->count(),
                'validationsByCard' => $validations->countBy('card_type')->all(),
                'replacementsByCard' => $replacements->countBy('card_type')->all(),
                'damageFound' => $validations->where('result', CardEvent::RESULT_DAMAGE)->count(),
            ],
        ]);
    }

    /**
     * Agregados para Reportes (área RWK): por tipo de tarjeta, por operador y filas con seriales.
     */
    public function report(Request $request): JsonResponse
    {
        $data = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
            'cardType' => ['nullable', 'string', 'max:60'],
            'employeeNumber' => ['nullable', 'string', 'max:40'],
        ]);

        $query = CardEvent::query()->orderByDesc('occurred_at')->orderByDesc('id');

        if (! empty($data['from'])) {
            $query->where('occurred_at', '>=', Carbon::parse($data['from'])->startOfDay());
        }
        if (! empty($data['to'])) {
            $query->where('occurred_at', '<=', Carbon::parse($data['to'])->endOfDay());
        }
        if (! empty($data['cardType'])) {
            $query->where('card_type', $data['cardType']);
        }
        if (! empty($data['employeeNumber'])) {
            $query->where('employee_number', $data['employeeNumber']);
        }

        $events = $query->get();
        $validations = $events->where('type', CardEvent::TYPE_VALIDATION);
        $replacements = $events->where('type', CardEvent::TYPE_REPLACEMENT);

        return response()->json([
            'ok' => true,
            'validations' => [
                'total' => $validations->count(),
                'damage' => $validations->where('result', CardEvent::RESULT_DAMAGE)->count(),
                'byCard' => $validations->countBy('card_type')->all(),
                'rows' => $validations->take(self::MAX_REPORT_ROWS)->map->toClientArray()->values(),
            ],
            'replacements' => [
                'total' => $replacements->count(),
                'byCard' => $replacements->countBy('card_type')->all(),
                'byOperator' => $replacements->groupBy('employee_number')->map(fn ($group) => [
                    'employeeNumber' => $group->first()->employee_number,
                    'operatorName' => $group->first()->operator_name,
                    'count' => $group->count(),
                ])->sortByDesc('count')->values(),
                'rows' => $replacements->take(self::MAX_REPORT_ROWS)->map->toClientArray()->values(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules());

        $event = $this->createEvent($data, $request->user());

        return response()->json(['ok' => true, 'event' => $event->toClientArray()], 201);
    }

    /**
     * Varias tarjetas de una misma sesión: todas o ninguna, con el mismo group_id.
     */
    public function batch(Request $request): JsonResponse
    {
        $request->validate([
            'groupId' => ['nullable', 'string', 'max:40'],
            'events' => ['required', 'array', 'min:1', 'max:'.self::MAX_BATCH],
        ]);

        $items = $request->input('events');
        $groupId = $request->input('groupId');
        $validated = [];

        foreach ($items as $index => $item) {
            $validator = Validator::make(is_array($item) ? $item : [], $this->rules());
            if ($validator->fails()) {
                $errors = [];
                foreach ($validator->errors()->messages() as $field => $messages) {
                    $errors["events.{$index}.{$field}"] = $messages;
                }
                throw ValidationException::withMessages($errors);
            }
            $validated[] = $validator->validated();
        }

        $events = DB::transaction(fn () => collect($validated)->map(
            fn (array $data) => $this->createEvent($data + ['groupId' => $groupId], $request->user())
        ));

        return response()->json(['ok' => true, 'events' => $events->map->toClientArray()->values()], 201);
    }

    private function rules(): array
    {
        return [
            'type' => ['required', Rule::in([CardEvent::TYPE_VALIDATION, CardEvent::TYPE_REPLACEMENT])],
            'nodeSerial' => ['required', 'string', 'max:80'],
            'nodePartNumber' => ['nullable', 'string', 'max:80'],
            'nodeNumber' => ['nullable', 'string', 'max:80'],
            'stationAssignment' => ['nullable', 'string', 'max:40'],
            'cardType' => ['required', 'string', 'max:60'],
            'cardPartNumber' => ['required', 'string', 'max:80'],
            'cardSerial' => ['required', 'string', 'max:80'],
            'result' => ['required_if:type,'.CardEvent::TYPE_VALIDATION, 'nullable', Rule::in([CardEvent::RESULT_OK, CardEvent::RESULT_DAMAGE, CardEvent::RESULT_FAILURE])],
            'reason' => ['required_if:type,'.CardEvent::TYPE_REPLACEMENT, 'nullable', Rule::in([CardEvent::REASON_DIRECT, CardEvent::REASON_DAMAGE, CardEvent::REASON_FAILURE])],
            'note' => ['required_if:result,'.CardEvent::RESULT_DAMAGE, 'nullable', 'string', 'max:1000'],
            'removedPartNumber' => ['nullable', 'string', 'max:80'],
            'removedSerial' => ['required_if:type,'.CardEvent::TYPE_REPLACEMENT, 'nullable', 'string', 'max:80'],
            'validationId' => ['nullable', 'integer', 'exists:card_events,id'],
            'sheets' => ['nullable', 'array', 'max:20'],
            'sheets.*' => ['string', 'max:20'],
            'groupId' => ['nullable', 'string', 'max:40'],
        ];
    }

    private function createEvent(array $data, User $user): CardEvent
    {
        // Un reemplazo por daño sale de una validación que encontró ese daño en el mismo nodo.
        if (! empty($data['validationId'])) {
            $validation = CardEvent::find($data['validationId']);
            if (
                $validation->type !== CardEvent::TYPE_VALIDATION
                || $validation->node_serial !== $data['nodeSerial']
                || $validation->result !== CardEvent::RESULT_DAMAGE
            ) {
                throw ValidationException::withMessages(['validationId' => 'La validación no corresponde a este nodo o no encontró daño.']);
            }
        }

        return CardEvent::create([
            'type' => $data['type'],
            'node_serial' => $data['nodeSerial'],
            'node_part_number' => $data['nodePartNumber'] ?? null,
            'node_number' => $data['nodeNumber'] ?? null,
            'station_assignment' => $data['stationAssignment'] ?? null,
            'card_type' => $data['cardType'],
            'card_part_number' => $data['cardPartNumber'],
            'card_serial' => $data['cardSerial'],
            'result' => $data['result'] ?? null,
            'reason' => $data['reason'] ?? null,
            'note' => $data['note'] ?? null,
            'removed_part_number' => $data['removedPartNumber'] ?? null,
            'removed_serial' => $data['removedSerial'] ?? null,
            'validation_id' => $data['validationId'] ?? null,
            'sheets' => $data['sheets'] ?? null,
            'group_id' => $data['groupId'] ?? null,
            'operator_id' => $user->id,
            'operator_name' => $user->name,
            'employee_number' => $user->employee_number,
            'occurred_at' => now(),
        ]);
    }
}
