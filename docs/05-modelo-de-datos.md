# Modelo de datos y persistencia

Última actualización: 2026-11-02. Código: `main` @ `11f61c3` (= `origin/main`; árbol con `README.md` modificado, sin commit).

## Resumen

El modelo vive en objetos JavaScript serializables. `state` combina UI, formulario, SOP activa, trabajos, evidencia y filtros. Los datos se dividen entre localStorage, sessionStorage e IndexedDB.

## Estado principal

[Verificado en código] `src/app.js:8-77` contiene:

- navegación: `activeSection`, `navOpen`;
- SOP: `selectedId`, `sopRun`, `sopVersionMeta`, `sopVersionHistory`, `sopVersionCatalog`;
- formulario: PN/serial de nodo y componente, operador, puesto, reparación y declaración;
- trabajo: `workItems`, `activeWorkId`, `completedSteps`;
- evidencia/diálogos: archivos, revisión, errores y estados de apertura;
- reportes: filtros, páginas y búsqueda;
- visor: `sopPageZoom` (50–500) y `sopFocusedZoom`; carga de SOP: `sopUploadFile`/`sopUploadFileName` (`src/app.js:11-12`, `:52-53`).

## Entidades

### SOP/documento

`SOP_DOCUMENT` y cada revisión contienen `id`, `title`, `revision`, `pdfPath` o Blob, `totalSheets`, `stationAssignment`, procedimientos y metadata de carga (`src/data/sopData.js:11-24`, `src/sop-version-control.js:211-285`).

### Procedimiento y paso

Cada procedimiento contiene `id`, `sheet`, `category`, `title`, `stepRange`, `partNumber` y `steps`. Cada paso contiene `number`, `text`, `sourceNote` e `images` (`src/data/sopData.js:36-57`). Las revisiones importadas agregan `sourceBounds` para ubicar el paso en la hoja.

### Trabajo

[Verificado en código] `workflow.js:155-201` guarda SOP/revisión, hoja, serial, operador, formulario, checklist, historial, intentos y estado. Estados incluyen `En proceso`, `Detenida`, `Retrabajo requerido`, `Retrabajo en proceso`, `Pendiente de revisión` y `Completado`.

### Registro

`STORAGE_KEY` guarda validaciones serializadas en localStorage (`src/app.js:1`, `src/app.js:81-100`). Los registros contienen fecha/hora, seriales, PN, operación/categoría, SOP/revisión, operador, reparación, estado y evidencia.

## Almacenamiento

| Almacén | Claves/base | Contenido |
| --- | --- | --- |
| `localStorage` | claves `sop-operador-*` declaradas en `src/app.js`, `src/user-control.js`, `src/work-items.js` | registros, usuarios, sesión auxiliar, trabajos y auditoría |
| `sessionStorage` | sesión de autenticación local | usuario de la sesión actual |
| IndexedDB evidencia | `sop-operador-evidence-v1` (`src/evidence-store.js:1-27`) | fotos y PDF fuente |
| IndexedDB SOP | `sop-operador-sop-versions-v1` (`src/sop-version-control.js:1-70`) | versiones, catálogo y versión activa |

## Límites y migración

[Verificado en código] No existe esquema de backend ni migración. Cualquier centralización debe definir API, autenticación, concurrencia, respaldo, retención y migración de datos locales antes de cambiar el modelo.

## Formas de datos con valores ficticios

Los ejemplos usan datos inventados (no son registros reales). Los campos salen de `src/workflow.js:155-201` y `src/app.js:419-482`.

### Trabajo (`localStorage`, clave `sop-operador-work-items-v1`)

```json
{
  "id": "work-1760000000000",
  "createdAt": 1760000000000,
  "attempts": 0,
  "workKind": "guided",
  "status": "En proceso",
  "sopDocumentId": "SOP-EJEMPLO-001",
  "sopVersionId": "version-ejemplo",
  "sopRevision": "1",
  "procedureId": "sheet-5",
  "sheet": 5,
  "serial": "SERIE-DEMO-001",
  "nodeNumber": "NODO-DEMO",
  "employeeNumber": "000000",
  "completedSteps": ["1", "1.1"],
  "totalSteps": 132,
  "form": { "stationAssignment": "MFG:TDR" },
  "sopRun": { "stage": "steps", "currentIndex": 0, "procedureIds": ["sheet-5"], "completedByProcedure": { "sheet-5": ["1", "1.1"] }, "operatorHandoffs": [] },
  "history": [{ "at": 1760000000000, "date": "1 ene 2026", "time": "08:00", "status": "En proceso", "note": "Inició ..." }],
  "evidenceFiles": [],
  "evidenceHistory": []
}
```

[Verificado en código] `stationAssignment` usa el formato `<TIPO>:<NOMBRE>` (por ejemplo `RWK:RWK` en `src/data/sopData.js:14`). `form` contiene más campos (PN, seriales de nodo y tarjeta, reparación); aquí se abrevió.

### Registro de validación (`localStorage`, clave `sop-operador-validation-demo-records-v1`)

```json
{
  "id": "local-1760000000000",
  "recordType": "Validación del operador",
  "status": "Completado",
  "sopDocumentId": "SOP-EJEMPLO-001",
  "sopRevision": "1",
  "validatedStepCount": 132,
  "validatedSteps": [{ "procedureId": "sheet-5", "sheet": 5, "number": "1", "text": "...", "completed": true }],
  "declared": true,
  "declaredAt": "2026-01-01T08:00:00.000Z",
  "date": "2026-01-01",
  "time": "08:00",
  "shift": "Turno 1",
  "source": "local",
  "evidenceCount": 0,
  "evidenceFiles": []
}
```

[Verificado en código] El registro también guarda `operator`, `employeeNumber`, `actor`, `operatorHandoffs`, `auditEventIds` y el texto de la declaración. Son datos personales y no se reproducen aquí. `prepareCompletionRecord` puede cambiar `status` y `recordType` según el tipo de trabajo (`src/workflow.js:372-396`).

### Evidencia (IndexedDB `sop-operador-evidence-v1`, almacén `files`)

```json
{ "id": "evidence-ejemplo", "blob": "<Blob>", "name": "foto.jpg", "type": "image/jpeg", "size": 123456 }
```

[Verificado en código] `keyPath: "id"` (`src/evidence-store.js:14-16`); el almacén `sop-source` guarda el PDF activo con el id fijo `active-sop-pdf` (`src/evidence-store.js:4`). Versión de la base: 2 (`:12`).

### Revisión de SOP (IndexedDB `sop-operador-sop-versions-v1`, almacén `versions`)

```json
{
  "id": "version-ejemplo",
  "document": { "id": "SOP-EJEMPLO-001", "title": "...", "revision": "1", "stationAssignment": "MFG:TDR", "totalSheets": 46 },
  "procedures": [{ "id": "sheet-5", "sheet": 5, "steps": [{ "number": "1", "text": "...", "images": [], "sourceBounds": {} }],
    "annotations": [{ "id": "a1", "type": "arrow", "stepNumber": "1", "x1": 100, "y1": 120, "x2": 260, "y2": 300 }] }]
}
```

[Verificado en código] `annotations` (opcional, hasta 100 por hoja) usa coordenadas 0–1000 sobre la hoja; tipos `arrow`, `box`, `number`, `note`. La estructura la fija `validateSopDraft` (`src/sop-version-control.js:604-684`); los metadatos de carga y el PDF Blob se agregan al guardar (`:168-242`). El catálogo guarda por id `{ stationAssignment, enabled }` (`:149`, `:159`).

### Bitácora de auditoría (`localStorage`, clave `sop-operador-audit-trail-v1`)

[Verificado en código] Lista de eventos con `action` (`guided_sop_started`, `step_completed`, `step_reopened`, `operator_handoff`, `local_logout`…), `at`, `serial`, `procedureId` y detalles (`src/user-control.js:155-171`, `src/workflow.js:187-197`). No es inmutable.
