# Contexto del Proyecto: Traductor Local (LibreTranslate EN-ES)

## Objetivo
Implementar una versión local y práctica de LibreTranslate con la misma experiencia de usuario de https://libretranslate.com/, enfocada principalmente en Inglés y Español.

## Requisitos Clave
1. **Detección automática e inteligente de idioma fuente**:
   - Si se detecta **Inglés** (`en`), el idioma destino se configura automáticamente a **Español** (`es`).
   - Si se detecta **Español** (`es`), el idioma destino se configura automáticamente a **Inglés** (`en`).
   - Si el usuario selecciona manualmente otro idioma destino, se respeta la elección manual.
2. **Créditos y Atribución**:
   - Enlace visible en el pie de página reconociendo que es un desarrollo de [merke.net](https://merke.net) y basado en [LibreTranslate](https://github.com/LibreTranslate/LibreTranslate) (Licencia AGPLv3).
3. **UX / UI**:
   - Interfaz limpia, responsiva y rápida como la web oficial.
   - Traducción en tiempo real con debounce.
   - Notificaciones de tipo **sticky** al guardar favoritos, copiar al portapapeles o actualizar configuraciones.
   - **Modales de confirmación** elegantes para acciones destructivas (borrar texto largo, eliminar elementos del historial) en lugar de `alert()` o `confirm()`.
4. **Ejecución Local**:
   - Orquestado vía Docker / Docker Compose y scripts directos (`start.sh`, `stop.sh`).
   - Carga enfocada y optimizada para los modelos de Inglés y Español (`en,es`) para máxima velocidad y bajo consumo de memoria.
