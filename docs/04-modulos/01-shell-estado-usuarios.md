# Módulo: shell, estado y usuarios

Última actualización: 2026-11-02. Código: `main` @ `11f61c3` (= `origin/main`; árbol con `README.md` modificado, sin commit).

## Resumen

`index.html` carga la aplicación; `src/app.js` es el orquestador; `src/user-control.js` simula sesión/roles; las vistas `shell`, `login`, `station-intake` y `help` construyen el marco inicial.

## Responsabilidades

- `src/app.js:1-77`: crea el estado inicial, recupera trabajo activo y registros locales.
- `src/app.js:152-227`: decide login, intake, dashboard, diálogos, foco y gráfica.
- `src/user-control.js:1-215`: perfiles, autenticación local, usuarios gestionables y eventos de auditoría.
- `src/views/shell.js`: barra lateral, encabezado, secciones y pie.
- `src/views/login.js:1-21`: formulario de acceso.
- `src/views/station-intake.js:1-101`: selección MFG/RWK, SOP, PN y seriales.
- `src/focus-management.js:1-40`: conserva foco y selección durante re-render.

## Entradas y salidas

[Verificado en código] `render()` recibe claves de foco y escribe HTML en `#app`; los eventos delegados llaman handlers y vuelven a renderizar (`src/app.js:152-222`, `src/interactions.js:264-640`). La sesión se identifica mediante `getAuthenticatedLocalUser()`/`getActiveLocalUser()` (`src/user-control.js`).

## Estado relevante

`activeSection`, `operatorFlowReady`, `activeWorkId`, `sopRun`, `form`, `loginError`, filtros, diálogos y errores pertenecen a `state` (`src/app.js:8-77`). No mover un campo a un módulo sin actualizar todos sus consumidores.

## Casos borde y riesgos

- [Verificado en código] Sin usuario autenticado se muestra únicamente login (`src/app.js:152-157`).
- [Verificado en código] El rol de administrador habilita vistas administrativas, pero la autorización es local (`src/app.js:158-171`).
- [Verificado en código] Los valores se interpolan en HTML; `escapeHtml` debe usarse para texto del usuario (`src/escape.js:1-11`).
- [Pendiente de confirmar] Login seguro en servidor, expiración real y recuperación de cuenta.

## Mantenimiento

Cambios de navegación deben actualizar `app.js`, `shell.js`, `interactions.js` y este documento. Mantener el orden de scripts de `index.html`.

## Qué NO le corresponde

- No guarda datos de dominio por sí mismo: delega en `work-items.js`, `evidence-store.js` y `sop-version-control.js`.
- No valida identidad contra un servidor; solo compara contra usuarios guardados en `localStorage`.
- Las vistas (`src/views/*.js`) no mutan `state`; solo devuelven HTML.

## Funciones principales

| Función | Ubicación | Qué hace / efectos | Quién la llama |
| --- | --- | --- | --- |
| `render({focusKey, focusDialog, initial})` | `src/app.js:152` | Decide login, intake o panel; reescribe `#app.innerHTML`; restaura foco; dibuja la gráfica. Sin retorno. | Casi todo handler tras mutar `state`. |
| `readSavedRecords()` / `persistSavedRecords(records)` | `src/app.js:81`, `:87` | Lee/escribe los registros en `localStorage` (`STORAGE_KEY`, `src/app.js:1`). Persistir indica éxito o fracaso. | `getRecords`, `saveCompletion`, workflow. |
| `ensureGuidedSopRun()` | `src/app.js:107` | Si hay flujo listo y no hay `sopRun`, llama `createGuidedSopRun` con la SOP activa y fija hoja actual y formulario. | `render`. |
| `canOperateGuidedSopRun()` | `src/app.js:126` | `true` si la versión del recorrido coincide con la SOP activa y el operador actual es el dueño. | Vistas e interacciones que habilitan pasos. |
| `restoreOperatorFlowForSession()` | `src/app.js:132` | Al iniciar sesión recupera el trabajo activo; si pertenece a otro empleado lo suelta y reinicia el formulario. | Arranque de `app.js`. |
| `handleStationIntakeSubmit()` | `src/app.js:230` | Llama `prepareStationSop` y re-renderiza o muestra el error. | `interactions.js`. |
| `saveCompletion()` | `src/app.js:419` | Arma el registro final con todos los pasos y su estado de cumplimiento y lo persiste. | `handleCompletionSubmit`. |
| `bindInteractions(app, handlers)` | `src/interactions.js:1` | Registra los listeners delegados; `switch` sobre `data-action` en `src/interactions.js:279-381`. | `app.js` al arrancar. |
| `authenticateLocalUser(username, password)` | `src/user-control.js:68` | Verifica credenciales, guarda el id activo en `localStorage` y marca la sesión en `sessionStorage`. Devuelve usuario o `null`. | Login y entrega entre operadores. |
| `getAuthenticatedLocalUser()` | `src/user-control.js:50` | Devuelve el usuario activo solo si `sessionStorage` tiene la marca de sesión. | `render`, flujos. |
| `recordLocalAuditEvent(action, details)` | `src/user-control.js:155` | Agrega un evento a la bitácora local. | Marcado de pasos, login/logout, usuarios. |
| `prepareStationSop(state)` | `src/station-intake.js:9` | Valida estación y PN/seriales, busca la SOP habilitada, pausa trabajos incompatibles (`pauseIncompatibleSopWork`), activa la revisión y deja `operatorFlowReady = true`. Devuelve `{ok, message?}`. | `handleStationIntakeSubmit`. |
| `getStationIntakeStatus(state)` | `src/data/workStations.js:118` | Devuelve el mensaje de estado del intake; si faltan datos, lista cuáles (`Falta capturar: Serie del nodo, …`). | Vista de intake y `updateStationIntakeUI`. |
| `snapshotStationIntake` / `restoreStationIntake` | `src/station-intake.js:1`, `:5` | Guardan y restauran el formulario de intake cuando aún no hay flujo activo. | Re-render de la pantalla de intake. |
| `updateStationIntakeUI`, `renderOperatorFlowProgress` | `src/station-intake.js:58`, `:49` | Actualizan la UI de intake sin re-render completo. | Eventos de campos del intake. |
| `getFocusState()` / `restoreFocus(...)` | `src/focus-management.js:1`, `:10` | Capturan y restauran foco/selección entre renders. | `render`. |

## Código clave

Cada render comprueba la sesión antes de mostrar nada (`src/app.js:153-157`):

```js
if (!getAuthenticatedLocalUser()) {
  app.innerHTML = renderLoginView({ error: state.loginError, username: state.loginUsername });
  document.querySelector(state.loginError ? "#login-password" : "#login-username")?.focus();
  return;
}
```

Por qué importa: no hay rutas ni guardias; toda protección es este `if` más las condiciones de rol de `render` (`src/app.js:159-171`). La sesión vive en `sessionStorage` (`src/user-control.js:50-56`), por lo que cerrar la pestaña la termina, pero el usuario activo queda en `localStorage`.

Cambio de SOP al entrar a una estación (`src/station-intake.js:22-34`): primero se pausan los trabajos de otra revisión y, si falla activar la nueva, se revierte con `pausedWork.rollback()` y se restaura la versión anterior. Es la única operación con rollback explícito del proyecto.

## Trampas

- [Verificado en código] `getActiveLocalUser()` cae al primer usuario activo, o al primer usuario de la semilla, si el id guardado no existe (`src/user-control.js:44-48`). No usarlo como prueba de autenticación; para eso está `getAuthenticatedLocalUser()`.
- [Verificado en código] `readLocalUsers()` reimpone nombre, puesto, usuario, contraseña, número de empleado y rol de los usuarios semilla en cada lectura (`src/user-control.js:21-38`): editar a un usuario semilla en `localStorage` no persiste esos campos.
- [Verificado en código] Las contraseñas se guardan y comparan en texto plano dentro del objeto de usuario (`src/user-control.js:62-66`). Ver `11-seguridad-y-datos-sensibles.md`.

## Deuda técnica y mejoras sugeridas (aparte de los hechos)

- `app.js` mezcla estado, orquestación, guardado de registros y diálogos (637 líneas); separar `saveCompletion` y los handlers de hoja facilitaría pruebas.
- `interactions.js` (640 líneas) concentra más de 100 `case` en un solo `switch` y, desde `origin/main`, también la lógica de selección de área del visor.
- Sin pruebas automáticas de `render` ni de `user-control`.
