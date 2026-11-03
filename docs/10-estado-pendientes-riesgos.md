# Estado, pendientes y riesgos

Última actualización: 2026-11-02. Código: `main` @ `11f61c3` (= `origin/main`; árbol con `README.md` modificado, sin commit). Referencia: `main` / `11f61c3`.

## Estado verificable

| Área | Estado | Evidencia |
| --- | --- | --- |
| Login y perfiles locales | IMPLEMENTADO | `src/user-control.js`, `src/views/login.js` |
| Intake MFG/RWK, PN y seriales | IMPLEMENTADO (rediseño MD3 para operador, C-001, solo verificado en el panel) | `src/views/station-intake.js`, `src/data/workStations.js` |
| SOP base y 132 pasos | IMPLEMENTADO | `src/data/sopData.js` |
| Checklist y avance bloqueado | IMPLEMENTADO | `src/sop-run.js`, `tests/sop-run.test.mjs` |
| Pausa/retrabajo/reanudación | IMPLEMENTADO | `src/workflow.js`, `src/work-items.js` |
| Evidencia y revisión local | IMPLEMENTADO | `src/evidence-*.js` |
| Reportes/trazabilidad/CSV | IMPLEMENTADO | `src/reporting.js`, `src/views/*.js` |
| Importación/edición de PDF | IMPLEMENTADO CON REVISIÓN MANUAL | `src/sop-version-control.js` |
| Anotaciones visuales y zoom por área de hoja | IMPLEMENTADO; solo la prueba de anotaciones existe y no corre en Node | `src/sop-version-control.js:8-49`, `src/interactions.js:131-241`, `tests/sop-version-control.test.mjs` |
| Tests PDF/Sites | PENDIENTE | bloqueos de entorno documentados en `07` |
| Backend, auth real, sincronización | PENDIENTE | no existe en checkout |
| QA visual completa | NO VERIFICADO | falta smoke test de navegador |

## Riesgos

- Persistencia local puede perderse al borrar datos del navegador.
- Credenciales y roles simulados no protegen información.
- La extracción PDF puede confundir columnas, subpasos o documentos escaneados.
- Los módulos `src/app.js`, `src/interactions.js`, `src/workflow.js`, `src/sop-version-control.js` y `src/styles.css` son grandes; futuras funciones deberían separarse antes de crecer.
- `src/views/procedure (1).js` está presente, pero no se carga; puede confundir a un mantenedor.
- Las pruebas de Sites requieren artefactos/configuración que no están en este checkout.

## Integración con el remoto

[Verificado en Git] El 2026-11-03 se integró `origin/main` por fast-forward (`d3b7e93` → `11f61c3`, 14 commits: zoom por área y anotaciones de hojas SOP, botón «Extraer SOP», catálogo con columna «Status», banner de intake). El checkout local y `origin/main` coinciden; `README.md` conserva ediciones locales sin commit. Pendiente: la rama remota `codex/sop-version-control` no se tocó.

## Prioridad inmediata

1. Definir si se requiere backend y autenticación real.
2. Resolver entorno de prueba PDF.js y ESM del worker.
3. Ejecutar smoke test visual en servidor HTTP local.
4. Reconciliar discrepancias de PN con la SOP controlada.

## Riesgos añadidos en la revisión de correcciones (2026-11-02)

- [Verificado en código] Contraseñas guardadas y comparadas en texto plano en el objeto de usuario (`src/user-control.js:62-66`).
- [Verificado en código] La autorización del administrador de SOP depende de un número de empleado fijo en el código (`src/sop-version-control.js:51-53`); el valor no se copia a la documentación.
- [Verificado en Git] El `README.md` de `HEAD` (`11f61c3`, y el de commits anteriores) todavía contiene una tabla con nombres, números de empleado y contraseñas de los perfiles de demostración; el remoto es `origin` en GitHub (`gabo566/Proyecto-SOP`). Quitar la tabla del árbol de trabajo no la borra del historial. [Pendiente de confirmar] Si el repositorio es público y si esas credenciales siguen vigentes en algún sistema real.
- [Verificado en inventario] `node_modules/` sin `package.json` y `tmp/` con capturas e imágenes extraídas (ignoradas por Git) siguen en el directorio; ver `03-mapa-de-archivos.md`.
- [Verificado en código] La validación de evidencia está duplicada en `src/evidence-capture-workflow.js:11`, `src/evidence-workflow.js:25` y `:221`.
- [Verificado en código] `getShiftForTime` deja 05:31–06:59 como «Sin turno» (`src/reporting.js:22-30`).

## Entrega del análisis inicial

### Cobertura

- Conteos de líneas y bytes de 51 archivos propios: recontados el 2026-11-02 (`03-mapa-de-archivos.md`).
- Lectura completa: declarada por la revisión inicial; en este lote se releyeron `index.html`, `sop-run.js`, `escape.js`, `reporting.js` (1-56), `station-intake.js`, `sop-source.js`, `sop-version-activation.js`, `workflow.js` (1-203, 372-437), partes de `app.js`, `user-control.js`, `evidence-store.js`, `sop-version-control.js` y `worker/index.js`.
- No leídos a línea: `public/vendor/pdfjs/` (dependencia empaquetada), imágenes y PDF base (binarios), `tmp/` y `node_modules/`.

### Afirmaciones inferidas o pendientes

- Inferidas: problema que resuelve (`01`), requisitos de navegador (`06`), comando `python -m http.server` (`07`), dependencia del extractor al formato de la SOP de referencia (`04-modulos/03`).
- Pendientes de confirmar: backend y autenticación reales; retención y respaldo de evidencia; clasificación de datos; discrepancias de PN con la SOP controlada; QA visual de las 46 hojas; origen de `node_modules/`; si el hueco de turno 05:31–06:59 es intencional; vigencia de las credenciales del historial Git.

### Preguntas abiertas para el usuario

1. ¿Autorizas editar `README.md`? Ya se modificó antes de este lote (enlace a `docs/`, retiro de credenciales y del límite de 100 MB); aquí no se tocó más.
2. ¿El repositorio de GitHub es público? ¿Hay que rotar o reescribir historial por las credenciales antiguas?
3. ¿`node_modules/` y `tmp/` se pueden eliminar o dejarse como están?
4. ¿Quieres que se corrija el hueco de turno y el `worker` ESM (cambios de código)?
5. ¿Se integra también la rama remota `codex/sop-version-control` (no revisada)?
