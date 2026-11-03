# Arquitectura implementada

Última actualización: 2026-11-02. Código: `main` @ `11f61c3` (= `origin/main`; árbol con `README.md` modificado, sin commit).

## Resumen

[Verificado en código] La aplicación es un documento HTML con scripts globales. `src/app.js` mantiene el estado, decide qué vista se renderiza y enlaza los flujos; las vistas devuelven HTML como cadenas; los módulos de interacción usan delegación de eventos sobre `#app`.

## Componentes

```text
index.html
  ├─ datos y utilidades globales (sopData, workStations, reporting, escape, user-control)
  ├─ persistencia y dominio (work-items, evidence-store, SOP versions, workflow)
  ├─ vistas (shell, login, intake, procedure, reports, traceability, dialogs)
  ├─ interacción (interactions, report-interactions, focus-management)
  └─ app.js → state → render() → HTML + listeners

Browser storage
  ├─ localStorage: sesión local, usuarios, registros, trabajos, bitácora
  └─ IndexedDB: PDF fuente, evidencia, revisiones y catálogo de SOP
```

## Arranque y renderizado

1. [Verificado en código] `index.html` carga el CSS y luego los scripts en orden (`index.html:7-49`).
2. [Verificado en código] `app.js` lee trabajos y usuario, construye `state` y muestra login si no hay sesión (`src/app.js:1-77`, `src/app.js:152-193`).
3. [Verificado en código] El estado `activeSection` dirige a overview, production, traceability, reports, users o sop-admin (`src/app.js:177-189`).
4. [Verificado en código] Cada render vuelve a insertar el shell, los diálogos y el contenido; luego restaura foco y dibuja la gráfica (`src/app.js:190-227`).

## Flujo operativo

```text
login local
  → estación/SOP + PN y seriales
  → createGuidedSopRun
  → hoja actual + checklist
  → persistProgress / pause / rework / handoff
  → confirmación final
  → record local + evidencia + auditoría
```

[Verificado en código] El avance solo continúa cuando todos los pasos de la hoja están marcados (`src/sop-run.js:56-107`, `src/app.js:307-349`).

## Flujo de revisión de SOP

```text
PDF elegido
  → PDF.js getDocument
  → filas de texto y marcadores de paso
  → procedures + sourceBounds
  → edición manual y vista previa
  → IndexedDB
  → catálogo área/estación + habilitación
```

[Verificado en código] La extracción es heurística y la revisión humana es obligatoria (`src/sop-version-control.js:314-604`).

## Integración de hosting

[Verificado en código] `worker/index.js` solo sirve el asset solicitado y hace fallback a `index.html` para GET/HEAD HTML desconocidos. No implementa operaciones, API ni persistencia (`worker/index.js:1-15`).
