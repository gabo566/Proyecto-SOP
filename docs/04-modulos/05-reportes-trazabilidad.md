# Módulo: producción, trazabilidad y reportes

Última actualización: 2026-11-02. Código: `main` @ `11f61c3` (= `origin/main`; árbol con `README.md` modificado, sin commit).

## Resumen

Las vistas de actividad, registros, trazabilidad y reportes convierten registros locales y eventos en tablas, métricas, gráfica y CSV. No consultan una base externa.

## Módulos

- `src/reporting.js:1-126`: identifica demo, calcula fecha/turno, filtra, resume y descarga CSV.
- `src/report-interactions.js:1-60`: conecta filtros, paginación, exportación y vista de evidencia.
- `src/views/activity.js:1-50`: tarjetas de detenidos/retrabajos y estados.
- `src/views/records.js:1-100`: validaciones recientes, búsqueda, tabla y evidencia.
- `src/views/traceability.js:1-115`: eventos cronológicos, filtros y CSV.
- `src/views/reports.js:1-45`: filtros de periodo, turno, categoría y operador; resumen y tabla.
- `src/views/chart.js:1-16`: barras de completados por categoría.
- `src/views/production.js:1-17`: vista agregada de producción.

## Indicadores

[Verificado en código] Reportes muestran validaciones, operadores, retrabajos enviados y evidencia; la tabla de operador distribuye completados por categoría (`src/views/reports.js:13-45`). Los datos demo se excluyen salvo que el usuario los incluya (`src/reporting.js:1-42`).

## Limitaciones

- [Verificado en código] Los filtros operan sobre `getRecords()` y trabajos locales (`src/app.js:172-185`).
- [Verificado en código] La exportación es CSV generado en el navegador (`src/reporting.js:57-126`).
- [Pendiente de confirmar] Indicadores corporativos, metas, productividad por turno y conexión a fuente de producción real.

## Qué NO le corresponde

- No crea ni modifica registros: solo lee `getRecords()`, trabajos y bitácora.
- No calcula metas ni productividad; los indicadores son conteos simples.

## Funciones principales

| Función | Ubicación | Qué hace | Devuelve |
| --- | --- | --- | --- |
| `isDemoRecord(record)` | `src/reporting.js:1` | Detecta registros demostrativos por `recordType`, prefijo de `id` (`demo-`) o de serie (`DEMO-`). | `boolean` |
| `filterDemoRecords(records, includeDemo)` | `:5` | Excluye demo salvo petición explícita. | Lista |
| `getShiftForTime(value)` | `:22` | Turno 1: 07:00–14:59; Turno 2: 15:00–22:29; Turno 3: desde 22:30 hasta 05:30; otro: `Sin turno`. | `string` |
| `getReportRecords(records, filters, includeDemo)` | `:32` | Filtra por fecha, turno, categoría y empleado; ordena del más reciente al más antiguo. | Lista |
| `getReportSummary(records)` | `:44` | Total, operadores distintos, retrabajos y evidencia (con porcentaje). | Objeto |
| `downloadReportCsv(records)` / `downloadTraceabilityCsv(events)` | `:63`, `:102` | Generan y descargan CSV en el navegador; `escapeCsvCell` (`:57`) escapa celdas. | — |
| `bindReportInteractions(app, {...})` | `src/report-interactions.js:1` | Conecta filtros, paginación, exportación y visor de evidencia. | — |

## Código clave

Turnos (`src/reporting.js:22-30`):

```js
const minutes = Number(match[1]) * 60 + Number(match[2]);
if (minutes >= 7 * 60 && minutes < 15 * 60) return "Turno 1";
if (minutes >= 15 * 60 && minutes < 22 * 60 + 30) return "Turno 2";
if (minutes >= 22 * 60 + 30 || minutes <= 5 * 60 + 30) return "Turno 3";
return "Sin turno";
```

Trampa: entre 05:31 y 06:59 el resultado es `Sin turno`. [Pendiente de confirmar] si ese hueco es intencional o refleja los turnos reales de la planta.

## Trampas

- [Verificado en código] Un registro cuyo `time` no empieza con `HH:MM` cae en `Sin turno`.
- [Verificado en código] Las fechas de filtro se comparan como texto `AAAA-MM-DD` (`record.date`); funcionan por orden lexicográfico.
- [Verificado en código] Los CSV se arman en memoria; con muchos registros pueden ser pesados.

## Deuda técnica y mejoras sugeridas

- [Verificado en inventario] Ningún archivo de `tests/` menciona `reporting`, `workflow` ni `user-control`; añadir pruebas de turnos y filtros.
