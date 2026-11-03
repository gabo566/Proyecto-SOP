# Módulo: versiones de SOP y PDF

Última actualización: 2026-11-02. Código: `main` @ `11f61c3` (= `origin/main`; árbol con `README.md` modificado, sin commit).

## Resumen

`src/sop-version-control.js` administra revisiones locales: carga un PDF, extrae pasos con PDF.js, permite corregirlos, guarda el PDF y la revisión en IndexedDB y controla área/estación/disponibilidad. `sop-version-preview.js` muestra la página completa y resalta el área del paso editado.

## Persistencia

La base `sop-operador-sop-versions-v1` y los stores `versions`/`settings` se abren en `src/sop-version-control.js:1-70`. Se guardan versiones, catálogo y versión activa en `src/sop-version-control.js:71-210`.

## Extracción

`loadSopPdfJs()` importa PDF.js local y configura el worker (`src/sop-version-control.js:314-330`). `groupSopPdfRows()`, `readSopMarkersInRow()` y `readSopRowText()` agrupan texto por coordenadas (`src/sop-version-control.js:332-400`). `extractSopPdfVersion()` lee hojas, metadata, numeración, continuaciones y `sourceBounds` (`src/sop-version-control.js:474-603`).

## Flujo de carga y extracción explícita (desde `origin/main`)

[Verificado en código] Elegir el PDF solo lo guarda en `state.sopUploadFile`/`sopUploadFileName` y habilita el botón; el análisis empieza al enviar el formulario «Extraer SOP» (`src/sop-version-control.js:1212-1224`, `:1348-1372`). Mientras corre, `state.sopVersionBusy = true`. Si ya hay un borrador abierto, no deja elegir otro PDF.

## Anotaciones visuales

[Verificado en código] Cada procedimiento puede llevar `annotations`: flecha (`x1,y1,x2,y2`), recuadro (`x,y,width,height`), número (`x,y,label`) o nota (`x,y,text`, máximo 70 caracteres en el campo), con coordenadas normalizadas a 0–1000 (`clampSopAnnotationCoordinate`, `src/sop-version-control.js:8-10`) y `stepNumber` opcional. `validateSopDraft` limita a 100 anotaciones por hoja (`:663`) y las conserva en la revisión. Se guardan en IndexedDB con la revisión y se dibujan sobre la hoja que ve el operador. Prueba: `tests/sop-version-control.test.mjs` («retains administrator arrows, boxes, numbers and notes»), que además comprueba que `<script>` en una nota sale escapado; no se pudo ejecutar en Node (falta `DOMMatrix`).

## Edición y activación

`validateSopDraft()` rechaza títulos, revisiones, hojas o pasos incompletos/duplicados (`src/sop-version-control.js:604-684`). `renderSopVersionPreview()` genera campos editables y acciones; `bindSopVersionInteractions()` atiende input, click, change y submit (`src/sop-version-control.js:691-1374`). `pauseIncompatibleSopWork()` conserva trabajos activos cuando cambia la versión (`src/sop-version-activation.js:1-44`).

## Vista previa

`src/sop-version-preview.js:1-105` obtiene el Blob/PDF, calcula la escala disponible y dibuja una hoja completa en canvas. Si existe `sourceBounds`, agrega un recuadro azul alrededor del paso editado. No altera el PDF fuente.

## Limitaciones

- [Verificado en código] PDF escaneado sin texto seleccionable no puede ser interpretado por el extractor; requiere OCR/captura manual.
- [Verificado en ejecución] La prueba PDF no arrancó en Node porque PDF.js requiere `DOMMatrix`/canvas; el navegador local HTTP es el entorno previsto.
- [Pendiente de confirmar] Validación semántica automática de columnas, imágenes y discrepancias de ingeniería.

## Qué NO le corresponde

- No cambia la SOP base (`src/data/sopData.js`) ni sus imágenes: una revisión importada vive solo en IndexedDB.
- No decide qué trabajos se reanudan; solo los pausa (`pauseIncompatibleSopWork`) y deja la reanudación al flujo de trabajos.
- No hace OCR ni valida semántica de ingeniería.

## Funciones principales

| Función | Ubicación | Qué hace | Devuelve |
| --- | --- | --- | --- |
| `canManageSopVersions(user)` | `src/sop-version-control.js:51` | Autoriza el administrador de SOP comparando el número de empleado con una constante fija del código y exigiendo rol admin. | `boolean` |
| `openSopVersionDatabase()` | `src/sop-version-control.js:55` | Abre IndexedDB `sop-operador-sop-versions-v1`. | Promesa de `IDBDatabase` |
| `saveSopVersion(version)` / `deleteStoredSopVersion(id)` | `:94`, `:105` | Guardan o borran una revisión. | Promesa |
| `setActiveSopVersionId(id)` / `getActiveStoredSopVersionId()` | `:130`, `:84` | Guardan/leen la revisión activa. | Promesa |
| `saveStoredSopCatalog(catalog)` / `restoreStoredSopCatalog(state)` | `:141`, `:162` | Persisten y recuperan área/estación y habilitación de cada revisión. | Promesa |
| `applySopVersion(version, state, builtIn)` | `:231` | Reasigna los globales `SOP_DOCUMENT`/`PROCEDURES` con la revisión elegida y actualiza `state`. | — |
| `extractSopPdfVersion(pdfFile, pdfjsOverride)` | `:474` | Lee el PDF con PDF.js, detecta marcadores de paso, agrupa texto por filas, calcula `sourceBounds` y arma un borrador. Lanza `Error` si no hay texto utilizable. | Promesa de versión borrador |
| `validateSopDraft(draft)` | `:604` | Valida y normaliza el borrador (campos, hojas únicas, pasos únicos, estación). Lanza `Error` con mensaje en español. | Versión validada |
| `renderSopVersionManager(state)` / `renderSopCatalog(state)` | `:862`, `:823` | HTML del administrador y del catálogo. | `string` |
| `bindSopVersionInteractions(app, {state, render, showToast})` | `:876` | Listeners de carga, edición, guardado, habilitación y borrado. | — |
| `renderSopAnnotationContents(annotations, preview)` / `renderSopAnnotationOverlay(annotations, editable)` | `src/sop-version-control.js:12`, `:47` | Generan el SVG (viewBox 0–1000) de flechas, recuadros, números y notas; los textos pasan por `escapeHtml`. Lo usan la vista previa del administrador y la hoja del operador (`src/views/procedure.js`). | `string` |
| `pauseIncompatibleSopWork(state, targetVersionId)` | `src/sop-version-activation.js:1` | Cambia a `Detenida` los trabajos en proceso de otra revisión y devuelve `{saved, rollback}`. | Objeto |
| `renderSopDraftPdfPage(dialog, version, procedureIndex, stepIndex)` | `src/sop-version-preview.js:34` | Dibuja la hoja del paso editado y el recuadro `sourceBounds`. | Promesa |

## Código clave

Autorización del administrador (`src/sop-version-control.js:51-53`): el criterio es un número de empleado fijo en el código, más el rol.

```js
function canManageSopVersions(user = getActiveLocalUser()) {
  return String(user?.employeeNumber ?? "") === "<número fijo en el código>" && user?.role === "admin";
}
```

Se omite el valor a propósito. Consecuencia: es un permiso de interfaz; cualquiera con DevTools puede alterar `localStorage` o llamar las funciones globales.

Validación del borrador (`src/sop-version-control.js:604-684`): rechaza hoja repetida o no entera, paso sin número o texto, paso repetido en la hoja y SOP sin pasos; recalcula `stepRange`, `totalSheets`, `processSheets` y `processSheetRange`.

Rollback al pausar (`src/sop-version-activation.js:22-43`): guarda una copia de estado, motivo e historial de cada trabajo afectado; si `persistWorkItems` falla, restaura de inmediato.

## Trampas

- [Verificado en código] Una revisión activada sustituye `SOP_DOCUMENT` y `PROCEDURES` globales; los trabajos guardan `sopVersionId` y `sopRevision` para no mezclarse (`src/workflow.js:166-168`).
- [Verificado en código] Al habilitar una revisión se deshabilita la anterior del mismo identificador (descrito en `README.md`; la lógica está en el manejador de cambios del catálogo, `src/sop-version-control.js:1273-1295`, que desmarca las otras filas del mismo identificador).
- [Inferido] El extractor depende del diseño de la SOP de referencia (columnas, numeración `1.-`, `7.1.1.-`); otros formatos pueden fallar.

## Deuda técnica y mejoras sugeridas

- `sop-version-control.js` tiene 1,374 líneas y mezcla IndexedDB, extracción PDF, validación y vista; separar en 3 módulos.
- La autorización por número de empleado fijo debe reemplazarse por control de acceso real si hay backend.
