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
- **Formatos compatibles**: `.txt`, `.odt`, `.odp`, `.docx`, `.pptx`, `.epub`, `.html`, `.srt`, `.vtt`, `.pdf`, `.md` (Markdown).
- **Selector de Modo en UI**: Pestañas superiores para alternar entre "TRADUCIR TEXTO", "TRADUCIR ARCHIVOS" y "GENERAR PROMPT (IA)".
- **Área de Drag & Drop**: Permite arrastrar archivos o hacer clic en "SELECCIONAR ARCHIVO".
- **Refinamiento Inteligente con IA Habilitada**:
  - Si hay un proveedor de IA activo (o cuota gratuita seleccionada), el documento se traduce primero localmente con LibreTranslate y a continuación es refinado automáticamente por la IA seleccionada.
  - Para subtítulos (`.srt`, `.vtt`), preserva rigurosamente los índices numéricos y los timestamps de tiempo exactos, elevando únicamente la fluidez y naturalidad de los subtítulos.
  - Para Markdown (`.md`), preserva intactos bloques de código, tablas, enlaces y sintaxis, elevando el vocabulario a nivel técnico nativo.
  - Para HTML (`.html`, `.htm`), preserva la estructura del DOM, atributos y etiquetas intactos, traduciendo únicamente el texto visible legible.
  - Para Word (`.docx`), manipula la estructura XML interna (`word/document.xml`) preservando el diseño y estilos del documento original.
  - Si la opción activa es "Solo Local" o no hay IA configurada, traduce directamente con la velocidad de LibreTranslate sin intervención externa.
- **Privacidad Absoluta con Almacenamiento Cero (Zero Server-Side Storage)**:
  - **Autodestrucción Inmediata al Descargar**: El documento traducido reside únicamente en la memoria RAM del servidor con un token criptográfico de un solo uso (`uuid`).
  - En el instante exacto en que el usuario hace clic y descarga el archivo, éste es borrado de la memoria RAM y cualquier archivo temporal intermedio en disco es purgado inmediatamente. Todo intento de descarga posterior devuelve 404 (No Encontrado).
  - Un recolector daemon en segundo plano purga de forma continua cualquier archivo huérfano con más de 10 minutos de antigüedad.
- **Flujo**:
  1. Subida del documento y muestra de metadatos (nombre, peso).
  2. Envío a `/translate_file` en el backend local.
  3. Notificación sticky al completar y botón de descarga directa del documento traducido con advertencia de un solo uso.
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
- **Dictado por Voz (Speech-to-Text)**:
  - Botón "Dictar" con micrófono en el panel de texto original.
  - **Comando inicial por voz de idioma con pausa**: si al iniciar el dictado se dice el nombre de un idioma (ej. *"Inglés"*, *"Español"*, *"Francés"*, etc.) y se hace una pausa, el sistema cambia automáticamente al idioma indicado y reanuda el dictado para recibir lo que se hable en ese lenguaje.
  - De no indicarse un idioma al inicio o dictar directamente una oración, actúa normalmente sobre el idioma activo.
  - Reconocimiento de voz continuo y en tiempo real usando Web Speech API.
  - Ajuste dinámico del modelo fonético de reconocimiento según el idioma origen.
  - Indicador visual animado (pulso rojo y etiqueta "Escuchando...").
  - Notificaciones sticky de estado (micrófono activo, cambio de idioma por voz o errores de permisos).
  - Activación automática de la traducción mientras se dicta.
- Notificaciones Sticky (Toast) permanentes/temporales en esquina superior derecha para eventos:
  - Copiado al portapapeles ("Texto copiado con éxito").
  - Traducción guardada en favoritos.
  - Cambio automático de idioma detectado.
- Modales de Confirmación para acciones destructivas:
  - Botón "Limpiar": Limpia de forma directa e inmediata el texto de entrada y salida, aborta peticiones y timers pendientes, y elimina por completo cualquier imagen adjunta (incluidas las de sesiones de prompt previas).
  - Botón "Borrar del historial" / "Vaciar historial": Modal de confirmación antes de eliminar registros guardados.
- Soporte para atajos de teclado (Ctrl+Enter para traducir, Esc para cerrar modales).
- Contador de caracteres y palabras.
- **Iconografía Vectorial SVG (Font Awesome)**: Todos los iconos de la aplicación (logotipo/traducción, configuración, tema claro/oscuro, pestañas, intercambio de idiomas, dictado, pegar, limpiar, escuchar, guardar favoritos, copiar, drag & drop de archivos, descarga, cerrar modales y notificaciones toast) fueron reemplazados por iconos SVG de alta definición basados en el pack Font Awesome.

## 6. Módulo Administrativo e Integración de IAs (Gemini, Claude, ChatGPT, DeepSeek)
- **Acceso Administrativo (1)**: Icono de engranaje en la cabecera (junto al botón de modo oscuro) para configurar credenciales de API.
- **Cambio Dinámico de Título (2)**: Si hay al menos una API Key de IA activa y configurada, el título principal conmuta automáticamente a **"Traductor con IA"**. Si no hay IAs activas, se mantiene como **"Traductor Local"**.
- **Selector de IA en el Formulario (3)**: Ubicado en la barra de idiomas entre el selector de origen y el botón de intercambio (`⇆`). Solo se muestra si hay al menos una IA activa y permite al usuario elegir qué motor de IA utilizar o seleccionar "🚫 Solo Local".
- **Consulta y Selección Dinámica de Modelos en Tiempo Real**:
  - Al activar cada IA o ingresar la API Key, el sistema consulta en tiempo real mediante `POST /api/ai_models` los modelos oficialmente disponibles y activos para esa cuenta en ese momento (Gemini, Claude, OpenAI/ChatGPT, DeepSeek).
  - Botón individual `🔄 Actualizar` para refrescar los modelos disponibles al instante.
  - El usuario puede elegir cualquier modelo disponible en ese momento o utilizar los modelos recomendados predeterminados.
- **Flujo Híbrido de Traducción**:
  1. Primero traduce de forma instantánea y local mediante LibreTranslate.
  2. Apoyándose en la traducción local y el texto original, consulta a la IA seleccionada para perfeccionar y dotar de máxima fluidez, naturalidad e idoneidad idiomática al resultado.
  3. Indicador de estado animado (`✨ Refinando con [IA]...`) y fallback seguro a la traducción local en caso de error o límite de cuota.
- **Seguridad y Persistencia**: Las claves se almacenan en `localStorage` del cliente y de forma opcional en `./data/ai_config.json` (ignorado por Git). Modales para confirmación de borrado de claves y botones de prueba de conexión directa.

## 7. Modo Generador de Prompts (IA) y Soporte Multimodal para Programación
- **Pestaña / Interruptor `GENERAR PROMPT (IA)` en `.tabs-nav`**:
  - Ubicado en la barra superior de modos, inmediatamente a la derecha de "TRADUCIR ARCHIVOS".
  - Visible **únicamente** cuando al menos una IA está activa y configurada con su API Key (se oculta automáticamente si no hay IA activa).
  - Al seleccionarse, optimiza toda la experiencia para desarrolladores y programadores: traduce el requerimiento y genera un prompt técnico perfeccionado en inglés estructurado (Rol, Requerimientos, Análisis visual, Restricciones y Resultado esperado).
  - Actualiza automáticamente el título visible del encabezado a "Generador de Prompts (IA)" y el `<title>` del navegador a "Generador de Prompts (IA) - Traductor con IA".
  - Ahorro drástico de tokens: sin fórmulas de cortesía ni preámbulos vacíos, con máxima densidad de información para modelos como Claude 3.7 Sonnet, OpenAI o3/GPT-4o, Cursor o Gemini.
- **Soporte Multimodal e Interpretación de Imágenes**:
  - El formulario de entrada permite adjuntar o pegar capturas de pantalla e imágenes directamente mediante tres vías:
    1. **Portapapeles directo (`Ctrl+V`)** en cualquier parte del formulario.
    2. **Arrastrar y soltar (Drag & Drop)** sobre la tarjeta de texto original (con borde iluminado en arrastre).
    3. **Botón "Imagen"** con selector de archivo de imagen.
  - Tarjeta de previsualización compacta con miniatura, nombre y botón para eliminar la imagen.
  - La IA analiza la imagen (UI, diseño, errores de consola, esquemas o código) e incorpora el análisis visual detallado al prompt generado.
- **Selección Automática del Modelo Multimodal Más Económico**:
  - **Google Gemini**: Utiliza por defecto `gemini-3.5-flash-lite` (soporte nativo de visión de ultrabajo costo).
  - **OpenAI ChatGPT**: Utiliza `gpt-4o-mini` con detalle bajo (`detail: "low"` ~85 tokens por imagen) para mínimo consumo de tokens.
  - **Anthropic Claude**: Utiliza `claude-3-5-haiku-20241022` (modelo de menor costo con capacidad de visión).
  - **DeepSeek**: Notifica amistosamente que su API es solo de texto y sugiere seleccionar Gemini o ChatGPT para procesar imágenes.
  - **Meta AI (Llama)**: Utiliza `llama-3.2-11b-vision-preview` cuando se adjuntan imágenes o `llama-3.3-70b-versatile` / `llama-3.1-8b-instant` para texto de ultra alta velocidad.

## 8. Integración de Proveedores de IA y Cuotas
- **Meta AI (Llama 3.3)**:
  - Integrado mediante la API de Groq Cloud para inferencia abierta ultrarrápida (más de 300 tokens/segundo) a costo cero.
  - Modelos disponibles: `llama-3.3-70b-versatile`, `llama-3.1-8b-instant` y `llama-3.2-11b-vision-preview`.
  - Obtención de clave gratuita sin tarjeta desde [https://console.groq.com/keys](https://console.groq.com/keys).
- **OpenRouter**:
  - Pasarela unificada multimodelo compatible con el estándar OpenAI.
  - Soporte de modelos gratuitos con sufijo `:free` (como `meta-llama/llama-3.3-70b-instruct:free`, `google/gemini-2.0-flash-exp:free`, `deepseek/deepseek-r1:free`) y modelos comerciales de vanguardia.
  - Soporte multimodal (texto e imágenes).
  - Enlace directo a `https://openrouter.ai/settings/keys`.
- **Cerebras**:
  - Inferencia de hardware acelerado CS-3 de velocidad récord mundial (más de 1.800 tokens/segundo).
  - Modelos recomendados: `llama3.3-70b` y `llama3.1-8b`.
  - Enlace directo a `https://cloud.cerebras.ai/`.
- **Cuota Gratuita Real (Google Gemini)**:
  - Disponible exclusivamente para Google Gemini mediante el Free Tier oficial provisto por el servidor o variables de entorno.
  - La tarjeta de Gemini en el modal de administración incluye el interruptor `Usar Cuota Gratuita (Free Tier)` y badge en tiempo real de peticiones diarias disponibles (`GET /api/ai_free_quota`).
  - Las tarjetas de Claude, ChatGPT y DeepSeek muestran limpiamente su campo para ingresar API Key personal con sus respectivos enlaces a las consolas oficiales, evitando opciones falsas o no aplicables.
  - Rediseño espacioso del modal de administración (ancho ampliado a 860px y paddings balanceados) para una lectura clara y sin saturación visual.
- **Respaldo y Seguridad en el Servidor**:
  - Rate limiting inteligente por IP del cliente (30 peticiones/minuto, 150 peticiones/día) con ventana deslizante para asegurar disponibilidad compartida y evitar bloqueos de API.

## 9. Créditos
- Atribución a **merke.net** en el subtítulo del encabezado y en el pie de página.
- Enlace directo al repositorio original: https://github.com/LibreTranslate/LibreTranslate y https://libretranslate.com/.
