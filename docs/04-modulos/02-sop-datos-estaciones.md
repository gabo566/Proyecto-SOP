# Módulo: datos de SOP, estaciones y visor

Última actualización: 2026-11-02. Código: `main` @ `11f61c3` (= `origin/main`; árbol con `README.md` modificado, sin commit).

## Resumen

La SOP base y sus imágenes viven en `src/data/sopData.js` y `public/assets`. `src/data/workStations.js` resuelve catálogo y disponibilidad. `sop-run.js` controla avance; `sop-page-viewer.js` muestra la hoja PDF completa.

## Datos base

- [Verificado en código] `SOP_DOCUMENT` declara ID, título, PDF, revisión, área/estación, familia, cliente, PN y 46 hojas (`src/data/sopData.js:11-24`).
- [Verificado en código] `createProcedure()` normaliza id, hoja, categoría, rango, pasos, nota e imagen (`src/data/sopData.js:36-57`).
- [Verificado en código] `PROCEDURES` contiene 42 procedimientos y pasos numerados, incluidos subpasos (`src/data/sopData.js:60-341`).
- [Verificado en inventario] Hay una imagen por hoja y 132 referencias por paso, además de bloques específicos.

## Estaciones

`WORK_STATION_ASSIGNMENTS` define MFG/TDR, MFG/SYS_ASSY_1, MFG/SYS_ASSY_2 y RWK/RWK (`src/data/workStations.js:1-6`). Las funciones de `src/data/workStations.js:16-109` crean estaciones personalizadas, filtran SOP habilitadas y normalizan la selección intake. El PN del nodo es un catálogo local (`src/data/workStations.js:8-14`).

## Recorrido

`createGuidedSopRun()` crea el orden de procedimientos y el operador responsable (`src/sop-run.js:1-19`). `setGuidedSopStep()` marca pasos; `isGuidedSopProcedureComplete()` bloquea avance si falta uno; `advanceGuidedSopRun()` cambia de hoja o pasa a confirmación (`src/sop-run.js:52-95`).

## Visor

`src/sop-page-viewer.js:1-135` carga PDF.js local, usa el PDF guardado o la ruta pública, calcula escala, pinta canvas y re-renderiza al redimensionar. `src/views/procedure.js:1-144` compone checklist, referencias e información del operador.

## Riesgos

- [Verificado en código] La extracción/importación no modifica automáticamente la SOP base.
- [Verificado en código] Una imagen faltante se resuelve por ruta convencional; una referencia mal nombrada queda sin imagen (`src/data/sopData.js:44-55`).
- [Pendiente de confirmar] Revisión visual de cada recorte contra el PDF controlado.

## Qué NO le corresponde

- No persiste nada: `src/data/sopData.js` y `src/data/workStations.js` son datos y funciones sobre `state`; el guardado está en `sop-version-control.js` y `work-items.js`.
- `sop-run.js` no toca el DOM ni el almacenamiento.

## Funciones principales

| Función | Ubicación | Qué hace | Devuelve |
| --- | --- | --- | --- |
| `createProcedure(sheet, category, title, stepRange, partNumber, steps)` | `src/data/sopData.js:36` | Crea el objeto de hoja y asigna imagen por paso. | Procedimiento |
| `createGuidedSopRun(procedures, document, versionId, user)` | `src/sop-run.js:1` | Crea el recorrido con las hojas que tienen pasos y el operador inicial. Lanza `Error` si no hay pasos. | Objeto `sopRun` |
| `setGuidedSopStep(run, procedureId, stepNumber, checked)` | `src/sop-run.js:56` | Marca o desmarca un paso (guarda números como texto). Ignora hojas ajenas al recorrido. Muta `run`. | — |
| `isGuidedSopProcedureComplete(run, procedure)` | `src/sop-run.js:64` | `true` solo si la hoja tiene pasos y todos están marcados. | `boolean` |
| `advanceGuidedSopRun(run, procedures)` | `src/sop-run.js:89` | Avanza de hoja o pasa a `stage = "confirmation"`; no avanza si falta un paso. | `boolean` |
| `handoffGuidedSopRun(run, nextOperator)` | `src/sop-run.js:25` | Cambia el operador actual y registra el traspaso; rechaza etapa inválida o mismo empleado. | Traspaso o `null` |
| `getGuidedSopProgress(run, procedures)` | `src/sop-run.js:77` | Cuenta pasos completos y total. | `{complete, total}` |
| `getEnabledSopVersionsForStation(state, value)` | `src/data/workStations.js:79` | Revisiones habilitadas de una estación. | Lista |
| `findSopVersionForStation(state, value, versionId)` | `src/data/workStations.js:87` | Revisión pedida o la habilitada de esa estación. | Versión o `undefined` |
| `normalizeStationIntakeAssignment(state)` | `src/data/workStations.js:98` | Corrige la estación elegida si ya no tiene SOP habilitada. | — |
| `isStationIntakeComplete(form)` | `src/data/workStations.js:111` | Exige PN y seriales de nodo y tarjeta. | `boolean` |
| `renderSopPagePreview(zoomAnchor)` | `src/sop-page-viewer.js:38` | Dibuja la hoja PDF en canvas con PDF.js local, reintenta al redimensionar y, si recibe `zoomAnchor` (`pointX/Y`, `pointerX/Y`), desplaza el visor para centrar esa zona. | Promesa |
| `restoreStoredSopSource(state)` / `bindSopSourceInteractions(...)` | `src/sop-source.js:1`, `:11` | Recupera de IndexedDB el PDF fuente guardado y atiende el botón «seleccionar PDF» (guarda con `storeSopSourcePdf`, libera la URL anterior). | `boolean` / — |

## Zoom de hoja y zoom por área (desde `origin/main`)

[Verificado en código] El zoom del visor va de 50 % a 500 % (antes 150 %), inicia en 110 % (`state.sopPageZoom`, `src/app.js:11`). `setSopPageZoom(zoom, anchor)` actualiza el nivel y los botones y vuelve a dibujar solo el canvas (ya no hace `render()` completo) (`src/interactions.js:131-146`). El botón «Ampliar en vista específica» alterna `state.sopFocusedZoom` (`:148`): con él activo, arrastrar sobre el canvas dibuja un recuadro (`startSopAreaSelection`/`updateSopAreaSelection`/`finishSopAreaSelection`, `:170-241`), y al soltar calcula el zoom que lo ajusta al visor y lo centra. Recuadros menores de 18 px se rechazan con un aviso. Los listeners son de `window` (`pointerdown/move/up/cancel`).

## Código clave

Bloqueo de avance (`src/sop-run.js:64-95`): el criterio vive solo aquí, no en la UI.

```js
function isGuidedSopProcedureComplete(run, procedure) {
  return Boolean(procedure?.steps?.length)
    && procedure.steps.every((step) => getGuidedSopCheckedSteps(run, procedure.id).includes(String(step.number)));
}
function advanceGuidedSopRun(run, procedures) {
  const procedure = getGuidedSopProcedure(run, procedures);
  if (run?.stage !== "steps" || !isGuidedSopProcedureComplete(run, procedure)) return false;
  if (run.currentIndex < run.procedureIds.length - 1) run.currentIndex += 1;
  else run.stage = "confirmation";
  return true;
}
```

Resolución de imágenes (`src/data/sopData.js:44-55`): cada paso busca `STEP_IMAGE_OVERRIDES["hoja:paso"]` y, si no existe, `./public/assets/sop-step-references/sheet-<hoja>-step-<paso con guiones>.jpg`. Un paso nuevo sin imagen con ese nombre queda con imagen rota, sin error.

## Trampas

- [Verificado en código] Los números de paso se comparan como texto (`String(step.number)`), porque existen pasos como `22.5.1` o `54.5`.
- [Verificado en código] `SOP_DOCUMENT` es `let` global y se reasigna al activar otra revisión (`src/sop-version-control.js:231-285`); no capturarlo en constantes al cargar el script.
- [Verificado en código] `src/data/sopData.js` contiene un PN de nodo de ejemplo en `SOP_DOCUMENT.nodePartNumber`; es dato de producto, no personal. No se copia aquí.

## Deuda técnica y mejoras sugeridas

- 342 líneas de pasos escritos a mano en `PROCEDURES`: cualquier corrección de la SOP base es un cambio de código.
- No hay prueba que verifique que cada imagen referenciada exista en `public/assets/`.
