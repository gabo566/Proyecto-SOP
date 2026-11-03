# Módulo: trabajos, pausas, retrabajos y evidencia

Última actualización: 2026-11-02. Código: `main` @ `11f61c3` (= `origin/main`; árbol con `README.md` modificado, sin commit).

## Resumen

`work-items.js` serializa trabajos en localStorage. `workflow.js` orquesta inicio, progreso, pausa, retrabajo, reanudación, entrega entre operadores y cierre. Los tres módulos de evidencia almacenan fotos en IndexedDB y las asocian a trabajos/registros.

## Trabajos

- [Verificado en código] `readWorkItems()`/`persistWorkItems()` usan `sop-operador-work-items-v1` (`src/work-items.js:1-18`).
- [Verificado en código] `startGuidedWork()` crea o actualiza un trabajo con SOP, hoja, operador, formulario, checklist e historial (`src/workflow.js:155-201`).
- [Verificado en código] `submit()` guarda pausa o retrabajo, motivo, nota, paso fallido, reparación, componente y evidencia (`src/workflow.js:220-304`).
- [Verificado en código] `resume()` reabre el paso fallido para retrabajo y registra evento (`src/workflow.js:306-370`).
- [Verificado en código] `completeActiveWork()` cierra o envía a revisión según el tipo (`src/workflow.js:398-420`).

## Evidencia

`evidence-store.js:1-90` define IndexedDB `sop-operador-evidence-v1`, acepta JPG/PNG/WebP, limita cinco archivos y ocho MB por archivo. `evidence-capture-workflow.js:1-90` controla selección/retiro temporal. `evidence-workflow.js:1-270` abre visor, carga fotos, revisa, aprueba o solicita corrección.

## Riesgos

- [Verificado en código] La evidencia queda en el navegador/origen actual y puede perderse al borrar datos del sitio.
- [Verificado en código] La revisión «Supervisor» es una simulación local, no autorización de servidor.
- [Pendiente de confirmar] Política de retención, compresión, cifrado y respaldo central.

## Qué NO le corresponde

- No define el criterio de «paso completo» (eso es `sop-run.js`).
- No autentica: `handoffOperator` delega en `verifyLocalUserCredentials` (`src/user-control.js:62`) para validar al operador receptor; la fábrica también recibe `authenticateLocalUser` por inyección.
- No decide permisos de revisión; el filtro por rol está en `src/interactions.js:363-367`.

## Funciones principales

`createWorkItemWorkflow(state, deps)` (`src/workflow.js:1`) es una fábrica: cierra sobre `state` y devuelve el objeto de operaciones (`src/workflow.js:423-436`). Las dependencias (`getProcedure`, `createEmptyForm`, `render`, `showToast`, `persistSavedRecords`, `authenticateLocalUser`) se inyectan desde `app.js`.

| Función | Ubicación | Qué hace / efectos | Devuelve |
| --- | --- | --- | --- |
| `getTimestamp()` | `src/workflow.js:2` | Marca de tiempo con fecha y hora en `es-MX`. | `{at, date, time}` |
| `appendEvent(item, status, note)` | `:11` | Cambia estado y agrega entrada al historial del trabajo. | — |
| `persistProgress()` | `:22` | Si aún no hay trabajo activo y hay datos capturados, lo crea con `startGuidedWork`; copia checklist y formulario al trabajo y persiste. | `boolean` |
| `parkActiveWorkForSopChange()` | `:57` | Persiste el avance, marca el trabajo `Detenida` con motivo «Cambio de SOP», limpia `activeWorkId`/`sopRun` y vuelve al intake; si no puede guardar, restaura la copia previa. | `boolean` |
| `handoffOperator(username, password)` | `:79` | Valida credenciales del receptor (sin abrir su sesión), guarda el avance y registra el traspaso con `handoffGuidedSopRun`. | Código de texto: `not-active-work`, `sop-loading`, `not-current-operator`, `invalid-credentials`, `same-operator`, `save-failed` u otro de éxito (`src/workflow.js:79-100`) |
| `startGuidedWork(run)` | `:155` | Crea o actualiza el trabajo con SOP/revisión, hoja, seriales, formulario, checklist y estado `En proceso`; persiste y audita. Si no puede guardar, revierte y devuelve `false`. | `boolean` |
| `submit(event)` | `:220` | Guarda pausa o retrabajo (motivo, nota, paso fallido, evidencia). | — |
| `resume(id)` | `:306` | Reanuda; en retrabajo reabre el paso fallido. | — |
| `prepareCompletionRecord(record)` | `:372` | Enlaza el registro con el trabajo (`workItemId`, SOP, reparación, componente, intento) y fija `recordType`: retrabajo → «Retrabajo enviado a revisión» (estado `Pendiente de revisión`); pausa → «SOP reanudada»; otro → «Validación guiada SOP». | — |
| `completeActiveWork(recordId, operator)` | `:398` | Cierra el trabajo o lo manda a revisión si es retrabajo; limpia `activeWorkId`. | `{saved, needsReview}` |
| `readWorkItems()` / `persistWorkItems(items)` | `src/work-items.js:3`, `:12` | Leen/escriben el arreglo en `localStorage`; ante error devuelven `[]` / `false`. | Lista / `boolean` |
| `storeEvidenceFile(id, file)`, `loadEvidenceFile(id)`, `deleteEvidenceFile(id)` | `src/evidence-store.js:60`, `:71`, `:81` | CRUD de fotos (`{id, blob, name, type, size}`) en IndexedDB `files`. | Promesa |
| `addEvidence`, `removeEvidence`, `openEvidenceReview`, `decideEvidenceReview` | `src/evidence-workflow.js:14`, `:58`, `:77`, `:147` | Alta, baja, visor y aprobación o rechazo de evidencia de un trabajo. | — |
| `saveEvidenceFiles(fileList, existing, onSaved, onError)` | `src/evidence-capture-workflow.js:2` | Valida tipo/tamaño/cantidad y guarda las fotos antes de asociarlas. | Promesa |

## Código clave

Cierre de trabajo (`src/workflow.js:398-420`): un retrabajo no se marca `Completado`; pasa a `Pendiente de revisión` con su evidencia archivada por intento.

```js
const needsReview = item.workKind === "rework";
...
appendEvent(item, needsReview ? "Pendiente de revisión" : "Completado", needsReview
  ? `Evidencia enviada por ${operator}; requiere aprobación del supervisor`
  : `Validación registrada por ${operator}`);
const saved = persistWorkItems(state.workItems);
state.activeWorkId = "";
```

Límites de evidencia (`src/evidence-store.js:5-8`): máximo 5 archivos por envío, 8 MB cada uno, solo JPEG, PNG y WebP. Las validaciones se repiten en `evidence-capture-workflow.js` y `evidence-workflow.js`.

## Trampas

- [Verificado en código] Si `persistWorkItems` falla (cuota de `localStorage`), `startGuidedWork` recarga desde almacenamiento y descarta el trabajo nuevo (`src/workflow.js:190-194`); el usuario no pierde la pantalla pero sí ese avance.
- [Verificado en código] El almacenamiento de trabajos usa `localStorage` (≈5 MB) mientras las fotos van a IndexedDB; un trabajo guarda solo metadatos de evidencia.
- [Verificado en código] La lógica de límites y tipos de evidencia está duplicada en tres archivos.

## Deuda técnica y mejoras sugeridas

- `workflow.js` (437 líneas) es una sola función-fábrica; dividir por responsabilidad (progreso, pausa/retrabajo, entrega).
- Centralizar validación de evidencia.
- No hay pruebas de `workflow.js` ni de los módulos de evidencia (`tests/` solo cubre `sop-run`, `work-stations`, versión PDF y worker).
