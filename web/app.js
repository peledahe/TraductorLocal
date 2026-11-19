/**
 * Traductor Local - Lógica de Aplicación
 * Con detección inteligente EN <-> ES y sticky notifications / modales
 */

(() => {
  'use strict';

  // Endpoints de la API local (vía proxy o directo)
  const API_BASE = '';
  const ENDPOINTS = {
    translate: `${API_BASE}/translate`,
    translateFile: `${API_BASE}/translate_file`,
    detect: `${API_BASE}/detect`,
    languages: `${API_BASE}/languages`,
  };

  // Pestañas (Modo Texto vs Modo Archivos)
  const tabTextBtn = document.getElementById('tab-text-btn');
  const tabFileBtn = document.getElementById('tab-file-btn');
  const textTranslationSection = document.getElementById('text-translation-section');
  const fileTranslationSection = document.getElementById('file-translation-section');
  const historySection = document.querySelector('.history-section');

  // Elementos de Traducción de Archivos
  const fileDropzone = document.getElementById('file-dropzone');
  const fileInput = document.getElementById('file-input');
  const browseFileBtn = document.getElementById('browse-file-btn');
  const filePreviewCard = document.getElementById('file-preview-card');
  const previewFilename = document.getElementById('preview-filename');
  const previewFilesize = document.getElementById('preview-filesize');
  const removeFileBtn = document.getElementById('remove-file-btn');
  const translateFileBtn = document.getElementById('translate-file-btn');
  const fileProgressContainer = document.getElementById('file-progress-container');
  const fileResultContainer = document.getElementById('file-result-container');
  const downloadFileBtn = document.getElementById('download-file-btn');

  // Elementos del DOM (Texto)
  const sourceText = document.getElementById('source-text');
  const targetText = document.getElementById('target-text');
  const sourceLangSelect = document.getElementById('source-lang-select');
  const targetLangSelect = document.getElementById('target-lang-select');
  const detectedBadge = document.getElementById('detected-badge');
  const detectedLangName = document.getElementById('detected-lang-name');
  const swapBtn = document.getElementById('swap-lang-btn');
  const clearBtn = document.getElementById('clear-source-btn');
  const micBtn = document.getElementById('mic-btn');
  const micBtnLabel = document.getElementById('mic-btn-label');
  const pasteBtn = document.getElementById('paste-btn');
  const copyBtn = document.getElementById('copy-target-btn');
  const saveBtn = document.getElementById('save-favorite-btn');
  const speakBtn = document.getElementById('speak-btn');
  const translatingIndicator = document.getElementById('translating-indicator');
  const sourceStats = document.getElementById('source-stats');
  const targetStats = document.getElementById('target-stats');
  const backendStatusPill = document.getElementById('backend-status-pill');
  const backendStatusText = document.getElementById('backend-status-text');

  // Historial
  const historyList = document.getElementById('history-list');
  const historyEmpty = document.getElementById('history-empty');
  const historyCountBadge = document.getElementById('history-count-badge');
  const clearAllHistoryBtn = document.getElementById('clear-all-history-btn');

  // Modal de confirmación
  const confirmModal = document.getElementById('confirm-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalMessage = document.getElementById('modal-message');
  const modalConfirmBtn = document.getElementById('modal-confirm-btn');
  const modalCancelBtn = document.getElementById('modal-cancel-btn');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  // Toast container
  const toastContainer = document.getElementById('toast-container');

  // Toggle de Tema (Claro / Oscuro)
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const themeIconSun = document.getElementById('theme-icon-sun');
  const themeIconMoon = document.getElementById('theme-icon-moon');
  const THEME_STORAGE_KEY = 'traductor_local_theme';

  // Estado interno
  let debounceTimer = null;
  let activeAbortController = null;
  let currentDetectedLang = 'en';
  let modalConfirmCallback = null;
  const STORAGE_KEY = 'traductor_local_history';

  // Nombres legibles en español para idiomas
  const LANG_NAMES = {
    en: 'Inglés',
    es: 'Español',
    auto: 'Auto-detectar idioma',
    smart_auto: '✨ Automático (EN ⇄ ES)',
    fr: 'Francés',
    de: 'Alemán',
    it: 'Italiano',
    pt: 'Portugués',
    ru: 'Ruso',
    zh: 'Chino',
    'zh-Hans': 'Chino (Simplificado)',
    ja: 'Japonés',
    ko: 'Coreano',
    ar: 'Árabe',
    hi: 'Hindi',
    nl: 'Holandés',
    pl: 'Polaco',
    tr: 'Turco',
    ca: 'Catalán',
    el: 'Griego',
    cs: 'Checo',
    da: 'Danés',
    fi: 'Finés',
    hu: 'Húngaro',
    id: 'Indonesio',
    sv: 'Sueco',
    uk: 'Ucraniano',
    vi: 'Vietnamita',
    bg: 'Búlgaro',
    bn: 'Bengalí',
    et: 'Estonio',
    eu: 'Euskera',
    fa: 'Persa',
    he: 'Hebreo',
    ms: 'Malayo',
    ro: 'Rumano',
    sk: 'Eslovaco',
    sl: 'Esloveno',
    sq: 'Albanés',
    th: 'Tailandés',
    ur: 'Urdu',
  };

  // ========================================================
  // Notificaciones de Sistema Sticky (Toast)
  // ========================================================
  function showStickyToast(message, type = 'info', duration = 3500) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" style="color:#10b981"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>';
    } else if (type === 'danger') {
      iconSvg = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" style="color:#ef4444"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';
    } else {
      iconSvg = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" style="color:#2563eb"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>';
    }

    toast.innerHTML = `
      <div class="toast-icon">${iconSvg}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
      <button class="toast-close" title="Cerrar">&times;</button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
      toast.remove();
    });

    toastContainer.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => {
        if (toast.parentElement) {
          toast.style.opacity = '0';
          toast.style.transform = 'translateX(100%)';
          toast.style.transition = 'all 0.25s ease';
          setTimeout(() => toast.remove(), 250);
        }
      }, duration);
    }
  }

  // ========================================================
  // Gestión de Modo Claro y Modo Oscuro
  // ========================================================
  function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }

  function applyTheme(theme, notify = false) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);

    if (themeIconSun && themeIconMoon) {
      if (theme === 'dark') {
        themeIconSun.classList.remove('hidden');
        themeIconMoon.classList.add('hidden');
      } else {
        themeIconSun.classList.add('hidden');
        themeIconMoon.classList.remove('hidden');
      }
    }

    if (notify) {
      const msg = theme === 'dark' ? '🌙 Modo oscuro activado' : '☀️ Modo claro activado';
      showStickyToast(msg, 'info', 2000);
    }
  }

  function toggleTheme() {
    const nextTheme = getCurrentTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme, true);
  }

  // ========================================================
  // Modal de Confirmación (Reemplaza confirm/alert)
  // ========================================================
  function showConfirmModal(title, message, onConfirm) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalConfirmCallback = onConfirm;
    confirmModal.classList.add('open');
    confirmModal.setAttribute('aria-hidden', 'false');
    modalConfirmBtn.focus();
  }

  function closeModal() {
    confirmModal.classList.remove('open');
    confirmModal.setAttribute('aria-hidden', 'true');
    modalConfirmCallback = null;
  }

  modalConfirmBtn.addEventListener('click', () => {
    if (typeof modalConfirmCallback === 'function') {
      modalConfirmCallback();
    }
    closeModal();
  });

  modalCancelBtn.addEventListener('click', closeModal);
  modalCloseBtn.addEventListener('click', closeModal);
  confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && confirmModal.classList.contains('open')) {
      closeModal();
    }
  });

  // ========================================================
  // Heurística de detección rápida local de lenguaje
  // ========================================================
  function quickDetectLanguage(text) {
    if (!text || text.trim().length === 0) return null;
    const lower = text.toLowerCase();

    // Caracteres distintivos del español
    if (/[áéíóúñ¿¡]/.test(lower)) return 'es';

    // Palabras extremadamente comunes en español
    const spanishWords = /\b(el|la|los|las|un|una|unos|unas|de|del|en|para|por|con|como|este|esta|estos|estas|que|cual|quien|donde|cuando|pero|porque|es|son|somos|fue|era|hay|hacer|tener|categoria|categorias)\b/i;
    // Palabras comunes en inglés
    const englishWords = /\b(the|is|are|was|were|and|or|of|in|to|for|with|from|which|what|who|where|when|why|how|they|them|their|any|none|pick|fit|categories|that|this|these|those)\b/i;

    const spanishMatches = (lower.match(spanishWords) || []).length;
    const englishMatches = (lower.match(englishWords) || []).length;

    if (spanishMatches > englishMatches) return 'es';
    if (englishMatches > spanishMatches) return 'en';
    return null; // Indeterminado
  }

  // ========================================================
  // Detección con la API de LibreTranslate (/detect)
  // ========================================================
  async function apiDetectLanguage(text) {
    try {
      const response = await fetch(ENDPOINTS.detect, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text }),
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        return data[0].language;
      }
    } catch {
      // Ignorar errores de red en detección
    }
    return null;
  }

  // ========================================================
  // Resolución del idioma destino inteligente (Smart Target)
  // ========================================================
  function resolveTargetLanguage(detectedSource, selectedTarget) {
    if (selectedTarget === 'smart_auto') {
      // Regla pedida por el usuario:
      // "si es ingles que el resultado sea automaticamente español,
      //  y si es español el lenguaje fuente, que la respuesta sea en ingles"
      if (detectedSource === 'en') return 'es';
      if (detectedSource === 'es') return 'en';
      // Por defecto para cualquier otro: traducir a español
      return 'es';
    }
    return selectedTarget;
  }

  // ========================================================
  // Traducción principal
  // ========================================================
  async function performTranslation() {
    const text = sourceText.value.trim();

    if (!text) {
      targetText.value = '';
      translatingIndicator.classList.add('hidden');
      updateStats();
      return;
    }

    if (activeAbortController) {
      activeAbortController.abort();
    }
    activeAbortController = new AbortController();

    translatingIndicator.classList.remove('hidden');

    try {
      let sourceLang = sourceLangSelect.value;
      let effectiveSource = sourceLang;

      // 1. Detección automática si source es 'auto'
      if (sourceLang === 'auto') {
        const localDetected = quickDetectLanguage(text);
        if (localDetected) {
          effectiveSource = localDetected;
        } else {
          const apiDetected = await apiDetectLanguage(text);
          if (apiDetected) effectiveSource = apiDetected;
        }
      }

      currentDetectedLang = effectiveSource;

      // Actualizar badge de detección visual
      if (sourceLangSelect.value === 'auto') {
        const name = LANG_NAMES[effectiveSource] || effectiveSource.toUpperCase();
        detectedLangName.textContent = name;
        detectedBadge.classList.remove('hidden');
      } else {
        detectedBadge.classList.add('hidden');
      }

      // 2. Determinar el idioma destino
      const targetLang = resolveTargetLanguage(effectiveSource, targetLangSelect.value);

      // Si origen y destino coinciden, no llamar al backend (ej. texto idéntico)
      if (effectiveSource === targetLang) {
        targetText.value = text;
        translatingIndicator.classList.add('hidden');
        updateStats();
        return;
      }

      // 3. Ejecutar traducción contra LibreTranslate
      const payload = {
        q: text,
        source: sourceLang === 'auto' ? 'auto' : effectiveSource,
        target: targetLang,
        format: 'text',
      };

      const response = await fetch(ENDPOINTS.translate, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: activeAbortController.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${response.status} del servidor`);
      }

      const result = await response.json();
      targetText.value = result.translatedText || '';
      updateStats();

      // Si LibreTranslate detectó un idioma en su respuesta
      if (result.detectedLanguage && sourceLangSelect.value === 'auto') {
        const detectedCode = result.detectedLanguage.language;
        if (detectedCode) {
          detectedLangName.textContent = LANG_NAMES[detectedCode] || detectedCode.toUpperCase();
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Error en traducción:', err);
      showStickyToast(`Error al traducir: ${err.message}`, 'danger');
    } finally {
      translatingIndicator.classList.add('hidden');
    }
  }

  function triggerTranslationDebounced() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(performTranslation, 300);
  }

  // ========================================================
  // Intercambiar idiomas (Swap)
  // ========================================================
  function handleSwap() {
    stopDictation(false);
    const srcVal = sourceLangSelect.value;
    const tgtVal = targetLangSelect.value;
    const srcTxt = sourceText.value;
    const tgtTxt = targetText.value;

    // Si origen era auto, usamos el detectado
    const actualSrc = srcVal === 'auto' ? currentDetectedLang : srcVal;
    const actualTgt = tgtVal === 'smart_auto' ? (actualSrc === 'en' ? 'es' : 'en') : tgtVal;

    // Intercambiar textos
    sourceText.value = tgtTxt;
    targetText.value = srcTxt;

    // Intercambiar selectores
    sourceLangSelect.value = actualTgt;
    targetLangSelect.value = actualSrc;

    detectedBadge.classList.add('hidden');
    updateStats();

    showStickyToast('Idiomas y textos intercambiados', 'info', 2000);

    if (sourceText.value.trim()) {
      performTranslation();
    }
  }

  // ========================================================
  // Limpieza con Modal de Confirmación
  // ========================================================
  function handleClear() {
    stopDictation(false);
    sourceText.value = '';
    targetText.value = '';
    detectedBadge.classList.add('hidden');
    updateStats();
    sourceText.focus();
  }

  // ========================================================
  // Copiar con Sticky Toast
  // ========================================================
  async function handleCopy() {
    const text = targetText.value;
    if (!text) {
      showStickyToast('No hay texto traducido para copiar', 'danger', 2500);
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      showStickyToast('Traducción copiada al portapapeles con éxito', 'success', 3000);
    } catch {
      targetText.select();
      document.execCommand('copy');
      showStickyToast('Traducción copiada al portapapeles', 'success', 3000);
    }
  }

  // ========================================================
  // Pegar portapapeles
  // ========================================================
  async function handlePaste() {
    sourceText.focus();

    // 1. Intentar con la API moderna de Portapapeles (activa en HTTPS o localhost)
    if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          sourceText.value = text;
          updateStats();
          performTranslation();
          showStickyToast('Texto pegado desde el portapapeles', 'info', 2000);
          return;
        }
      } catch (err) {
        console.warn('Acceso directo a clipboard no permitido en este origen:', err);
      }
    }

    // 2. Fallback con document.execCommand('paste')
    try {
      if (document.execCommand('paste')) {
        updateStats();
        performTranslation();
        showStickyToast('Texto pegado', 'info', 2000);
        return;
      }
    } catch (e) {}

    // 3. Si el navegador bloquea la lectura por estar en HTTP no seguro:
    const isSecure = window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost';
    if (!isSecure) {
      showStickyToast(
        'El navegador bloquea leer portapapeles en HTTP. Usa https://translate.local o presiona Ctrl+V para pegar.',
        'info',
        5000
      );
    } else {
      showStickyToast('Por favor presiona Ctrl+V para pegar tu texto.', 'info', 3000);
    }
  }

  // ========================================================
  // Pronunciación de voz (SpeechSynthesis)
  // ========================================================
  function handleSpeak() {
    const text = targetText.value.trim();
    if (!text) return;

    if (!('speechSynthesis' in window)) {
      showStickyToast('Tu navegador no soporta síntesis de voz', 'danger', 3000);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const targetLang = resolveTargetLanguage(currentDetectedLang, targetLangSelect.value);
    utterance.lang = targetLang === 'en' ? 'en-US' : 'es-ES';
    window.speechSynthesis.speak(utterance);
    showStickyToast(`Reproduciendo audio en ${LANG_NAMES[targetLang] || targetLang}...`, 'info', 2000);
  }

  // ========================================================
  // Dictado por voz (SpeechRecognition)
  // ========================================================
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognitionInstance = null;
  let isDictating = false;
  let dictationBaseText = '';
  let isAwaitingLanguagePrefix = true;
  let isRestartingForLanguage = false;

  const VOICE_LANG_TRIGGERS = {
    // Español
    'español': 'es',
    'espanol': 'es',
    'spanish': 'es',
    'castellano': 'es',
    'en español': 'es',
    'en espanol': 'es',
    'al español': 'es',
    'a español': 'es',
    'idioma español': 'es',
    'idioma espanol': 'es',

    // Inglés
    'inglés': 'en',
    'ingles': 'en',
    'english': 'en',
    'en inglés': 'en',
    'en ingles': 'en',
    'al inglés': 'en',
    'al ingles': 'en',
    'a inglés': 'en',
    'a ingles': 'en',
    'idioma inglés': 'en',
    'idioma ingles': 'en',

    // Francés
    'francés': 'fr',
    'frances': 'fr',
    'french': 'fr',
    'en francés': 'fr',
    'en frances': 'fr',
    'al francés': 'fr',
    'a francés': 'fr',

    // Alemán
    'alemán': 'de',
    'aleman': 'de',
    'german': 'de',
    'en alemán': 'de',
    'en aleman': 'de',
    'al alemán': 'de',
    'a alemán': 'de',

    // Italiano
    'italiano': 'it',
    'italian': 'it',
    'en italiano': 'it',
    'al italiano': 'it',
    'a italiano': 'it',

    // Portugués
    'portugués': 'pt',
    'portugues': 'pt',
    'portuguese': 'pt',
    'en portugués': 'pt',
    'en portugues': 'pt',
    'al portugués': 'pt',
    'a portugués': 'pt',

    // Ruso
    'ruso': 'ru',
    'russian': 'ru',
    'en ruso': 'ru',
    'al ruso': 'ru',
    'a ruso': 'ru',

    // Chino
    'chino': 'zh',
    'chinese': 'zh',
    'en chino': 'zh',
    'al chino': 'zh',
    'a chino': 'zh',

    // Japonés
    'japonés': 'ja',
    'japones': 'ja',
    'japanese': 'ja',
    'en japonés': 'ja',
    'al japonés': 'ja',
    'a japonés': 'ja',

    // Coreano
    'coreano': 'ko',
    'korean': 'ko',
    'en coreano': 'ko',
    'al coreano': 'ko',
    'a coreano': 'ko',

    // Catalán
    'catalán': 'ca',
    'catalan': 'ca',
    'en catalán': 'ca',
    'al catalán': 'ca',
    'a catalán': 'ca',

    // Holandés
    'holandés': 'nl',
    'holandes': 'nl',
    'dutch': 'nl',
    'en holandés': 'nl',
    'al holandés': 'nl',
    'a holandés': 'nl',

    // Árabe
    'árabe': 'ar',
    'arabe': 'ar',
    'arabic': 'ar',
    'en árabe': 'ar',
    'al árabe': 'ar',
    'a árabe': 'ar',

    // Hindi
    'hindi': 'hi',
    'en hindi': 'hi',
    'al hindi': 'hi',
    'a hindi': 'hi'
  };

  function checkLanguageVoiceTrigger(phrase) {
    if (!phrase) return null;
    const clean = phrase.trim().toLowerCase().replace(/[.,!?:;¿¡]/g, '').trim();
    return VOICE_LANG_TRIGGERS[clean] || null;
  }

  function getSpeechRecognitionLang() {
    let lang = sourceLangSelect.value;
    if (lang === 'auto') {
      lang = currentDetectedLang || (navigator.language ? navigator.language.slice(0, 2) : 'es');
    }
    const map = {
      es: 'es-ES',
      en: 'en-US',
      fr: 'fr-FR',
      de: 'de-DE',
      it: 'it-IT',
      pt: 'pt-PT',
      ru: 'ru-RU',
      zh: 'zh-CN',
      ja: 'ja-JP',
      ko: 'ko-KR',
      ca: 'ca-ES',
      nl: 'nl-NL',
      ar: 'ar-SA',
      hi: 'hi-IN'
    };
    return map[lang] || navigator.language || 'es-ES';
  }

  function stopDictation(notify = false) {
    isRestartingForLanguage = false;
    isAwaitingLanguagePrefix = false;
    if (recognitionInstance) {
      try {
        recognitionInstance.stop();
      } catch (e) {}
      recognitionInstance = null;
    }
    if (isDictating) {
      isDictating = false;
      if (micBtn) micBtn.classList.remove('listening');
      if (micBtnLabel) micBtnLabel.textContent = 'Dictar';
      if (notify) {
        showStickyToast('Dictado por voz finalizado', 'info', 2000);
      }
    }
  }

  function startRecognition(checkPrefix = true) {
    if (!SpeechRecognition) {
      showStickyToast(
        'El dictado por voz requiere un navegador compatible (Chrome, Edge, Brave o Chromium en HTTPS).',
        'danger',
        5000
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionInstance = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = getSpeechRecognitionLang();

      isAwaitingLanguagePrefix = checkPrefix;
      isRestartingForLanguage = false;

      recognition.onstart = () => {
        isDictating = true;
        if (micBtn) micBtn.classList.add('listening');
        if (micBtnLabel) micBtnLabel.textContent = 'Escuchando...';

        const langCode = sourceLangSelect.value;
        const langDisplay = langCode === 'auto' ? 'Auto (' + (LANG_NAMES[currentDetectedLang] || currentDetectedLang) + ')' : (LANG_NAMES[langCode] || langCode);

        if (checkPrefix) {
          showStickyToast(`🎤 Micrófono activo (${langDisplay}). Si dices un idioma al inicio y pausas, cambiará a ese lenguaje.`, 'info', 4000);
        } else {
          showStickyToast(`🎤 Micrófono listo en ${langDisplay}. Dicta ahora...`, 'info', 3000);
        }
      };

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item && item[0]) {
            if (item.isFinal) {
              finalTranscript += item[0].transcript;
            } else {
              interimTranscript += item[0].transcript;
            }
          }
        }

        // Detección de idioma por voz al inicio seguido de pausa
        if (isAwaitingLanguagePrefix && !dictationBaseText.trim()) {
          const rawSpoken = (finalTranscript || interimTranscript).trim();
          const matchedLang = checkLanguageVoiceTrigger(rawSpoken);

          if (matchedLang) {
            // Si el motor ya marcó la palabra como final (hubo pausa tras pronunciar el idioma):
            if (finalTranscript) {
              isAwaitingLanguagePrefix = false;
              // Cambiar idioma origen en la UI y estado
              sourceLangSelect.value = matchedLang;
              currentDetectedLang = matchedLang;
              detectedBadge.classList.remove('hidden');
              detectedLangName.textContent = LANG_NAMES[matchedLang] || matchedLang.toUpperCase();

              showStickyToast(
                `🎙️ Idioma cambiado a ${LANG_NAMES[matchedLang] || matchedLang}. Habla después de la pausa...`,
                'success',
                3500
              );

              // Reiniciar el reconocimiento con el modelo de voz del nuevo idioma
              isRestartingForLanguage = true;
              recognition.stop();
              return;
            } else {
              // Interim mientras habla el nombre del idioma
              if (micBtnLabel) micBtnLabel.textContent = `Idioma: ${LANG_NAMES[matchedLang]}...`;
              return;
            }
          } else {
            // Si dijo una oración completa o palabras normales, no es un comando de idioma
            const wordCount = rawSpoken.split(/\s+/).filter(Boolean).length;
            if (wordCount > 1 || (finalTranscript && !matchedLang)) {
              isAwaitingLanguagePrefix = false;
              if (micBtnLabel) micBtnLabel.textContent = 'Escuchando...';
            }
          }
        }

        if (finalTranscript) {
          dictationBaseText += finalTranscript + ' ';
        }

        sourceText.value = (dictationBaseText + interimTranscript).trimStart();
        updateStats();
        triggerTranslationDebounced();
      };

      recognition.onerror = (event) => {
        console.warn('SpeechRecognition error:', event.error);
        if (event.error === 'not-allowed') {
          showStickyToast(
            'Permiso de micrófono denegado. Permite el acceso al micrófono en el candado de la URL.',
            'danger',
            5000
          );
          stopDictation(false);
        } else if (event.error !== 'no-speech') {
          showStickyToast(`Aviso de micrófono: ${event.error}`, 'warning', 3000);
          stopDictation(false);
        }
      };

      recognition.onend = () => {
        if (isRestartingForLanguage) {
          // Reanudar inmediatamente con el nuevo idioma
          setTimeout(() => {
            startRecognition(false);
          }, 150);
          return;
        }
        stopDictation(false);
      };

      recognition.start();
    } catch (err) {
      console.error('Error al iniciar SpeechRecognition:', err);
      showStickyToast('No se pudo activar el micrófono: ' + err.message, 'danger', 4000);
      stopDictation(false);
    }
  }

  function handleDictate() {
    if (isDictating) {
      stopDictation(true);
      return;
    }
    dictationBaseText = sourceText.value ? (sourceText.value.trim() + ' ') : '';
    startRecognition(true);
  }

  // ========================================================
  // Historial y Favoritos (con persistencia LocalStorage)
  // ========================================================
  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveHistoryList(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      renderHistory();
    } catch (e) {
      console.error('Error guardando en localStorage', e);
    }
  }

  function renderHistory() {
    const list = loadHistory();
    historyCountBadge.textContent = list.length;
    clearAllHistoryBtn.disabled = list.length === 0;

    if (list.length === 0) {
      historyEmpty.classList.remove('hidden');
      historyList.innerHTML = '';
      return;
    }

    historyEmpty.classList.add('hidden');
    historyList.innerHTML = '';

    list.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = 'history-item';
      el.innerHTML = `
        <div class="history-content" data-index="${index}">
          <div class="history-meta">${escapeHtml(item.sourceLang.toUpperCase())} ➔ ${escapeHtml(item.targetLang.toUpperCase())} • ${new Date(item.timestamp).toLocaleDateString()} ${new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          <div class="history-source">${escapeHtml(item.source)}</div>
          <div class="history-target">${escapeHtml(item.target)}</div>
        </div>
        <div class="history-actions">
          <button class="btn-text-action delete-item-btn" data-index="${index}" title="Borrar elemento">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      `;

      // Cargar en el editor al hacer clic
      el.querySelector('.history-content').addEventListener('click', () => {
        sourceText.value = item.source;
        targetText.value = item.target;
        sourceLangSelect.value = item.sourceLang;
        targetLangSelect.value = item.targetLang;
        updateStats();
        showStickyToast('Traducción cargada desde el historial', 'info', 2000);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });

      // Borrar con modal de confirmación
      el.querySelector('.delete-item-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        showConfirmModal(
          'Eliminar registro del historial',
          '¿Estás seguro de que deseas eliminar este registro de traducciones?',
          () => {
            const current = loadHistory();
            current.splice(index, 1);
            saveHistoryList(current);
            showStickyToast('Registro eliminado del historial', 'info', 2500);
          }
        );
      });

      historyList.appendChild(el);
    });
  }

  function handleSaveFavorite() {
    const src = sourceText.value.trim();
    const tgt = targetText.value.trim();

    if (!src || !tgt) {
      showStickyToast('Nada para guardar. Traduce algo primero.', 'danger', 2500);
      return;
    }

    const list = loadHistory();
    const targetLang = resolveTargetLanguage(currentDetectedLang, targetLangSelect.value);

    // Evitar duplicado idéntico al principio
    if (list.length > 0 && list[0].source === src && list[0].target === tgt) {
      showStickyToast('Esta traducción ya está guardada en favoritos', 'info', 2500);
      return;
    }

    list.unshift({
      source: src,
      target: tgt,
      sourceLang: sourceLangSelect.value === 'auto' ? currentDetectedLang : sourceLangSelect.value,
      targetLang: targetLang,
      timestamp: Date.now(),
    });

    // Guardar máximo 50
    if (list.length > 50) list.pop();

    saveHistoryList(list);
    showStickyToast('Traducción guardada exitosamente en el historial', 'success', 3000);
  }

  function handleClearAllHistory() {
    showConfirmModal(
      'Vaciar todo el historial',
      '¿Estás seguro de que deseas eliminar todas las traducciones guardadas? Esta acción no se puede deshacer.',
      () => {
        saveHistoryList([]);
        showStickyToast('Historial vaciado correctamente', 'info', 3000);
      }
    );
  }

  // ========================================================
  // Estadísticas de texto
  // ========================================================
  function updateStats() {
    const src = sourceText.value;
    const tgt = targetText.value;

    const srcChars = src.length;
    const srcWords = src.trim() ? src.trim().split(/\s+/).length : 0;
    sourceStats.textContent = `${srcChars} caracteres • ${srcWords} palabras`;

    const tgtChars = tgt.length;
    targetStats.textContent = `${tgtChars} caracteres`;
  }

  // ========================================================
  // Verificación de conexión con el backend
  // ========================================================
  async function checkBackendStatus() {
    try {
      const res = await fetch(ENDPOINTS.languages);
      if (res.ok) {
        const langs = await res.json();
        backendStatusPill.className = 'status-pill status-connected';
        backendStatusText.textContent = `Backend Activo (${langs.length} idiomas)`;
        populateLanguages(langs);
      } else {
        throw new Error('Respuesta no válida');
      }
    } catch {
      backendStatusPill.className = 'status-pill status-error';
      backendStatusText.textContent = 'Backend desconectado (Inicia Docker)';
    }
  }

  function populateLanguages(languages) {
    if (!Array.isArray(languages)) return;

    // Actualizar nombres conocidos sin sobreescribir las traducciones en español
    languages.forEach((l) => {
      if (!LANG_NAMES[l.code]) {
        LANG_NAMES[l.code] = l.name;
      }
    });

    const currentSrc = sourceLangSelect.value;
    const currentTgt = targetLangSelect.value;

    // Separar en principales (es, en) y otros idiomas
    const others = languages
      .filter((l) => l.code !== 'en' && l.code !== 'es')
      .map((l) => ({ code: l.code, name: LANG_NAMES[l.code] || l.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));

    // Reconstruir selector de origen
    sourceLangSelect.innerHTML = '';
    const optAuto = document.createElement('option');
    optAuto.value = 'auto';
    optAuto.textContent = 'Auto-detectar idioma';
    sourceLangSelect.appendChild(optAuto);

    const groupSrcMain = document.createElement('optgroup');
    groupSrcMain.label = 'Idiomas Principales';
    const optSrcEs = document.createElement('option');
    optSrcEs.value = 'es';
    optSrcEs.textContent = 'Español';
    const optSrcEn = document.createElement('option');
    optSrcEn.value = 'en';
    optSrcEn.textContent = 'Inglés (English)';
    groupSrcMain.appendChild(optSrcEs);
    groupSrcMain.appendChild(optSrcEn);
    sourceLangSelect.appendChild(groupSrcMain);

    if (others.length > 0) {
      const groupSrcOthers = document.createElement('optgroup');
      groupSrcOthers.label = 'Otros Idiomas (Selección manual)';
      others.forEach((l) => {
        const opt = document.createElement('option');
        opt.value = l.code;
        opt.textContent = `${l.name} (${l.code})`;
        groupSrcOthers.appendChild(opt);
      });
      sourceLangSelect.appendChild(groupSrcOthers);
    }

    // Reconstruir selector de destino
    targetLangSelect.innerHTML = '';
    const optSmartAuto = document.createElement('option');
    optSmartAuto.value = 'smart_auto';
    optSmartAuto.textContent = '✨ Automático (EN ⇄ ES)';
    targetLangSelect.appendChild(optSmartAuto);

    const groupTgtMain = document.createElement('optgroup');
    groupTgtMain.label = 'Idiomas Principales (Manual)';
    const optTgtEs = document.createElement('option');
    optTgtEs.value = 'es';
    optTgtEs.textContent = 'Español';
    const optTgtEn = document.createElement('option');
    optTgtEn.value = 'en';
    optTgtEn.textContent = 'Inglés (English)';
    groupTgtMain.appendChild(optTgtEs);
    groupTgtMain.appendChild(optTgtEn);
    targetLangSelect.appendChild(groupTgtMain);

    if (others.length > 0) {
      const groupTgtOthers = document.createElement('optgroup');
      groupTgtOthers.label = 'Otros Idiomas (Selección manual)';
      others.forEach((l) => {
        const opt = document.createElement('option');
        opt.value = l.code;
        opt.textContent = `${l.name} (${l.code})`;
        groupTgtOthers.appendChild(opt);
      });
      targetLangSelect.appendChild(groupTgtOthers);
    }

    // Restaurar selecciones si aún son válidas
    if (Array.from(sourceLangSelect.options).some((o) => o.value === currentSrc)) {
      sourceLangSelect.value = currentSrc;
    } else {
      sourceLangSelect.value = 'auto';
    }

    if (Array.from(targetLangSelect.options).some((o) => o.value === currentTgt)) {
      targetLangSelect.value = currentTgt;
    } else {
      targetLangSelect.value = 'smart_auto';
    }
  }

  // ========================================================
  // Manejo de Pestañas (Modo Texto vs Modo Archivos)
  // ========================================================
  let currentTab = 'text';
  let selectedFile = null;
  let isTranslatingFile = false;

  function switchTab(mode) {
    if (mode === 'text') {
      currentTab = 'text';
      tabTextBtn.classList.add('active');
      tabFileBtn.classList.remove('active');
      textTranslationSection.classList.remove('hidden');
      if (historySection) historySection.classList.remove('hidden');
      fileTranslationSection.classList.add('hidden');
    } else {
      currentTab = 'file';
      tabFileBtn.classList.add('active');
      tabTextBtn.classList.remove('active');
      textTranslationSection.classList.add('hidden');
      if (historySection) historySection.classList.add('hidden');
      fileTranslationSection.classList.remove('hidden');
    }
  }

  // ========================================================
  // Manejo de Traducción de Archivos
  // ========================================================
  function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function handleFileSelection(file) {
    if (!file) return;

    selectedFile = file;
    previewFilename.textContent = file.name;
    previewFilesize.textContent = formatBytes(file.size);

    fileDropzone.classList.add('hidden');
    filePreviewCard.classList.remove('hidden');
    fileResultContainer.classList.add('hidden');
    fileProgressContainer.classList.add('hidden');
    translateFileBtn.classList.remove('hidden');
    translateFileBtn.disabled = false;

    showStickyToast(`Archivo "${file.name}" cargado correctamente`, 'info', 2500);
  }

  function resetFileSelection() {
    if (isTranslatingFile) {
      showConfirmModal(
        'Cancelar traducción de archivo',
        'Hay una traducción de archivo en curso. ¿Deseas cancelarla y quitar el archivo?',
        () => {
          doResetFile();
        }
      );
    } else {
      doResetFile();
    }
  }

  function doResetFile() {
    selectedFile = null;
    fileInput.value = '';
    fileDropzone.classList.remove('hidden');
    filePreviewCard.classList.add('hidden');
    fileResultContainer.classList.add('hidden');
    fileProgressContainer.classList.add('hidden');
    translateFileBtn.disabled = false;
    isTranslatingFile = false;
  }

  async function performFileTranslation() {
    if (!selectedFile) {
      showStickyToast('Por favor selecciona un archivo primero', 'danger', 2500);
      return;
    }

    let sourceLang = sourceLangSelect.value;
    let targetLang = targetLangSelect.value;

    // Resolver destino si es smart_auto
    let effectiveTarget = targetLang;
    if (targetLang === 'smart_auto') {
      if (sourceLang === 'en') effectiveTarget = 'es';
      else if (sourceLang === 'es') effectiveTarget = 'en';
      else effectiveTarget = 'es'; // Por defecto a español
    }

    // Si es un archivo .md (Markdown), lo adaptamos como text/plain con extensión .txt
    // para que el motor de LibreTranslate lo procese conservando su estructura
    const isMd = selectedFile.name.toLowerCase().endsWith('.md');
    const uploadFile = isMd
      ? new File([selectedFile], selectedFile.name.replace(/\.md$/i, '.txt'), { type: 'text/plain' })
      : selectedFile;

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('source', sourceLang);
    formData.append('target', effectiveTarget);

    isTranslatingFile = true;
    translateFileBtn.disabled = true;
    translateFileBtn.classList.add('hidden');
    fileProgressContainer.classList.remove('hidden');
    fileResultContainer.classList.add('hidden');

    try {
      const response = await fetch(ENDPOINTS.translateFile, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${response.status} del servidor al traducir archivo`);
      }

      const result = await response.json();
      if (!result.translatedFileUrl) {
        throw new Error('El servidor no devolvió la URL del archivo traducido');
      }

      // Preparar enlace de descarga
      downloadFileBtn.href = result.translatedFileUrl;
      const originalName = selectedFile.name;
      const lastDot = originalName.lastIndexOf('.');
      const ext = lastDot !== -1 ? originalName.substring(lastDot) : '';
      const base = lastDot !== -1 ? originalName.substring(0, lastDot) : originalName;
      downloadFileBtn.setAttribute('download', `${base}_${effectiveTarget}${ext}`);

      fileProgressContainer.classList.add('hidden');
      fileResultContainer.classList.remove('hidden');

      showStickyToast(`¡Archivo traducido con éxito a ${LANG_NAMES[effectiveTarget] || effectiveTarget.toUpperCase()}!`, 'success', 4000);
    } catch (err) {
      console.error('Error al traducir archivo:', err);
      fileProgressContainer.classList.add('hidden');
      translateFileBtn.classList.remove('hidden');
      translateFileBtn.disabled = false;
      showStickyToast(`Error al traducir archivo: ${err.message}`, 'danger', 4000);
    } finally {
      isTranslatingFile = false;
    }
  }

  // ========================================================
  // Parseo de URL Query Params (como libretranslate.com)
  // ========================================================
  function parseQueryParams() {
    const params = new URLSearchParams(window.location.search);
    const sourceParam = params.get('source');
    const targetParam = params.get('target');
    const queryParam = params.get('q');

    if (sourceParam) sourceLangSelect.value = sourceParam;
    if (targetParam) targetLangSelect.value = targetParam;
    if (queryParam) {
      sourceText.value = queryParam;
      updateStats();
      performTranslation();
    }
  }

  // Utilidad de escape HTML
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ========================================================
  // Inicialización de Event Listeners
  // ========================================================
  function init() {
    sourceText.addEventListener('input', () => {
      updateStats();
      triggerTranslationDebounced();
    });

    sourceLangSelect.addEventListener('change', performTranslation);
    targetLangSelect.addEventListener('change', performTranslation);

    swapBtn.addEventListener('click', handleSwap);
    clearBtn.addEventListener('click', handleClear);
    if (micBtn) micBtn.addEventListener('click', handleDictate);
    pasteBtn.addEventListener('click', handlePaste);
    copyBtn.addEventListener('click', handleCopy);
    saveBtn.addEventListener('click', handleSaveFavorite);
    speakBtn.addEventListener('click', handleSpeak);
    clearAllHistoryBtn.addEventListener('click', handleClearAllHistory);

    // Atajos de teclado
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        performTranslation();
      }
    });

    // Pestañas (Modo Texto vs Modo Archivos)
    if (tabTextBtn && tabFileBtn) {
      tabTextBtn.addEventListener('click', () => switchTab('text'));
      tabFileBtn.addEventListener('click', () => switchTab('file'));
    }

    // Traducción de Archivos
    if (browseFileBtn && fileInput) {
      browseFileBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          handleFileSelection(e.target.files[0]);
        }
      });
    }

    if (removeFileBtn) {
      removeFileBtn.addEventListener('click', resetFileSelection);
    }

    if (translateFileBtn) {
      translateFileBtn.addEventListener('click', performFileTranslation);
    }

    if (fileDropzone) {
      fileDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileDropzone.classList.add('dragover');
      });
      fileDropzone.addEventListener('dragleave', () => {
        fileDropzone.classList.remove('dragover');
      });
      fileDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        fileDropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleFileSelection(e.dataTransfer.files[0]);
        }
      });
    }

    // Inicializar Modo Claro / Oscuro
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', toggleTheme);
      applyTheme(getCurrentTheme(), false);
    }

    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem(THEME_STORAGE_KEY)) {
          applyTheme(e.matches ? 'dark' : 'light', false);
        }
      });
    }

    renderHistory();
    checkBackendStatus();
    parseQueryParams();

    // Reintentar conectar si el backend está iniciando
    setInterval(checkBackendStatus, 10000);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
