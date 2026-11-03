# Entorno y dependencias

Última actualización: 2026-11-02. Código: `main` @ `11f61c3` (= `origin/main`; árbol con `README.md` modificado, sin commit).

## Resumen

No hay `package.json`, lockfile ni dependencias npm declaradas; existe una carpeta `node_modules/` local sin uso (ver nota abajo). El navegador ejecuta archivos estáticos y usa APIs web; PDF.js, fuentes y recursos se incluyen localmente.

## Herramientas observadas

- [Verificado en ejecución] Node.js `v22.19.0`.
- [Verificado en ejecución] Python `3.13.14`.
- [Verificado en código] PDF.js local en `public/vendor/pdfjs/`.
- [Verificado en código] APIs: localStorage, sessionStorage, IndexedDB, File API, Blob/URL, `crypto.randomUUID`, canvas y `<dialog>`.
- [Verificado en código] `.openai/hosting.json` no declara bindings D1/R2.

## Dependencias locales

`public/assets/fonts/` contiene Roboto variable y Material Symbols Rounded con sus licencias. `public/vendor/pdfjs/` contiene módulo, worker, mapas de caracteres, fuentes estándar y licencias. No se descarga una dependencia externa al abrir la aplicación.

## Configuración

[Verificado en código] No se encontraron variables de entorno requeridas ni archivos de configuración de backend. `.gitignore` excluye `.env` y `.env.*`, salvo `.env.example` si algún día se incorpora.

## Compatibilidad

[Inferido] Se requiere navegador moderno con IndexedDB, `<dialog>`, canvas, File API y ES2020+. PDF.js puede requerir origen HTTP local para importar módulo/worker; abrir por `file://` no es el camino confiable.

## `node_modules/` sin manifiesto

[Verificado en inventario] Existe `node_modules/` con 20 entradas (por ejemplo `chart.js`, `@vitejs`, `rollup`, `esbuild`, `@babel`), pero no hay `package.json` ni lockfile, `index.html` no carga nada de esa carpeta y está ignorada por Git (`.gitignore:1`). Se trata como sobrante local de una herramienta anterior. [Pendiente de confirmar] Quién la instaló y si alguna herramienta externa la necesita. No borrarla sin confirmarlo (regla 1 de esta fase: solo documentación).

## Carga de scripts

[Verificado en código] `index.html:14-47` carga los scripts con `defer` y en orden de documento. El orden efectivo es: datos (`sopData`, `workStations`), `reporting`, `escape`, `user-control`, `work-items`, `sop-version-activation`, `views/production`, `evidence-store`, `sop-source`, `sop-version-control`, `sop-version-preview`, `station-intake`, `sop-run`, `sop-page-viewer`, módulos de evidencia, `workflow`, vistas, `interactions`, `report-interactions`, `focus-management` y, al final, `app.js`. Todo es ámbito global: una función usada por otro archivo debe declararse en un script anterior o invocarse solo después de que `app.js` arranque.
