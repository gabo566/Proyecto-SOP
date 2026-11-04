<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CardEvent extends Model
{
    public const TYPE_VALIDATION = 'validation';

    public const TYPE_REPLACEMENT = 'replacement';

    public const RESULT_OK = 'ok';

    public const RESULT_DAMAGE = 'damage';

    public const RESULT_FAILURE = 'failure';

    public const REASON_DIRECT = 'direct';

    public const REASON_DAMAGE = 'damage';

    public const REASON_FAILURE = 'failure';

    protected $fillable = [
        'type', 'node_serial', 'node_part_number', 'node_number', 'station_assignment',
        'card_type', 'card_part_number', 'card_serial', 'result', 'reason', 'note',
        'removed_part_number', 'removed_serial', 'validation_id', 'sheets',
        'operator_id', 'operator_name', 'employee_number', 'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'sheets' => 'array',
            'occurred_at' => 'datetime',
        ];
    }

    public function toClientArray(): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'nodeSerial' => $this->node_serial,
            'nodePartNumber' => $this->node_part_number,
            'nodeNumber' => $this->node_number,
            'stationAssignment' => $this->station_assignment,
            'cardType' => $this->card_type,
            'cardPartNumber' => $this->card_part_number,
            'cardSerial' => $this->card_serial,
            'result' => $this->result,
            'reason' => $this->reason,
            'note' => $this->note,
            'removedPartNumber' => $this->removed_part_number,
            'removedSerial' => $this->removed_serial,
            'validationId' => $this->validation_id,
            'sheets' => $this->sheets ?? [],
            'operatorName' => $this->operator_name,
            'employeeNumber' => $this->employee_number,
            'occurredAt' => $this->occurred_at?->toIso8601String(),
        ];
    }
}
