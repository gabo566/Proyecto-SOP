# Decisiones e historial

Última actualización: 2026-11-02. Código: `main` @ `11f61c3` (= `origin/main`; árbol con `README.md` modificado, sin commit).

## Decisiones vigentes

### D-001 — Prototipo browser-local

- Origen: [Verificado en código] `src/app.js`, `src/user-control.js`, `src/work-items.js`, `src/evidence-store.js`.
- Decisión: conservar registros, trabajos, perfiles y evidencia en almacenamiento del navegador.
- Motivo: el checkout no contiene backend, API ni configuración de BD.
- Consecuencia: no hay sincronización, respaldo central ni autenticación real.
- Estado: aprobado para demostración; pendiente para producción.

### D-002 — SOP base estática + revisiones locales

- Origen: [Verificado en código] `src/data/sopData.js`, `src/sop-version-control.js`.
- Decisión: mantener una SOP base en código y guardar revisiones cargadas en IndexedDB.
- Motivo: permite revisar cambios sin reemplazar la fuente base.
- Consecuencia: las revisiones dependen del navegador/origen local.
- Estado: implementado.

### D-003 — Checklist bloquea avance

- Origen: [Verificado en código] `src/sop-run.js:56-95`, `tests/sop-run.test.mjs`.
- Decisión: no avanzar de hoja mientras falte un paso.
- Estado: implementado y probado con tests de dominio.

## Historial Git comprobado

[Verificado en Git] La rama actual es `main` y su HEAD es `d3b7e93` (`feat: refine SOP management and preview`). [Corrección 2026-11-02] La versión anterior decía que coincidía con `origin/main`; era falso. El 2026-11-03 se integró `origin/main` por fast-forward (`d3b7e93` → `11f61c3`, 14 commits: zoom por área y anotaciones de hojas SOP, botón «Extraer SOP», catálogo con columna «Status», banner de intake). El checkout local y `origin/main` coinciden; `README.md` conserva ediciones locales sin commit. Commits integrados, de más nuevo a más viejo: `11f61c3`, `cec8865`, `96657c5`, `5d603cf`, `79a88a2`, `c761a70`, `c81b292`, `617c74f`, `d2181f7`, `a1ad9b5`, `4d7b388`, `4c07d9d`, `e990fb8`, `4bf94c7`.

## Lotes de mantenimiento

### Lote documental L-D01 (2026-11-02) — correcciones de la auditoría de documentación

No son cambios de código; no usan la numeración C-nnn. Archivos tocados: `docs/00` a `docs/12` y `docs/04-modulos/*.md`.

1. **Cobertura e inventario** (`03`, `06`): conteos de líneas recalculados (la tabla sumaba una línea de más), alta de `node_modules/`, `tmp/`, `.playwright-cli/`, `offline/LEEME-SIN-RED.txt` y `sop-source-pages/`; el estado «leído completo» pasa a «declarado, no re-verificado».
2. **Profundidad de módulos** (`04-modulos/01` a `07`, `05`): tablas de funciones con ubicación, efectos y llamadores; fragmentos de código con ruta y líneas; secciones «Qué NO le corresponde», trampas y deuda técnica; ejemplos de datos ficticios.
3. **Riesgos y trazabilidad** (`00`, `07`, `09`, `10`, `11`): línea de versión de código en cada documento, riesgo de credenciales en el historial Git, contraseñas en texto plano, local `main` detrás de `origin/main`, correcciones de líneas citadas (`worker/index.js:1-15`, `INICIAR-SOP-SIN-RED.bat:1-15`, `reports.js:13-45`, `index.html:14-47`).

- Validación: ver la revalidación de `07-ejecutar-probar-desplegar.md` y la prueba en frío abajo.
- Revertir: los documentos son archivos sin seguimiento en Git (`docs/` no está versionada); no hay copia previa. Para volver atrás habría que reescribir el contenido original; por eso se recomienda versionar `docs/` tras la revisión del usuario.
- Pendiente: el `README.md` modificado antes de este lote no se tocó más.

### C-001 (2026-11-03) — Rediseño Material Design de «Registrar validación» para operador

- **Solicitud:** «aplico un diseño con Material Design […] es para un operador, tiene que ser llamativo y tiene que ser intuitivo en la parte de registrar validación.»
- **Estado previo:** pantalla con texto pequeño (10–13 px), campos de 42 px, botón gris sin explicar qué faltaba, mensaje de estado solo cuando los cuatro datos estaban completos.
- **Archivos tocados:** `src/views/station-intake.js`, `src/data/workStations.js`, `src/station-intake.js`, `src/styles-md3.css`, `index.html`.
- **Qué cambió:** títulos de sección en lenguaje directo con número («¿Dónde vas a trabajar?», «Captura los datos del equipo»); iconos en tarjetas y etiquetas; tarjetas de estación grandes con check; campos de 64 px con borde verde y check al llenarse; mensaje de estado siempre visible con los campos que faltan (`getStationIntakeStatus`); botón principal «Abrir la SOP» (antes «Continuar a la SOP»); atributos `autocapitalize`, `spellcheck="false"` y `enterkeyhint="next"` en los campos de captura.
- **Cómo:** el marcado conserva todos los `data-*` y los selectores que usa la lógica (`data-station-type`, `data-form-field`, `data-focus-key`, `#station-intake-status`); el estilo es un bloque nuevo al final de `styles-md3.css` que prevalece por orden de carga. `updateStationIntakeUI` ahora actualiza el texto y el icono del estado dentro de sus `<span>`.
- **Impacto:** el texto de `getStationIntakeStatus` cambió («Completa los cuatro datos obligatorios…» → «Falta capturar: …»); ningún test lo usa. Se añadió `?v=md3-operator` a cuatro recursos de `index.html` para evitar caché.
- **Validaciones:** `node --test tests/sop-run.test.mjs tests/work-stations.test.mjs` → 9 pasan; `node --check` de los tres JS; vista real en el panel por `http://127.0.0.1:8000` con perfil operador de demostración: pantalla de escritorio y móvil (375 px), estado «Falta capturar…» y estado «Información completa» con los cuatro campos llenos. No se probó: continuar a la SOP, tabletas, otros navegadores, lector de pantalla.
- **Resultado y pendientes:** se descartó convertir a mayúsculas con CSS porque el valor guardado no coincidía con lo mostrado; si se quiere forzar mayúsculas, hay que normalizar el valor en la captura (cambio de datos). El estado «Estación: RWK» se apila en móvil.
- **Revertir:** `git checkout -- index.html src/views/station-intake.js src/data/workStations.js src/station-intake.js src/styles-md3.css` (no commiteado; estos archivos solo tienen este cambio sin commit).

### C-002 (2026-11-03) — Encabezado MD3 de «Registrar validación»

- **Solicitud:** «Aplica Material Design 3 en la parte de registrar validación. Veo en el header […] que llame la atención, que esté también profesional, pero que se vea estético, resaltivo, intuitivo.»
- **Estado previo:** banda roja plana con logo, título y datos del usuario en texto pequeño (`src/views/station-intake.js:50-56`).
- **Archivos tocados:** `src/views/station-intake.js`, `src/styles-md3.css`, `index.html` (parámetro `?v=`).
- **Qué cambió:** degradado rojo con círculos decorativos y esquinas inferiores de 32 px; logo en chip blanco; icono dentro de contenedor tonal de 68 px; etiqueta «Paso 1 de 3 · Seleccionar estación»; título de hasta 46 px; usuario en tarjeta translúcida con avatar blanco y chip de rol (el rol salió de la línea de texto); el progreso pasó a una tarjeta blanca que se solapa con el encabezado.
- **Cómo:** marcado nuevo sin tocar `data-*` ni ids; reglas añadidas al final de `styles-md3.css` con puntos de corte a 1000 y 650 px. Ajuste: `.station-intake-user > span:nth-child(2)` vuelve a ser `grid` porque el chip de rol pasó a ser el último hijo.
- **Impacto:** el texto «Paso 1 de 3» está escrito a mano, solo aplica al intake (paso 1). Otros usos de `.station-intake-user` y `.operator-flow-progress` en la hoja SOP comparten clases: los estilos de progreso de C-001/C-002 se acotaron a `.station-intake-screen` para no afectar la hoja SOP; [Pendiente] comprobarlo visualmente en esa pantalla.
- **Validaciones:** 9 pruebas pasan; vista real en el panel (escritorio y móvil 375 px) con perfil administrador de demostración. No se revisó la pantalla de la hoja SOP ni tabletas.
- **Revertir:** `git checkout -- src/views/station-intake.js src/styles-md3.css index.html` revertiría también C-001 (mismos archivos, sin commit); para quitar solo C-002 hay que borrar de `styles-md3.css` el bloque «encabezado MD3» y restaurar las líneas 50-56 del marcado.

### C-003 (2026-11-03) — Encabezado compacto y logo sin fondo blanco

- **Solicitud:** «La vista está muy grande. ¿Puedes arreglar el diseño? Y el logo también quiero que se adapte al fondo […] quitarle el fondo blanco, hacerlo más grande para que resalte.»
- **Estado previo:** encabezado de ~203 px de alto con el logo en un chip blanco (`ingrasys-logo.png`); secciones y campos grandes de C-001/C-002.
- **Archivos tocados:** `src/views/station-intake.js` (el banner usa `ingrasys-logo-dark.png`), `src/styles-md3.css` (bloque «C-003» al final), `index.html` (`?v=`).
- **Qué cambió:** encabezado de ~100 px; degradado de granate oscuro (izquierda) a rojo de marca (derecha); logo de hasta 88 px de alto y 280 px de ancho sin tarjeta; título en una sola línea; tarjeta de usuario, progreso, secciones, tarjetas de estación (112 px), campos (54 px) y botón (62 px) reducidos.
- **Cómo:** `ingrasys-logo-dark.png` es opaco (letras blancas y arco rojo sobre negro, sin canal alfa). Se quita el negro con `mix-blend-mode: screen` sobre el fondo oscuro del degradado: el negro desaparece, el blanco se conserva y el arco rojo se aclara. No se creó un PNG nuevo.
- **Impacto:** el efecto depende de que el fondo detrás del logo sea oscuro; sobre un fondo claro el logo se vería mal. El archivo `ingrasys-logo.png` ya no se usa en el intake (sigue en el repo).
- **Validaciones:** 9 pruebas pasan; vista real en el panel a escritorio y móvil (375 px) tras el cambio; «Abrir la SOP» con datos ficticios abre la hoja 5 de 46 con su progreso y checklist, sin estilos rotos por las reglas nuevas. No se probó tableta ni otros navegadores. La hoja SOP conserva el estilo anterior (no rediseñada).
- **Revertir:** borrar el bloque «C-003» de `styles-md3.css` y devolver `ingrasys-logo.png` en el marcado (sin commit, junto con C-001 y C-002).

### C-004 (2026-11-03) — Auditoría MD3 de toda la aplicación y rediseño de la hoja SOP

- **Solicitud:** «Sí, rediseñar» (hoja SOP) y «audita cada sección de diseño de la página y si hay algo que no ha sido adaptado todavía al Material Design, aplícalo.»
- **Auditoría (escritorio, panel del navegador):** Producción, Trazabilidad, Reportes, Crear usuarios, Modificar SOP, hoja SOP, ayuda y registro ya tenían tarjetas y chips parciales de MD3, pero con tipografía de 8–11 px, encabezado superior rojo plano y botones/campos con formas distintas entre pantallas.
- **Archivos tocados:** `src/styles-md3.css`, `index.html` (`?v=md3-c004i`), `src/views/login.js` y `src/views/station-intake.js` (solo el `src` del logo) y el archivo nuevo `public/assets/ingrasys-logo-transparent.png`. Sin cambios de lógica.
- **Qué cambió:** (1) escala tipográfica mínima: 8→11, 9→12, 10→13, 11→13, 12→14, 13→14 px, generada con un script a partir de las reglas existentes de `styles.css` y de la parte original de `styles-md3.css` (≈400 líneas, bloque «C-004: escala tipográfica» antes del bloque del intake); (2) tokens globales `--md-*` en `:root`; (3) encabezado superior de todas las secciones con el mismo degradado, chip de etiqueta e icono tonal que el intake; (4) botones pill, botones tonales y contorneados, diálogos de 28 px, foco visible; (5) hoja SOP: progreso en tarjeta, tarjetas de contexto, barra de zoom en píldora, checklist con casillas de 26 px, ítems verdes al marcarse, barra de progreso verde, botones de acción de 52 px.
- **Impacto:** los textos más grandes pueden desbordar tablas o filas densas; en las pantallas revisadas no se vio desbordamiento. El script reescribe tamaños por selector: si se edita `styles.css`, los tamaños nuevos no se regeneran solos (hay que volver a generar el bloque). Cualquier font-size no entero o fuera de 8–13 px no se modificó.
- **Revisión posterior (mismo día):** se corrigió (a) Trazabilidad: celdas con `white-space: nowrap` se solapaban con el texto grande; ahora `td:nth-child(n+2)` envuelve línea y la tabla mide 1240 px; (b) última columna de `.table-scroll` envuelve; (c) casilla de declaración final de 26 px con estado verde; (d) login: el logo seguía en caja negra porque `mix-blend-mode` no actúa dentro del contexto de apilamiento de `.login-content`; se generó `public/assets/ingrasys-logo-transparent.png` (994×293 px, 147 KB) con Pillow a partir de `ingrasys-logo-dark.png` (alfa por brillo: negro→transparente, blanco y rojo opacos) y se usa en login e intake; botón de login rojo y campos con borde claro.
- **Validaciones:** 9 pruebas pasan; revisión visual en el panel (escritorio): intake, hoja SOP, última hoja, diálogo de confirmación final, diálogo de registros, Producción, Trazabilidad, Reportes, Crear usuarios, Modificar SOP, ayuda y login; móvil de 375 px (intake y hoja SOP, parte superior). Un barrido por JavaScript de texto desbordado en las seis secciones solo encontró la tabla de auditoría de «Crear usuarios» (ya con envoltura). Segunda revisión: diálogos de entrega de operador, detener/retrabajo, revisión de evidencia (con una imagen generada en el navegador) y vista previa del borrador de SOP (con el PDF base extraído por `extractSopPdfVersion`, 42 hojas): ya tenían forma MD3; se mejoraron campos de diálogos (48 px, borde y foco de marca), las opciones «Tipo de registro» como tarjetas seleccionables y el botón de evidencia como píldora tonal. A petición del usuario, el progreso de pasos del intake se separó del encabezado (`margin: 18px auto 6px`, antes −12 px). No revisadas: tableta, otros navegadores, flujos de subida real de archivos, entrega de operador con credenciales reales.
- **Revertir:** quitar de `styles-md3.css` los bloques «C-004» (escala tipográfica y auditoría); sin commit y comparte archivo con C-001 a C-003.

### C-005 (2026-11-03) — Tono del menú, tarjeta de usuario azul y composición centrada

- **Solicitud:** quitar el naranja oscuro y usar el tono del botón del menú; el desvanecido oscuro de la izquierda del encabezado debe ser de ese tono; resaltar la tarjeta del usuario con un azul menos oscuro; centrar y distribuir uniformemente textos y logos; que las tarjetas abarquen los costados sin espacios en blanco.
- **Interpretación:** el botón activo del menú es `#a92328` (rojo); se tomó como el «naranja suave». Esto sustituye el naranja `#e89a2e` puesto antes en el chip RWK (que fue una lectura equivocada). [Pendiente de confirmar] con el usuario si buscaba justo ese rojo.
- **Archivos tocados:** `src/styles-md3.css` (bloques «C-005»), `index.html` (`?v=md3-c005b`). Sin cambios de marcado ni de lógica.
- **Qué cambió:** degradado del encabezado del intake y del `.topbar` de `#a92328` a `#dc6a62` sin zona oscura; contorno oscuro fino en el logo para que el arco rojo no se pierda; chip RWK y los iconos naranja/ámbar de las tarjetas de resumen y contexto pasan a `#a92328`; `.station-intake-user` y `.profile-chip` en degradado azul `#2f80ed`→`#1f5fc4` con borde blanco, avatar blanco y chip de rol blanco; encabezado en tres zonas (logo, título, usuario) centradas; pantalla a 100 % de ancho con 20 px de margen y tarjetas, progreso y resumen a todo el ancho; títulos de sección centrados con el número encima.
- **Impacto:** el chip RWK y el arco del logo comparten tono con la tarjeta seleccionada; se mitigó con contorno y anillo blanco. Todo el diseño sigue sin commit.
- **Validaciones:** 9 pruebas pasan; panel del navegador: intake escritorio y móvil (375 px) y hoja SOP (barra superior con el chip azul). No revisado: tableta, otras secciones con el nuevo degradado más allá del encabezado, ni Playwright (no hay MCP de Playwright instalado; se usó el panel del navegador de Claude).
- **Revertir:** quitar de `styles-md3.css` los bloques «C-005»; sin commit.

### C-006 (2026-11-03) — Encabezado naranja con contorno y escala uniforme en las demás secciones

- **Solicitud:** «Algunas de las ventanas tienen el diseño y textos un poco más grande […] aplícalo en las otras ventanas, menos en seguimiento SOP»; el encabezado «se ve muy pálido. Me gustó mucho el naranja que pusiste en el recuadro de rework. Ese color naranja me gustaría que lo unificaras ahí en esa parte de arriba […] que las letras resalten con un contorno negro, igual el logo.»
- **Aclaración del usuario (confirmada):** el color es `rgb(169, 35, 40)` = `#a92328`, el del botón activo del menú y el que tenía el chip RWK en C-005. Una primera versión de C-006 usó un ámbar `#e89a2e` por una lectura equivocada y se corrigió en la misma sesión. Los tokens `--md-orange*` quedaron así: `--md-orange: #a92328`, `--md-orange-deep: #8a1b20`, `--md-orange-soft: #c23a3c`, `--md-on-orange: #fff` (el nombre «orange» es histórico).
- **Archivos tocados:** `src/styles-md3.css` (bloques «C-006» al final), `index.html` (`?v=md3-c006e`). Sin cambios de marcado ni de lógica.
- **Qué cambió:** (1) `.station-intake-banner` y `.topbar` con degradado `#8a1b20`→`#a92328`→`#c23a3c` (menos pálido que el de C-005); (2) títulos, subtítulos y etiquetas del encabezado en blanco con `-webkit-text-stroke` negro (1.6 px título, 0.4–0.5 px texto pequeño) y `paint-order: stroke fill`; (3) logo con contorno negro mediante cuatro `drop-shadow` de 1.5 px; (4) chip RWK e iconos de resumen/contexto en `#a92328` con texto blanco; (5) escala uniforme en `.production-dashboard`, `.traceability-view`, `.reports-view`, `.users-panel`, `.audit-panel` y `.sop-version-panel`: texto 15 px, títulos 24 px, cabeceras 14 px, botones 48 px, campos 50 px, métricas 34 px y textos sueltos 14.5 px; (6) acciones del catálogo SOP con `flex-wrap`.
- **Impacto:** «Seguimiento SOP» (intake y hoja) no cambia de tamaño. El contorno negro puede verse tipo «cómic»; alternativa: texto oscuro sin contorno. El selector depende de los nombres de clase de cada vista.
- **Validaciones:** 9 pruebas pasan; panel del navegador, escritorio: intake (encabezado naranja y chip RWK), Producción, Trazabilidad, Modificar SOP; móvil 375 px: intake. Barrido JS de desborde: solo el catálogo SOP (corregido). No revisado en pantalla tras el cambio: Reportes y Crear usuarios (solo barrido), hoja SOP, tableta.
- **Revertir:** quitar de `styles-md3.css` los bloques «C-006»; sin commit.

### C-007 (2026-11-03) — Contorno solo en «Registrar validación» y tarjeta de usuario en azul marino

- **Solicitud:** la tarjeta azul del usuario «no cuadra con lo demás»; hace falta una mezcla de colores coherente; el contorno negro del logo de Ingrasys no era la petición, era solo para la parte de «Registrar validación» y la del usuario administrador.
- **Archivos tocados:** `src/styles-md3.css` (bloque «C-007»), `index.html` (`?v=md3-c007`).
- **Qué cambió:** se quitó el contorno negro del logo (queda solo una sombra suave) y del texto de la barra superior de las demás secciones (`.topbar-title`, `.topbar-kicker`); el contorno del texto se mantiene solo en el encabezado de «Registrar validación». La tarjeta de usuario (`.station-intake-user`, `.profile-chip`) pasa de azul brillante a azul marino `#2a4258`→`#172635` (el del menú lateral) con borde blanco y chip de rol en `#a92328`. Paleta resultante: rojo `#a92328` (marca/acción), azul marino `#172635` (navegación y usuario), crema `#fff8f7` (fondo), verde `#146c3a` (ok), teal `#00677a` (MFG).
- **Interpretación:** «la parte del usuario» se tomó como la tarjeta; el nombre no lleva contorno negro porque sobre azul marino no se vería. [Pendiente de confirmar].
- **Validaciones:** 9 pruebas pasan; captura de escritorio del intake y de Producción (barra superior). No revisado: móvil, hoja SOP, tableta.
- **Revertir:** quitar el bloque «C-007» de `styles-md3.css`; sin commit.

### C-008 (2026-11-03) — Login con la propuesta E (campos con icono y botón con flecha)

- **Solicitud:** «aver has este» (captura de la propuesta E de `propuestas/login-refinado.html`) tras pedir mejorar el login sin alejarse del actual.
- **Archivos tocados:** `src/views/login.js` (marcado nuevo), `src/interactions.js` (acción `toggle-login-password`), `src/styles-md3.css` (bloque «C-008»), `index.html` (`?v=md3-c008c` en CSS, `login.js` e `interactions.js`).
- **Qué cambió:** logo transparente, título con subtítulo «Nvidia Racks · GB200» (se retiró la etiqueta «GB200 · Acceso local de demostración» y el subtítulo «Ingresar al sistema»), panel de cristal con dos campos con icono y etiqueta interna, botón con ojo para mostrar la contraseña, botón rojo «Ingresar al sistema» con flecha en círculo blanco. Se conservan los `id`, `name` y `data-login-field` que usa la lógica de acceso (`src/interactions.js`, `#local-login-form`) y el mensaje de error con `role="alert"`; los campos con error añaden la clase `is-invalid`.
- **Ajuste posterior (a petición del usuario):** el texto «Ingresar al sistema» del botón se centró (la flecha pasa a posición absoluta a la derecha) y se quitó del login el aviso «Acceso local de demostración…» (`login-note`). El aviso de demostración sigue en el diálogo de ayuda; el login ya no advierte que los permisos son simulados.
- **Modelos (a petición del usuario):** el subtítulo del login y el pie de la aplicación pasan de «GB200» a «GB200 / GB300» porque Nvidia Racks incluye también el modelo GB300. La SOP incluida (`SOP-NVD-GB200-141`, familia `GB200` en `src/data/sopData.js`) sigue siendo la de GB200; no se renombró ningún dato. [Pendiente de confirmar] si existen SOP, PN o estaciones propias de GB300 que deban cargarse por «Modificar SOP».
- **Impacto:** la línea roja bajo el título (`h1::after`) se ocultó en este diseño. El botón de ojo es nuevo: alterna `type` entre `password` y `text`, el icono y `aria-label`/`aria-pressed`. Las reglas viejas `.login-form input` de `styles.css` y de C-004 se sobrescriben dentro de `.login-field-body`.
- **Validaciones:** 9 pruebas pasan; con Playwright CLI a 1440 px: se ve el login, el ojo cambia a «Ocultar contraseña» y `type` a `text`, un usuario inválido muestra «Usuario o contraseña incorrectos, o cuenta inactiva.», y un usuario de demostración operador entra y llega a «Registrar validación». Captura móvil de 375 px sin desbordes. No probado: tableta, lector de pantalla, teclado de tableta con el campo numérico (`inputmode="numeric"` en usuario).
- **Revertir:** `git checkout -- src/views/login.js` y quitar de `styles-md3.css` e `interactions.js` los bloques «C-008» (sin commit).

### C-009 (2026-11-03) — Encabezados en azul marino con acento naranja (propuesta V2)

- **Solicitud:** «aplica la opcion 2» de `propuestas/banner-registro.html`, tras pedir un naranja menos claro y más contrastante, más profesional y algo interactivo.
- **Archivos tocados:** `src/styles-md3.css` (bloque «C-009»), `index.html` (`?v=md3-c009b`). Sin cambios de marcado ni de lógica.
- **Qué cambió:** el banner de «Registrar validación» y la barra superior (`.topbar`) pasan a degradado azul marino `#0f1b27`→`#223a50` con línea inferior naranja `#e8730f` de 5 px; etiqueta de paso, icono, avatar y chip de rol en naranja; tarjeta de usuario translúcida con borde naranja; se quitó el contorno negro del texto del encabezado; pasos del progreso en naranja (activo `#e8730f`, completo `#c85f06`) y la línea entre pasos se rellena con una animación de 0.45 s cuando el paso anterior está completo (selector `.operator-flow-step--complete + i::after`, sin JavaScript); respeta `prefers-reduced-motion`.
- **No se tocó:** botones principales y chips de estación siguen en rojo `#a92328`; el naranja es solo de encabezado y progreso. [Pendiente de confirmar] si el usuario quiere llevar el naranja también a esos botones.
- **Validaciones:** 9 pruebas pasan; Playwright CLI a 1440 px: intake, hoja SOP y Producción (barra superior); y móvil 375 px: intake. Un avatar con texto rojo ilegible en la barra superior se corrigió (`.profile-avatar`). No probado: tableta, Reportes, Trazabilidad y Crear usuarios con el nuevo encabezado.
- **Revertir:** quitar de `styles-md3.css` los bloques «C-009»; sin commit.

### C-010 (2026-11-03) — Usuario, fecha y turno en un solo recuadro

- **Solicitud:** «enfócate también en la parte del usuario. Donde aparece la fecha y el turno. Si lo puedes integrar en un solo recuadro, que se vea […] un poquito más marcado.»
- **Archivos tocados:** `src/views/shell.js` (`renderTopbar`: `.topbar-profile` y `.topbar-meta` quedan dentro de un nuevo `<div class="topbar-user-panel">`), `src/styles-md3.css` (bloque «C-010»), `index.html` (`?v=md3-c010b`).
- **Qué cambió:** un solo recuadro con borde naranja de 2 px, fondo translúcido, sombra y brillo al pasar el cursor, que contiene el avatar naranja con nombre y puesto (con el menú desplegable de «Cerrar sesión»), la fecha, el turno y el botón de ayuda naranja, separados por líneas finas. En móvil (≤650 px) el recuadro ocupa el ancho completo en una segunda fila. El título de la barra se redujo a un máximo de 24 px para que no ocupe tres líneas.
- **Impacto:** las reglas de rejilla viejas de `.topbar-profile` y `.topbar-meta` (`styles.css`) dejan de aplicar porque ya no son hijos directos de `.topbar`; el comportamiento del menú (`<details class="profile-menu">`) no cambió.
- **Validaciones:** 9 pruebas pasan; Playwright CLI: Producción a 1440 px, menú de usuario abierto (se ve «Administrador» y «Cerrar sesión»), y móvil de 375 px. No probado: tableta ni lector de pantalla; el turno se calcula al cargar y no se refresca solo.
- **Revertir:** quitar el `<div class="topbar-user-panel">` y su cierre en `shell.js` y el bloque «C-010» de `styles-md3.css`; sin commit.

### C-011 (2026-11-03) — Más contraste en el texto de los encabezados

- **Solicitud:** «Las letras se ven muy opacas igual.»
- **Archivos tocados:** `src/styles-md3.css` (bloque «C-011»), `index.html` (`?v=md3-c011`).
- **Qué cambió:** subtítulos, nombre, puesto, fecha y turno del encabezado pasan a blanco puro, 13 a 16 px y peso 700–800, con sombra de texto oscura más marcada; los chips naranja (etiqueta de paso, rol, avatar y ayuda) usan `--md-accent-deep` `#c85f06`, con mejor contraste con texto blanco; las etiquetas de los pasos del progreso van en tinta oscura `#201a19`.
- **Interpretación:** «letras opacas» se tomó como poco contraste del texto del encabezado (nombre, puesto, fecha, turno y subtítulos). [Pendiente de confirmar] si se refería a otros textos de la pantalla.
- **Validaciones:** 9 pruebas pasan y capturas de Playwright CLI a 1440 px (ver mensaje de entrega).
- **Revertir:** quitar el bloque «C-011» de `styles-md3.css`; sin commit.

### C-012 (2026-11-03) — Se quita la tarjeta de usuario del banner de Registrar validación

- **Solicitud:** «mejor quita la parte del usuario» del banner de «Registrar validación», porque es la primera instancia y el usuario que realiza el proceso ya se muestra al final («Operador que realiza la acción»); se conserva «Paso 1 de 3 · Seleccionar estación».
- **Archivos tocados:** `src/views/station-intake.js` (se elimina el bloque `.station-intake-user` del banner), `src/styles-md3.css` (bloque «C-012»: columnas `1fr auto 1fr` para que el título siga centrado), `index.html` (`?v=md3-c012`).
- **Impacto:** el nombre, número de empleado, puesto y rol ya no aparecen en la primera pantalla; siguen en el resumen inferior del intake y, en el resto de pantallas, en el recuadro de usuario de la barra superior (C-010). Las reglas `.station-intake-user` y `.station-intake-role` quedan sin uso en el intake.
- **Validaciones:** 9 pruebas pasan; captura de escritorio y móvil con Playwright CLI.
- **Revertir:** restaurar el bloque `.station-intake-user` en `station-intake.js` (línea tras `.station-intake-banner-heading`) y quitar el bloque «C-012»; sin commit.

### C-013 (2026-11-03) — Título del banner sin etiqueta de paso ni subtítulo

- **Solicitud:** quitar «Paso 1 de 3 · Seleccionar estación» y «Seguimiento de SOPs Nvidia Racks» del título de «Registrar validación» (la etiqueta se había conservado en C-012; ahora se retira).
- **Archivos tocados:** `src/views/station-intake.js` (se eliminan el `<span class="station-intake-eyebrow">` y el `<p>` del banner), `index.html` (`?v=md3-c013`).
- **Impacto:** el banner queda con logo, icono y el título «Registrar validación». El progreso de 3 pasos sigue debajo del banner, así que el paso actual se ve ahí. Las reglas CSS de `.station-intake-eyebrow` quedan sin uso en el intake.
- **Validaciones:** 9 pruebas pasan; capturas de escritorio y móvil con Playwright CLI.
- **Revertir:** restaurar el `<span>` y el `<p>` en `station-intake.js`; sin commit.

### C-014 (2026-11-03) — Título de la barra superior centrado y sin frase descriptiva

- **Solicitud:** centrar los textos de la zona del usuario (el puesto no estaba centrado) y la etiqueta «SOP actual · Rev. 3»; ponerla debajo de «Desensamble general de Compu tray modelo 2000» y borrar «Control de ejecución, validación y trazabilidad».
- **Archivos tocados:** `src/views/shell.js` (`renderTopbar`: se reordena el bloque del título: `<h1>` y luego `.topbar-kicker`; se elimina el `<p>`), `src/styles-md3.css` (bloque «C-014»), `index.html` (`?v=md3-c014` en `shell.js` y en `styles-md3.css`; la primera entrega solo subió `shell.js`, así que un navegador con la hoja de estilos en caché seguía mostrando el diseño anterior).
- **Qué cambió:** el título y la etiqueta quedan centrados en una columna; el nombre y el puesto del usuario se centran uno bajo el otro dentro del recuadro de usuario.
- **Validaciones:** 9 pruebas pasan; capturas con Playwright CLI (Producción y hoja SOP, escritorio y móvil).
- **Revertir:** restaurar el orden y el `<p>` en `renderTopbar` y quitar el bloque «C-014»; sin commit.

### C-015 (2026-11-03) — Se borra el aviso de la SOP incluida en el catálogo

- **Solicitud:** borrar el texto «La SOP incluida en el sistema no es una revisión cargada para eliminar.» de la fila del catálogo en «Modificar SOP».
- **Archivos tocados:** `src/sop-version-control.js` (se quita el `<small class="sop-version-delete-blocked">` de la fila de la SOP incluida; el botón «Eliminar» sigue deshabilitado y conserva el motivo como `title`), `index.html` (`?v=md3-c015` en `sop-version-control.js`).
- **Impacto:** el aviso visible desaparece; el motivo sigue disponible al pasar el cursor sobre «Eliminar». Para las revisiones cargadas con otro motivo de bloqueo (por ejemplo, la versión activa) el texto `sop-version-delete-blocked` se mantiene.
- **Validaciones:** 9 pruebas pasan; captura de «Modificar SOP» con Playwright CLI.
- **Revertir:** restaurar el `<small>` en la plantilla del botón «Eliminar»; sin commit.

### C-016 (2026-11-03) — Espacios de la tabla del catálogo en «Modificar SOP»

- **Solicitud:** «optimizar los espacios en la tabla donde se menciona modificar SOP».
- **Archivos tocados:** `src/styles-md3.css` (bloque «C-016»), `index.html` (`?v=md3-c016` en `styles-md3.css`). Sin cambios de marcado ni de lógica.
- **Qué cambió:** columnas de la rejilla con columnas flexibles (`minmax`) con separación de 24 px y mínimos que suman ≈1030 px, para que la tabla quepa en el panel (una primera versión con anchos fijos se salía del panel y se corrigió); la columna de Acciones tiene 280 px mínimo para «Crear nueva revisión» y «Eliminar» sin pegarse al borde; cabecera y filas con el mismo relleno lateral (antes 24 px y 14 px, que desalineaba las columnas); letra de 14–15 px; selectores de 44 px con texto centrado y flecha a la derecha; botones de acción sin salto de línea.
- **Validaciones:** 9 pruebas pasan; con Playwright CLI se midió que los botones de acción quedan dentro de la fila con margen. El perfil de prueba solo tiene una SOP; no se probó con tres filas ni a menos de 1180 px de ancho.
- **Revertir:** quitar el bloque «C-016» de `styles-md3.css`; sin commit.

### C-017 (2026-11-03) — Color del selector de Área en el catálogo (RWK rojo, MFG azul)

- **Solicitud:** «Agrega un color rojo para el botón de rework y cuando esté en manufactura un color azul.»
- **Archivos tocados:** `src/styles-md3.css` (bloque «C-017»), `index.html` (`?v=md3-c017`). Sin cambios de marcado ni de lógica.
- **Qué cambió:** el selector «Área» de cada fila del catálogo (`data-sop-catalog-type`) se pinta según su valor: RWK con borde y texto rojo sobre fondo rosa claro (`#a92328`/`#ffdad6`), MFG con borde y texto azul sobre fondo azul claro (`#1f63c6`/`#dbe9ff`). Se usa `select:has(option[value="…"]:checked)`, así que el color cambia al instante al elegir otra área sin JavaScript.
- **Limitación:** `:has()` requiere un navegador moderno (Chrome/Edge 105+, Safari 15.4+, Firefox 121+); en uno anterior el selector se ve como antes.
- **Validaciones:** 9 pruebas pasan; Playwright CLI: color de borde con RWK y tras cambiar a MFG.
- **Revertir:** quitar el bloque «C-017»; sin commit.

### C-018 (2026-11-03) — Cabecera de «Modificar SOP» en verde

- **Solicitud:** «Aquí un color verde» (sobre la cabecera de «Modificar SOP»: icono, «Solo cuenta 140784», «Subir SOP PDF» y «Extraer SOP»).
- **Interpretación:** el verde se aplicó a todo el bloque de la cabecera: fondo y borde verde muy claros, icono y etiqueta de cuenta en verde, «Subir SOP PDF» como botón de contorno verde y «Extraer SOP» como botón verde sólido (verde grisáceo cuando está deshabilitado). Verde de la aplicación: `#146c3a`. [Pendiente de confirmar] si se quería solo en los botones.
- **Archivos tocados:** `src/styles-md3.css` (bloque «C-018»), `index.html` (`?v=md3-c018`).
- **Validaciones:** 9 pruebas pasan; captura de Playwright CLI de «Modificar SOP».
- **Revertir:** quitar el bloque «C-018»; sin commit.

### C-019 (2026-11-03) — Fondos de «Modificar SOP» más intensos, letras en negro

- **Solicitud:** «quiero que sean colores un poquito más fuertes. Sin ser tan fuertes, pero sí fuertes» (mensaje cortado; se aplicó a los colores de C-017 y C-018) y «el fondo cambiará nada más, no las letras. Las letras quedan en negro como están».
- **Archivos tocados:** `src/styles-md3.css` (bloque «C-019»), `index.html` (`?v=md3-c019`).
- **Qué cambió:** solo fondos y bordes: cabecera verde `#a9e0bf`→`#e9f8ef` con borde `#4fb27a`, icono `#6cc58f`, etiqueta de cuenta `#7fd1a0`, «Subir SOP PDF» `#bfeacf`, «Extraer SOP» `#5fbf88`; Área RWK con fondo `#f4a39b` y borde rojo, MFG con fondo `#9cc3f7` y borde azul. El texto y los iconos de esos elementos van en `#201a19` (negro), por lo que se retiran los textos verdes, rojos y azules de C-017 y C-018.
- **Interpretación:** [Pendiente de confirmar] si se quería también intensificar otros fondos de la aplicación.
- **Validaciones:** 9 pruebas pasan; captura con Playwright CLI.
- **Revertir:** quitar el bloque «C-019»; sin commit.

### C-020 (2026-11-03) — Colores más fuertes y conservar la sección al recargar

- **Solicitud:** «COLORES MÁS FUERTE Y AL ACTUALIZAR NO TE SALGAS DE ESA PÁGINA PARA MANTENER LA VISTA DE LOS CAMBIOS».
- **Archivos tocados:** `src/app.js` (la sección activa se guarda en `sessionStorage`, clave `sop-operador-active-section`, y se restaura al iniciar: `readSavedSection()` y escritura en `render()`; la primera versión fallaba en silencio porque `readSavedSection()` usaba una `const` declarada al final del archivo y quedaba en la zona muerta temporal: se corrigió con el literal de la clave), `src/styles-md3.css` (bloque «C-020»), `index.html` (`?v=md3-c020` en CSS y `app.js`).
- **Qué cambió:** (1) fondos aún más fuertes, texto en negro: cabecera verde `#7fd3a2`→`#cdeedb` con borde de 3 px, icono `#34a869`, etiqueta `#5fc489`, «Subir SOP PDF» `#8fd6ac`, «Extraer SOP» `#3fae72`, Área RWK `#ee7f75` y MFG `#6fa6f2`; (2) al recargar la página se vuelve a la misma sección (antes volvía siempre a «Registrar validación»).
- **Impacto:** el comportamiento de recarga cambió para todos los usuarios, no solo para pruebas: se conserva la sección mientras dure la pestaña. Si un usuario sin permiso tenía guardada una sección de administración, `render()` lo regresa a «Seguimiento SOP». El trabajo activo y el recorrido de la SOP siguen sin restaurarse por completo (no es parte de este cambio).
- **Validaciones:** 9 pruebas pasan; en Playwright CLI se comprobó que tras recargar en «Modificar SOP» la página sigue en esa sección.
- **Revertir:** restaurar `activeSection: "overview"` en `app.js`, quitar la línea de `sessionStorage` y `readSavedSection`, y el bloque «C-020»; sin commit.

### C-021 (2026-11-03) — Se retira el verde de la cabecera de «Modificar SOP»

- **Solicitud:** «QUITALE EL COLOR VERDE Y DEJALO COMO ESTABA».
- **Archivos tocados:** `src/styles-md3.css` (se eliminan las reglas `.sop-version-manager-header`, `.sop-version-access-badge` y `.sop-version-actions` de los bloques C-018, C-019 y C-020), `index.html` (`?v=md3-c021`).
- **Impacto:** la cabecera de «Modificar SOP» vuelve a su aspecto anterior a C-018 (fondo claro, icono y botones rojos). **Se conservan** los colores del selector de Área del catálogo (RWK rojo y MFG azul, C-017 en su versión de C-020). Los textos de C-018 a C-020 que describen el verde quedan sustituidos por esta entrada.
- **Validaciones:** 9 pruebas pasan; captura con Playwright CLI en «Modificar SOP».
- **Revertir:** reponer los bloques verdes de C-018 a C-020; sin commit.

### C-022 (2026-11-03) — Interruptor de disponibilidad más grande

- **Solicitud:** «HAZ MÁS GRANDE ESTE BOTÓN» (el interruptor «Disponibilidad» del catálogo en «Modificar SOP»).
- **Archivos tocados:** `src/styles-md3.css` (bloque «C-022»), `index.html` (`?v=md3-c022`).
- **Qué cambió:** el interruptor pasa de 30×16 px a 62×34 px, con la perilla de 26 px que recorre 28 px al activarse, y un anillo de foco verde. No cambia su lógica ni su color.
- **Validaciones:** 9 pruebas pasan; captura con Playwright CLI de «Modificar SOP» y comprobación de que el interruptor sigue marcando «Habilitada».
- **Revertir:** quitar el bloque «C-022»; sin commit.

### C-023 (2026-11-03) — Menú lateral en Material Design 3

- **Solicitud:** «TE FALTÓ APLICAR MATERIAL DESIGN EN ESTA SECCIÓN» (el menú lateral).
- **Archivos tocados:** `src/views/shell.js` (el logo del menú pasa a `ingrasys-logo-transparent.png`, sin caja negra), `src/styles-md3.css` (bloque «C-023»), `index.html` (`?v=md3-c023`).
- **Qué cambió:** fondo con degradado azul marino y sombra; logo con sombra y separador inferior; botones del menú en forma de píldora de 54 px, icono de 24 px contorneado y texto de 15 px en negrita; estado activo con degradado rojo del menú, icono relleno y una barra naranja a la izquierda como indicador; hover translúcido, pulsación con ligera reducción y foco visible naranja. En ≤1000 px (solo iconos) se conserva el menú compacto con botones redondeados.
- **Ajuste:** se quitó la caja de fondo del logo (`.brand` tenía el color del menú y `mix-blend-mode: screen`), el texto «Seguimiento SOP» ya no salta de línea (relleno de 14 px) y, entre 1000 y 1150 px, la barra superior pasa a dos filas para que el título no se solape con el recuadro de usuario (error de C-010 que apareció al probar a 900 px).
- **Validaciones:** 9 pruebas pasan; captura con Playwright CLI a 1440 px y a 375 px.
- **Revertir:** restaurar `ingrasys-logo-dark.png` en `shell.js` y quitar el bloque «C-023»; sin commit.

### C-024 (2026-11-03) — Se quita la fecha de la barra de usuario

- **Solicitud:** «BORRA LA FECHA PARA REDUCIR EL ESPACIO DE LA BARRA DE USUARIO».
- **Archivos tocados:** `src/views/shell.js` (`renderTopbar`: se elimina el `<div class="date-chip">`), `src/styles-md3.css` (bloque «C-024»), `index.html` (`?v=md3-c024`).
- **Impacto:** el recuadro de usuario queda con avatar y nombre, turno y botón de ayuda. La constante `TODAY_DATE_LABEL` sigue usándose en otras partes (registros y reportes); las reglas `.date-chip` quedan sin uso en la barra superior.
- **Validaciones:** 9 pruebas pasan; captura con Playwright CLI.
- **Revertir:** restaurar la línea `<div class="date-chip">` en `renderTopbar`; sin commit.

### C-025 (2026-11-03) — «Crear usuarios»: confirmar contraseña, ver/ocultar y una sola fila

- **Solicitud:** agregar junto a «Contraseña inicial» una segunda de confirmación, con opción de ocultar caracteres; reducir espacios para que las celdas y el botón «Crear usuario» quepan en una sola fila.
- **Archivos tocados:** `src/user-control.js` (`renderLocalUsersPanel`: campo `userPasswordConfirm` y botones de ojo), `src/app.js` (`createLocalUser` rechaza con aviso si las dos contraseñas no coinciden), `src/interactions.js` (acción `toggle-password-visibility` y validación en vivo con `setCustomValidity`), `src/styles-md3.css` (bloque «C-025»), `index.html` (`?v=md3-c025` en CSS y en los tres scripts).
- **Qué cambió:** el formulario tiene siete elementos en una fila (nombre, número, puesto, contraseña, confirmar, tipo y botón) con cuadrícula flexible; bajo 1280 px pasa a 4 columnas, bajo 760 px a 2 y bajo 520 px a 1. Ambos campos de contraseña llevan un botón de ojo que alterna entre ocultar y mostrar (`aria-pressed` y `aria-label` cambian). Si no coinciden, el navegador marca el campo de confirmación con «Las contraseñas no coinciden.» y, como segunda barrera, `createLocalUser` no crea el usuario.
- **No se tocó:** el formulario «Cambiar contraseña» sigue sin confirmación ni ojo. [Pendiente de confirmar] si se quiere lo mismo ahí.
- **Validaciones:** 9 pruebas pasan; con Playwright CLI: formulario en una fila a 1440 px, el ojo alterna el tipo del campo, una confirmación distinta bloquea el envío y una igual crea el usuario de prueba.
- **Revertir:** quitar el campo y los botones de ojo de `user-control.js`, la comprobación en `createLocalUser`, el bloque «C-025» y los dos añadidos de `interactions.js`; sin commit.

### C-026 (2026-11-03) — Proporciones del formulario «Crear usuarios» y nombres de campo centrados

- **Solicitud:** alargar «Nombre completo», reducir «Número de empleado» (celda más corta) y centrar los nombres de todas las celdas.
- **Archivos tocados:** `src/user-control.js` (la etiqueta «Número de empleado» pasa a «N.º de empleado» para que quepa en la columna angosta), `src/styles-md3.css` (bloque «C-026»), `index.html` (`?v=md3-c026`).
- **Qué cambió:** columna de nombre de `1fr` a `2.4fr` con mínimo de 200 px; columna de número de empleado fija en 118 px; etiquetas de todos los campos con `text-align: center`.
- **Validaciones:** 9 pruebas pasan; captura con Playwright CLI.
- **Revertir:** restaurar el texto «Número de empleado» y quitar el bloque «C-026»; sin commit.

### C-027 (2026-11-03) — Opción «Modificar estación…» en el catálogo de SOP

- **Solicitud:** «AÑADE LA OPCIÓN DE MODIFICAR ESTACIÓN EN ESE BOTÓN» (el selector de Estación de cada fila del catálogo).
- **Archivos tocados:** `src/sop-version-control.js` (`renderSopCatalog`: nueva opción `__custom__` y atributo `data-previous-value`; manejador de cambios del catálogo: pide el nombre con `window.prompt`, crea la estación con `createCustomWorkStationAssignment` y la agrega al selector; al cambiar de área se conserva la opción), `src/styles-md3.css` (estilo de la opción), `index.html` (`?v=md3-c027`).
- **Cómo funciona:** al elegir «✎ Modificar estación…» se pide un nombre (hasta 80 caracteres) para el área elegida (MFG o RWK). El nombre se agrega como estación personalizada (`CUSTOM:<AREA>:<nombre>`, ya soportada por `getWorkStationAssignment`), queda seleccionada y se guarda con el botón «Guardar estaciones y disponibilidad». Si se cancela o el nombre no es válido, se restaura la estación anterior. Si ya existe una estación con ese nombre en la lista, se reutiliza.
- **Ajuste:** las estaciones RWK personalizadas mostraban «Desensamble» en lugar de su nombre; ahora solo las estaciones RWK predefinidas se llaman «Desensamble» y las personalizadas usan su nombre.
- **Limitaciones:** no se renombran ni se borran estaciones personalizadas ya creadas (solo se agregan o se reasignan); usa `window.prompt`, un cuadro nativo del navegador.
- **Validaciones:** 9 pruebas pasan; con Playwright CLI: se elige la opción, se escribe un nombre de prueba, queda seleccionado y habilitar/guardar funcionan; al cancelar se restaura el valor anterior.
- **Revertir:** quitar la opción `__custom__`, el bloque de manejo y los dos añadidos descritos; sin commit.

### C-028 (2026-11-03) — Diálogo propio para «Modificar estación…»

- **Problema:** `window.prompt` (C-027) no funciona en el navegador integrado; el selector quedaba en «Modificar estación…» sin cambiar nada.
- **Cambio:** `openStationNameDialog` en `src/sop-version-control.js` abre un diálogo propio (campo de nombre, Cancelar / Agregar estación, Esc y clic fuera cierran); estilos «C-028» en `src/styles-md3.css`; `index.html` `?v=md3-c028`. Al cancelar queda la estación anterior.
- **Validaciones:** 9 pruebas pasan; estación personalizada creada y seleccionada en el panel.
- **Revertir:** quitar la función, el bloque CSS y volver al manejo previo; sin commit.

### C-029 (2026-11-03) — Vista previa de la hoja junto al editor de pasos

- **Solicitud:** integrar en «Revisa y corrige la extracción automática» la propuesta A (`propuestas/revision-extraccion.html`): ver la hoja del PDF y que el paso editado se ubique en ella.
- **Archivos tocados:** `src/sop-version-control.js` (panel `#sop-inline-preview` junto a `.sop-version-procedures`; `paintSopInlinePreview`, `updateSopInlinePreviewCard`; escuchas `focusin`, `toggle` y un `MutationObserver` para pintar tras cada `render()`), `src/styles-md3.css` (bloque «C-029»), `index.html` (`?v=md3-c029`). Reutiliza `renderSopDraftPdfPage` (`src/sop-version-preview.js`) y `sourceBounds` de cada paso.
- **Cómo funciona:** al enfocar un paso o abrir otra hoja se redibuja la hoja del PDF con el recuadro azul del paso; al escribir, la tarjeta inferior muestra el texto y número editados al instante. «Ampliar y anotar» abre el diálogo existente.
- **Límites:** el PDF original no se modifica; los pasos añadidos a mano no tienen `sourceBounds` y no muestran recuadro.
- **Validaciones:** 9 pruebas pasan; comprobado en el navegador con el borrador de la SOP incluida.
- **Revertir:** quitar el panel, las funciones y listeners descritos y el bloque CSS; sin commit.

### C-030 (2026-11-03) — El texto corregido de un paso se dibuja sobre la hoja

- **Solicitud:** al editar un paso, que el cambio se vea en la imagen de la vista previa y también en la SOP que ve el operador.
- **Archivos tocados:** `src/sop-version-control.js` (nuevo tipo de anotación `textfix`: se dibuja en `renderSopAnnotationContents`, se valida en `validateSopDraft`, se genera con `syncSopStepTextFix` al editar número o texto; el paso guarda `originalText` y `originalNumber`), `src/styles-md3.css` (bloque «C-030»), `index.html` (`?v=md3-c030`).
- **Cómo funciona:** si el texto o número difiere del original y el paso tiene `sourceBounds`, se crea una anotación con un recuadro blanco sobre el texto original y el texto nuevo ajustado al área (coordenadas 0–1000 como las demás anotaciones). Como las anotaciones se guardan con la revisión, la vista del operador (`src/views/procedure.js`) la muestra igual. Si el texto vuelve al original, la anotación se elimina; al borrar el paso también.
- **Límites:** el PDF original no se modifica (es una capa encima); los pasos sin `sourceBounds` (añadidos a mano) no dibujan texto sobre la hoja; las imágenes recortadas de pasos de la SOP incluida (`sop-step-blocks`) no cambian.
- **Validaciones:** 9 pruebas pasan; en el navegador se editó el paso 4.2, la hoja mostró el texto nuevo y `validateSopDraft` conservó la anotación. No se guardó ninguna revisión.
- **Revertir:** quitar el tipo `textfix`, las funciones auxiliares, el bloque en el manejador de entrada y el CSS; sin commit.

### C-031 (2026-11-03) — Detección automática de la posición de cada paso en la hoja

- **Problema:** la SOP de desensamble incluida no tiene `sourceBounds` en sus pasos, así que C-030 no dibujaba el texto corregido sobre su hoja.
- **Cambio:** `src/sop-version-control.js`: la lectura de pasos de una página del PDF pasó a la función `extractSopPageSteps` (misma lógica que usa la extracción al subir un PDF) y `ensureSopStepBounds` la ejecuta bajo demanda sobre la hoja (`pdfPage` o `sheet`) para asignar `sourceBounds` a los pasos que no lo tienen, emparejando por número (1, 2, 3, 1.1, 1.2…). Se llama al pintar la vista previa, al abrir el diálogo de hoja y al editar un paso. `index.html` `?v=md3-c031`.
- **Alcance:** funciona con cualquier SOP cuyo PDF esté disponible (`pdfPath` o PDF guardado con la revisión).
- **Validaciones:** en el navegador, la hoja 5 de la SOP de desensamble detectó los pasos 1, 2 y 3 y dibujó el texto corregido del paso 1. `tests/sop-run` y `tests/work-stations` pasan (9); `tests/sop-version-control.test.mjs` y `tests/sites-worker.test.mjs` no cargan en este entorno (falta `@napi-rs/canvas`/sintaxis `export`), sin relación con este cambio.
- **Límites:** la detección depende de que el PDF tenga texto seleccionable y numeración `N.-`; si un paso no se encuentra, su texto se guarda pero no se dibuja sobre la hoja.
- **Revertir:** devolver el cuerpo de `extractSopPageSteps` al bucle de `extractSopPdfVersion` y quitar `ensureSopStepBounds` y sus llamadas; sin commit.

### C-032 (2026-11-03) — Texto corregido sin recuadro y con la tipografía del documento

- **Solicitud:** al editar un paso no debe aparecer ningún recuadro de color; el texto debe verse lo más parecido posible al del PDF.
- **Archivos tocados:** `src/sop-version-control.js` (`readSopStepFont`, `syncSopStepTextFix` y el dibujo de `textfix`: tamaño, familia, peso y estilo se toman del texto original del PDF; el salto de línea se calcula con las medidas reales de la fuente; se conserva el formato del marcador `N.-`), `src/sop-version-preview.js` (no se pinta el recuadro azul cuando el paso ya tiene texto corregido), `src/styles-md3.css` (sin borde, texto negro), `index.html` (`?v=md3-c032c`).
- **Cómo funciona:** la extracción guarda `sourceFormat` por paso (fuente interna, tamaño, sufijo del marcador). Al editar, se resuelve el nombre real de la fuente con `page.commonObjs` (p. ej. Calibri 10.8 pt), se cubre el texto original con blanco y se escribe el texto nuevo en la misma posición. Si la fuente no está instalada en el equipo se usa Carlito, Calibri o Arial.
- **Límites:** el fondo que se usa para tapar es blanco (las hojas de esta plantilla lo son); el texto justificado del original se dibuja alineado a la izquierda; las SOP guardadas antes de este cambio no tienen `sourceFormat` y usan 10.8 pt y Calibri por defecto.
- **Validaciones:** 9 pruebas pasan; en el navegador, hoja 5 de desensamble, paso 1 editado: se ve igual que el original, sin recuadro de color.
- **Revertir:** restaurar el dibujo de `textfix` de C-030 y quitar `sourceFormat`; sin commit.

### C-033 (2026-11-03) — Zoom, edición sobre la hoja y rediseño del panel de revisión

- **Solicitud:** botón de zoom en la vista previa, poder editar el texto de la hoja (p. ej. el paso 1 de desensamble) y un panel más interactivo con iconos.
- **Archivos tocados:** `src/sop-version-control.js` (barra de herramientas del panel `#sop-inline-preview`: paso anterior/siguiente, alejar/acercar/ajustar, modo edición, ampliar; zoom con Ctrl + rueda y arrastre para moverse; clic sobre un paso de la hoja lo selecciona; en modo edición, clic sobre cualquier texto abre un editor — para pasos edita el paso, para otro texto crea una anotación `textfix` libre con `id`, `original`, `source` y `sourceFormat`; `findSopTextBlockAt`, `buildSopTextFix`, muestreo de color de fondo y tinta con un lienzo auxiliar a 2×; chips «Editado», botón «Restaurar» por paso y contador de textos editados), `src/sop-version-preview.js` (factor `data-zoom`, `canvas._sopViewport`, centrado en el paso al acercar), `src/styles-md3.css` (bloque «C-033»), `index.html` (`?v=md3-c033b`).
- **Validación:** `textfix` ya no exige `stepNumber`; guarda `bg` e `ink` (hex). Las revisiones guardadas con texto libre se muestran igual en la vista del operador.
- **Límites:** el texto libre se detecta por líneas alineadas a la izquierda del mismo párrafo; el tapado usa el color de fondo muestreado en el borde del texto, por lo que sobre fotografías puede notarse; el PDF original no se modifica.
- **Pruebas:** 9 pasan; en el navegador se probó zoom, modo edición, clic sobre el paso 1 de la hoja 5, edición desde el editor de la hoja y «Restaurar».
- **Revertir:** restaurar los tres archivos desde el estado anterior a C-033 y quitar el bloque CSS; sin commit.

### C-034 (2026-11-03) — Filas de paso ordenadas, «Guardar paso» y vista previa que no se reinicia

- **Solicitud:** menos amontonamiento en cada paso (acciones arriba y texto amplio), botón para guardar el paso y continuar con el siguiente/otra hoja, y revisar los botones que no respondían.
- **Causa de los botones «que no funcionan»:** `showToast` (`src/app.js`) llama a `render()` al mostrar y a los 4.2 s al ocultar el aviso; eso recreaba toda la sección y reiniciaba la vista previa (hoja 1, zoom 100 %, modo edición apagado, hojas plegadas).
- **Cambios:** `src/sop-version-control.js`: cada paso tiene cabecera (número, etiqueta Editado/Guardado, Restaurar, Eliminar), texto de ancho completo y «Guardar paso» (marca `step.reviewed`, pasa al siguiente paso u hoja con pasos y avisa al terminar); estado de la vista previa (`inlineView`: hoja, paso, zoom, modo edición, hojas abiertas) que se restaura tras cada `render()`; avisos de esta sección con `showInlineNotice` (sin `render()`); botones de paso anterior/siguiente y zoom se deshabilitan en los extremos; contador «N de M revisados». `src/styles-md3.css` (bloque «C-034»), `index.html` (`?v=md3-c034b`).
- **Alcance de «guardar»:** guardar paso confirma el paso en el borrador; la revisión se publica con «Guardar revisión y actualizar estación». El borrador no se guarda en disco hasta entonces.
- **Pruebas:** 9 pasan; en el navegador se probaron zoom (acercar, alejar, ajustar), paso anterior/siguiente, modo edición, un `showToast` forzado (la vista previa conserva hoja, zoom y modo) y «Guardar paso».
- **Revertir:** restaurar la plantilla de paso de C-033 y quitar `inlineView`, `showInlineNotice` y el bloque CSS; sin commit.

### C-035 (2026-11-03) — Filas de paso compactas con iconos pequeños

- **Solicitud:** los iconos/botones de C-034 eran demasiado grandes; volver al tamaño anterior y optimizar los iconos para dejar más espacio de escritura.
- **Cambios:** `src/styles-md3.css` (bloque «C-035»): fila de paso en una cuadrícula con número, etiqueta y tres botones solo-icono de 32 px (restaurar, eliminar, guardar paso) en una línea, y el texto a todo el ancho debajo (14 px, mínimo 64 px); se oculta la frase de ayuda del pie. `src/sop-version-control.js`: `title` y `aria-label` en los botones que perdieron su texto visible. `index.html` (`?v=md3-c035`).
- **Sin cambios de lógica:** guardar paso, restaurar y eliminar funcionan igual que en C-034.
- **Revertir:** quitar el bloque CSS «C-035»; sin commit.

### C-036 (2026-11-03) — Filas de paso en tamaño original, con mini-iconos

- **Solicitud:** C-035 seguía siendo demasiado grande; dejar la sección de pasos como estaba (pequeña) y mantener «Guardar paso», que guarda y pasa al siguiente.
- **Cambios:** `src/sop-version-control.js`: la fila de paso vuelve a 3 columnas (número, texto, herramientas) sin etiquetas ni pie; las herramientas son cuatro mini-iconos de 24 px en cuadrícula 2 × 2 (marca Editado/Guardado, guardar paso, restaurar, eliminar). `src/styles-md3.css`: se quitaron las reglas de tamaño de fila de C-033/C-034/C-035 y se añadió el bloque «C-036» (número 56 px, texto 13 px, mínimo 34 px, relleno 6×8). `index.html` (`?v=md3-c036b`).
- **Sin cambios de lógica:** «Guardar paso» marca el paso como revisado y selecciona el siguiente (o la siguiente hoja con pasos); se puede hacer clic en cualquier otro paso en cualquier momento.
- **Pruebas:** 9 pasan; comprobado en el navegador (hoja 5): guardar el paso 1 selecciona el paso 2.
- **Nota:** la clase `.sop-step-chip` ya existe en otra parte de los estilos, por lo que el chip se fuerza a 24 px dentro de `.sop-step-tools`.
- **Revertir:** quitar el bloque «C-036»; sin commit.

### C-037 (2026-11-03) — «Guardar anotaciones» y cabecera de la vista previa centrada

- **Solicitud:** un botón para guardar las anotaciones (flechas, números, recuadros, notas) y centrar la cabecera de la vista previa.
- **Causa:** las anotaciones sí entraban al borrador al soltar el puntero, pero la vista previa en línea no se actualizaba al cerrar el diálogo y no había confirmación visible.
- **Cambios:** `src/sop-version-control.js`: bloque `.sop-annotation-save` en el editor de anotaciones con estado («Sin cambios por guardar» / «Hay cambios sin guardar») y botón «Guardar anotaciones» (acción `save-sop-annotations`: refresca la vista previa en línea, cierra el diálogo y avisa con `showInlineNotice`); `markAnnotationsDirty` al agregar o quitar una anotación; al cerrar el diálogo (`close`) se refresca la vista previa en línea. `src/styles-md3.css` (bloque «C-037», con la cabecera centrada). `index.html` (`?v=md3-c037`).
- **Alcance:** guardar las anotaciones las confirma en el borrador; se publican con «Guardar revisión y actualizar estación».
- **Pruebas:** 9 pasan; en el navegador se trazó una flecha en la hoja 5, apareció en la vista previa y el botón cerró el diálogo con aviso.
- **Revertir:** quitar el bloque, la acción, el listener `close` y el CSS; sin commit.

### C-038 (2026-11-03) — Iconos de los pasos más marcados

- **Solicitud:** los iconos de cada paso no mostraban bien la marca (el check se veía tenue).
- **Cambio:** `src/styles-md3.css` (bloque «C-038»): iconos de 18 px con trazo grueso (`wght` 700), color heredado forzado (check blanco sobre verde, lápiz blanco sobre naranja, restaurar café, papelera roja con fondo rosado) y sombra leve en «Guardar paso». `index.html` (`?v=md3-c038`). Tamaño de los botones sin cambios (24 px).
- **Revertir:** quitar el bloque «C-038»; sin commit.

### C-039 (2026-11-03) — «Guardar información de pasos» por hoja

- **Solicitud:** dar color al botón «Añadir paso a esta hoja» y, a su lado, un botón para guardar los pasos de la hoja y ocultarlos para elegir otra.
- **Cambios:** `src/sop-version-control.js`: `.sop-sheet-actions` con «Añadir paso a esta hoja» (naranja, icono +) y «Guardar información de pasos» (verde, acción `save-sop-sheet`: marca todos los pasos de la hoja como revisados, pliega la hoja, avisa con `showInlineNotice` y se desplaza a la siguiente); `refreshSopReviewMarks` marca la hoja con `is-sheet-saved` y añade «· guardada» al resumen. `src/styles-md3.css` (bloque «C-039»), `index.html` (`?v=md3-c039`).
- **Alcance:** guarda en el borrador; se publica con «Guardar revisión y actualizar estación». Una hoja se puede reabrir y editar de nuevo; al cambiar un paso pierde su marca de guardado.
- **Pruebas:** 9 pasan; en el navegador, la hoja 5 se pliega, muestra «3 pasos · guardada» y el contador pasa a «3 de 132 revisados».
- **Revertir:** restaurar el botón de C-034 y quitar la acción y el CSS; sin commit.

### C-040 (2026-11-03) — Acercar a una zona con recuadro

- **Solicitud:** habilitar el icono de la barra de la vista previa para dibujar un recuadro sobre la hoja, acercar esa zona al soltar y volver a la vista normal con un clic.
- **Cambios:** `src/sop-version-control.js`: el botón `fit_screen` pasa a `inline-zoom-area` (primer clic arma la selección con aviso azul y cursor en cruz; al soltar el recuadro se calcula el zoom para llenar el visor y se centra en la zona; con zoom > 1 el mismo botón muestra `fullscreen_exit` y vuelve al 100 %; doble clic sobre la hoja también vuelve, salvo en modo edición); el zoom máximo sube de 4 a 6. `src/sop-version-preview.js`: centrado en `_zoomTarget` y tope de 6. `src/styles-md3.css` (bloque «C-040»), `index.html` (`?v=md3-c040`).
- **Pruebas:** 9 pasan; en el navegador se armó el botón, se dibujó el recuadro (zoom ≈ 400 % centrado en la zona) y un clic en el botón volvió a 100 %.
- **Revertir:** devolver el botón a `inline-zoom-fit` y quitar los listeners y el CSS; sin commit.

### C-041 (2026-11-03) — Zoom progresivo de 10 en 10 %

- **Solicitud:** que los botones de acercar/alejar avancen de forma progresiva, de 10 en 10.
- **Cambio:** `src/sop-version-control.js`: paso de 0.5 a 0.1 en los botones y de 0.25 a 0.1 con Ctrl + rueda; el nivel se redondea a dos decimales. `index.html` (`?v=md3-c041`).
- **Revertir:** devolver los pasos 0.5 y 0.25; sin commit.

### C-042 (2026-11-03) — Encabezado de la revisión centrado

- **Solicitud:** centrar el título «Revisa y corrige la extracción automática» y su bloque.
- **Cambio:** `src/styles-md3.css` (bloque «C-042»): título, descripción y contadores centrados; `index.html` (`?v=md3-c042`). Revertir: quitar el bloque; sin commit.

### C-043 (2026-11-03) — Título del paso 1 del registro

- **Solicitud:** cambiar «¿Dónde vas a trabajar?» por una pregunta sobre el área de la línea de producción.
- **Cambio:** `src/views/station-intake.js`: título «¿En qué área de la línea de producción te encuentras?»; `index.html` (`?v=md3-c043`). Revertir: restaurar el texto anterior; sin commit.

### C-044 (2026-11-03) — Nombre de estación centrado en el selector del registro

- **Solicitud:** que el nombre de la estación (p. ej. TDR) quede centrado dentro del recuadro del selector.
- **Cambio:** `src/styles-md3.css` (bloque «C-044»): `text-align` y `text-align-last` centrados y relleno lateral simétrico en `.station-choice-selector select`; `index.html` (`?v=md3-c044`). Revertir: quitar el bloque; sin commit.

### C-045 (2026-11-03) — Selección de área con botones de estación (propuesta A)

- **Solicitud:** implementar la propuesta A de `propuestas/seleccion-area.html` solo en las tarjetas de área, sin tocar la captura de datos del equipo.
- **Cambios:** `src/views/station-intake.js`: `renderStationPills` (botones `.station-pill` por estación habilitada de cada área; «Desensamble» para RWK no personalizada), se quitan los `<select data-station-code>` de las tarjetas y se añade el texto «Elige una estación» en la tarjeta no seleccionada; `src/interactions.js`: acción `pick-station` (misma lógica que el cambio del selector: estación, primera SOP habilitada, `prepareSopChangeFromIntake`, `render` con foco); `src/styles-md3.css` (bloque «C-045»: tarjeta MFG azul y RWK roja al seleccionarse, insignia MFG azul, botones de estación). `index.html` (`?v=md3-c045`).
- **Sin cambios:** sección «Captura los datos del equipo», resumen, estado y botón «Abrir la SOP»; el manejador `[data-station-code]` queda en `interactions.js` sin uso.
- **Pruebas:** 9 pasan; en el navegador TDR/BAT/Desensamble se seleccionan, cambian `state.form.stationAssignment` (`MFG:TDR`, `CUSTOM:MFG:BAT`, `RWK:RWK`) y la tarjeta del área se marca.
- **Revertir:** restaurar el selector en `station-intake.js`, quitar `pick-station` y el bloque CSS; sin commit.

### C-046 (2026-11-03) — Pregunta «¿Qué tipo de desensamble vas a realizar?» en Retrabajo

- **Solicitud:** en RWK solo hay una SOP (desensamble completo del nodo); preguntar al operador qué tipo de desensamble hará y limitar el recorrido a esa parte.
- **Criterio de agrupación [Inferido]:** las opciones salen de la `category` de cada hoja de la SOP (`getDisassemblyOptions` en `src/data/workStations.js`): «Desensamble completo del nodo» más una opción por categoría (Chasis, Busbar, BMC, Cold Plate / Manifold, Bianca, Cableado / energía, Inspección, PDB / BMC, E1.S, Bahías / PCIe), con su número de hojas y pasos. Solo se pregunta cuando la SOP tiene dos o más categorías; una SOP subida desde PDF (una sola categoría) no la muestra. **Pendiente de confirmar** con producción si las categorías corresponden a los tipos reales de desensamble.
- **Archivos tocados:** `src/data/workStations.js` (`getDisassemblyOptions`, `getStationDisassemblyChoice`, `isStationIntakeReady`, mensaje de estado y normalización), `src/views/completion-dialog.js` (`disassemblyType` en el formulario), `src/interactions.js` (acción `pick-disassembly` y reinicio del tipo al cambiar de estación o SOP), `src/views/station-intake.js` (sección de opciones y botón «Abrir la SOP» condicionado), `src/station-intake.js` (validación al abrir), `src/app.js` (el recorrido guiado se crea solo con las hojas elegidas y guarda `run.disassembly`; el registro guarda `disassemblyType`), `src/reporting.js` (columna «Tipo de desensamble» en el CSV), `src/views/procedure.js` (ficha «Tipo de desensamble»), `src/styles-md3.css` (bloque «C-046»), `index.html` (`?v=md3-c046`).
- **Pruebas:** 9 pasan; en el navegador, RWK muestra 11 opciones (completo: 42 hojas con pasos y 132 pasos); «Bianca» crea un recorrido de 10 hojas (10–…); «Abrir la SOP» queda bloqueado hasta elegir el tipo.
- **Revertir:** quitar los cambios de los archivos listados; sin comprometer en `main` hasta que se confirme.

### C-047 (2026-11-03) — Selección de hojas del desensamble (una o varias)

- **Solicitud:** cada hoja de la SOP de desensamble es un proceso distinto (de chasis a Bianca); el operador debe poder elegir las hojas que va a realizar y ver solo esas.
- **Cambio sobre C-046:** se sustituyen las categorías por una tarjeta por hoja con selección múltiple. Descripciones de las hojas 5–23 tomadas del listado que entregó el usuario (`DISASSEMBLY_SHEET_NOTES` en `src/data/workStations.js`); para las demás hojas se usa el título de la hoja en la SOP **[Pendiente de confirmar]** (falta el listado de las hojas 24–46).
- **Archivos tocados:** `src/data/workStations.js` (`getDisassemblyOptions` por hoja, `describeDisassemblySelection`, `normalizeDisassemblySearch`), `src/views/completion-dialog.js` (`disassemblySheets` en el formulario), `src/interactions.js` (acciones `toggle-disassembly-sheet`, `select-all-disassembly-sheets`, `clear-disassembly-sheets` y filtro de búsqueda), `src/views/station-intake.js` (rejilla de hojas con buscador, «Todas», «Quitar» y contador), `src/station-intake.js`, `src/app.js` (recorrido con las hojas elegidas, en orden), `src/reporting.js`, `src/views/procedure.js` (ficha «Hojas del desensamble»), `src/styles-md3.css` (bloque «C-047»), `index.html` (`?v=md3-c047`).
- **Comportamiento:** hay que elegir al menos una hoja para abrir la SOP; el buscador filtra por número o texto (p. ej. «bf3») y la selección se conserva; el recorrido guiado incluye solo las hojas elegidas.
- **Pruebas:** 9 pasan; en el navegador aparecen 42 hojas, «bf3» deja 8, elegir las hojas 35 y 36 crea un recorrido de esas 2 hojas (6 pasos) con la ficha «Hojas 35–36».
- **Revertir:** volver a C-046 (`git revert` de este cambio); sin comprometer en `main` hasta confirmarlo.

### C-048 (2026-11-03) — Iconos llamativos por hoja del desensamble

- **Solicitud:** devolver los iconos llamativos de la versión por categorías a las tarjetas por hoja.
- **Cambios:** `src/data/workStations.js` (`DISASSEMBLY_ICON_RULES` y `getDisassemblyIcon`: icono y color según el texto de la hoja, p. ej. agua → gota azul, busbar → rayo naranja, ventiladores → ventilador turquesa, cables → cable verde, BMC/HMC → chip azul, BF3/OSFP → router morado), `src/views/station-intake.js` (insignia de color de 52 px y marca de selección a la derecha), `src/styles-md3.css` (bloque «C-048»), `index.html` (`?v=md3-c048c`).
- **Límites:** la asignación es por palabras clave **[Inferido]**; hojas con texto distinto reciben el icono de la primera regla que coincida, o una llave genérica.
- **Pruebas:** 9 pasan; revisado en el navegador (42 hojas con icono). **Revertir:** `git revert` de este cambio; sin comprometer en `main` hasta confirmarlo.

### C-049 (2026-11-03) — Con hojas elegidas, la SOP no muestra otras hojas

- **Solicitud:** al elegir una o varias hojas del desensamble, la imagen de la SOP debe mostrar solo esas hojas.
- **Revisión:** el visor (`src/sop-page-viewer.js`) ya dibujaba solo la página de la hoja actual y la navegación ya recorría solo `run.procedureIds`. Quedaban dos accesos al PDF completo y las etiquetas «de 46».
- **Cambios:** `src/views/procedure.js`: con un recorrido restringido (`run.disassembly.sheets`) se oculta el enlace «Abrir PDF en página», las etiquetas pasan a «Hoja 35 · 1 de 2 elegidas» y el visor recibe `data-restricted="true"`; `src/sop-page-viewer.js`: en ese caso, si falla pdf.js, no se usa el visor PDF del navegador como alternativa (permitiría desplazarse a otras hojas) y se muestra el error. `index.html` (`?v=md3-c049`).
- **Pruebas:** 9 pasan; en el navegador, elegidas las hojas 35 y 36: solo se dibuja la página 35, sin enlace al PDF, siguiente botón «Continuar a hoja 36».
- **Límite:** quien abra directamente el archivo `public/documents/SOP-NVD-GB200-141.pdf` por su URL lo ve completo; es un prototipo estático sin control de acceso. **Revertir:** `git revert`; sin comprometer en `main` hasta confirmarlo.

### C-050 (propuesta, 2026-11-03) — Tarjetas de hoja con el estilo de iconos de la primera versión

- **Solicitud:** al usuario le gustaron más los iconos de la primera versión (por categorías) que las insignias de color de C-048; proponer esa apariencia en las tarjetas por hoja.
- **Cambio (solo estilos):** `src/styles-md3.css` (bloque «C-050»): tarjeta centrada con icono rojo de contorno de 36 px sobre «Hoja N», etiqueta de pasos, descripción debajo y marca de selección en la esquina; la tarjeta elegida pasa a azul oscuro con icono blanco. `index.html` (`?v=md3-c050`). Los iconos y su asignación por palabras clave no cambian.
- **Estado:** rama `propuesta/iconos-iniciales`, **sin unir a `main`**; a la espera de confirmación. **Revertir:** `git revert` o no unir la rama.

### C-051 (2026-11-03) — Encabezado «Registrar validación» redondeado y en rojo (Material Design 3)

- **Solicitud:** redondear el recuadro del encabezado, usar el rojo de marca y hacerlo más llamativo con Material Design 3.
- **Cambios (solo estilos):** `src/styles-md3.css` (bloque «C-051»): recuadro con esquinas de 36 px (28 px en móvil) en lugar de solo las inferiores, degradado rojo `#7d1216 → #a92328 → #cf3a3e` con brillo radial, elevación MD3 de tres capas, anillos decorativos translúcidos, logo dentro de una cápsula azul marino (el arco rojo del logo no se ve sobre fondo rojo) e icono en un contenedor blanco de 60 px con símbolo rojo relleno; se quita el contorno del texto. `index.html` (`?v=md3-c051`).
- **Comprobado:** escritorio y 375 px de ancho. **Revertir:** quitar el bloque «C-051».

### C-052 (2026-11-03) — «Registrar validación» como rectángulo redondeado con contorno rojo

- **Solicitud:** el usuario aclaró la forma que quería (imagen de un rectángulo de esquinas redondeadas moderadas con contorno) con contorno rojo y Material Design 3; C-051 la había interpretado con esquinas muy redondeadas y sin contorno.
- **Cambio (solo estilos):** `src/styles-md3.css` (bloque «C-052»): radio de 22 px (18 px en móvil), contorno de 3 px en rojo oscuro `#6f0d11`, relleno rojo `#a92328` con degradado suave y brillo, elevación MD3 y cápsula del logo e icono con radio de 16 px. `index.html` (`?v=md3-c052`).
- **Revertir:** quitar el bloque «C-052» (queda C-051).

### C-053 (2026-11-03) — «Registrar validación»: relleno original y solo contorno rojo

- **Solicitud:** no cambiar el relleno del encabezado; cambiar solo la forma (rectángulo redondeado) y el contorno (rojo). C-051 y C-052 habían cambiado también el relleno a rojo.
- **Cambio (solo estilos):** `src/styles-md3.css` (bloque «C-053»): se restaura el relleno azul marino con brillo naranja, el logo sin cápsula y el icono naranja de la versión anterior; el contorno pasa a 4 px en rojo `#cf3a3e` con esquinas de 22 px (18 px en móvil). `index.html` (`?v=md3-c053`).
- **Revertir:** quitar el bloque «C-053» (queda C-052).

### C-054 (2026-11-03) — Encabezado de la SOP y ficha de hojas en «Validar SOP asignada»

- **Solicitud:** en la pantalla «Validar SOP asignada», aplicar al encabezado superior el estilo de «Seleccionar estación»; mover ahí la información de la SOP; quitar de junto al operador la ficha de la SOP y poner en su lugar las hojas (y qué desensamble) que se realizan, una por una; hacer más grandes iconos y texto.
- **Cambios:** `src/views/shell.js`: la etiqueta del encabezado ahora dice «SOP actual · SOP-NVD-GB200-141 · Rev. 1.1» (id y revisión). `src/views/procedure.js`: se elimina la ficha «SOP utilizada» y la ficha «Hojas del desensamble» antigua; nueva `renderContextSheets` con la lista de hojas del recorrido (número y descripción de cada una, la actual resaltada); con más de 6 hojas muestra el resumen («Desensamble completo del nodo · N hojas») y la hoja actual; en SOP que no son de desensamble muestra «Hoja en validación». `src/styles-md3.css` (bloque «C-054»): el encabezado `.topbar` usa relleno azul marino, contorno rojo de 4 px y esquinas de 22 px como el de «Registrar validación»; iconos de 56 px y textos de 18/14 px en las fichas. `index.html` (`?v=md3-c054b`).
- **Alcance:** el estilo del encabezado se aplica a todas las pantallas que usan `.topbar`, no solo a la validación. **Revertir:** `git revert` de este cambio; sin comprometer en `main` hasta confirmarlo.

### Lote documental L-D02 (2026-11-03) — actualización tras integrar `origin/main`

No es cambio de código; el código cambió por la integración (14 commits ajenos a esta sesión). Archivos tocados: `docs/00`, `03`, `04-modulos/01`, `02`, `03`, `06`, `05`, `09`, `10`, `07`; y números de línea citados en todos los documentos.

1. **Integración Git:** `git merge --ff-only origin/main` (sin conflictos de código). `README.md` tenía ediciones locales: se guardaron con `git stash`, se restauraron y se resolvieron dos conflictos conservando lo nuevo del remoto y sin credenciales ni cuenta nombrada ni el límite de 100 MB (el código no lo aplica).
2. **Líneas citadas:** remapeadas con un script que traduce cada número viejo al nuevo usando `git diff -U0 d3b7e93 HEAD`; las referencias sueltas (`:NN`) del módulo 03 se corrigieron a mano con `grep`.
3. **Contenido nuevo:** zoom 50–500 % y selección de área, anotaciones visuales, extracción explícita, cache-busting manual en `index.html`, inventario recontado (`sop-version-control.js` 1,374 líneas; `styles.css` 1,592; `styles-md3.css` 489).

- Validación: `node --test tests/sop-run.test.mjs tests/work-stations.test.mjs` → 9 pasan; `tests/sop-version-control.test.mjs` sigue sin correr en Node (falta `DOMMatrix`/`@napi-rs/canvas`). No se probó la interfaz en navegador.
- Revertir la integración: `git reset --hard d3b7e93` descartaría el código remoto integrado y las ediciones locales de `README.md` sin commit; antes habría que guardar `README.md`. No ejecutado.

### Prueba en frío de `00-LEEME-AGENTE.md`

Hecha por el mismo agente que escribió la documentación (no es una prueba independiente). Desde el orden de lectura de `00` se localizó: bloqueo de avance de hoja → `02` → `04-modulos/02` (`src/sop-run.js:64-95`); cierre y revisión de retrabajo → `04-modulos/04` (`src/workflow.js:398-420`); permiso de administrar SOP → `04-modulos/03` y `11`; cálculo de turnos → `04-modulos/05` (`src/reporting.js:22-30`); dónde viven los datos → `05`. Resultado: las cinco consultas se resolvieron en dos saltos o menos. Una prueba realmente en frío, con otro agente, sigue [Pendiente].

## Estado de lotes de cambios de código

No hay cambios de código nuevos en esta sesión; solo se creó/actualizó documentación. Por eso no se registra un lote C-001 de implementación. El próximo cambio de código debe iniciar una entrada con identificador consecutivo y reunir tres cambios completos, salvo excepción de riesgo.
