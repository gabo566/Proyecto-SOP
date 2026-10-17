# SOP de desensamble GB200 · Ingrasys

Aplicación web estática en español para consultar y registrar el avance de procedimientos de desensamble de un nodo GB200. El prototipo combina instrucciones de trabajo, referencias visuales, una lista de validación por paso, trazabilidad ilustrativa y un flujo local para detener trabajos, documentar retrabajos y revisar evidencia fotográfica.

> **Estado del proyecto:** prototipo de desarrollo local. La interfaz identifica expresamente un entorno de muestra sin conexión a producción. No hay servidor de aplicación, API, base de datos compartida, autenticación ni despliegue configurado como parte del flujo actual.

## Para qué sirve

El proyecto explora cómo podría acompañarse una operación de desensamble de principio a fin: seleccionar una sección de la SOP, leer cada instrucción con su referencia visual, marcar los pasos realizados, asociar la validación con el nodo y el operador, guardar una interrupción para reanudar después y conservar fotos relacionadas con una validación o un retrabajo.

La aplicación no controla herramientas ni equipos, no se conecta a sistemas de manufactura y no verifica físicamente que un paso se haya ejecutado. La marca de un paso y la declaración son entradas del usuario. La aprobación de un retrabajo representa una revisión humana simulada; el sistema no determina automáticamente si una reparación es técnicamente correcta.

## Procedimiento documentado

Los datos de `src/data/sopData.js` describen el documento `SOP-NVD-GB200-141`, titulado «Desensamble general de Compu tray modelo 2000», asociado a la familia GB200, cliente «Nvidia Racks», estación «Rework» y número de parte de nodo `675-24975-2000-000`. La estructura contiene 42 secciones de procedimiento, correspondientes a las hojas 5 a 46 del PDF, y 132 renglones de pasos de validación. Las numeraciones conservan subpasos como `7.1.1` y `54.5`.

Las categorías que agrupan los procedimientos son:

- Chasis
- Busbar
- BMC
- Cold Plate / Manifold
- Bianca
- Cableado / energía
- Inspección
- PDB / BMC
- E1.S
- Bahías / PCIe

El contenido recorre preparación del chasis; desconexión de Busbar, ventiladores, tarjetas y cableado; retiro de manifolds, fuentes y bahías; inspección de conectores y sensores; limpieza de Bianca y Cold Plate; y extracción de componentes como BMC, PDB, SSD E1.S, BF3, NIC, OSFP e IPEX. Algunas instrucciones incluyen números de parte, conectores, fixtures, puntas de herramienta, secuencias y rangos de torque.

Cada sección relaciona el texto de sus pasos con una o más imágenes. Cuando existe, el PDF original se puede abrir en la hoja correspondiente. El visor de imágenes permite ampliar y reducir la referencia.

### Datos que requieren cotejo con la SOP controlada

Hay una diferencia visible entre la revisión del encabezado de la aplicación («Rev 2») y la metadata usada por los paneles y el selector (`SOP_DOCUMENT.revision`, «3»). Antes de usar estos datos en un proceso real, se debe confirmar cuál revisión está aprobada y actualizar ambas referencias según corresponda.

Además, cuatro pasos incluyen una nota de discrepancia en los propios datos. La interfaz las muestra junto al paso:

| Hoja | Paso | Discrepancia que señala el prototipo |
| --- | --- | --- |
| 16 | 23 | El texto muestra `755-24975-0054-A01` para NCSI, mientras que el llamado visual y la tabla de partes señalan `755-24975-0018-A11`. |
| 42 | 91 | El texto muestra `753-24974-0012-000`; la imagen y la tabla de partes señalan `753-24974-0010-A03`. |
| 45 | 98 | El PN `755-24975-0027-A09` aparece asociado al lado izquierdo en la tabla y al derecho en el texto. |
| 46 | 103 | El texto muestra `688-24975-0009-005`; la imagen y la tabla de partes señalan `688-24975-0009-002`. |

Estas notas son advertencias editoriales del prototipo, no una resolución de ingeniería. La fuente aprobada debe decidir el valor correcto.

## Qué puede hacer una persona en la interfaz

### Seguimiento de SOP y producción

- Elegir cualquiera de las 42 secciones desde el selector o avanzar y retroceder entre ellas.
- Consultar categoría, título, hoja, secuencia, instrucciones, imágenes y datos generales de la SOP.
- Ampliar las referencias visuales con controles de zoom.
- Capturar serial y número de parte del nodo, nombre y número de empleado, puesto, tipo de reparación y datos del componente reparado.
- Marcar cada paso como realizado y revisar el avance de la sección.
- Presentar una declaración indicando que se realizaron los pasos y que la información capturada es correcta.
- Registrar la validación cuando todos los pasos de la sección están marcados y los campos obligatorios están completos.

La declaración no equivale a una firma electrónica ni a una identidad autenticada. La casilla es una confirmación dentro del prototipo.

### Detener y reanudar un trabajo

Antes de detener el trabajo, la aplicación requiere el serial del nodo, nombre del operador y número de empleado. También requiere escoger un motivo y escribir una nota para la persona que lo reanude. Los motivos disponibles incluyen falta de componente, falta de herramienta o fixture, espera de soporte técnico, discrepancia de SOP, defecto detectado y otro.

Se puede guardar una detención por bloqueo o declarar que se requiere retrabajo. En ambos casos se conserva localmente el procedimiento, hoja, avance marcado, datos capturados, motivo, nota y un historial de eventos. Una detención queda disponible para reanudarse; un retrabajo identifica el paso con falla. Al iniciar el retrabajo, ese paso se vuelve a abrir para que se corrija y valide de nuevo.

El área «Detenidos y retrabajos» presenta los trabajos abiertos, su estado, avance, responsable, datos del componente, fotos relacionadas e historial. También muestra algunos trabajos cerrados recientemente.

### Evidencia fotográfica y revisión

- Se aceptan imágenes JPG, PNG y WebP, de hasta 8 MB cada una, con un máximo de cinco fotos por conjunto.
- La evidencia de una validación normal es opcional. Para enviar un retrabajo a revisión se requiere al menos una foto.
- Una detención también admite evidencia opcional.
- El envío del retrabajo crea una entrada de evidencia asociada al registro y lo deja «Pendiente de revisión».
- La revisión permite ampliar las fotos, aprobar el retrabajo o solicitar una corrección. Para solicitar corrección se debe escribir una nota.
- Las decisiones y notas de revisión se guardan en el mismo navegador. La etiqueta «Supervisor» no corresponde a una sesión autenticada ni a permisos de servidor.

### Trazabilidad, reportes y búsqueda

La navegación separa «Seguimiento SOP», «Producción», «Trazabilidad» y «Reportes». La interfaz muestra métricas diarias, conteos por categoría y por operador, una gráfica y tablas de validaciones. Se puede buscar por serial, nodo, categoría, operador y otros datos capturados; el diálogo de registros muestra el conjunto filtrado.

Los datos iniciales son 19 registros ficticios distribuidos entre BMC, Busbar, Cold Plate / Manifold y Bianca. Llevan seriales `DEMO-*`, operadores `Operador demo *` y la etiqueta «Demostración». Las métricas del día combinan esos datos ilustrativos con las validaciones que se hayan guardado localmente. No deben interpretarse como producción real.

## Persistencia y límites

La aplicación no tiene backend. Los registros de validación y los trabajos detenidos o en retrabajo se guardan en `localStorage`; los archivos de evidencia se guardan en IndexedDB. Esto significa que:

- Los datos pertenecen al perfil de navegador y al origen local que se usó para abrir la aplicación.
- No se comparten entre operadores, equipos, navegadores ni instalaciones.
- Borrar los datos del sitio en el navegador puede eliminar registros y evidencia.
- No hay sincronización, respaldo central, control de acceso, autenticación, bitácora inmutable ni recuperación administrativa.
- La persistencia local sirve para probar el flujo de interfaz, no para mantener registros oficiales de manufactura.

La fecha y hora se obtienen del reloj y la zona horaria del navegador. Las métricas y los registros de demostración se presentan para la fecha actual del dispositivo.

## Cómo abrirlo para desarrollo local

No se necesita instalar paquetes ni compilar la aplicación. Se puede servir el checkout directamente desde la raíz del repositorio:

```bash
cd /workspace/Proyecto-SOP
python3 -m http.server 8000 --bind 127.0.0.1
```

Después, abre `http://127.0.0.1:8000` en el navegador. Ejecutar el servidor desde la raíz mantiene disponibles las rutas `./src/...` y `./public/...` que usa la aplicación. Detén el servidor con `Ctrl+C` al terminar.

No se genera `dist` para este flujo local. El archivo `scripts/prepare-sites-build.mjs` pertenece a la preparación de empaquetado para Sites y crea archivos dentro de `dist`; no forma parte del inicio ni del desarrollo local actual.

La tipografía Roboto y los iconos Material Symbols se cargan desde Google Fonts. Si el navegador no tiene acceso a esos dominios, la aplicación sigue usando sus estilos y fuentes de respaldo, aunque algunos iconos o detalles visuales pueden variar.

## Organización del código

La aplicación no usa un framework ni un bundler. `index.html` carga scripts clásicos en un orden explícito; los datos y funciones se comparten en el ámbito global del documento. `src/app.js` mantiene el estado de la interfaz, vuelve a renderizar la pantalla y conecta los flujos con los eventos delegados de `src/interactions.js`.

| Ruta | Responsabilidad |
| --- | --- |
| `index.html` | Documento inicial, CSS y orden de carga de scripts. |
| `src/data/sopData.js` | Metadata de la SOP, los 42 procedimientos, pasos, referencias visuales, categorías y registros ficticios. |
| `src/app.js` | Estado de pantalla, selección de procedimiento, validación, guardado de registros y composición de vistas. |
| `src/interactions.js` | Eventos de navegación, formularios, búsqueda, diálogos, imágenes y evidencia. |
| `src/workflow.js` | Crear, pausar, reanudar, completar y registrar el historial de trabajos. |
| `src/work-items.js` | Lectura y escritura de trabajos en almacenamiento local y presentación de sus tarjetas. |
| `src/evidence-capture-workflow.js` | Selección y retiro de fotos de validación, detención y retrabajo. |
| `src/evidence-workflow.js` | Evidencia asociada a retrabajos, visor, administración de fotos y decisión de revisión. |
| `src/evidence-store.js` | Base IndexedDB del navegador y límites de archivos de evidencia. |
| `src/views/` | Plantillas de navegación, procedimientos, formularios, registros, actividad y diálogos. |
| `src/escape.js` | Escape de texto antes de insertarlo en plantillas HTML. |
| `src/styles.css` | Diseño visual adaptable, estados, tablas, diálogos y componentes. |
| `public/documents/SOP-NVD-GB200-141.pdf` | PDF de referencia que abre el selector en la hoja activa. |
| `public/assets/` | Identidad visual, imágenes de hojas y referencias paso a paso. |
| `worker/index.js` | Worker de Sites que devuelve `index.html` para rutas GET/HEAD HTML desconocidas. No es un backend de operaciones. |
| `scripts/prepare-sites-build.mjs` | Copia el worker y la configuración de hosting a `dist` para empaquetado de Sites. No se requiere para desarrollo local. |
| `tests/sites-worker.test.mjs` | Pruebas del comportamiento del worker y de los archivos del paquete de Sites; no cubren todo el flujo de la interfaz. |
| `.openai/hosting.json` | Configuración de hosting actual: sin bindings configurados para D1 o R2. |
| `src/views/procedure (1).js` | Archivo presente en el repositorio que no se carga desde `index.html`; la vista activa es `src/views/procedure.js`. |

## Tecnologías y compatibilidad

- HTML, CSS y JavaScript nativo.
- APIs del navegador: `localStorage`, IndexedDB, `crypto.randomUUID`, File API, `URL.createObjectURL` y diálogos HTML nativos.
- Node.js solo se usa para el script y las pruebas de empaquetado para Sites; Python puede servir los archivos estáticos durante el desarrollo local.
- No hay `package.json`, dependencias npm, servicio de base de datos ni variables de entorno requeridas para abrir el prototipo.

Se recomienda un navegador moderno con soporte para esas APIs. Las fotos requieren un origen web que permita IndexedDB; el servidor local indicado proporciona ese contexto.

## Alcance pendiente antes de cualquier uso operativo

Antes de tratar el proyecto como una herramienta de producción, haría falta definir e implementar fuera de este prototipo, como mínimo, la fuente oficial y revisión vigente de la SOP, la resolución de discrepancias, autenticación y roles reales, un backend con persistencia central, sincronización y respaldo de fotos, auditoría de cambios, política de retención y privacidad, manejo de errores operativos, pruebas del flujo completo y aprobación de ingeniería/calidad. El código actual no proporciona esas capacidades.

## Regla para mantener esta documentación

Actualiza este README en la misma modificación que cambie el propósito, los flujos, las reglas de validación, los datos de la SOP, el almacenamiento, las tecnologías, los comandos locales o cualquier otra capacidad descrita aquí. Mantén las explicaciones y el inventario de archivos alineados con el comportamiento real del código; elimina o corrige la información que deje de aplicar. No documentes un despliegue como parte del flujo vigente hasta que el proyecto y su responsable lo hayan solicitado expresamente.
