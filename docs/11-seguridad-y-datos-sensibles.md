# Seguridad y datos sensibles

Última actualización: 2026-11-02. Código: `main` @ `11f61c3` (= `origin/main`; árbol con `README.md` modificado, sin commit).

## Resumen

El sistema es un prototipo local. Maneja identificadores de empleados, nombres de operadores, seriales, PN, fotos y contraseñas simuladas en el navegador. No debe tratarse como control de acceso ni registro oficial.

## Hallazgos

- [Verificado en código] Los perfiles iniciales están en `src/user-control.js`; la documentación omite sus valores.
- [Verificado en código] Las credenciales nuevas se guardan en almacenamiento local y la sesión se simula en el navegador (`src/user-control.js:1-215`).
- [Verificado en código] Seriales, PN, operador, puesto y evidencia se persisten localmente (`src/app.js:67-75`, `src/workflow.js:165-185`, `src/evidence-store.js:1-90`).
- [Verificado en código] La auditoría local conserva eventos, pero puede modificarse desde DevTools y no es inmutable (`src/user-control.js`, `src/app.js:227`).
- [Verificado en inventario] `.gitignore` excluye `.env`, temporales y artefactos; no deben agregarse secretos al repo.

## Reglas para futuros cambios

1. No copiar credenciales, tokens, llaves, nombres personales, seriales o fotografías reales a Markdown, tests o commits.
2. No enviar datos del navegador a servicios externos sin autorización explícita y diseño de privacidad.
3. Si se agrega backend, usar autenticación real, autorización por rol, TLS, control de sesiones, cifrado y auditoría inmutable.
4. Definir retención y borrado de evidencias antes de migrar IndexedDB.
5. Mantener el modo demo separado de cualquier entorno de producción.

## Estado

[Pendiente de confirmar] Clasificación corporativa de los campos de nodo/tarjeta y requisitos de privacidad de Ingrasys/Nvidia Racks.

## Hallazgos adicionales (2026-11-02)

- [Verificado en código] Las contraseñas de los usuarios se almacenan y comparan en texto plano dentro del objeto de usuario, tanto en la semilla como en `localStorage` (`src/user-control.js:62-66`, `:87-114`). Cualquiera con DevTools puede leerlas.
- [Verificado en código] El permiso para administrar SOP se decide por un número de empleado fijo y el rol (`src/sop-version-control.js:51-53`). Es un control de interfaz, no de servidor. El número no se transcribe.
- [Verificado en Git] El `README.md` del commit `11f61c3` (y de los anteriores) contiene una tabla de perfiles de demostración con nombres reales, números de empleado y contraseñas. Esa versión permanece en el historial del repositorio remoto aunque el árbol de trabajo ya no la tenga. Riesgo: exposición de datos personales y de credenciales (si siguen en uso). Acción sugerida, no ejecutada: confirmar visibilidad del repositorio, rotar contraseñas reutilizadas y decidir si se reescribe el historial.
- [Verificado en código] Los nombres de los perfiles de demostración también están en `src/user-control.js` (semilla). Se documenta su existencia, no su contenido.
- [Verificado en inventario] `tmp/` (capturas QA, PDF e imágenes extraídas) no está versionada (`.gitignore:2`); si contuviera datos reales, no llegaría al repositorio, pero sí al paquete si se copia la carpeta a mano. `scripts/package-offline.py` solo incluye rutas listadas (`index.html`, `README.md`, `offline`, `src`, `public`).
- [Verificado en código] Antes de publicar un paquete sin red, revisar que `README.md` no vuelva a incluir credenciales.
