# Módulo: scripts, worker y pruebas

Última actualización: 2026-11-02. Código: `main` @ `11f61c3` (= `origin/main`; árbol con `README.md` modificado, sin commit).

## Scripts

- `scripts/package-offline.py:1-57` crea un ZIP autocontenido desde rutas permitidas; excluye `.git`, tests y `dist` por diseño del conjunto incluido.
- `scripts/prepare-sites-build.mjs:1-20` valida `dist/client/index.html`, worker y hosting; copia worker y hosting a `dist`.
- `worker/index.js:1-15` implementa fallback de `index.html` para rutas HTML GET/HEAD.
- `INICIAR-SOP-SIN-RED.bat:1-15` delega en `offline/servidor-local.ps1` y no inicia servicios externos.

## Pruebas existentes

`tests/sop-run.test.mjs` valida checklist y handoff; `tests/work-stations.test.mjs` valida estaciones y revisiones; `tests/sop-version-control.test.mjs` valida extracción PDF y borrador; `tests/sites-worker.test.mjs` valida worker y artefactos.

## Resultados de esta revisión

- [Verificado en ejecución] `node --test tests/sop-run.test.mjs tests/work-stations.test.mjs`: 9 pruebas pasan.
- [Verificado en ejecución] `python -m py_compile scripts/package-offline.py`: pasa.
- [Verificado en ejecución] Sintaxis de los `.js/.mjs` bajo `src`: pasa.
- [Pendiente] `tests/sites-worker.test.mjs` falla antes de probar por `worker/index.js` ESM sin `package.json` con `type: module`, y espera `dist/client/index.html`.
- [Pendiente] `tests/sop-version-control.test.mjs` falla en Node sin `DOMMatrix`, canvas y `@napi-rs/canvas`.
- [Pendiente] Prueba visual/interactiva en navegador; no se afirma como ejecutada.

## Qué NO le corresponde

- Los scripts no forman parte de la aplicación en ejecución; `worker/index.js` no sirve datos ni persiste.
- Las pruebas no tocan el navegador real: son Node puro.

## Funciones y archivos

| Archivo | Qué hace | Efectos |
| --- | --- | --- |
| `scripts/package-offline.py` | Crea un ZIP con `index.html`, `README.md`, `offline`, `src` y `public`. | Escribe el ZIP en la ruta indicada. |
| `scripts/prepare-sites-build.mjs` | Verifica `dist/client/index.html` y copia worker y hosting a `dist`. | Escribe en `dist/`. |
| `worker/index.js` | `export default` con `fetch`: sirve el asset y, si es GET/HEAD HTML desconocido, devuelve `index.html`. | Ninguno. |
| `offline/servidor-local.ps1` | Servidor HTTP mínimo en `127.0.0.1:8765`, solo GET/HEAD; responde 405 al resto (`:89-90`). | Abre un puerto local. |
| `INICIAR-SOP-SIN-RED.bat` | Comprueba PowerShell y lanza el script con `-ExecutionPolicy Bypass` solo para ese proceso. | Inicia el servidor. |

## Código clave

Lanzamiento offline (`INICIAR-SOP-SIN-RED.bat:11`):

```bat
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0offline\servidor-local.ps1"
```

`-ExecutionPolicy Bypass` evita el bloqueo de scripts firmados en el equipo del operador; aplica solo a ese proceso, no cambia la política del sistema.

## Pruebas existentes y cobertura

| Prueba | Cubre | Estado verificado |
| --- | --- | --- |
| `tests/sop-run.test.mjs` | Checklist, confirmación y traspaso. | 3 pasan |
| `tests/work-stations.test.mjs` | Catálogo, visibilidad por estación y revisión exacta. | 6 pasan |
| `tests/sop-version-control.test.mjs` | Extracción PDF y borrador. | No ejecuta en Node (falta `DOMMatrix`/canvas) |
| `tests/sites-worker.test.mjs` | Worker y artefactos Sites. | No ejecuta (ESM sin `package.json`; espera `dist/`) |

Sin cobertura: `workflow.js`, `evidence-*.js`, `reporting.js`, `user-control.js`, vistas e interacciones.

## Trampas

- [Verificado en ejecución] `node --test tests/sites-worker.test.mjs` falla al importar el worker como CommonJS.
- [Verificado en código] `tests/sop-run.test.mjs:1-14` carga el script con `node:vm` (`vm.runInContext`) porque el código fuente son scripts globales, no módulos ES.

## Deuda técnica y mejoras sugeridas

- Añadir `package.json` con `"type": "module"` solo para el worker, o renombrarlo a `.mjs` (cambio de código: requiere autorización).
- No hay integración continua ni linter ([Verificado en inventario]: no existe `.github/` ni configuración de lint).
