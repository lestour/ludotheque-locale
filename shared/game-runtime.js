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
      .filter(control => !['sound', 'volume', 'errors', 'showErrors'].includes(control.id))
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
      button,a,select,input,label,[role="button"]{touch-action:manipulation}dialog{max-width:calc(100vw - 20px);max-height:calc(100dvh - 20px);box-sizing:border-box}.hand{max-width:100%;overscroll-behavior-inline:contain}
      @media(max-width:760px){
        main{width:100%;max-width:100%!important;padding:10px!important;margin-inline:0!important}.layout,.game-layout{width:100%;max-width:100%;padding:10px!important;gap:10px!important}
        .panel{width:100%;max-width:100%;padding:11px!important;border-radius:12px!important}.toolbar,.bar,.actions,.controls,.rules{gap:7px!important}
        button,a,[role="button"]{min-height:42px}select,input[type="text"],input[type="number"],input[type="file"],textarea{max-width:100%;min-height:42px;font-size:16px!important;box-sizing:border-box}
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

  const lanBootOptions = decodeLanOptions();
  applyLanOptions(lanBootOptions);
  const seededRandom = reproducibleRandom();
  window.GameRuntime = { version: 6, hashSeed, createRandom, shuffle, clone, createHistory, storage, settingsSignature, createWorkerTask, randomSeed, rememberRecent, applyLanOptions, lanBootOptions, seededRandom };
  installMobileLayout();

  if (location.pathname.includes('/games/')) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => rememberRecent(), { once: true });
    else rememberRecent();
    window.addEventListener('pagehide', () => rememberRecent());
  }

  if (location.pathname.includes('/games/') && !window.GameRecords && !document.querySelector('script[data-game-records]')) {
    const currentSource = document.currentScript?.src;
    if (currentSource) {
      const recordsScript = document.createElement('script');
      recordsScript.src = new URL('records.js?v=5', currentSource).href;
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

  if (location.pathname.includes('/games/') && !window.LanMultiplayer && !document.querySelector('script[data-lan-multiplayer]')) {
    const currentSource = document.currentScript?.src;
    if (currentSource) {
      const lanScript = document.createElement('script');
      lanScript.src = new URL('lan-multiplayer.js?v=3', currentSource).href;
      lanScript.dataset.lanMultiplayer = 'true';
      document.head.appendChild(lanScript);
    }
  }
})();
