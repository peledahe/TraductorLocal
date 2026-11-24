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

  // Pestañas (Modo Texto vs Modo Archivos vs Generar Prompt)
  const tabTextBtn = document.getElementById('tab-text-btn');
  const tabFileBtn = document.getElementById('tab-file-btn');
  const tabPromptBtn = document.getElementById('tab-prompt-btn');
  const textTranslationSection = document.getElementById('text-translation-section');
  const fileTranslationSection = document.getElementById('file-translation-section');
  const historySection = document.querySelector('.history-section');

  // Elementos de la tarjeta de Entrada / Multimodalidad
  const sourceCard = document.querySelector('.source-card');
  const sourceCardTitle = document.getElementById('source-card-title');
  const targetCardTitle = document.getElementById('target-card-title');
  const imagePreviewContainer = document.getElementById('image-preview-container');
  const imagePreviewThumb = document.getElementById('image-preview-thumb');
  const imagePreviewName = document.getElementById('image-preview-name');
  const imageRemoveBtn = document.getElementById('image-remove-btn');
  const attachImgBtn = document.getElementById('attach-img-btn');
  const imageFileInput = document.getElementById('image-file-input');

  // Estado de imagen adjunta
  let currentAttachedImage = null; // { dataUrl: string, name: string, size: number }

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
  const fileProgressText = document.getElementById('file-progress-text');
  const fileResultContainer = document.getElementById('file-result-container');
  const fileResultTitle = document.getElementById('file-result-title');
  const fileResultDesc = document.getElementById('file-result-desc');
  const downloadFileBtn = document.getElementById('download-file-btn');

  // Elementos del DOM (Texto)
  const mainBrandTitle = document.getElementById('main-brand-title');
  const mainBrandSubtitle = document.getElementById('main-brand-subtitle');
  const adminSettingsBtn = document.getElementById('admin-settings-btn');
  const aiActiveIndicatorDot = document.getElementById('ai-active-indicator-dot');
  const aiSelectorContainer = document.getElementById('ai-selector-container');
  const activeAiSelect = document.getElementById('active-ai-select');
  const aiTierBadge = document.getElementById('ai-tier-badge');
  const aiRefiningBadge = document.getElementById('ai-refining-badge');
  const aiRefiningBadgeText = document.getElementById('ai-refining-badge-text');

  // Modal Administrativo de IAs
  const adminModal = document.getElementById('admin-modal');
  const adminCloseBtn = document.getElementById('admin-close-btn');
  const adminCancelBtn = document.getElementById('admin-cancel-btn');
  const adminSaveBtn = document.getElementById('admin-save-btn');

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
  let aiDebounceTimer = null;
  let aiAbortController = null;
  let currentDetectedLang = 'en';
  let modalConfirmCallback = null;
  const STORAGE_KEY = 'traductor_local_history';

  // Configuración de IAs (Gemini, Claude, ChatGPT, DeepSeek)
  const AI_CONFIG_KEY = 'traductor_local_ai_config';
  const SELECTED_AI_KEY = 'traductor_local_selected_ai';

  const DEFAULT_AI_CONFIG = {
    gemini: {
      name: 'Gemini',
      enabled: false,
      useFreeTier: true,
      apiKey: '',
      model: 'gemini-3.5-flash-lite'
    },
    claude: {
      name: 'Claude',
      enabled: false,
      useFreeTier: false,
      apiKey: '',
      model: 'claude-3-5-haiku-20241022'
    },
    chatgpt: {
      name: 'ChatGPT',
      enabled: false,
      useFreeTier: false,
      apiKey: '',
      model: 'gpt-4o-mini'
    },
    deepseek: {
      name: 'DeepSeek',
      enabled: false,
      useFreeTier: false,
      apiKey: '',
      model: 'deepseek-chat'
    },
    meta: {
      name: 'Meta AI (Llama)',
      enabled: false,
      useFreeTier: false,
      apiKey: '',
      model: 'llama-3.3-70b-versatile'
    },
    openrouter: {
      name: 'OpenRouter',
      enabled: false,
      useFreeTier: false,
      apiKey: '',
      model: 'meta-llama/llama-3.3-70b-instruct:free'
    },
    cerebras: {
      name: 'Cerebras',
      enabled: false,
      useFreeTier: false,
      apiKey: '',
      model: 'llama3.3-70b'
    }
  };

  let aiConfig = loadAiConfig();
  let freeQuotaData = null;

  function isProviderActive(k) {
    const item = aiConfig[k];
    if (!item || !item.enabled) return false;
    if (k === 'gemini' && item.useFreeTier) return true;
    return !!(item.apiKey && item.apiKey.trim().length > 0);
  }

  function getActiveProviders() {
    return Object.keys(aiConfig).filter(isProviderActive);
  }

  async function loadFreeQuotaStatus() {
    try {
      const resp = await fetch('/api/ai_free_quota');
      if (resp.ok) {
        freeQuotaData = await resp.json();
        updateFreeQuotaBadges(freeQuotaData);
      }
    } catch (e) {
      console.warn('Error cargando estado de cuota gratuita:', e);
    }
  }

  function updateFreeQuotaBadges(data) {
    if (!data || !data.providers) return;
    const pData = data.providers.gemini;
    const badge = document.getElementById('free-quota-badge-gemini');
    if (!badge || !pData) return;

    if (pData.available) {
      badge.className = 'quota-badge quota-available';
      badge.innerHTML = `<span class="quota-dot"></span> Tokens Gratuitos Activos (${pData.remaining}/${pData.limit} hoy)`;
    } else if (pData.remaining <= 0) {
      badge.className = 'quota-badge quota-unavailable';
      badge.innerHTML = `<span class="quota-dot"></span> Cuota Agotada hoy (0 req)`;
    } else {
      badge.className = 'quota-badge quota-unavailable';
      badge.innerHTML = `<span class="quota-dot"></span> No disponible`;
    }
  }

  function syncKeyInputWithFreeTier(provider, isFreeActive) {
    if (provider !== 'gemini') return;
    const keyInput = document.getElementById('ai-key-gemini');
    const freeBox = document.getElementById('free-tier-box-gemini');
    if (freeBox) {
      if (isFreeActive) {
        freeBox.classList.add('is-active');
      } else {
        freeBox.classList.remove('is-active');
      }
    }
    if (!keyInput) return;
    if (isFreeActive) {
      keyInput.classList.add('free-tier-active');
      keyInput.setAttribute('placeholder', '✨ Usando cuota gratuita del sistema (Opcional ingresar clave personal)');
    } else {
      keyInput.classList.remove('free-tier-active');
      keyInput.setAttribute('placeholder', 'AIzaSy...');
    }
  }

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
      iconSvg = '<svg viewBox="0 0 512 512" width="18" height="18" fill="currentColor" style="color:#10b981"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z"/></svg>';
    } else if (type === 'danger') {
      iconSvg = '<svg viewBox="0 0 512 512" width="18" height="18" fill="currentColor" style="color:#ef4444"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm0-384c13.3 0 24 10.7 24 24V264c0 13.3-10.7 24-24 24s-24-10.7-24-24V152c0-13.3 10.7-24 24-24zm32 224a32 32 0 1 1 -64 0 32 32 0 1 1 64 0z"/></svg>';
    } else if (type === 'warning') {
      iconSvg = '<svg viewBox="0 0 512 512" width="18" height="18" fill="currentColor" style="color:#f59e0b"><path d="M256 32c14.2 0 27.3 7.5 34.5 19.8l216 368c7.3 12.4 7.3 27.7 .2 40.1S486.3 480 472 480H40c-14.3 0-27.6-7.7-34.7-20.1s-7-27.8 .2-40.1l216-368C228.7 39.5 241.8 32 256 32zm0 128c-13.3 0-24 10.7-24 24V296c0 13.3 10.7 24 24 24s24-10.7 24-24V184c0-13.3-10.7-24-24-24zm32 224a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z"/></svg>';
    } else {
      iconSvg = '<svg viewBox="0 0 512 512" width="18" height="18" fill="currentColor" style="color:#2563eb"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-144a32 32 0 1 1 0-64 32 32 0 1 1 0 64z"/></svg>';
    }

    toast.innerHTML = `
      <div class="toast-icon">${iconSvg}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
      <button class="toast-close" title="Cerrar">
        <svg viewBox="0 0 384 512" width="12" height="12" fill="currentColor">
          <path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/>
        </svg>
      </button>
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
    const hasImage = !!currentAttachedImage;

    if (!text && !hasImage) {
      targetText.value = '';
      translatingIndicator.classList.add('hidden');
      updateStats();
      return;
    }

    if (activeAbortController) {
      activeAbortController.abort();
    }
    activeAbortController = new AbortController();

    // Si solo hay imagen adjunta (sin texto aún), llamar directamente a la IA multimodal
    if (!text && hasImage) {
      const selectedAi = activeAiSelect ? activeAiSelect.value : 'none';
      const activeProviders = getActiveProviders();
      if (selectedAi && selectedAi !== 'none' && activeProviders.includes(selectedAi)) {
        scheduleAiRefinement("", "", "es", "en", selectedAi, 100);
      } else {
        showStickyToast('Activa una IA (Gemini, ChatGPT o Claude) para interpretar la imagen adjunta', 'info', 3500);
      }
      return;
    }

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

      // 2. Determinar el idioma destino (en modo prompt siempre se traduce al inglés para optimizar prompts de IA)
      const targetLang = currentTab === 'prompt' ? 'en' : resolveTargetLanguage(effectiveSource, targetLangSelect.value);

      // Si origen y destino coinciden y no hay imagen ni modo prompt, no llamar al backend
      if (effectiveSource === targetLang && !hasImage && currentTab !== 'prompt') {
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
      const localTranslation = result.translatedText || '';
      targetText.value = localTranslation;
      updateStats();

      // Si LibreTranslate detectó un idioma en su respuesta
      if (result.detectedLanguage && sourceLangSelect.value === 'auto') {
        const detectedCode = result.detectedLanguage.language;
        if (detectedCode) {
          detectedLangName.textContent = LANG_NAMES[detectedCode] || detectedCode.toUpperCase();
        }
      }

      // 4. Concluir la traducción local de inmediato para que el usuario la vea al instante sin demora
      translatingIndicator.classList.add('hidden');

      // 5. Programar el perfeccionamiento con IA solo cuando el usuario pause en el teclado
      const selectedAi = activeAiSelect ? activeAiSelect.value : 'none';
      const activeProviders = getActiveProviders();

      if (selectedAi && selectedAi !== 'none' && activeProviders.includes(selectedAi) && (localTranslation.trim() || hasImage)) {
        scheduleAiRefinement(text, localTranslation, effectiveSource, targetLang, selectedAi);
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
    clearTimeout(aiDebounceTimer);
    if (aiAbortController) {
      aiAbortController.abort();
      aiAbortController = null;
    }
    if (aiRefiningBadge) {
      aiRefiningBadge.classList.add('hidden');
    }
    debounceTimer = setTimeout(performTranslation, 250);
  }

  // ========================================================
  // Refinamiento Inteligente con IA (Tras pausa en teclado)
  // ========================================================
  function scheduleAiRefinement(sourceTxt, localTxt, srcLang, tgtLang, providerKey, delay = 700) {
    clearTimeout(aiDebounceTimer);
    if (aiAbortController) {
      aiAbortController.abort();
      aiAbortController = null;
    }

    aiDebounceTimer = setTimeout(async () => {
      // Verificar que el texto siga siendo el mismo y que el usuario no haya seguido escribiendo
      if (sourceText.value.trim() !== sourceTxt && !currentAttachedImage) return;

      aiAbortController = new AbortController();
      await refineTranslationWithAi(sourceTxt, localTxt, srcLang, tgtLang, providerKey, aiAbortController.signal);
    }, delay);
  }

  async function refineTranslationWithAi(sourceTxt, localTxt, srcLang, tgtLang, providerKey, abortSignal) {
    const provConfig = aiConfig[providerKey];
    if (!provConfig || !provConfig.enabled) return;
    const hasKey = !!(provConfig.apiKey && provConfig.apiKey.trim());
    const useFree = providerKey === 'gemini' && !!provConfig.useFreeTier;
    if (!hasKey && !useFree) return;

    const isPrompt = currentTab === 'prompt';
    const hasImage = !!currentAttachedImage;

    if (aiRefiningBadge) {
      if (aiRefiningBadgeText) {
        if (isPrompt) {
          aiRefiningBadgeText.textContent = hasImage
            ? `Interpretando imagen y optimizando prompt con ${provConfig.name}...`
            : `Generando prompt en inglés con ${provConfig.name}...`;
        } else {
          aiRefiningBadgeText.textContent = hasImage
            ? `Interpretando imagen y texto con ${provConfig.name}...`
            : `Perfeccionando con ${provConfig.name}...`;
        }
      }
      aiRefiningBadge.classList.remove('hidden');
    }

    try {
      const resp = await fetch('/api/ai_refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: providerKey,
          apiKey: provConfig.apiKey || '',
          useFreeTier: useFree,
          model: provConfig.model,
          sourceText: sourceTxt,
          localTranslation: localTxt,
          sourceLang: LANG_NAMES[srcLang] || srcLang,
          targetLang: LANG_NAMES[tgtLang] || tgtLang,
          isPromptMode: isPrompt,
          imageData: currentAttachedImage ? currentAttachedImage.dataUrl : null
        }),
        signal: abortSignal
      });

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(errJson.error || `Error ${resp.status}`);
      }

      const data = await resp.json();
      // Asegurarse de que el usuario no haya escrito nuevo texto mientras la IA procesaba
      if ((sourceText.value.trim() === sourceTxt || !sourceTxt) && data && data.refinedText) {
        targetText.value = data.refinedText;
        updateStats();
        if (aiRefiningBadgeText) {
          aiRefiningBadgeText.textContent = isPrompt
            ? `Prompt optimizado con ${provConfig.name} ✨`
            : `Perfeccionado con ${provConfig.name} ✨`;
        }
        setTimeout(() => {
          if (aiRefiningBadge && (sourceText.value.trim() === sourceTxt || !sourceTxt)) {
            aiRefiningBadge.classList.add('hidden');
          }
        }, 2500);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn('Aviso de refinamiento con IA:', err);
      if (aiRefiningBadge) aiRefiningBadge.classList.add('hidden');
      showStickyToast(err.message, 'danger', 4500);
    }
  }

  // ========================================================
  // Gestión de Configuración de IAs y Estado de la UI
  // ========================================================
  function loadAiConfig() {
    let cfg;
    try {
      const raw = localStorage.getItem(AI_CONFIG_KEY);
      if (raw) {
        cfg = { ...DEFAULT_AI_CONFIG, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.warn('Error cargando aiConfig de localStorage', e);
    }
    if (!cfg) cfg = JSON.parse(JSON.stringify(DEFAULT_AI_CONFIG));

    // Migrar modelos que quedaron como antiguos valores por defecto al modelo de menor consumo
    if (cfg.gemini && (!cfg.gemini.model || cfg.gemini.model === 'gemini-1.5-flash')) {
      cfg.gemini.model = 'gemini-3.5-flash-lite';
    }
    if (cfg.claude && (!cfg.claude.model || cfg.claude.model === 'claude-3-5-sonnet-20241022')) {
      cfg.claude.model = 'claude-3-5-haiku-20241022';
    }
    if (cfg.chatgpt && !cfg.chatgpt.model) {
      cfg.chatgpt.model = 'gpt-4o-mini';
    }
    if (cfg.deepseek && !cfg.deepseek.model) {
      cfg.deepseek.model = 'deepseek-chat';
    }
    if (cfg.meta && !cfg.meta.model) {
      cfg.meta.model = 'llama-3.3-70b-versatile';
    }
    if (cfg.openrouter && !cfg.openrouter.model) {
      cfg.openrouter.model = 'meta-llama/llama-3.3-70b-instruct:free';
    }
    if (cfg.cerebras && !cfg.cerebras.model) {
      cfg.cerebras.model = 'llama3.3-70b';
    }
    return cfg;
  }

  function saveAiConfig(config) {
    try {
      localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
      fetch('/api/ai_config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      }).catch(() => {});
    } catch (e) {
      console.error('Error guardando aiConfig', e);
    }
  }

  function updateHeaderTitles() {
    const activeProviders = getActiveProviders();
    const hasAi = activeProviders.length > 0;

    if (currentTab === 'prompt') {
      if (mainBrandTitle) mainBrandTitle.textContent = 'Generador de Prompts (IA)';
      if (mainBrandSubtitle) mainBrandSubtitle.textContent = 'Prompts en inglés optimizados para asistentes de código con IA • Un desarrollo de merke.net';
      document.title = 'Generador de Prompts (IA) - Traductor con IA';
    } else if (currentTab === 'file') {
      if (mainBrandTitle) mainBrandTitle.textContent = 'Traducción de Archivos';
      if (mainBrandSubtitle) mainBrandSubtitle.textContent = 'Traducción de documentos y archivos locales (.pdf, .docx, .txt, .srt) • Un desarrollo de merke.net';
      document.title = hasAi
        ? 'Traducción de Archivos - Traductor con IA'
        : 'Traducción de Archivos - LibreTranslate';
    } else {
      // Modo Texto (TRADUCIR TEXTO)
      if (hasAi) {
        if (mainBrandTitle) mainBrandTitle.textContent = 'Traductor con IA';
        if (mainBrandSubtitle) mainBrandSubtitle.textContent = 'Impulsado por LibreTranslate + IA • Un desarrollo de merke.net';
        document.title = 'Traductor con IA - LibreTranslate + IA EN ⇄ ES';
      } else {
        if (mainBrandTitle) mainBrandTitle.textContent = 'Traductor Local';
        if (mainBrandSubtitle) mainBrandSubtitle.textContent = 'Impulsado por LibreTranslate • Un desarrollo de merke.net';
        document.title = 'Traductor Local - LibreTranslate EN ⇄ ES';
      }
    }
  }

  function updateAiUIState() {
    const activeProviders = getActiveProviders();

    // Actualizar títulos según la opción / pestaña activa
    updateHeaderTitles();

    if (activeProviders.length > 0) {
      // Indicador visual en botón de configuración (1)
      if (aiActiveIndicatorDot) aiActiveIndicatorDot.classList.remove('hidden');

      // Requisito 3: Mostrar selector de IA en el formulario
      if (aiSelectorContainer) aiSelectorContainer.classList.remove('hidden');

      // Mostrar opción / pestaña para Generar Prompt optimizado
      if (tabPromptBtn) tabPromptBtn.classList.remove('hidden');

      if (activeAiSelect) {
        const savedSelected = localStorage.getItem(SELECTED_AI_KEY);
        activeAiSelect.innerHTML = '';

        activeProviders.forEach(p => {
          const item = aiConfig[p];
          const opt = document.createElement('option');
          opt.value = p;
          const icon = p === 'gemini' ? '✨' : p === 'claude' ? '🧠' : p === 'chatgpt' ? '🤖' : p === 'deepseek' ? '🐋' : p === 'meta' ? '🦙' : p === 'openrouter' ? '🌐' : p === 'cerebras' ? '⚡' : '🚀';
          const isFree = (p === 'gemini' && item.useFreeTier);
          const tierTag = isFree ? 'Free Tier' : 'API Key';
          opt.textContent = `${icon} ${item.name} (${tierTag})`;
          activeAiSelect.appendChild(opt);
        });

        // Opción Solo Local
        const optLocal = document.createElement('option');
        optLocal.value = 'none';
        optLocal.textContent = '🚫 Solo Local (sin IA)';
        activeAiSelect.appendChild(optLocal);

        if (savedSelected && (activeProviders.includes(savedSelected) || savedSelected === 'none')) {
          activeAiSelect.value = savedSelected;
        } else {
          activeAiSelect.value = activeProviders[0];
          localStorage.setItem(SELECTED_AI_KEY, activeAiSelect.value);
        }

        updateAiTierBadge();
      }
    } else {
      updateHeaderTitles();

      if (aiActiveIndicatorDot) aiActiveIndicatorDot.classList.add('hidden');

      // Requisito 3: No mostrar selector de IA
      if (aiSelectorContainer) aiSelectorContainer.classList.add('hidden');

      // Ocultar opción Generar Prompt si no hay IA
      if (tabPromptBtn) {
        tabPromptBtn.classList.add('hidden');
        if (currentTab === 'prompt') {
          switchTab('text');
        }
      }
    }
  }

  function updateAiTierBadge() {
    if (!aiTierBadge || !activeAiSelect) return;
    const selected = activeAiSelect.value;
    if (selected === 'none' || !selected) {
      aiTierBadge.textContent = 'Solo Local';
      aiTierBadge.className = 'ai-tier-badge tier-none';
      aiTierBadge.title = 'Traducción local únicamente (sin IA)';
      return;
    }
    const item = aiConfig[selected];
    if (selected === 'gemini' && item && item.useFreeTier) {
      aiTierBadge.textContent = 'Free Tier';
      aiTierBadge.className = 'ai-tier-badge tier-free';
      aiTierBadge.title = 'Operando con Cuota Gratuita del sistema (Tokens sin costo)';
    } else {
      aiTierBadge.textContent = 'API Key (Pro)';
      aiTierBadge.className = 'ai-tier-badge tier-paid';
      aiTierBadge.title = 'Operando con API Key personal / Pro';
    }
  }

  function switchAiTab(provider) {
    document.querySelectorAll('.ai-tab-btn').forEach(btn => {
      const isTarget = btn.getAttribute('data-provider') === provider;
      btn.classList.toggle('active', isTarget);
      btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    });
    document.querySelectorAll('.ai-provider-panel').forEach(panel => {
      const isTarget = panel.getAttribute('data-provider') === provider;
      panel.classList.toggle('active', isTarget);
    });
  }

  function updateTabStatusChips() {
    ['gemini', 'claude', 'chatgpt', 'deepseek', 'meta', 'openrouter', 'cerebras'].forEach(p => {
      const chip = document.getElementById(`tab-status-${p}`);
      const toggle = document.getElementById(`ai-toggle-${p}`);
      const item = aiConfig[p] || {};
      const isEnabled = toggle ? toggle.checked : !!item.enabled;
      if (chip) {
        if (isEnabled) {
          chip.textContent = p === 'gemini' && item.useFreeTier && !item.apiKey ? 'Free Tier' : 'Activo';
          chip.className = 'ai-tab-status-chip is-active';
        } else {
          chip.textContent = 'Inactivo';
          chip.className = 'ai-tab-status-chip';
        }
      }
    });
  }

  function openAdminModal() {
    loadFreeQuotaStatus();
    ['gemini', 'claude', 'chatgpt', 'deepseek', 'meta', 'openrouter', 'cerebras'].forEach(p => {
      const item = aiConfig[p] || {};
      const toggle = document.getElementById(`ai-toggle-${p}`);
      const freeToggle = document.getElementById(`ai-free-toggle-${p}`);
      const keyInput = document.getElementById(`ai-key-${p}`);
      const testStatus = document.getElementById(`test-status-${p}`);

      if (toggle) toggle.checked = !!item.enabled;
      if (p === 'gemini') {
        if (freeToggle) freeToggle.checked = !!item.useFreeTier;
        syncKeyInputWithFreeTier('gemini', !!item.useFreeTier);
      }
      if (keyInput) keyInput.value = item.apiKey || '';

      if (testStatus) {
        testStatus.textContent = '';
        testStatus.className = 'test-status-msg';
      }

      // Si la IA tiene clave o cuota gratuita activa en gemini, cargar modelos disponibles en tiempo real
      if ((item.apiKey && item.apiKey.trim()) || (p === 'gemini' && item.useFreeTier)) {
        fetchModelsForProvider(p, false);
      } else {
        populateModelSelect(p, FALLBACK_MODELS[p], item.model);
      }
    });

    // Limpiar estados de prueba previos
    document.querySelectorAll('.test-pill').forEach(pill => {
      pill.textContent = '';
      pill.className = 'test-pill';
    });

    updateTabStatusChips();

    // Activar pestaña según la IA actualmente seleccionada en el traductor principal (si aplica)
    if (activeAiSelect && activeAiSelect.value && activeAiSelect.value !== 'none') {
      switchAiTab(activeAiSelect.value);
    } else {
      switchAiTab('gemini');
    }

    if (adminModal) {
      adminModal.classList.add('open');
      adminModal.setAttribute('aria-hidden', 'false');
    }
  }

  // Modelos recomendados / de reserva para cuando no hay conexión o no se ha ingresado clave aún
  const FALLBACK_MODELS = {
    gemini: [
      { id: 'gemini-3.5-flash-lite', name: 'gemini-3.5-flash-lite (Menor consumo de tokens / Ultrarrápido)' },
      { id: 'gemini-3.5-flash', name: 'gemini-3.5-flash (Equilibrado y veloz)' },
      { id: 'gemini-flash-latest', name: 'gemini-flash-latest (Última versión Flash)' },
      { id: 'gemini-3.8-flash', name: 'gemini-3.8-flash' },
      { id: 'gemini-2.5-flash', name: 'gemini-2.5-flash' }
    ],
    claude: [
      { id: 'claude-3-5-haiku-20241022', name: 'claude-3-5-haiku-20241022 (Claude 3.5 Haiku - Menor consumo de tokens)' },
      { id: 'claude-3-haiku-20240307', name: 'claude-3-haiku-20240307 (Claude 3 Haiku)' },
      { id: 'claude-3-5-sonnet-20241022', name: 'claude-3-5-sonnet-20241022 (Claude 3.5 Sonnet)' },
      { id: 'claude-3-opus-20240229', name: 'claude-3-opus-20240229 (Claude 3 Opus)' }
    ],
    chatgpt: [
      { id: 'gpt-4o-mini', name: 'gpt-4o-mini (Menor consumo de tokens / Rápido y preciso)' },
      { id: 'gpt-3.5-turbo', name: 'gpt-3.5-turbo (Económico)' },
      { id: 'gpt-4o', name: 'gpt-4o (Alta capacidad)' },
      { id: 'o3-mini', name: 'o3-mini (Razonamiento)' }
    ],
    deepseek: [
      { id: 'deepseek-chat', name: 'deepseek-chat (DeepSeek-V3 - Menor consumo de tokens)' },
      { id: 'deepseek-reasoner', name: 'deepseek-reasoner (DeepSeek-R1 Razonamiento / Mayor consumo)' }
    ],
    meta: [
      { id: 'llama-3.3-70b-versatile', name: 'llama-3.3-70b-versatile (Recomendado - 70B Alta precisión)' },
      { id: 'llama-3.1-8b-instant', name: 'llama-3.1-8b-instant (Ultrarrápido - Menor consumo de tokens)' }
    ],
    openrouter: [
      { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'meta-llama/llama-3.3-70b-instruct:free (Gratis)' },
      { id: 'google/gemini-2.0-flash-exp:free', name: 'google/gemini-2.0-flash-exp:free (Gratis)' },
      { id: 'deepseek/deepseek-r1:free', name: 'deepseek/deepseek-r1:free (Gratis)' },
      { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'meta-llama/llama-3.1-8b-instruct:free (Gratis)' },
      { id: 'openai/gpt-4o-mini', name: 'openai/gpt-4o-mini (Popular)' },
      { id: 'anthropic/claude-3.5-haiku', name: 'anthropic/claude-3.5-haiku' }
    ],
    cerebras: [
      { id: 'llama3.3-70b', name: 'llama3.3-70b (Recomendado - 70B Inferencia Ultrarrápida)' },
      { id: 'llama3.1-8b', name: 'llama3.1-8b (Ultrarrápido CS-3)' }
    ]
  };

  const modelsCache = {};
  const isFetchingModels = {};

  function populateModelSelect(provider, models, preferredModel) {
    const select = document.getElementById(`ai-model-${provider}`);
    if (!select) return;

    // Detectar modelos antiguos, retirados o de clasificación no aptos (como guardrails o vision/preview decommissioned) y migrarlos
    const legacyDefaults = [
      'gemini-1.5-flash',
      'claude-3-5-sonnet-20241022',
      'llama-3.2-11b-vision-preview',
      'llama-3.2-90b-vision-preview',
      'llama-3.2-3b-preview',
      'llama-3.2-1b-preview'
    ];
    let currentVal = preferredModel || select.value || aiConfig[provider]?.model;
    const isObsolete = currentVal && (
      legacyDefaults.includes(currentVal) ||
      currentVal.includes('guard') ||
      currentVal.includes('vision') ||
      currentVal.includes('whisper') ||
      currentVal.includes('preview') ||
      currentVal.includes('decommissioned')
    );

    if (isObsolete && models && models.length > 0) {
      currentVal = models[0].id;
      if (aiConfig[provider]) aiConfig[provider].model = currentVal;
    }

    select.innerHTML = '';

    if (!models || models.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No hay modelos disponibles';
      opt.disabled = true;
      opt.selected = true;
      select.appendChild(opt);
      return;
    }

    let foundCurrent = false;
    models.forEach((m, idx) => {
      const opt = document.createElement('option');
      opt.value = m.id;
      let label = m.name || m.id;
      // Resaltar visualmente el modelo de menor consumo si es el primero
      if (idx === 0 && !label.toLowerCase().includes('menor consumo')) {
        label = `⚡ ${label} (Menor consumo de tokens)`;
      }
      opt.textContent = label;
      if (m.id === currentVal) {
        opt.selected = true;
        foundCurrent = true;
      }
      select.appendChild(opt);
    });

    // Si no coincide o no hay selección, seleccionar siempre el primero (el de menor consumo de tokens)
    if (!foundCurrent && select.options.length > 0) {
      select.options[0].selected = true;
    }

    if (aiConfig[provider]) {
      aiConfig[provider].model = select.value;
    }
  }

  async function fetchModelsForProvider(provider, force = false) {
    const keyInput = document.getElementById(`ai-key-${provider}`);
    const freeToggle = document.getElementById(`ai-free-toggle-${provider}`);
    const keyVal = keyInput ? keyInput.value.trim() : (aiConfig[provider]?.apiKey || '');
    const useFree = freeToggle ? freeToggle.checked : (aiConfig[provider]?.useFreeTier || false);
    const select = document.getElementById(`ai-model-${provider}`);
    const refreshBtn = document.querySelector(`.btn-refresh-models[data-provider="${provider}"]`);
    const refreshIcon = refreshBtn ? refreshBtn.querySelector('.refresh-icon') : null;

    if (!keyVal && !useFree) {
      if (!modelsCache[provider]) {
        populateModelSelect(provider, FALLBACK_MODELS[provider], aiConfig[provider]?.model);
      }
      return;
    }

    if (!force && modelsCache[provider] && modelsCache[provider].length > 0) {
      populateModelSelect(provider, modelsCache[provider], aiConfig[provider]?.model);
      return;
    }

    if (isFetchingModels[provider]) return;
    isFetchingModels[provider] = true;

    if (refreshIcon) refreshIcon.classList.add('spinning');
    if (refreshBtn) refreshBtn.disabled = true;
    if (select && select.options.length <= 1) {
      select.innerHTML = '<option value="" disabled selected>Consultando modelos en tiempo real...</option>';
    }

    try {
      const resp = await fetch('/api/ai_models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: provider,
          apiKey: keyVal,
          useFreeTier: useFree
        })
      });

      const data = await resp.json();
      const modelsList = data.models || [];
      if (resp.ok && Array.isArray(modelsList) && modelsList.length > 0) {
        modelsCache[provider] = modelsList;
        populateModelSelect(provider, modelsList, aiConfig[provider]?.model);
        if (force) {
          showStickyToast(`Modelos de ${provider.toUpperCase()} actualizados en tiempo real (${modelsList.length} disponibles)`, 'success', 2500);
        }
      } else {
        throw new Error(data.error || 'No se pudieron recuperar los modelos');
      }
    } catch (err) {
      console.warn(`Error al consultar modelos en tiempo real para ${provider}:`, err);
      const fallbacks = modelsCache[provider] || FALLBACK_MODELS[provider];
      populateModelSelect(provider, fallbacks, aiConfig[provider]?.model);
      if (force) {
        showStickyToast(`Aviso ${provider.toUpperCase()}: ${err.message}. Se cargaron modelos recomendados.`, 'warning', 3500);
      }
    } finally {
      isFetchingModels[provider] = false;
      if (refreshIcon) refreshIcon.classList.remove('spinning');
      if (refreshBtn) refreshBtn.disabled = false;
    }
  }

  function closeAdminModal() {
    if (adminModal) {
      adminModal.classList.remove('open');
      adminModal.setAttribute('aria-hidden', 'true');
    }
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
  // Limpieza de campos y elementos adjuntos
  // ========================================================
  function handleClear() {
    stopDictation(false);
    if (debounceTimer) clearTimeout(debounceTimer);
    if (aiDebounceTimer) clearTimeout(aiDebounceTimer);
    if (activeAbortController) activeAbortController.abort();
    if (aiAbortController) aiAbortController.abort();

    sourceText.value = '';
    targetText.value = '';

    // Limpiar completamente cualquier imagen adjunta
    removeAttachedImage(false, false);

    detectedBadge.classList.add('hidden');
    if (aiRefiningBadge) aiRefiningBadge.classList.add('hidden');
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
            <svg viewBox="0 0 448 512" width="13" height="13" fill="currentColor">
              <path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"/>
            </svg>
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
  let isCheckingBackend = false;
  let wasBackendDisconnected = false;

  async function checkBackendStatus() {
    if (isCheckingBackend) return;
    isCheckingBackend = true;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(ENDPOINTS.languages, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const langs = await res.json();
        backendStatusPill.className = 'status-pill status-connected';
        backendStatusText.textContent = `Backend Activo (${langs.length} idiomas)`;
        populateLanguages(langs);

        // Si venía de estar desconectado y hay texto/imagen pendiente, reintentar traducción
        if (wasBackendDisconnected) {
          wasBackendDisconnected = false;
          showStickyToast('Conexión con el Backend restablecida', 'success', 2500);
          if ((sourceText.value.trim() || currentAttachedImage) && !targetText.value.trim()) {
            performTranslation();
          }
        }
      } else {
        throw new Error('Respuesta no válida');
      }
    } catch {
      wasBackendDisconnected = true;
      backendStatusPill.className = 'status-pill status-error';
      backendStatusText.textContent = 'Backend desconectado (Inicia Docker)';
    } finally {
      isCheckingBackend = false;
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
      if (tabPromptBtn) tabPromptBtn.classList.remove('active');
      textTranslationSection.classList.remove('hidden');
      if (historySection) historySection.classList.remove('hidden');
      fileTranslationSection.classList.add('hidden');

      // Restaurar interfaz de traducción estándar
      if (sourceCardTitle) sourceCardTitle.textContent = 'Texto original';
      if (targetCardTitle) targetCardTitle.textContent = 'Traducción';
      sourceText.placeholder = 'Escribe o pega texto aquí... (Ej: Which categories do they fit? (pick any that fit, or none))';
      targetText.placeholder = 'La traducción aparecerá aquí...';
      if (copyBtn) copyBtn.title = 'Copiar traducción';
    } else if (mode === 'prompt') {
      currentTab = 'prompt';
      if (tabPromptBtn) tabPromptBtn.classList.add('active');
      tabTextBtn.classList.remove('active');
      tabFileBtn.classList.remove('active');
      textTranslationSection.classList.remove('hidden');
      if (historySection) historySection.classList.remove('hidden');
      fileTranslationSection.classList.add('hidden');

      // Adaptar interfaz para Generación de Prompts (Programación)
      if (sourceCardTitle) sourceCardTitle.textContent = 'Requerimiento / Código / Captura';
      if (targetCardTitle) targetCardTitle.textContent = 'Prompt en Inglés (Programación)';
      sourceText.placeholder = 'Describe en español lo que deseas programar, pega código o pega una captura con Ctrl+V...';
      targetText.placeholder = 'El prompt perfeccionado en inglés optimizado para asistentes de código (Cursor, Claude, ChatGPT, etc.) aparecerá aquí...';
      if (copyBtn) copyBtn.title = 'Copiar Prompt';

      showStickyToast('⚡ Modo Prompt de Programación activo (Inglés optimizado)', 'info', 2500);

      if (sourceText.value.trim() || currentAttachedImage) {
        triggerTranslationDebounced();
      }
    } else {
      currentTab = 'file';
      tabFileBtn.classList.add('active');
      tabTextBtn.classList.remove('active');
      if (tabPromptBtn) tabPromptBtn.classList.remove('active');
      textTranslationSection.classList.add('hidden');
      if (historySection) historySection.classList.add('hidden');
      fileTranslationSection.classList.remove('hidden');
    }

    // Actualizar títulos del encabezado y title del documento según la pestaña activa
    updateHeaderTitles();
  }

  // ========================================================
  // Manejo de Imágenes Adjuntas o Pegadas (Multimodal)
  // ========================================================
  function handleImageFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      showStickyToast('El archivo no es una imagen válida', 'warning', 3000);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      currentAttachedImage = {
        dataUrl: e.target.result,
        name: file.name || 'Captura de pantalla',
        size: file.size
      };

      if (imagePreviewThumb) imagePreviewThumb.src = currentAttachedImage.dataUrl;
      if (imagePreviewName) imagePreviewName.textContent = currentAttachedImage.name;
      if (imagePreviewContainer) imagePreviewContainer.classList.remove('hidden');

      // Si hay una IA activa y no estamos en la pestaña prompt, activarla automáticamente
      const activeProviders = getActiveProviders();
      if (activeProviders.length > 0 && currentTab !== 'prompt') {
        switchTab('prompt');
      }

      showStickyToast('📷 Imagen cargada (interpretación multimodal activa)', 'success', 2500);
      triggerTranslationDebounced();
    };
    reader.readAsDataURL(file);
  }

  function removeAttachedImage(showToast = true, triggerTranslate = true) {
    currentAttachedImage = null;
    if (imagePreviewThumb) imagePreviewThumb.src = '';
    if (imagePreviewContainer) imagePreviewContainer.classList.add('hidden');
    if (imageFileInput) imageFileInput.value = '';
    if (showToast) showStickyToast('Imagen eliminada', 'info', 2000);
    if (triggerTranslate) triggerTranslationDebounced();
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
    if (downloadFileBtn) {
      downloadFileBtn.style.pointerEvents = 'auto';
      downloadFileBtn.style.opacity = '1';
    }
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

    // Integrar refinamiento con IA si hay un motor activo seleccionado
    const activeProviders = getActiveProviders();
    const selectedAi = activeAiSelect ? activeAiSelect.value : 'none';
    const isAiActive = selectedAi !== 'none' && activeProviders.includes(selectedAi) && aiConfig[selectedAi];

    if (isAiActive) {
      formData.append('aiProvider', selectedAi);
      formData.append('aiModel', aiConfig[selectedAi].model || '');
      formData.append('aiApiKey', aiConfig[selectedAi].apiKey || '');
      formData.append('useFreeTier', aiConfig[selectedAi].useFreeTier ? 'true' : 'false');
      if (fileProgressText) {
        fileProgressText.textContent = `Traduciendo y perfeccionando archivo con ${aiConfig[selectedAi].name}... por favor espera.`;
      }
    } else {
      if (fileProgressText) {
        fileProgressText.textContent = 'Traduciendo archivo localmente... por favor espera.';
      }
    }

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
      downloadFileBtn.style.pointerEvents = 'auto';
      downloadFileBtn.style.opacity = '1';
      const originalName = selectedFile.name;
      const lastDot = originalName.lastIndexOf('.');
      const ext = lastDot !== -1 ? originalName.substring(lastDot) : '';
      const base = lastDot !== -1 ? originalName.substring(0, lastDot) : originalName;
      downloadFileBtn.setAttribute('download', `${base}_${effectiveTarget}${ext}`);

      fileProgressContainer.classList.add('hidden');
      fileResultContainer.classList.remove('hidden');

      if (result.refined) {
        if (fileResultTitle) fileResultTitle.textContent = `¡Traducción perfeccionada con ${result.aiProvider ? result.aiProvider.toUpperCase() : 'IA'}!`;
        if (fileResultDesc) fileResultDesc.textContent = 'El documento ha sido traducido y refinado con máxima fluidez y naturalidad. Por privacidad, el archivo se eliminará del servidor de inmediato tras descargarlo.';
        showStickyToast(`¡Archivo traducido y perfeccionado con ${result.aiProvider || 'IA'}! (Descarga efímera)`, 'success', 4500);
      } else {
        if (fileResultTitle) fileResultTitle.textContent = '¡Traducción completada!';
        if (fileResultDesc) fileResultDesc.textContent = 'Tu archivo traducido está listo para descargar. Se eliminará del servidor de inmediato tras descargarlo.';
        showStickyToast(`¡Archivo traducido con éxito a ${LANG_NAMES[effectiveTarget] || effectiveTarget.toUpperCase()}!`, 'success', 4000);
      }
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

    // Pestañas (Modo Texto vs Modo Archivos vs Generar Prompt)
    if (tabTextBtn) tabTextBtn.addEventListener('click', () => switchTab('text'));
    if (tabFileBtn) tabFileBtn.addEventListener('click', () => switchTab('file'));
    if (tabPromptBtn) tabPromptBtn.addEventListener('click', () => switchTab('prompt'));

    // Gestión de Imágenes (Pegado con Ctrl+V, Drag & Drop y Selector)
    if (attachImgBtn && imageFileInput) {
      attachImgBtn.addEventListener('click', () => imageFileInput.click());
      imageFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          handleImageFile(e.target.files[0]);
        }
      });
    }

    if (imageRemoveBtn) {
      imageRemoveBtn.addEventListener('click', removeAttachedImage);
    }

    // Drag & Drop de imágenes sobre la tarjeta de texto origen
    if (sourceCard) {
      sourceCard.addEventListener('dragover', (e) => {
        e.preventDefault();
        sourceCard.classList.add('drag-over');
      });
      sourceCard.addEventListener('dragleave', () => {
        sourceCard.classList.remove('drag-over');
      });
      sourceCard.addEventListener('drop', (e) => {
        e.preventDefault();
        sourceCard.classList.remove('drag-over');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const file = e.dataTransfer.files[0];
          if (file.type.startsWith('image/')) {
            handleImageFile(file);
          }
        }
      });
    }

    // Pegar imágenes directamente desde el portapapeles (Ctrl+V)
    document.addEventListener('paste', (e) => {
      if (e.clipboardData && e.clipboardData.items) {
        for (let i = 0; i < e.clipboardData.items.length; i++) {
          const item = e.clipboardData.items[i];
          if (item.type.indexOf('image') !== -1) {
            const file = item.getAsFile();
            if (file) {
              e.preventDefault();
              handleImageFile(file);
              return;
            }
          }
        }
      }
    });

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

    if (downloadFileBtn) {
      downloadFileBtn.addEventListener('click', () => {
        setTimeout(() => {
          showStickyToast('Archivo descargado. Ha sido eliminado del servidor por privacidad.', 'info', 4000);
          downloadFileBtn.style.pointerEvents = 'none';
          downloadFileBtn.style.opacity = '0.5';
          if (fileResultDesc) {
            fileResultDesc.textContent = 'El archivo ya ha sido descargado y eliminado del servidor.';
          }
        }, 800);
      });
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

    // Configuración Administrativa de IAs
    if (adminSettingsBtn) {
      adminSettingsBtn.addEventListener('click', openAdminModal);
    }

    if (adminCloseBtn) {
      adminCloseBtn.addEventListener('click', closeAdminModal);
    }

    if (adminCancelBtn) {
      adminCancelBtn.addEventListener('click', closeAdminModal);
    }

    if (adminModal) {
      adminModal.addEventListener('click', (e) => {
        if (e.target === adminModal) closeAdminModal();
      });
    }

    // Toggle de visibilidad de contraseñas/keys
    const FA_EYE_SVG = '<svg class="icon-eye" viewBox="0 0 576 512" width="14" height="14" fill="currentColor"><path d="M288 32c-80.8 0-145.5 36.8-192.6 80.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.8-35.7-46.1-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-72.8-89.8-78.4c-5.9-.8-10.9 3.8-10.3 9.7c.7 6.4 1.4 12.9 1.4 19.6z"/></svg>';
    const FA_EYE_SLASH_SVG = '<svg class="icon-eye-slash" viewBox="0 0 640 512" width="14" height="14" fill="currentColor"><path d="M38.8 5.1C28.4-3.1 13.3-1.2 5.1 9.2S-1.2 34.7 9.2 42.9l592 464c10.4 8.2 25.5 6.3 33.7-4.1s6.3-25.5-4.1-33.7L526 386.4c52.2-46.7 87.8-100.8 101.4-133.5c3.3-7.9 3.3-16.7 0-24.6c-14.8-35.7-46.1-87.7-93-131.1C487.4 53.4 422.7 16 341.9 16c-64.8 0-119 23.9-162.2 56.4L38.8 5.1zM288 336a80 80 0 0 1 -80-80c0-12.2 2.7-23.7 7.7-34l106.3 83.3c-10.3 5-21.8 7.7-34 7.7zm134.4-49.3l-156-122.2C274.6 161.6 281.2 160 288 160a96 96 0 0 1 96 96c0 6.8-1.6 13.4-4.4 19.3zM95.4 112.6C48.6 156 17.3 208 2.5 243.7c-3.3 7.9-3.3 16.7 0 24.6C17.3 304 48.6 356 95.4 399.4C142.5 443.2 207.2 480 288 480s145.5-36.8 192.6-80.6c46.8-43.5 78.1-95.4 93-131.1c3.3-7.9 3.3-16.7 0-24.6c-14.8-35.7-46.1-87.7-93-131.1C433.5 68.8 368.8 32 288 32zM144 256a144 144 0 1 1 288 0 144 144 0 1 1 -288 0zm144-64c0 35.3-28.7 64-64 64c-7.1 0-13.9-1.2-20.3-3.3c-5.5-1.8-11.9 1.6-11.7 7.4c.3 6.9 1.3 13.8 3.2 20.7c13.7 51.2 66.4 81.6 117.6 67.9s81.6-66.4 67.9-117.6c-11.1-41.5-47.8-72.8-89.8-78.4c-5.9-.8-10.9 3.8-10.3 9.7c.7 6.4 1.4 12.9 1.4 19.6z"/></svg>';

    document.querySelectorAll('.btn-toggle-visibility').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const input = document.getElementById(targetId);
        if (input) {
          if (input.type === 'password') {
            input.type = 'text';
            btn.innerHTML = FA_EYE_SLASH_SVG;
          } else {
            input.type = 'password';
            btn.innerHTML = FA_EYE_SVG;
          }
        }
      });
    });

    // Navegación por pestañas entre IAs en el modal administrativo
    document.querySelectorAll('.ai-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const prov = btn.getAttribute('data-provider');
        switchAiTab(prov);
      });
    });

    // Botón 1: Probar Conexión de API Key (comprueba credenciales y sincroniza modelos)
    document.querySelectorAll('.btn-test-api').forEach(btn => {
      btn.addEventListener('click', async () => {
        const provider = btn.getAttribute('data-provider');
        const keyInput = document.getElementById(`ai-key-${provider}`);
        const freeToggle = document.getElementById(`ai-free-toggle-${provider}`);
        const statusPill = document.getElementById(`test-status-api-${provider}`);

        const keyVal = keyInput ? keyInput.value.trim() : '';
        const useFree = provider === 'gemini' && freeToggle ? freeToggle.checked : (provider === 'gemini' && !!aiConfig.gemini?.useFreeTier);

        if (!keyVal && !useFree) {
          if (statusPill) {
            statusPill.textContent = '✗ Falta API Key';
            statusPill.className = 'test-pill error show';
          }
          const msg = provider === 'gemini'
            ? 'Ingresa una API Key o activa la cuota gratuita para GEMINI'
            : `Ingresa tu API Key personal para ${provider.toUpperCase()}`;
          showStickyToast(msg, 'warning', 3500);
          return;
        }

        if (statusPill) {
          statusPill.textContent = 'Verificando API...';
          statusPill.className = 'test-pill loading show';
        }

        try {
          const resp = await fetch('/api/ai_models', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: provider,
              apiKey: keyVal,
              useFreeTier: useFree
            })
          });

          const data = await resp.json();
          if (resp.ok && data.status === 'ok' && Array.isArray(data.models) && data.models.length > 0) {
            modelsCache[provider] = data.models;
            populateModelSelect(provider, data.models, aiConfig[provider]?.model);

            if (statusPill) {
              statusPill.textContent = `✓ API OK (${data.models.length} modelos)`;
              statusPill.className = 'test-pill success show';
            }
            showStickyToast(`Conexión con la API de ${provider.toUpperCase()} exitosa. ${data.models.length} modelos sincronizados.`, 'success', 3000);
            loadFreeQuotaStatus();
            updateTabStatusChips();
          } else {
            throw new Error(data.error || 'Fallo de autenticación con la API');
          }
        } catch (err) {
          if (statusPill) {
            statusPill.textContent = `✗ API: ${err.message}`;
            statusPill.className = 'test-pill error show';
          }
          showStickyToast(`Error de API en ${provider}: ${err.message}`, 'danger', 4000);
        }
      });
    });

    // Botón 2: Probar Modelo Seleccionado (envía una inferencia de prueba técnica y mide latencia)
    document.querySelectorAll('.btn-test-model').forEach(btn => {
      btn.addEventListener('click', async () => {
        const provider = btn.getAttribute('data-provider');
        const keyInput = document.getElementById(`ai-key-${provider}`);
        const freeToggle = document.getElementById(`ai-free-toggle-${provider}`);
        const modelSelect = document.getElementById(`ai-model-${provider}`);
        const statusPill = document.getElementById(`test-status-model-${provider}`);

        const keyVal = keyInput ? keyInput.value.trim() : '';
        const useFree = provider === 'gemini' && freeToggle ? freeToggle.checked : (provider === 'gemini' && !!aiConfig.gemini?.useFreeTier);
        const modelVal = modelSelect ? modelSelect.value : '';

        if (!keyVal && !useFree) {
          if (statusPill) {
            statusPill.textContent = '✗ Falta API Key';
            statusPill.className = 'test-pill error show';
          }
          showStickyToast(`Ingresa tu API Key para probar el modelo de ${provider.toUpperCase()}`, 'warning', 3500);
          return;
        }

        if (!modelVal) {
          if (statusPill) {
            statusPill.textContent = '✗ Sin modelo';
            statusPill.className = 'test-pill error show';
          }
          showStickyToast('Selecciona un modelo del desplegable para probarlo', 'warning', 3500);
          return;
        }

        if (statusPill) {
          statusPill.textContent = `Invocando ${modelVal}...`;
          statusPill.className = 'test-pill loading show';
        }

        try {
          const resp = await fetch('/api/ai_refine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: provider,
              apiKey: keyVal,
              useFreeTier: useFree,
              model: modelVal,
              testModelOnly: true
            })
          });

          const data = await resp.json();
          if (resp.ok && data.status === 'ok') {
            const lat = data.latencyMs ? ` (${data.latencyMs}ms)` : '';
            if (statusPill) {
              statusPill.textContent = `✓ Modelo OK${lat}`;
              statusPill.className = 'test-pill success show';
            }
            showStickyToast(`Modelo '${modelVal}' respondió OK${lat}`, 'success', 3000);
          } else {
            throw new Error(data.error || 'El modelo no respondió');
          }
        } catch (err) {
          if (statusPill) {
            statusPill.textContent = `✗ Modelo: ${err.message}`;
            statusPill.className = 'test-pill error show';
          }
          showStickyToast(`Error en modelo ${modelVal}: ${err.message}`, 'danger', 4000);
        }
      });
    });

    // Checkbox para alternar cuota gratuita en Gemini
    const geminiFreeChk = document.getElementById('ai-free-toggle-gemini');
    if (geminiFreeChk) {
      geminiFreeChk.addEventListener('change', () => {
        const isFree = geminiFreeChk.checked;
        syncKeyInputWithFreeTier('gemini', isFree);
        if (isFree) {
          fetchModelsForProvider('gemini', false);
          showStickyToast('Cuota gratuita activada para GEMINI', 'info', 2000);
        }
      });
    }

    // Botones de eliminar clave con modal de confirmación
    document.querySelectorAll('.btn-clear-key').forEach(btn => {
      btn.addEventListener('click', () => {
        const provider = btn.getAttribute('data-provider');
        const provName = aiConfig[provider]?.name || provider;

        showConfirmModal(
          '¿Eliminar clave de API?',
          `¿Estás seguro de que deseas eliminar la API Key de ${provName}?`,
          () => {
            if (aiConfig[provider]) {
              aiConfig[provider].apiKey = '';
              // Si no tiene cuota gratuita activada, desactivar el switch
              if (provider !== 'gemini' || !aiConfig[provider].useFreeTier) {
                aiConfig[provider].enabled = false;
              }
            }
            const keyInput = document.getElementById(`ai-key-${provider}`);
            const toggle = document.getElementById(`ai-toggle-${provider}`);
            const statusSpan = document.getElementById(`test-status-${provider}`);
            if (keyInput) keyInput.value = '';
            if (toggle && (provider !== 'gemini' || !aiConfig[provider]?.useFreeTier)) toggle.checked = false;
            if (statusSpan) statusSpan.textContent = '';

            saveAiConfig(aiConfig);
            updateAiUIState();
            updateTabStatusChips();
            showStickyToast(`Clave de ${provName} eliminada`, 'info', 3000);
          }
        );
      });
    });

    // Carga dinámica de modelos al activar interruptor de IA
    document.querySelectorAll('.ai-toggle-checkbox').forEach(toggle => {
      toggle.addEventListener('change', () => {
        const card = toggle.closest('.ai-card');
        const provider = card ? card.getAttribute('data-provider') : toggle.id.replace('ai-toggle-', '');
        const keyInput = document.getElementById(`ai-key-${provider}`);
        const freeToggle = document.getElementById(`ai-free-toggle-${provider}`);
        const keyVal = keyInput ? keyInput.value.trim() : (aiConfig[provider]?.apiKey || '');
        const useFree = provider === 'gemini' && freeToggle ? freeToggle.checked : (provider === 'gemini' && !!aiConfig.gemini?.useFreeTier);

        updateTabStatusChips();

        if (toggle.checked) {
          if (keyVal || useFree) {
            // Actualizar lista de modelos en tiempo real inmediatamente al conectar la IA
            fetchModelsForProvider(provider, true);
          } else {
            showStickyToast(`Ingresa tu API Key para cargar los modelos disponibles de ${provider.toUpperCase()}`, 'info', 3000);
          }
        }
      });
    });

    // Carga dinámica de modelos reactiva al escribir o pegar la API Key
    const keyInputDebounces = {};
    document.querySelectorAll('.ai-key-input').forEach(input => {
      const triggerRefresh = (force = false) => {
        const card = input.closest('.ai-card');
        const provider = card ? card.getAttribute('data-provider') : input.id.replace('ai-key-', '');
        const keyVal = input.value.trim();
        if (keyVal && keyVal.length >= 8) {
          fetchModelsForProvider(provider, force);
        }
      };

      input.addEventListener('change', () => triggerRefresh(true));
      input.addEventListener('paste', () => setTimeout(() => triggerRefresh(true), 150));
      input.addEventListener('input', () => {
        const provider = input.id.replace('ai-key-', '');
        clearTimeout(keyInputDebounces[provider]);
        keyInputDebounces[provider] = setTimeout(() => triggerRefresh(true), 600);
      });
    });

    // Botones para refrescar modelos disponibles en tiempo real
    document.querySelectorAll('.btn-refresh-models').forEach(btn => {
      btn.addEventListener('click', () => {
        const provider = btn.getAttribute('data-provider');
        fetchModelsForProvider(provider, true);
      });
    });

    // Guardar configuración de IAs
    if (adminSaveBtn) {
      adminSaveBtn.addEventListener('click', () => {
        ['gemini', 'claude', 'chatgpt', 'deepseek', 'meta', 'openrouter', 'cerebras'].forEach(p => {
          const toggle = document.getElementById(`ai-toggle-${p}`);
          const freeToggle = document.getElementById(`ai-free-toggle-${p}`);
          const keyInput = document.getElementById(`ai-key-${p}`);
          const modelSelect = document.getElementById(`ai-model-${p}`);

          if (!aiConfig[p]) aiConfig[p] = {};
          aiConfig[p].enabled = toggle ? toggle.checked : false;
          if (p === 'gemini') {
            aiConfig[p].useFreeTier = freeToggle ? freeToggle.checked : false;
          } else {
            aiConfig[p].useFreeTier = false;
          }
          aiConfig[p].apiKey = keyInput ? keyInput.value.trim() : '';
          if (modelSelect) aiConfig[p].model = modelSelect.value;

          // Si no tiene clave ni cuota gratuita en gemini, no puede estar activo
          if (!aiConfig[p].apiKey && !(p === 'gemini' && aiConfig[p].useFreeTier)) {
            aiConfig[p].enabled = false;
          }
        });

        saveAiConfig(aiConfig);
        updateAiUIState();
        closeAdminModal();
        showStickyToast('Configuración de IAs guardada con éxito', 'success', 3000);

        // Si ya hay texto o imagen, re-traducir para activar el refinamiento con la IA recién guardada
        if (sourceText.value.trim() || currentAttachedImage) {
          performTranslation();
        }
      });
    }

    // Cambio en el selector de IA del formulario (Ubicación 3)
    if (activeAiSelect) {
      activeAiSelect.addEventListener('change', () => {
        localStorage.setItem(SELECTED_AI_KEY, activeAiSelect.value);
        updateAiTierBadge();
        const selVal = activeAiSelect.value;
        if (selVal !== 'none' && aiConfig[selVal]) {
          showStickyToast(`Refinamiento activo con ${aiConfig[selVal].name}`, 'info', 2000);
        } else {
          showStickyToast('Modo solo traducción local activado', 'info', 2000);
        }
        if (sourceText.value.trim()) {
          performTranslation();
        }
      });
    }

    // Inicializar estado de las IAs
    updateAiUIState();

    // Sincronizar en segundo plano con el servidor si existe config previa
    fetch('/api/ai_config')
      .then(res => res.json())
      .then(serverCfg => {
        if (serverCfg && Object.keys(serverCfg).length > 0) {
          let changed = false;
          Object.keys(serverCfg).forEach(k => {
            if (serverCfg[k] && serverCfg[k].apiKey && (!aiConfig[k] || !aiConfig[k].apiKey)) {
              aiConfig[k] = serverCfg[k];
              changed = true;
            }
          });
          if (changed) {
            saveAiConfig(aiConfig);
            updateAiUIState();
          }
        }
      })
      .catch(() => {});

    renderHistory();
    loadFreeQuotaStatus();
    checkBackendStatus();
    parseQueryParams();

    // Reintentar conectar si el backend está iniciando o se reinicia
    setInterval(() => {
      checkBackendStatus();
    }, wasBackendDisconnected ? 3500 : 8000);

    // Clic sobre el pill de estado para forzar reconexión manual
    if (backendStatusPill) {
      backendStatusPill.style.cursor = 'pointer';
      backendStatusPill.title = 'Clic para comprobar conexión con Docker / Backend';
      backendStatusPill.addEventListener('click', () => {
        showStickyToast('Comprobando conexión con Docker...', 'info', 1500);
        checkBackendStatus();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
