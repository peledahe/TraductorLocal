# Traductor Local (LibreTranslate + Asistente de IA)

Versión local, privada y de alto rendimiento de [LibreTranslate](https://github.com/LibreTranslate/LibreTranslate), enriquecida con capacidades de Inteligencia Artificial de última generación, generación de prompts técnicos multimodales para programadores y una interfaz moderna e intuitiva inspirada en [libretranslate.com](https://libretranslate.com/).

---

## Características Principales

### 1. Integración de Inteligencia Artificial (7 Proveedores Oficiales)
- **Panel Administrativo Centralizado**: Accesible desde el icono de configuración (⚙️) con diseño moderno *Master-Detail* (barra lateral + panel de configuración).
- **Proveedores Soportados**:
  1. **Google Gemini**: Modelos Flash de última generación y soporte para **Cuota Gratuita (Free Tier)** del sistema.
  2. **Anthropic Claude**: Claude 3.5 Haiku, Sonnet y Opus.
  3. **OpenAI ChatGPT**: GPT-4o mini, GPT-4o y serie o3.
  4. **DeepSeek**: DeepSeek-V3 y DeepSeek-R1.
  5. **Meta AI (Llama 3.3 vía Groq Cloud)**: Inferencia abierta ultrarrápida a costo cero.
  6. **OpenRouter**: Pasarela unificada multimodelo con acceso a modelos comerciales y gratuitos (`:free`).
  7. **Cerebras**: Inferencia de velocidad récord mundial para Llama en hardware CS-3.
- **Doble Diagnóstico Independiente**:
  - **Probar Conexión API**: Valida las credenciales contra la API oficial y descarga en vivo los modelos vigentes disponibles para la cuenta.
  - **Probar Modelo**: Realiza un benchmark técnico en tiempo real contra el modelo seleccionado, midiendo la latencia de respuesta en milisegundos (ms).
- **Flujo Híbrido de Traducción**: Realiza primero la traducción local instantánea con LibreTranslate y, opcionalmente, la IA seleccionada perfecciona el estilo, coherencia e idoneidad idiomática.

### 2. Modo Generador de Prompts (IA) y Soporte Multimodal
- **Pestaña Dedicada**: Modo especializado para desarrolladores (`GENERAR PROMPT (IA)`), visible cuando al menos una IA está configurada.
- **Estructura Optimizada para Código**: Transforma ideas y requerimientos en inglés técnico estructurado (Rol, Contexto, Análisis visual, Restricciones y Entregables) listo para Cursor, Claude 3.7 Sonnet, OpenAI o3/GPT-4o o Gemini.
- **Entrada Multimodal (Imágenes y Capturas)**:
  - Pegado directo con `Ctrl+V` desde el portapapeles.
  - Arrastrar y soltar (Drag & Drop) sobre el área de trabajo.
  - Selector tradicional de archivos de imagen.
  - Selección automática del modelo de visión más eficiente en tokens.

### 3. Traducción de Archivos con Refinamiento y Privacidad Absoluta (Zero-Storage)
- **Formatos Compatibles**: `.txt`, `.odt`, `.odp`, `.docx`, `.pptx`, `.epub`, `.html`, `.srt`, `.vtt`, `.pdf` y `.md` (Markdown).
- **Refinamiento Especializado según Formato**:
  - Subtítulos (`.srt`, `.vtt`): Mantiene intactos números de índice y marcas de tiempo, puliendo exclusivamente los diálogos.
  - Markdown (`.md`): Preserva bloques de código, tablas y enlaces.
  - Documentos Word (`.docx`) y páginas `.html`: Respeta la estructura interna y estilos intactos.
- **Autodestrucción al Descargar (Zero Server-Side Storage)**:
  - El documento traducido reside únicamente en memoria RAM mediante un token de un solo uso.
  - En el instante en que el usuario descarga el archivo, éste es destruido inmediatamente de la memoria y del disco (peticiones posteriores retornan 404).
  - Recolector en segundo plano para purgar archivos temporales huérfanos.

### 4. Detección Inteligente y Soporte Multilingüe
- **Modo Automático EN ⇄ ES**:
  - Si el texto está en **Inglés**, traduce automáticamente a **Español**.
  - Si el texto está en **Español**, traduce automáticamente a **Inglés**.
- **14+ Idiomas Disponibles para Selección Manual**: Alemán, Árabe, Catalán, Chino, Coreano, Francés, Hindi, Holandés, Italiano, Japonés, Portugués, Ruso, etc.

### 5. Dictado por Voz con Comando Inicial de Idioma
- Dictado continuo en tiempo real mediante Web Speech API.
- **Comando de Voz Inteligente**: Si al iniciar el dictado se pronuncia el nombre de un idioma y se hace una breve pausa (ej. *"Inglés"*, *"Español"*), el sistema conmuta el destino automáticamente y reanuda la transcripción.

### 6. Experiencia de Usuario (UI/UX)
- **Sincronización Dinámica de Título**: El encabezado visible y la etiqueta `<title>` del navegador cambian según la pestaña activa y el estado de las IAs (*Traductor Local*, *Traductor con IA*, *Traducción de Archivos* o *Generador de Prompts (IA)*).
- **Modo Oscuro / Claro**: Detección automática del sistema con persistencia local y prevención de parpadeo blanco (*anti-flicker*).
- **Notificaciones Sticky y Modales de Confirmación**: Feedback visual mediante toasts persistentes y modales seguros en lugar de diálogos nativos `alert()`/`confirm()`.
- **Diseño Responsivo**: Adaptación completa a escritorio, tablet y móviles.
- **Scrollbars Minimalistas**: Barras de desplazamiento sutiles y redondeadas de 6px adaptables al tema.

### 7. Infraestructura, Resiliencia y Seguridad
- **Servidor Multihilo**: Backend Python con `ThreadingHTTPServer` que previene bloqueos por concurrencia y timeouts (`ERR_TIMED_OUT`).
- **HTTPS Nativo**: Soporte para puerto 443 con Autoridad Certificadora (CA) propia para `https://translate.local`.
- **Protección de Credenciales**: Plantillas `.env.example` y `data/ai_config.example.json` para evitar la fuga accidental de claves en Git.

---

## Cómo Iniciar

### Requisitos Previos
- Docker y Docker Compose instalados.

### 1. Iniciar con Docker Compose
```bash
./start.sh
```
O directamente con Docker Compose:
```bash
docker compose up -d
```

### 2. Acceso a la Aplicación
Abre en tu navegador cualquiera de las siguientes URLs:
- **HTTP**: [http://localhost:8080](http://localhost:8080) o [http://translate.local](http://translate.local)
- **HTTPS**: [https://translate.local](https://translate.local) (ejecuta `./instalar-certificado.sh` para confiar en el certificado local)

### 3. Detener el Servicio
```bash
./stop.sh
```
O bien:
```bash
docker compose down
```

---

## Configuración de Claves de IA

Puedes configurar tus claves de dos formas:

1. **Desde la Interfaz Gráfica (Recomendado)**:
   - Haz clic en el icono de engranaje (⚙️) en la barra superior.
   - Selecciona el proveedor que desees, pega tu API Key y haz clic en **Probar Conexión API**.
   - Haz clic en **Guardar Configuración**. Las claves se almacenan en tu navegador (`localStorage`) y en el archivo local protegido `data/ai_config.json`.

2. **Mediante Variables de Entorno (`.env`)**:
   - Copia la plantilla [.env.example](file:///.env.example) como `.env`:
     ```bash
     cp .env.example .env
     ```
   - Rellena las claves de los proveedores que desees utilizar (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, etc.).

---

## Estructura del Proyecto

```
├── .agents/
│   └── .context/          # Documentación de arquitectura, estado y funcionalidades
├── data/
│   ├── ai_config.example.json # Plantilla de configuración de IAs
│   ├── certs/             # Certificados SSL para translate.local
│   └── libretranslate/    # Modelos neuronales locales de Argos Translate
├── web/
│   ├── index.html         # Interfaz web principal
│   ├── styles.css         # Estilos, temas (dark/light) y componentes UI
│   └── app.js             # Lógica del cliente, IAs, dictado y traducciones
├── .env.example           # Plantilla segura de variables de entorno
├── .gitignore             # Reglas estrictas de exclusión de credenciales y modelos
├── docker-compose.yml     # Orquestación de backend LibreTranslate + Frontend Proxy
├── instalar-certificado.sh # Script para confiar en el certificado SSL local
├── server.py              # Servidor HTTP/HTTPS multihilo, proxy y orquestador de IAs
├── start.sh               # Script de inicio rápido
├── stop.sh                # Script de apagado
└── README.md              # Documentación del proyecto
```

---

## Créditos y Reconocimientos

- **Desarrollo e implementación**: [merke.net](https://merke.net)
- **Motor de traducción libre**:
  - **[LibreTranslate](https://github.com/LibreTranslate/LibreTranslate)** (Licencia AGPLv3), creado por Piergiuseppe Mallozzi y la comunidad open source.
  - Modelos neuronales provistos por **[Argos Translate](https://github.com/argosopentech/argos-translate)**.
