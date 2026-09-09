# Kit visual de correo de Kiosco+

Este directorio contiene derivados para correo electrónico creados a partir de los logos oficiales de Kiosco+. No reemplazan los maestros ubicados en `docs/marca/`.

## Archivos

- `assets/cabecera-correo-petroleo-1200x420.png`: cabecera principal recomendada. Debe mostrarse a 600 × 210 px para aprovechar pantallas de alta densidad.
- `assets/cabecera-correo-papel-1200x420.png`: alternativa clara.
- `assets/fondo-correo-papel-1200x1600.png`: fondo decorativo opcional. Siempre usar además `#F6F1E7` como color de respaldo.
- `assets/monograma-correo-320x320.png`: avatar o ícono cuadrado.
- `assets/logo-correo-claro-1200x375.png`: logo transparente para fondo oscuro.
- `assets/logo-correo-oscuro-1200x375.png`: logo transparente para fondo claro.
- `generar-assets-correo.ps1`: regenera todos los PNG desde los maestros actuales.
- `generar-vistas-previas.mjs`: genera ejemplos reales usando `server/email-service.mjs`.
- `vistas-previas/`: ejemplos de los cuatro correos automáticos, sin variables visibles.

La fuente de verdad del diseño automático es `server/email-service.mjs`. No copiar ni enviar un HTML con variables `{{...}}`: las muestras correctas son las de `vistas-previas/` y se regeneran desde el servicio real.

## Reglas de uso

- Las copias listas para publicar quedan en `public/email-assets/` y, después del despliegue de la landing, sus URLs serán `https://kioscomas.ar/email-assets/NOMBRE-DEL-ARCHIVO.png`.
- Para correo automático, usar siempre esas URLs HTTPS públicas y absolutas del dominio `kioscomas.ar`.
- No adjuntar las imágenes como base64 dentro del HTML.
- Incluir siempre texto alternativo en el logo.
- El contenido importante debe seguir siendo comprensible si el destinatario bloquea todas las imágenes.
- El fondo gráfico es opcional. Outlook y otros clientes pueden omitirlo; por eso la plantilla usa también un color de fondo sólido.
- No estirar ni recolorear los logos.
- Conservar el HTML de texto principal con estilos inline.
- El servicio declara `color-scheme: light only`, repite colores críticos mediante `bgcolor` y aplica correcciones para Apple Mail en modo oscuro.

## Paleta

- Petróleo: `#1C4A44`
- Mostaza: `#E3A23C`
- Papel: `#F6F1E7`
- Tinta: `#2A241E`
- Sello: `#B8412F`
