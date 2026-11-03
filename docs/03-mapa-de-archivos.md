# Mapa de archivos y cobertura

Última actualización: 2026-11-02. Código: `main` @ `11f61c3` (= `origin/main`; árbol con `README.md` modificado, sin commit). Las rutas son relativas a la raíz del checkout.

## Entrada y configuración

| Ruta | Propósito | Estado |
| --- | --- | --- |
| `index.html` | 49 | 2,638 | Contado (lectura completa declarada) |
| `INICIAR-SOP-SIN-RED.bat` | 15 | 320 | Contado (lectura completa declarada) |
| `.gitignore` | 9 | 92 | Contado (lectura completa declarada) |
| `.openai/hosting.json` | 4 | 31 | Contado (lectura completa declarada) |
| `README.md` | Guía rápida y límites del prototipo. | [Verificado en código] Actualizado con enlaces a esta documentación |
| `desktop.ini` | Metadato de Windows ignorado por Git. | [Verificado en inventario] No funcional |

## Código activo

| Grupo | Archivos | Responsabilidad |
| --- | --- | --- |
| Estado/orquestación | `src/app.js`, `src/interactions.js`, `src/focus-management.js`, `src/escape.js` | Estado, render, eventos, foco y escape HTML. |
| Datos | `src/data/sopData.js`, `src/data/workStations.js` | SOP base, procedimientos, PN, áreas y estaciones. |
| Usuarios | `src/user-control.js` | 215 | 13,836 | Contado (lectura completa declarada) |
| Trabajo | `src/sop-run.js`, `src/work-items.js`, `src/workflow.js` | Checklist, pausas, retrabajos, reanudación y handoff. |
| Evidencia | `src/evidence-store.js`, `src/evidence-capture-workflow.js`, `src/evidence-workflow.js` | IndexedDB, carga, revisión y visor de fotos. |
| SOP/PDF | `src/sop-source.js`, `src/sop-page-viewer.js`, `src/sop-version-control.js`, `src/sop-version-preview.js`, `src/sop-version-activation.js` | PDF fuente, visor, extracción, edición y activación. |
| Vistas | `src/views/*.js` | Plantillas de shell, login, intake, procedimiento, diálogos, reportes y trazabilidad. |
| Reportes | `src/reporting.js`, `src/report-interactions.js` | Turnos, filtros, métricas y CSV. |
| Estilos | `src/styles.css`, `src/styles-md3.css` | Diseño base, responsive y capa Material Design 3. |

## Inventario de código y configuración

Líneas y bytes recontados el 2026-11-02 sobre `11f61c3` (tras integrar `origin/main`) (líneas = saltos de línea reales del archivo; la versión anterior de esta tabla sumaba una línea de más). [Verificado en inventario] Los conteos. [Pendiente de confirmar] La lectura completa de cada archivo: la revisión inicial la declaró, pero este lote solo releyó fragmentos; los fragmentos citados en `04-modulos/` sí se leyeron.

| Ruta | Líneas | Bytes | Estado |
| --- | ---: | ---: | --- |
| `.openai/hosting.json` | 4 | 31 | Contado (lectura completa declarada) |
| `index.html` | 49 | 2,665 | Contado (lectura completa declarada) |
| `INICIAR-SOP-SIN-RED.bat` | 15 | 320 | Contado (lectura completa declarada) |
| `offline/LEEME-SIN-RED.txt` | 12 | 1,110 | Contado (lectura completa declarada) |
| `offline/servidor-local.ps1` | 119 | 4,897 | Contado (lectura completa declarada) |
| `scripts/package-offline.py` | 60 | 1,812 | Contado (lectura completa declarada) |
| `scripts/prepare-sites-build.mjs` | 21 | 910 | Contado (lectura completa declarada) |
| `worker/index.js` | 15 | 483 | Contado (lectura completa declarada) |
| `.gitignore` | 9 | 92 | Contado (lectura completa declarada) |
| `src/app.js` | 637 | 28,604 | Contado (lectura completa declarada) |
| `src/desktop.ini` | 2 | 106 | Contado (lectura completa declarada) |
| `src/escape.js` | 11 | 229 | Contado (lectura completa declarada) |
| `src/evidence-capture-workflow.js` | 90 | 4,316 | Contado (lectura completa declarada) |
| `src/evidence-store.js` | 90 | 4,083 | Contado (lectura completa declarada) |
| `src/evidence-workflow.js` | 270 | 12,218 | Contado (lectura completa declarada) |
| `src/focus-management.js` | 40 | 1,621 | Contado (lectura completa declarada) |
| `src/interactions.js` | 640 | 32,994 | Contado (lectura completa declarada) |
| `src/report-interactions.js` | 60 | 2,564 | Contado (lectura completa declarada) |
| `src/reporting.js` | 126 | 6,346 | Contado (lectura completa declarada) |
| `src/sop-page-viewer.js` | 135 | 5,698 | Contado (lectura completa declarada) |
| `src/sop-run.js` | 107 | 4,191 | Contado (lectura completa declarada) |
| `src/sop-source.js` | 41 | 1,570 | Contado (lectura completa declarada) |
| `src/sop-version-activation.js` | 44 | 2,067 | Contado (lectura completa declarada) |
| `src/sop-version-control.js` | 1,374 | 82,029 | Contado (lectura completa declarada) |
| `src/sop-version-preview.js` | 105 | 5,270 | Contado (lectura completa declarada) |
| `src/station-intake.js` | 90 | 4,844 | Contado (lectura completa declarada) |
| `src/styles-md3.css` | 650 | 36,797 | Contado (lectura completa declarada) |
| `src/styles.css` | 1,592 | 156,346 | Contado (lectura completa declarada) |
| `src/user-control.js` | 215 | 13,836 | Contado (lectura completa declarada) |
| `src/work-items.js` | 122 | 17,819 | Contado (lectura completa declarada) |
| `src/workflow.js` | 437 | 20,276 | Contado (lectura completa declarada) |
| `src/data/desktop.ini` | 2 | 106 | Contado (lectura completa declarada) |
| `src/data/sopData.js` | 341 | 26,654 | Contado (lectura completa declarada) |
| `src/data/workStations.js` | 136 | 5,790 | Contado (lectura completa declarada) |
| `src/views/activity.js` | 50 | 4,149 | Contado (lectura completa declarada) |
| `src/views/chart.js` | 16 | 1,119 | Contado (lectura completa declarada) |
| `src/views/completion-dialog.js` | 125 | 13,437 | Contado (lectura completa declarada) |
| `src/views/help.js` | 10 | 1,999 | Contado (lectura completa declarada) |
| `src/views/login.js` | 21 | 1,709 | Contado (lectura completa declarada) |
| `src/views/procedure (1).js` | 51 | 5,277 | Contado (lectura completa declarada) |
| `src/views/procedure.js` | 144 | 16,503 | Contado (lectura completa declarada) |
| `src/views/production.js` | 17 | 1,541 | Contado (lectura completa declarada) |
| `src/views/records.js` | 100 | 9,816 | Contado (lectura completa declarada) |
| `src/views/reports.js` | 45 | 6,030 | Contado (lectura completa declarada) |
| `src/views/shell.js` | 130 | 9,954 | Contado (lectura completa declarada) |
| `src/views/station-intake.js` | 101 | 12,628 | Contado (lectura completa declarada) |
| `src/views/traceability.js` | 115 | 10,823 | Contado (lectura completa declarada) |
| `tests/sites-worker.test.mjs` | 68 | 2,219 | Contado (lectura completa declarada) |
| `tests/sop-run.test.mjs` | 70 | 3,909 | Contado (lectura completa declarada) |
| `tests/sop-version-control.test.mjs` | 98 | 5,464 | Contado (lectura completa declarada) |
| `tests/work-stations.test.mjs` | 120 | 6,279 | Contado (lectura completa declarada) |

Los documentos Markdown se describen en sus propios encabezados y en `00-LEEME-AGENTE.md`.

## Elementos fuera del código fuente

| Ruta | Qué es | Estado |
| --- | --- | --- |
| `node_modules/` | 20 entradas (chart.js, vite, rollup, esbuild, @babel, @types…). No hay `package.json` ni lockfile, y ningún script de `index.html` las usa. Ignorada por Git (`.gitignore:1`). | [Verificado en inventario] Sobrante local; origen y propósito [Pendiente de confirmar] |
| `tmp/` | Capturas QA (`qa-*.png`), `pdfs/` y `pdf-extracted/` (imágenes extraídas del PDF). Ignorada por Git (`.gitignore:2`). No la consume la aplicación. | [Verificado en inventario] Material de trabajo; no auditado imagen por imagen |
| `.playwright-cli/` | Solo contiene `desktop.ini`. | [Verificado en inventario] Vacía de contenido útil |
| `offline/LEEME-SIN-RED.txt` | Instrucciones de texto para el paquete sin red. | [Verificado en inventario] Existe; no se transcribe |
| `public/assets/sop-source-pages/` | Carpeta vacía (solo `desktop.ini`). | [Verificado en inventario] Sin uso aparente |
| `desktop.ini` (varios) | Metadato de Windows, ignorado por Git. | [Verificado en inventario] No funcional |

## Scripts y pruebas

| Ruta | Propósito | Estado |
| --- | --- | --- |
| `worker/index.js` | Fallback HTML para Sites. | [Verificado en código] ESM sin `package.json` local |
| `scripts/package-offline.py` | Empaqueta aplicación, PDF, assets y PDF.js sin `.git`, tests ni `dist`. | [Verificado en código] Leído |
| `scripts/prepare-sites-build.mjs` | Copia worker y hosting a `dist`. | [Verificado en código] Requiere `dist/client/index.html` |
| `tests/sop-run.test.mjs` | Checklist, confirmación y handoff. | [Verificado en ejecución] 3 pasan |
| `tests/work-stations.test.mjs` | Catálogo y estaciones. | [Verificado en ejecución] 6 pasan |
| `tests/sop-version-control.test.mjs` | PDF.js, borrador y gate de administración. | [Pendiente de ejecutar] falta DOMMatrix/canvas en Node |
| `tests/sites-worker.test.mjs` | Worker y artefactos Sites. | [Pendiente de ejecutar] falta modo ESM/dist |

## Recursos binarios

[Verificado en inventario] `public/assets/sop-pages/` contiene 46 hojas completas; `public/assets/sop-step-references/` contiene 132 referencias; `public/assets/sop-step-blocks/` contiene 7 bloques; `public/documents/` contiene el PDF base de 10,265,517 bytes. También hay logos, fondo de login, fuentes locales Roboto/Material Symbols, PDF.js, mapas de caracteres y fuentes estándar.

## Cobertura de lectura

- [Verificado en inventario] La tabla anterior lista los archivos propios de código, configuración y pruebas. La lectura completa fue declarada por la revisión inicial y no fue re-verificada en este lote (ver nota arriba).
- [Verificado en inventario] `public/vendor/pdfjs/` es una dependencia vendorizada/minificada: se comprobó su presencia, worker, mapas, fuentes y consumo, pero no se reescribió ni se auditó línea a línea.
- [Verificado en inventario] Los binarios no se interpretaron como texto; se registró tipo, cantidad, tamaño y consumidor.
- [Pendiente de confirmar] Inspección visual hoja por hoja de las 46 imágenes y prueba completa en navegador; la sesión no dispone de una prueba visual automatizada aprobada.
