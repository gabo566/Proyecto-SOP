# Visión y objetivo

Última actualización: 2026-11-02. Código: `main` @ `11f61c3` (= `origin/main`; árbol con `README.md` modificado, sin commit).

## Resumen

[Verificado en código] El sistema modela el seguimiento de desensamble/retrabajo de nodos GB200 con una SOP visual. Un operador selecciona contexto de estación y equipo, recorre hojas con checklist y puede detener, reanudar, entregar el trabajo a otro operador o registrar el cierre. Un administrador local gestiona revisiones de SOP.

## Problema que resuelve

[Inferido] Reduce la ambigüedad de una ejecución manual al mantener juntos hoja, instrucciones, referencias visuales, datos del nodo, responsable y estado del trabajo. La evidencia y la bitácora quedan asociadas al navegador para una demostración local.

## Usuarios y perfiles

- [Verificado en código] Operador: login local, captura del nodo/tarjeta, checklist, pausas, reanudación, retrabajo y evidencia (`src/views/login.js:1-21`, `src/views/station-intake.js:1-101`, `src/workflow.js:1-437`).
- [Verificado en código] Supervisor: consulta trazabilidad, trabajos y revisión de evidencia; la etiqueta no representa un permiso de servidor (`src/evidence-workflow.js:1-270`, `src/views/traceability.js:1-115`).
- [Verificado en código] Administrador: gestiona perfiles y revisiones de SOP en la interfaz local (`src/user-control.js:1-215`, `src/sop-version-control.js:51-53`).

## Alcance implementado

- SOP base GB200: 46 hojas, 42 procedimientos y 132 pasos (`src/data/sopData.js:11-24`, `src/data/sopData.js:60-341`).
- Catálogo MFG/RWK, asignación de estación y revisiones habilitadas (`src/data/workStations.js:1-109`).
- Visor PDF y referencias visuales (`src/sop-page-viewer.js:1-135`, `src/views/procedure.js:1-144`).
- Registros, trabajos detenidos/retrabajos, evidencia, trazabilidad, reportes y exportación CSV (`src/app.js:81-100`, `src/workflow.js:155-421`, `src/reporting.js:1-126`).

## Fuera de alcance

- [Verificado en código] No hay API, base de datos, autenticación real, control de acceso efectivo, sincronización entre equipos ni auditoría inmutable (`.openai/hosting.json`, `src/user-control.js:1-215`).
- [Verificado en código] El sistema no controla herramientas ni valida físicamente que el paso se haya ejecutado; solo registra la declaración y las marcas (`src/app.js:375-405`, `src/views/completion-dialog.js:1-125`).
- [Pendiente de confirmar] Política oficial de retención, privacidad, respaldo y aprobación de calidad para uso productivo.
