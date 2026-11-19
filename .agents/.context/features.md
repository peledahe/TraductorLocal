# Características y Reglas del Traductor Local

## 1. Detección Inteligente y Selección de Idiomas
- **Modo Automático enfocado en EN ⇄ ES**:
  - Origen por defecto: `auto` ("Detectar idioma").
  - Destino por defecto: `smart_auto` ("✨ Automático (EN ⇄ ES)").
  - Regla:
    - Si el texto detectado es Inglés (`en`), el destino se ajusta automáticamente a Español (`es`).
    - Si el texto detectado es Español (`es`), el destino se ajusta automáticamente a Inglés (`en`).
    - Si el texto detectado pertenece a otro idioma, se traduce a Español por defecto.
- **Soporte de Otros Idiomas (Selección Manual)**:
  - Los usuarios pueden seleccionar explícitamente cualquier otro idioma soportado (Francés, Alemán, Italiano, Portugués, Ruso, Chino, Japonés, Coreano, Árabe, Catalán, Holandés, Hindi, etc.) tanto en origen como en destino.
  - Al seleccionar un idioma manual en destino, prevalece esa elección sin activar el cambio automático.
  - Los selectores agrupan visualmente los "Idiomas Principales" (Español, Inglés) y "Otros Idiomas (Selección manual)" ordenados alfabéticamente en español.

## 2. Traducción de Archivos
- **Formatos compatibles**: `.txt`, `.odt`, `.odp`, `.docx`, `.pptx`, `.epub`, `.html`, `.srt`, `.pdf`, `.md` (Markdown).
- **Selector de Modo en UI**: Pestañas superiores para alternar entre "TRADUCIR TEXTO" y "TRADUCIR ARCHIVOS".
- **Área de Drag & Drop**: Permite arrastrar archivos o hacer clic en "SELECCIONAR ARCHIVO".
- **Flujo**:
  1. Subida del documento y muestra de metadatos (nombre, peso).
  2. Envío a `/translate_file` en el backend local.
  3. Notificación sticky al completar y botón de descarga directa del documento traducido.
  4. Modal de confirmación si se cancela una traducción en proceso.

## 3. Modo Oscuro / Modo Claro (Theming)
- Toggle en la cabecera (sol / luna) con persistencia en `localStorage`.
- Detección automática de la preferencia del sistema (`prefers-color-scheme`).
- Carga sin parpadeo blanco (*anti-flicker script* en `<head>`).
- Notificación sticky al alternar entre modos.

## 4. Modo Responsivo Esencial
- En dispositivos móviles (< 768px):
  - **Header compacto**: Se ocultan subtítulos extensos y se prioriza Logo + Toggle de Tema + Status discreto.
  - **Barra de idiomas simplificada**: Se ocultan etiquetas redundantes y textos explicativos largos; los selectores ocupan el ancho óptimo con el botón swap centrado.
  - **Cajas de texto adaptadas**: Altura reducida a ~135px para que entrada y traducción quepan cómodamente en la pantalla sin scroll excesivo.
  - **Toasts y modales centrados** en el viewport móvil con márgenes seguros.
  - **Traducción de archivos compacta**: Padding reducido y botones táctiles optimizados.

## 5. Experiencia de Usuario (UI/UX)
- Notificaciones Sticky (Toast) permanentes/temporales en esquina superior derecha para eventos:
  - Copiado al portapapeles ("Texto copiado con éxito").
  - Traducción guardada en favoritos.
  - Cambio automático de idioma detectado.
- Modales de Confirmación para acciones destructivas:
  - Botón "Limpiar": Limpia de forma directa e inmediata el texto sin pedir confirmación.
  - Botón "Borrar del historial" / "Vaciar historial": Modal de confirmación antes de eliminar registros guardados.
- Soporte para atajos de teclado (Ctrl+Enter para traducir, Esc para cerrar modales).
- Contador de caracteres y palabras.

## 6. Créditos
- Atribución a **merke.net** en el subtítulo del encabezado y en el pie de página.
- Enlace directo al repositorio original: https://github.com/LibreTranslate/LibreTranslate y https://libretranslate.com/.
