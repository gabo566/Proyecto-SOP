# Convenciones y reglas de mantenimiento

Última actualización: 2026-11-02. Código: `main` @ `11f61c3` (= `origin/main`; árbol con `README.md` modificado, sin commit).

## Código

- [Verificado en código] JavaScript clásico global; las funciones se deben declarar antes de que otro script las use (`index.html:14-47`).
- [Verificado en código] Las vistas construyen HTML con template strings y escapan entradas (`src/escape.js:1-11`).
- [Verificado en código] Las acciones se identifican con `data-action` y se resuelven por delegación (`src/interactions.js:264-640`).
- [Verificado en código] Estado mutado se persiste mediante helpers de almacenamiento, no mediante variables aisladas (`src/app.js:81-100`, `src/work-items.js:1-18`).
- [Verificado en código] Mantener accesibilidad: `aria-label`, foco y `<dialog>` son parte del flujo (`src/focus-management.js:1-40`, `src/app.js:197-222`).

## Datos y seguridad

- No agregar contraseñas, tokens, claves o datos personales a documentación, tests o logs.
- No convertir usuarios demo en autenticación de producción.
- No usar `file://` como ruta principal para PDF.js si el navegador bloquea módulos/worker; usar HTTP local.
- No borrar datos locales sin confirmar el alcance; el navegador es la única persistencia actual.

## UI

- Mantener la capa base y la capa Material Design 3 separadas (`src/styles.css`, `src/styles-md3.css`).
- Revisar media queries después de tocar tablas, visor, diálogos o navegación.
- Respetar `prefers-reduced-motion` si se agregan animaciones.

## Documentación

Cada cambio significativo actualiza el documento afectado. Los lotes de mantenimiento se registran en `09-decisiones-e-historial.md` después de tres cambios validados o inmediatamente si cambian arquitectura, seguridad, datos o persistencia.
