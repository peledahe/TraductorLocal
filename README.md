# Traductor Local (LibreTranslate EN ⇄ ES)

Versión local, privada y optimizada de [LibreTranslate](https://github.com/LibreTranslate/LibreTranslate) con interfaz inspirada en [libretranslate.com](https://libretranslate.com/).

## Características Principales

- **Modo Oscuro y Modo Claro**:
  - Selector en la cabecera (☀️ / 🌙) con detección de preferencia del sistema y guardado local.
- **Diseño Responsivo Esencial**:
  - En móviles y pantallas pequeñas muestra solo lo esencial para operar: cabecera compacta, cajas optimizadas a altura de vista directa y selectores fluidos sin textos ruidosos.
- **Acceso por Dominio Local y HTTPS / HTTP**:
  - Escucha directamente en los puertos estándar `80` (HTTP) y `443` (HTTPS).
  - Accesible de forma segura desde `https://translate.local` o `http://translate.local`.
  - Incluye Autoridad Certificadora (CA) propia para confiar en el certificado SSL en el sistema y navegador con `./instalar-certificado.sh`.
- **Arranque Automático al Encender la Máquina**:
  - Configurado con `restart: always` en Docker, arrancando automáticamente con el sistema.
- **Traducción de Archivos y Documentos**:
  - Pestaña dedicada **TRADUCIR ARCHIVOS** con soporte para arrastrar y soltar (Drag & Drop).
  - Compatible con formatos: `.txt`, `.odt`, `.odp`, `.docx`, `.pptx`, `.epub`, `.html`, `.srt`, `.pdf` y `.md` (Markdown).
  - Descarga directa del archivo traducido localmente en un solo clic.
- **Detección Automática Inteligente (EN ⇄ ES)**:
  - Si el texto introducido está en **Inglés**, se traduce automáticamente a **Español**.
  - Si el texto introducido está en **Español**, se traduce automáticamente a **Inglés**.
  - El modo automático está exclusivamente enfocado en **Inglés y Español**.
- **Soporte de Otros Idiomas (Selección Manual)**:
  - Disponibles para seleccionar manualmente en los menús desplegables: **Alemán, Árabe, Catalán, Chino, Coreano, Francés, Hindi, Holandés, Italiano, Japonés, Portugués y Ruso**.
  - Al seleccionar un idioma manual en el destino, se traduce directamente a ese idioma respetando la elección sin activar el cambio automático.
- **Modelos Locales Pre-cargados**:
  - Configurado para cargar exclusivamente los modelos de **Inglés y Español** (`en,es`), optimizando el uso de memoria RAM y logrando tiempos de respuesta casi instantáneos.
- **UI/UX Moderna y Práctica**:
  - Interfaz de doble panel idéntica a LibreTranslate.
  - Traducción en tiempo real con *debounce*.
  - Notificaciones **Sticky (Toast)** al copiar al portapapeles, guardar o cambiar idioma.
  - **Modales de confirmación** elegantes para acciones destructivas (limpiar texto largo, borrar historial) en lugar de alertas nativas del navegador.
  - Historial local persistente en el navegador con capacidad de guardar traducciones favoritas.
  - Pronunciación de voz integrada (*Speech Synthesis*).
  - Parámetros de URL compatibles: `?source=auto&target=smart_auto&q=...`.
- **100% Autónomo y Privado**:
  - Sin dependencias de servicios externos ni envío de telemetría a terceros.

---

## Cómo Iniciar

### 1. Iniciar el servicio (Recomendado con Docker)
```bash
./start.sh
```
El script iniciará el contenedor de LibreTranslate y el servidor web local. Luego abre en tu navegador:
👉 **[http://localhost:8080](http://localhost:8080)**

Ejemplo directo con texto precargado:
👉 **[http://localhost:8080/?source=auto&target=smart_auto&q=Which+categories+do+they+fit%3F+%28pick+any+that+fit%2C+or+none%29](http://localhost:8080/?source=auto&target=smart_auto&q=Which+categories+do+they+fit%3F+%28pick+any+that+fit%2C+or+none%29)**

### 2. Detener el servicio
```bash
./stop.sh
```

---

## Estructura del Proyecto

```
├── web/
│   ├── index.html     # Interfaz de usuario completa
│   ├── styles.css     # Estilos modernos, responsivos y componentes (toast, modal)
│   └── app.js         # Lógica de detección inteligente EN <-> ES y conexión a API
├── data/
│   └── libretranslate/ # Modelos Argos Translate persistidos localmente
├── server.py          # Servidor web estático y proxy inverso (Python estándar)
├── docker-compose.yml # Orquestación de backend LibreTranslate + Frontend Web
├── start.sh           # Script de inicio rápido
├── stop.sh            # Script de apagado
└── README.md          # Documentación del proyecto
```

---

## Créditos y Reconocimientos

- **Desarrollo e implementación**: [merke.net](https://merke.net)
- **Motor de traducción libre**:
  - **[LibreTranslate](https://github.com/LibreTranslate/LibreTranslate)** (Licencia AGPLv3), creado por Piergiuseppe Mallozzi y la comunidad open source.
  - Modelos neuronales provistos por **[Argos Translate](https://github.com/argosopentech/argos-translate)**.
