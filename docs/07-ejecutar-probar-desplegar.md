# Ejecutar, probar y desplegar

Última actualización: 2026-11-02. Código: `main` @ `11f61c3` (= `origin/main`; árbol con `README.md` modificado, sin commit).

## Desarrollo local

Desde la raíz del checkout:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Después abrir `http://127.0.0.1:8000/`. [Inferido, no ejecutado en esta revisión] Un servidor estático en la raíz expone `index.html`, `src/` y `public/` (incluido PDF.js). Detener con `Ctrl+C`.

En Windows sin Python:

```text
INICIAR-SOP-SIN-RED.bat
```

[Verificado en código] El BAT llama a `offline/servidor-local.ps1`, que sirve solo en `127.0.0.1:8765` y permite GET/HEAD (`INICIAR-SOP-SIN-RED.bat:1-15`, `offline/servidor-local.ps1:1-92`).

## Validación ejecutada el 2026-11-02

- `node --test tests/sop-run.test.mjs tests/work-stations.test.mjs` → 9 pruebas pasan.
- `python -m py_compile scripts/package-offline.py` → correcto.
- `node --check` para JS/MJS de `src` → correcto.
- `git diff --check` → correcto antes de esta documentación.

## Limitaciones de pruebas

- `tests/sites-worker.test.mjs` → no ejecuta: Node trata `worker/index.js` como CommonJS porque no hay `package.json` con `type: module`; además el test espera `dist/client/index.html`.
- `tests/sop-version-control.test.mjs` → no ejecuta en Node puro: PDF.js requiere `DOMMatrix`, canvas y `@napi-rs/canvas`.
- [Pendiente] Smoke test interactivo en navegador, carga de PDF, IndexedDB, login, evidencia y responsive.

## Empaquetado

```powershell
python scripts/package-offline.py C:\ruta\Proyecto-SOP-sin-red.zip
```

[Verificado en código] `scripts/package-offline.py:1-57` incluye `index.html`, `README.md`, `offline`, `src` y `public`; excluye `.git`, tests y `dist` por su lista explícita.

```powershell
node scripts/prepare-sites-build.mjs
```

[Pendiente] Este comando requiere que exista `dist/client/index.html`; no se ejecutó porque el checkout actual no contiene ese artefacto.

## Despliegue

[Verificado en código] El worker está preparado para Sites, pero este documento no declara un despliegue productivo. El repositorio remoto y Pages requieren una revisión de seguridad y persistencia antes de uso operativo.

## Revalidación del 2026-11-03 (sobre `11f61c3`)

- `node --test tests/sop-run.test.mjs tests/work-stations.test.mjs` → 9 de 9 pasan.
- `node --test tests/sop-version-control.test.mjs` → no corre en Node: `Cannot find module '@napi-rs/canvas'` y no se puede polifillar `DOMMatrix`. La prueba nueva de anotaciones tampoco se ejecutó.
- Nota: `node --test tests/` (carpeta) falla con `Cannot find module`; hay que pasar los archivos.

## Revalidación del 2026-11-02 (lote de correcciones de documentación)

- `node --test tests/sop-run.test.mjs tests/work-stations.test.mjs` → 9 pruebas, 9 pasan, 0 fallan (ejecutado).
- `node --test tests/sites-worker.test.mjs` → falla al cargar `worker/index.js` ("Unexpected token 'export'", Node lo trata como CommonJS) (ejecutado).
- `git diff --check` → sin errores (ejecutado).
- `python -m http.server` y `scripts/package-offline.py` → **no ejecutados** en este lote; los comandos siguen sin resultado observado.
- Prueba en frío de `00-LEEME-AGENTE.md`: ver `09-decisiones-e-historial.md`.
