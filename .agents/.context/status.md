# Estado Actual del Proyecto

## Implementación Completada
- **Soporte HTTPS y Portapapeles**: Habilitado puerto 443 (HTTPS) con certificado SSL y Autoridad Certificadora (CA) propia para `translate.local` (`instalar-certificado.sh` para confianza en sistema y navegadores sin alertas). Soporte nativo para lectura de portapapeles sin restricciones.
- **Control de Versiones (.gitignore)**: Configurado y aplicado para excluir modelos pesados (>3 GB en `data/libretranslate`), certificados y claves privadas SSL (`data/certs`), entornos virtuales (`venv`), caché (`__pycache__`) y logs, manteniendo la estructura de directorios mediante `.gitkeep`.
- **Versión Activa**: v2.3 desplegada en `https://translate.local`, `http://translate.local` y `http://localhost`.
- **Temas y Responsivo**: Modo Oscuro y Modo Claro con toggle dinámico e interfaz móvil optimizada para mostrar solo lo esencial.
- **Arranque Automático**: Configurado con política `restart: always` en Docker Compose y servicio systemd opcional (`traductor-local.service`).
- **Dominio y Puertos**: Mapeado al puerto estándar `80` (HTTP) y `8080`. Accesible vía `http://translate.local` y `http://localhost`.
- **Traducción de Archivos**: Pestañas de modo ("TRADUCIR TEXTO" y "TRADUCIR ARCHIVOS"), soporte drag & drop para `.txt, .odt, .odp, .docx, .pptx, .epub, .html, .srt, .pdf, .md` con descarga local de archivos traducidos.
- **Backend**: Contenedor oficial `libretranslate/libretranslate:latest` con 14 idiomas cargados (`en, es, fr, de, it, pt, ru, zh, ja, ko, ar, hi, nl, ca`) y 28 modelos en memoria.
- **Frontend / Proxy**: Servidor local Python (`server.py`) sirviendo `web/` en el puerto `8080` y proxeando llamadas `/translate`, `/detect` y `/languages`.
- **Detección Dinámica**:
  - Modo automático exclusivo para Inglés y Español (EN ⇄ ES).
  - Otros idiomas disponibles para selección manual agrupados en los desplegables de origen y destino.
- **Notificaciones y Modales**:
  - Notificaciones sticky (toast) al copiar al portapapeles, guardar favoritos y advertencias.
  - Modales de confirmación para borrado de texto e historial (reemplazando `alert`/`confirm`).
- **Créditos**: Enlace y atribución directa al proyecto original en el pie de página de la interfaz y en el README.
- **Pruebas de Funcionamiento**: Realizadas con éxito tanto para traducción EN ➔ ES como ES ➔ EN y detección automática.
