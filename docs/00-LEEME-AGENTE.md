# Entrada para agentes y mantenedores

Fecha de revisión: 2026-11-02. Checkout documentado: `SOP OPERADOR VALIDATION - copia`. Referencia Git: `main` en `11f61c3` (igual a `origin/main`).

## Resumen

Este repositorio contiene un prototipo local para seleccionar una estación MFG/RWK, elegir una revisión de SOP, consultar sus hojas, marcar pasos, detener o reanudar trabajos, registrar validaciones y revisar evidencia. Es HTML, CSS y JavaScript nativo; no hay backend ni autenticación corporativa.

## Orden de lectura

1. [`01-vision-y-objetivo.md`](01-vision-y-objetivo.md): propósito y límites.
2. [`02-arquitectura.md`](02-arquitectura.md): arranque, renderizado y flujo de datos.
3. [`03-mapa-de-archivos.md`](03-mapa-de-archivos.md): inventario y cobertura.
4. [`04-modulos/`](04-modulos/): responsabilidades por grupo de módulos.
5. [`05-modelo-de-datos.md`](05-modelo-de-datos.md): estado, formatos y persistencia.
6. [`06-entorno-y-dependencias.md`](06-entorno-y-dependencias.md): herramientas reales.
7. [`07-ejecutar-probar-desplegar.md`](07-ejecutar-probar-desplegar.md): comandos y resultados.
8. [`08-convenciones-y-reglas.md`](08-convenciones-y-reglas.md): reglas de mantenimiento.
9. [`09-decisiones-e-historial.md`](09-decisiones-e-historial.md): decisiones y lotes documentales.
10. [`10-estado-pendientes-riesgos.md`](10-estado-pendientes-riesgos.md), [`11-seguridad-y-datos-sensibles.md`](11-seguridad-y-datos-sensibles.md) y [`12-glosario.md`](12-glosario.md).

## Reglas de trabajo

- [Verificado en código] `index.html` carga scripts clásicos en un orden explícito; no convertir el proyecto en un framework sin una decisión registrada (`index.html:1-49`).
- [Verificado en código] Las funciones se comparten en el ámbito global del documento. Respetar el orden de carga antes de mover una función (`index.html:14-47`).
- [Verificado en código] La persistencia es local: `localStorage`, `sessionStorage` e IndexedDB. No presentar este prototipo como sistema de producción (`src/app.js:1-77`, `src/user-control.js:1-215`, `src/evidence-store.js:1-90`, `src/sop-version-control.js:1-210`).
- [Verificado en código] Escapar valores que llegan a plantillas HTML con `escapeHtml` (`src/escape.js:1-11`).
- [Pendiente de confirmar] No existe una fuente central de verdad para usuarios, SOP, evidencias o auditoría; cualquier cambio de persistencia requiere definir backend, migración y respaldo.

## Procedimiento antes de editar

1. Leer este archivo, el estado actual y el último historial.
2. Revisar el módulo afectado y sus consumidores; no editar solo por el nombre de un archivo.
3. Clasificar el cambio como verificado, inferido o pendiente.
4. Ejecutar las pruebas que correspondan. En este checkout, `sop-run` y `work-stations` pasan; las limitaciones de Sites/PDF.js están documentadas en `07-ejecutar-probar-desplegar.md`.
5. Actualizar los documentos afectados junto con el cambio de código. Los cambios se registran por lotes de tres, salvo cambios de riesgo o cierre de sesión.

## Historial de integración

[Verificado en Git] El 2026-11-03 se integró `origin/main` por fast-forward (`d3b7e93` → `11f61c3`, 14 commits: zoom por área y anotaciones de hojas SOP, botón «Extraer SOP», catálogo con columna «Status», banner de intake). El checkout local y `origin/main` coinciden; `README.md` conserva ediciones locales sin commit.

## Fuentes y cobertura

La cobertura completa se encuentra en `03-mapa-de-archivos.md`. Los binarios se inventarían por tipo y propósito; no se copian imágenes ni datos personales a la documentación.

No se encontró `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md` ni una carpeta `docs/` previa en este checkout al iniciar la revisión. Sí existía `README.md`; se leyó, se modificó antes de esta corrección (enlace a `docs/`, retiro de credenciales de demostración y del límite de 100 MB, alineado con el código) y no se tocó en el lote L-D01. Esa edición no tiene autorización registrada: [Pendiente de confirmar] con el usuario. Este conjunto `docs/` es ahora la fuente compartida de contexto; si aparece una instrucción local futura, debe leerse antes de cambiar código.
