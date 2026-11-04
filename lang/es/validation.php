<?php

// Mensajes de validación en español para las reglas que usa la API del SOP.
// Si falta una regla, Laravel muestra su clave (p. ej. "validation.max.file").
return [
    'accepted' => 'Debes aceptar :attribute.',
    'array' => ':Attribute debe ser una lista.',
    'boolean' => ':Attribute debe ser verdadero o falso.',
    'file' => ':Attribute debe ser un archivo.',
    'image' => ':Attribute debe ser una imagen.',
    'in' => 'El valor de :attribute no es válido.',
    'integer' => ':Attribute debe ser un número entero.',
    'max' => [
        'array' => ':Attribute no puede tener más de :max elementos.',
        'file' => ':Attribute no puede pesar más de :max KB.',
        'numeric' => ':Attribute no puede ser mayor que :max.',
        'string' => ':Attribute no puede tener más de :max caracteres.',
    ],
    'mimes' => ':Attribute debe ser un archivo de tipo :values.',
    'mimetypes' => ':Attribute debe ser una imagen JPG, PNG o WebP válida.',
    'min' => [
        'array' => ':Attribute debe tener al menos :min elementos.',
        'file' => ':Attribute debe pesar al menos :min KB.',
        'numeric' => ':Attribute debe ser al menos :min.',
        'string' => ':Attribute debe tener al menos :min caracteres.',
    ],
    'present' => 'Falta :attribute.',
    'regex' => 'El formato de :attribute no es válido.',
    'required' => 'Falta :attribute.',
    'string' => ':Attribute debe ser texto.',
    'uploaded' => 'No se pudo subir :attribute; revisa que no supere el tamaño permitido.',

    'custom' => [],

    'attributes' => [
        'file' => 'la foto',
        'pdf' => 'el PDF',
        'version' => 'la revisión',
        'id' => 'el identificador',
        'password' => 'la contraseña',
        'employeeNumber' => 'el número de empleado',
    ],
];
