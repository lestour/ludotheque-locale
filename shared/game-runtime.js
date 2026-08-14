(() => {
  if (window.GameRuntime) return;

  const storagePrefix = 'ludotheque:v1';

  function hashSeed(value) {
    const text = String(value ?? '');
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0 || 0x9e3779b9;
  }

  function createRandom(seed = Date.now()) {
    let state = hashSeed(seed);
    const random = () => {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
    random.seed = String(seed);
    random.state = () => state >>> 0;
    return random;
  }

  function shuffle(values, random = Math.random) {
    const result = values.slice();
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  function clone(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function createHistory(initialState, options = {}) {
    const limit = Math.max(2, Number(options.limit) || 200);
    const copy = options.clone || clone;
    let entries = [copy(initialState)];
    let index = 0;
    return {
      push(state) {
        entries = entries.slice(0, index + 1);
        entries.push(copy(state));
        if (entries.length > limit) entries.shift();
        index = entries.length - 1;
        return copy(entries[index]);
      },
      undo() { if (index > 0) index -= 1; return copy(entries[index]); },
      redo() { if (index < entries.length - 1) index += 1; return copy(entries[index]); },
      current() { return copy(entries[index]); },
      reset(state) { entries = [copy(state)]; index = 0; return copy(entries[0]); },
      get canUndo() { return index > 0; },
      get canRedo() { return index < entries.length - 1; },
      get length() { return entries.length; }
    };
  }

  function storageKey(namespace, key) { return `${storagePrefix}:${namespace}:${key}`; }
  const storage = {
    save(namespace, key, value) {
      try { localStorage.setItem(storageKey(namespace, key), JSON.stringify({ version: 1, savedAt: Date.now(), value })); return true; }
      catch { return false; }
    },
    load(namespace, key, fallback = null) {
      try { const data = JSON.parse(localStorage.getItem(storageKey(namespace, key)) || 'null'); return data?.version === 1 ? data.value : fallback; }
      catch { return fallback; }
    },
    remove(namespace, key) { try { localStorage.removeItem(storageKey(namespace, key)); } catch {} },
    key: storageKey
  };

  function settingsSignature(root = document) {
    return [...root.querySelectorAll('select[id],input[id][type="checkbox"],input[id][type="radio"],input[id][type="number"],input[id][type="range"]')]
      .filter(control => !['sound', 'volume', 'effects', 'haptics', 'errors', 'showErrors'].includes(control.id))
      .map(control => `${control.id}=${control.type === 'checkbox' || control.type === 'radio' ? Number(control.checked) : control.value}`)
      .sort()
      .join('&') || 'default';
  }

  function createWorkerTask(handler, options = {}) {
    const timeout = Math.max(100, Number(options.timeout) || 15000);
    if (typeof Worker !== 'function' || typeof Blob !== 'function') return payload => Promise.resolve().then(() => handler(payload));
    const source = `self.onmessage=async event=>{try{const handler=(${handler.toString()});self.postMessage({ok:true,value:await handler(event.data)})}catch(error){self.postMessage({ok:false,error:error&&error.message?error.message:String(error)})}}`;
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    return payload => new Promise((resolve, reject) => {
      const worker = new Worker(url);
      const timer = setTimeout(() => { worker.terminate(); reject(new Error('Calcul interrompu : délai dépassé.')); }, timeout);
      worker.onmessage = event => {
        clearTimeout(timer);
        worker.terminate();
        if (event.data.ok) resolve(event.data.value);
        else reject(new Error(event.data.error));
      };
      worker.onerror = event => { clearTimeout(timer); worker.terminate(); reject(new Error(event.message || 'Erreur du calcul isolé.')); };
      worker.postMessage(payload);
    });
  }

  function randomSeed() {
    if (globalThis.crypto?.getRandomValues) { const data = new Uint32Array(2); crypto.getRandomValues(data); return `${data[0].toString(36)}-${data[1].toString(36)}`; }
    return `${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffffff).toString(36)}`;
  }

  function reproducibleRandom() {
    const seed = new URLSearchParams(location.search).get('seed');
    if (!seed) return null;
    const random = createRandom(seed);
    Math.random = random;
    return random;
  }

  function decodeLanOptions() {
    const encoded = new URLSearchParams(location.search).get('lanOptions');
    if (!encoded) return null;
    try {
      const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(escape(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))));
      const options = JSON.parse(json);
      return options && typeof options === 'object' && !Array.isArray(options) ? options : null;
    } catch { return null; }
  }

  function applyLanOptions(options, root = document) {
    if (!options) return false;
    Object.entries(options).forEach(([id, value]) => {
      const control = root.getElementById?.(id);
      if (!control || !control.matches('input,select,textarea')) return;
      if (control.type === 'checkbox' || control.type === 'radio') control.checked = Boolean(value);
      else control.value = String(value);
    });
    return true;
  }

  function rememberRecent(title = document.title || 'Jeu') {
    if (!location.pathname.includes('/games/')) return false;
    const gamePathIndex = location.pathname.lastIndexOf('/games/');
    const route = `${location.pathname.slice(gamePathIndex + 1)}${location.search}`;
    try {
      localStorage.setItem('game-hub:last-route', JSON.stringify({ route, title, visitedAt: Date.now() }));
      return true;
    } catch { return false; }
  }

  function activeProfileId() {
    try {
      const value = localStorage.getItem('game-hub:active-profile') || 'default';
      return /^[a-z0-9-]{1,32}$/i.test(value) ? value : 'default';
    } catch { return 'default'; }
  }

  function profileKey(key) {
    const profile = activeProfileId();
    return profile === 'default' ? key : `${key}:${profile}`;
  }

  function installControlPreferences() {
    if (!location.pathname.includes('/games/')) return;
    const key = profileKey(`game-hub:options:${location.pathname}`);
    let values = {};
    try { values = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}
    document.querySelectorAll('main select[id],main input[id]').forEach(control => {
      if (!(control.id in values) || ['file', 'button', 'submit', 'text', 'password'].includes(control.type)) return;
      if (control.type === 'checkbox' || control.type === 'radio') control.checked = Boolean(values[control.id]);
      else control.value = String(values[control.id]);
    });
    document.addEventListener('change', event => {
      const control = event.target;
      if (!control.matches?.('main select[id],main input[id]') || ['file', 'button', 'submit', 'text', 'password'].includes(control.type) || control.closest('[data-lan-ui]')) return;
      values[control.id] = control.type === 'checkbox' || control.type === 'radio' ? control.checked : control.value;
      try { localStorage.setItem(key, JSON.stringify(values)); } catch {}
    });
  }

  function createAutosave(name, handlers = {}) {
    const key = profileKey(`game-hub:autosave:${location.pathname}:${name}`);
    const profile = activeProfileId();
    const enabled = () => !new URLSearchParams(location.search).has('lan') && !window.LanMultiplayer?.active && (typeof handlers.enabled !== 'function' || handlers.enabled());
    const save = () => {
      if (!enabled() || typeof handlers.capture !== 'function') return false;
      try {
        const value = handlers.capture();
        if (value == null) return false;
        localStorage.setItem(key, JSON.stringify({
          version: 2,
          savedAt: Date.now(),
          profile,
          name,
          title: handlers.title || document.title || name,
          route: `${location.pathname}${location.search}`,
          value
        }));
        window.dispatchEvent(new CustomEvent('game-runtime:autosaved', { detail: { key, name } }));
        return true;
      } catch { return false; }
    };
    const restore = () => {
      if (!enabled() || typeof handlers.restore !== 'function') return false;
      try {
        const payload = JSON.parse(localStorage.getItem(key) || 'null');
        if (!payload || ![1, 2].includes(payload.version) || Date.now() - Number(payload.savedAt || 0) > (handlers.maxAge || 30 * 24 * 60 * 60 * 1000)) return false;
        if (typeof handlers.validate === 'function' && !handlers.validate(payload.value)) return false;
        handlers.restore(payload.value);
        return true;
      } catch { return false; }
    };
    const clear = () => { try { localStorage.removeItem(key); window.dispatchEvent(new CustomEvent('game-runtime:autosave-cleared', { detail: { key, name } })); } catch {} };
    const interval = window.setInterval(save, Math.max(1000, Number(handlers.interval) || 3000));
    window.addEventListener('pagehide', save);
    return { key, save, restore, clear, stop() { clearInterval(interval); window.removeEventListener('pagehide', save); } };
  }

  function listAutosaves(profile = activeProfileId()) {
    const saves = [];
    try {
      Object.keys(localStorage).filter(key => key.startsWith('game-hub:autosave:')).forEach(key => {
        let payload;
        try { payload = JSON.parse(localStorage.getItem(key) || 'null'); } catch { return; }
        if (!payload || ![1, 2].includes(payload.version)) return;
        const belongsToProfile = payload.profile ? payload.profile === profile : profile === 'default' ? !/:p-[a-z0-9-]+(?::|$)/i.test(key) : key.endsWith(`:${profile}`) || key.includes(`:${profile}:`);
        if (!belongsToProfile) return;
        const route = payload.route || key.slice('game-hub:autosave:'.length).split(/:[^/]*$/)[0];
        saves.push({ key, name: payload.name || key.split(':').at(-1), title: payload.title || route.split('/').pop() || 'Partie', route, savedAt: Number(payload.savedAt || 0), bytes: new Blob([localStorage.getItem(key) || '']).size });
      });
    } catch {}
    return saves.sort((left, right) => right.savedAt - left.savedAt);
  }

  function removeAutosave(key) {
    if (typeof key !== 'string' || !key.startsWith('game-hub:autosave:')) return false;
    try { localStorage.removeItem(key); return true; } catch { return false; }
  }

  function installMobileLayout() {
    if (!location.pathname.includes('/games/') || document.querySelector('style[data-mobile-layout]')) return;
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport && !viewport.content.includes('viewport-fit')) viewport.content = `${viewport.content}, viewport-fit=cover`;
    if (!document.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
      const capable = document.createElement('meta');
      capable.name = 'apple-mobile-web-app-capable';
      capable.content = 'yes';
      document.head.appendChild(capable);
    }
    const style = document.createElement('style');
    style.dataset.mobileLayout = 'true';
    style.textContent = `
      html{-webkit-text-size-adjust:100%;text-size-adjust:100%}body{max-width:100%;overflow-x:hidden;padding-bottom:env(safe-area-inset-bottom)}
      main,.panel,.layout,.game-layout,.side,aside,section{min-width:0;box-sizing:border-box}.toolbar,.bar,.actions,.controls,.rules{max-width:100%;box-sizing:border-box}.board-wrap,.stage-wrap,.goban-wrap{max-width:100%;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
      button,a,select,input,label,[role="button"]{touch-action:manipulation}dialog{max-width:calc(100vw - 20px);max-height:calc(100dvh - 20px);box-sizing:border-box;overscroll-behavior:contain}.hand{max-width:100%;overscroll-behavior-inline:contain}
      :where(.board,.grid,.goban,.hand,.tableau,.mahjong-board,.player-area){-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
      @media(max-width:760px){
        main{width:100%;max-width:100%!important;padding:10px!important;margin-inline:0!important}.layout,.game-layout{width:100%;max-width:100%;padding:10px!important;gap:10px!important}
        .panel{width:100%;max-width:100%;padding:11px!important;border-radius:12px!important}.toolbar,.bar,.actions,.controls,.rules{gap:7px!important}
        :where(button,a,[role="button"]):not(.cell):not(.card):not(.tile):not(.piece):not(.image-block){min-height:42px}select,input[type="text"],input[type="number"],input[type="file"],textarea{max-width:100%;min-height:42px;font-size:16px!important;box-sizing:border-box}
        input[type="range"]{min-height:34px}.hand{overflow-x:auto;flex-wrap:nowrap!important;justify-content:flex-start!important;padding:8px 2px 14px;-webkit-overflow-scrolling:touch}
        .hand>.card,.hand>button,.hand>span{flex:0 0 auto}.side{width:100%;max-width:100%}table{display:block;max-width:100%;overflow:auto}.muted{line-height:1.4}
        #lanButton{left:max(10px,env(safe-area-inset-left))!important;right:auto!important;bottom:max(10px,env(safe-area-inset-bottom))!important}
      }
      @media(max-width:480px){h1{font-size:1.55rem}h2{font-size:1.25rem}.toolbar>h1,.bar>h1{width:100%;margin-right:0!important}.toolbar>label,.bar>label{max-width:100%}}
      @media(hover:none){button:hover,a:hover,[role="button"]:hover{transform:none}}
    `;
    document.head.appendChild(style);
    document.documentElement.classList.toggle('touch-device', matchMedia('(pointer:coarse)').matches);
  }

  function installAccessibilityPreferences() {
    if (document.querySelector('[data-accessibility-preferences]')) return;
    const storageKey = 'game-hub:accessibility';
    const defaults = { fontScale: 100, highContrast: false, reduceMotion: false, theme: 'auto' };
    let preferences = defaults;
    try { preferences = { ...defaults, ...JSON.parse(localStorage.getItem(storageKey) || '{}') }; } catch {}

    const apply = () => {
      const fontScale = Math.max(85, Math.min(140, Number(preferences.fontScale) || 100));
      document.documentElement.style.setProperty('--app-font-scale', `${fontScale / 100}`);
      document.documentElement.classList.toggle('app-high-contrast', Boolean(preferences.highContrast));
      document.documentElement.classList.toggle('app-reduce-motion', Boolean(preferences.reduceMotion));
      document.documentElement.classList.toggle('app-theme-dark', preferences.theme === 'dark');
      document.documentElement.classList.toggle('app-theme-light', preferences.theme === 'light');
    };
    const save = () => {
      try { localStorage.setItem(storageKey, JSON.stringify(preferences)); } catch {}
      apply();
    };
    apply();

    const style = document.createElement('style');
    style.dataset.accessibilityPreferences = 'true';
    style.textContent = `
      html{font-size:calc(16px * var(--app-font-scale,1))}
      html.app-reduce-motion *,html.app-reduce-motion *::before,html.app-reduce-motion *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important;transition-duration:.001ms!important}
      html.app-high-contrast{filter:contrast(1.16)}html.app-high-contrast :focus-visible{outline:4px solid #f59e0b!important;outline-offset:3px!important}
      html.app-theme-dark{color-scheme:dark;background:#101827!important;color:#e8eef8!important}html.app-theme-dark body,html.app-theme-dark main{background:#101827!important;color:#e8eef8!important}html.app-theme-dark :where(.panel,.side,aside,dialog){background:#172235!important;color:#e8eef8!important;border-color:#52637d!important}html.app-theme-dark :where(button,select,input,textarea){background:#263447;color:#f1f5fb;border-color:#60718a}
      html.app-theme-light{color-scheme:light;background:#f3f6fb!important;color:#17243a!important}html.app-theme-light body,html.app-theme-light main{background:#f3f6fb!important;color:#17243a!important}html.app-theme-light :where(.panel,.side,aside,dialog){background:#fff!important;color:#17243a!important;border-color:#cbd5e1!important}html.app-theme-light :where(button,select,input,textarea){background:#fff;color:#17243a;border-color:#94a3b8}
      #accessibilityButton{position:fixed;right:max(14px,env(safe-area-inset-right));top:max(14px,env(safe-area-inset-top));z-index:2147478000;width:44px;height:44px;padding:0;border:2px solid #fff;border-radius:50%;background:#334155;color:#fff;font:700 22px system-ui;box-shadow:0 4px 16px #0006;cursor:pointer}
      #accessibilityDialog{z-index:2147482000;width:min(420px,calc(100vw - 24px));box-sizing:border-box;border:1px solid #64748b;border-radius:16px;padding:18px;background:#fff;color:#172033;box-shadow:0 20px 70px #0008}
      #accessibilityDialog::backdrop{background:#07111fcc;backdrop-filter:blur(3px)}#accessibilityDialog form{display:grid;gap:14px}#accessibilityDialog header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0;background:none;color:inherit}#accessibilityDialog h2{margin:0}#accessibilityDialog label{display:grid;grid-template-columns:1fr auto;align-items:center;gap:12px}#accessibilityDialog input[type=range]{width:min(190px,45vw)}#accessibilityDialog button{padding:8px 12px;border:1px solid #94a3b8;border-radius:9px;background:#f8fafc;color:#172033;cursor:pointer}
      @media(prefers-color-scheme:dark){#accessibilityDialog{background:#172235;color:#e5edf8}#accessibilityDialog button{background:#25344b;color:#e5edf8;border-color:#64748b}}
      @media(max-width:760px){#accessibilityButton{top:max(8px,env(safe-area-inset-top));right:max(8px,env(safe-area-inset-right));width:42px;height:42px}}
    `;
    document.head.appendChild(style);

    const button = document.createElement('button');
    button.id = 'accessibilityButton';
    button.type = 'button';
    button.title = 'Accessibilité';
    button.setAttribute('aria-label', 'Ouvrir les réglages d’accessibilité');
    button.textContent = '♿';
    document.body.appendChild(button);

    const dialog = document.createElement('dialog');
    dialog.id = 'accessibilityDialog';
    dialog.innerHTML = `<form method="dialog"><header><h2>Affichage et accessibilité</h2><button aria-label="Fermer">×</button></header><label>Thème <select id="appTheme"><option value="auto">Système</option><option value="light">Clair</option><option value="dark">Sombre</option></select></label><label>Taille du texte <span><input id="appFontScale" type="range" min="85" max="140" step="5"><output id="appFontScaleValue"></output></span></label><label>Contraste renforcé <input id="appHighContrast" type="checkbox"></label><label>Réduire les animations <input id="appReduceMotion" type="checkbox"></label><button id="appAccessibilityReset" type="button">Valeurs par défaut</button></form>`;
    document.body.appendChild(dialog);
    const fontScale = dialog.querySelector('#appFontScale');
    const fontScaleValue = dialog.querySelector('#appFontScaleValue');
    const highContrast = dialog.querySelector('#appHighContrast');
    const reduceMotion = dialog.querySelector('#appReduceMotion');
    const theme = dialog.querySelector('#appTheme');
    const syncControls = () => {
      fontScale.value = preferences.fontScale;
      fontScaleValue.value = `${preferences.fontScale} %`;
      highContrast.checked = preferences.highContrast;
      reduceMotion.checked = preferences.reduceMotion;
      theme.value = preferences.theme;
    };
    const update = () => {
      preferences = { fontScale: Number(fontScale.value), highContrast: highContrast.checked, reduceMotion: reduceMotion.checked, theme: theme.value };
      fontScaleValue.value = `${preferences.fontScale} %`;
      save();
    };
    fontScale.addEventListener('input', update);
    highContrast.addEventListener('change', update);
    reduceMotion.addEventListener('change', update);
    theme.addEventListener('change', update);
    dialog.querySelector('#appAccessibilityReset').addEventListener('click', () => { preferences = { ...defaults }; syncControls(); save(); });
    button.addEventListener('click', () => { syncControls(); if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', ''); });
  }

  function mobileInterface(root = document) {
    const viewport = root.querySelector('meta[name="viewport"]');
    const layoutStyle = root.querySelector('style[data-mobile-layout]');
    const scrollRegions = root.querySelectorAll('.board-wrap,.stage-wrap,.goban-wrap,.hand,.tableau,.viewport,[class*="viewport"]').length;
    return {
      viewport: Boolean(viewport?.content.includes('width=device-width')),
      viewportFit: Boolean(viewport?.content.includes('viewport-fit=cover')),
      layoutInstalled: Boolean(layoutStyle),
      coarsePointer: Boolean(matchMedia('(pointer:coarse)').matches),
      scrollRegions,
      interactiveControls: root.querySelectorAll('button,a,select,input,[role="button"]').length
    };
  }

  function installProblemReporter() {
    if (!location.pathname.includes('/games/') || document.getElementById('gameProblemReport')) return;
    const button = document.createElement('button');
    button.id = 'gameProblemReport';
    button.type = 'button';
    button.textContent = '⚑ Signaler';
    button.dataset.help = 'Prépare un rapport technique sans envoyer automatiquement vos données.';
    const dialog = document.createElement('dialog');
    dialog.id = 'gameProblemDialog';
    dialog.innerHTML = '<h2>Signaler un problème</h2><label>Catégorie <select id="problemCategory"><option>Règle ou solveur</option><option>Affichage</option><option>Commande</option><option>Son</option><option>Multijoueur</option><option>Autre</option></select></label><label>Description <textarea id="problemDescription" rows="6" placeholder="Que s’est-il passé ?"></textarea></label><p id="problemStatus"></p><div><button type="button" data-copy>Copier le rapport</button><a data-github target="_blank" rel="noopener">Ouvrir GitHub</a><button type="button" data-close>Fermer</button></div>';
    const report = () => {
      const category = dialog.querySelector('#problemCategory').value;
      const description = dialog.querySelector('#problemDescription').value.trim() || 'Aucune description fournie.';
      return `## ${category}\n\n${description}\n\n- Page : ${location.href}\n- Navigateur : ${navigator.userAgent}\n- Écran : ${innerWidth}×${innerHeight}\n- Date : ${new Date().toISOString()}`;
    };
    dialog.querySelector('[data-copy]').onclick = async () => {
      try { await navigator.clipboard.writeText(report()); dialog.querySelector('#problemStatus').textContent = 'Rapport copié.'; }
      catch { dialog.querySelector('#problemStatus').textContent = 'Copie impossible : sélectionnez le texte manuellement.'; }
    };
    const github = dialog.querySelector('[data-github]');
    github.href = `https://github.com/lestour/ludotheque-locale/issues/new?template=bug_report.yml&title=${encodeURIComponent(`[Bug] ${document.title}`)}`;
    github.textContent = 'Créer une issue';
    dialog.querySelector('[data-close]').onclick = () => dialog.close();
    button.onclick = () => dialog.showModal?.();
    document.body.append(button, dialog);
    const style = document.createElement('style');
    style.textContent = '#gameProblemReport{position:fixed;z-index:8998;right:max(14px,env(safe-area-inset-right));top:max(66px,calc(env(safe-area-inset-top) + 58px));padding:7px 10px;border:1px solid #64748b;border-radius:999px;background:#fff;color:#17243a;box-shadow:0 5px 18px #0003;font:700 12px Arial,sans-serif}#gameProblemDialog{width:min(560px,calc(100vw - 28px));max-height:calc(100dvh - 28px);padding:18px;border:1px solid #64748b;border-radius:14px;background:#fff;color:#17243a}#gameProblemDialog label{display:grid;gap:6px;margin:12px 0}#gameProblemDialog textarea,#gameProblemDialog select{box-sizing:border-box;width:100%;font:inherit;padding:8px}#gameProblemDialog>div{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}#gameProblemDialog a{padding:8px 11px;border:1px solid #64748b;border-radius:8px;text-decoration:none;color:inherit}@media(prefers-color-scheme:dark){#gameProblemReport,#gameProblemDialog{background:#1e293b;color:#f8fafc}}';
    document.head.append(style);
  }

  const lanBootOptions = decodeLanOptions();
  installControlPreferences();
  applyLanOptions(lanBootOptions);
  const seededRandom = reproducibleRandom();
  window.GameRuntime = { version: 12, hashSeed, createRandom, shuffle, clone, createHistory, createAutosave, listAutosaves, removeAutosave, storage, settingsSignature, createWorkerTask, randomSeed, rememberRecent, activeProfileId, profileKey, applyLanOptions, mobileInterface, lanBootOptions, seededRandom };
  installMobileLayout();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { installAccessibilityPreferences(); installProblemReporter(); }, { once: true });
  else { installAccessibilityPreferences(); installProblemReporter(); }

  if (location.pathname.includes('/games/')) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => rememberRecent(), { once: true });
    else rememberRecent();
    window.addEventListener('pagehide', () => rememberRecent());
  }

  if (location.pathname.includes('/games/') && !window.GameRecords && !document.querySelector('script[data-game-records]')) {
    const currentSource = document.currentScript?.src;
    if (currentSource) {
      const recordsScript = document.createElement('script');
      recordsScript.src = new URL('records.js?v=7', currentSource).href;
      recordsScript.dataset.gameRecords = 'true';
      document.head.append(recordsScript);
    }
  }

  if (location.pathname.includes('/games/') && !window.GameEffects && !document.querySelector('script[data-game-effects]')) {
    const currentSource = document.currentScript?.src;
    if (currentSource) {
      const effectsScript = document.createElement('script');
      effectsScript.src = new URL('effects.js?v=3', currentSource).href;
      effectsScript.dataset.gameEffects = 'true';
      document.head.appendChild(effectsScript);
    }
  }

  if (location.pathname.includes('/games/') && !window.GameOptionsHelp && !document.querySelector('script[data-options-help]')) {
    const currentSource = document.currentScript?.src;
    if (currentSource) {
      const optionsHelpScript = document.createElement('script');
      optionsHelpScript.src = new URL('options-help.js?v=4', currentSource).href;
      optionsHelpScript.dataset.optionsHelp = 'true';
      document.head.appendChild(optionsHelpScript);
    }
  }

  if (location.pathname.includes('/games/') && !window.LanMultiplayer && !document.querySelector('script[data-lan-multiplayer]')) {
    const currentSource = document.currentScript?.src;
    if (currentSource) {
      const lanScript = document.createElement('script');
      lanScript.src = new URL('lan-multiplayer.js?v=10', currentSource).href;
      lanScript.dataset.lanMultiplayer = 'true';
      document.head.appendChild(lanScript);
    }
  }
})();
