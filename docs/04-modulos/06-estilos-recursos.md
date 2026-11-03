# Módulo: estilos y recursos visuales

Última actualización: 2026-11-02. Código: `main` @ `11f61c3` (= `origin/main`; árbol con `README.md` modificado, sin commit).

## Resumen

`src/styles.css` contiene el estilo base y responsive. `src/styles-md3.css` añade la capa Material Design 3 introducida para el catálogo y los controles administrativos. Los logos, fondo, fuentes, hojas y referencias están bajo `public/assets`.

## Reglas visuales verificadas

- [Verificado en código] `index.html:8-10` carga ambos CSS y fuentes locales.
- [Verificado en código] `styles.css` define shell, tarjetas, tablas, diálogos, visor, checklist y media queries (1,592 líneas).
- [Verificado en código] `styles-md3.css` define tokens de color, radios, elevación, estados, catálogo y vista previa (650 líneas).
- [Verificado en código] El diseño usa Material Symbols Rounded y Roboto locales; no requiere Google Fonts (`public/assets/fonts/`).

## Recursos

[Verificado en inventario] Hay 46 imágenes de hoja completa, 132 referencias de paso, 7 bloques, 4 imágenes SOP sueltas, 4 imágenes de identidad/fondo y un PDF base. Las imágenes son binarias y se documentan por conteo, no por contenido textual.

## Riesgos

- [Verificado en código] Los CSS son archivos grandes y varias reglas específicas se agregan al final; cambios futuros deben revisar cascada y responsive.
- [Pendiente de confirmar] Auditoría visual en móvil, tablet y escritorio con cada sección.

## Qué NO le corresponde

- Los estilos no definen comportamiento ni permisos; solo presentación.
- `public/vendor/pdfjs/` es una dependencia ajena: no se edita a mano.

## Funciones y estructura

No hay funciones; la organización de capas es:

| Capa | Archivo | Líneas | Contenido |
| --- | --- | ---: | --- |
| Base | `src/styles.css` | 1,592 | Shell, tarjetas, tablas, diálogos, visor, checklist y media queries. |
| Material Design 3 | `src/styles-md3.css` | 650 | Tokens de color, radios, elevación, estados, catálogo y vista previa. |
| Fuentes | `public/assets/fonts/fonts.css` | — | `@font-face` locales de Roboto y Material Symbols Rounded. |

Orden de carga en `index.html:8-10`: `styles.css`, `public/assets/fonts/fonts.css`, `styles-md3.css`. Como `styles-md3.css` va al final, sus reglas ganan a igualdad de especificidad.

## Capa «Registrar validación» para operador (C-001)

[Verificado en código] Al final de `src/styles-md3.css` (desde la línea ~490) hay un bloque propio de la pantalla de intake: tokens locales `--intake-*` (rojo de marca, contenedores, verde de campo válido, ámbar de aviso), tarjetas de sección de 28 px de radio, tarjetas de estación táctiles de 140 px con check, campos de 64 px con letra de 20 px, estado en píldora y botón principal de 76 px. Incluye `:has()` para marcar en verde cada campo con contenido y respeta `prefers-reduced-motion` en la animación del botón. Los puntos de corte son 1000 px y 650 px; en móvil los campos bajan a 60 px.

## Cache-busting manual (desde `origin/main`)

[Verificado en código] `index.html` añade parámetros `?v=<hash>-<texto>` a `styles.css`, `styles-md3.css`, `sop-version-control.js` y `views/station-intake.js` (líneas 8, 10, 16, 25, 27 y 36; en C-001 se añadieron `src/data/workStations.js` y `src/station-intake.js`) para forzar al navegador a recargar esos archivos. Son manuales: si se edita otro script o CSS sin cambiar el parámetro, un navegador con caché puede mostrar la versión vieja. Los demás scripts no lo llevan.

## Código clave

```html
<link rel="stylesheet" href="./src/styles.css" />
<link rel="stylesheet" href="./public/assets/fonts/fonts.css" />
<link rel="stylesheet" href="./src/styles-md3.css" />
```

(`index.html:8-10`). Mover una de estas líneas cambia la cascada de toda la aplicación.

## Trampas

- [Verificado en código] Material Symbols pesa 5.4 MB (`MaterialSymbolsRounded.woff2`); es el recurso más grande de la interfaz tras el PDF base (10.3 MB).
- [Verificado en código] Las imágenes se consumen por ruta convencional desde `src/data/sopData.js`, no desde CSS.

## Deuda técnica y mejoras sugeridas

- `styles.css` supera 1,500 líneas con reglas añadidas al final; revisar la cascada antes de tocarla.
- Subconjunto de la fuente de iconos para reducir peso.
