if (!window.GameEffects) {
  window.GameEffects = (() => {
    const sounds = {
      click: [540, .05, 'sine'],
      move: [330, .09, 'triangle'],
      place: [410, .08, 'sine'],
      flip: [180, .12, 'square'],
      draw: [260, .1, 'sine'],
      capture: [210, .16, 'sawtooth'],
      shuffle: [290, .2, 'triangle'],
      success: [660, .18, 'triangle'],
      error: [130, .16, 'sawtooth'],
      lose: [196, .34, 'triangle'],
      win: [784, .35, 'sine']
    };
    let context;

    function audio() {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      context ??= new AudioContextClass();
      if (context.state === 'suspended') context.resume().catch(() => {});
      return context;
    }

    function play(name = 'click', volume = .09) {
      const options = sounds[name] || sounds.click;
      try {
        const audioContext = audio();
        if (!audioContext) return;
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = options[2];
        oscillator.frequency.setValueAtTime(options[0], audioContext.currentTime);
        if (['win', 'success'].includes(name)) oscillator.frequency.exponentialRampToValueAtTime(options[0] * 1.5, audioContext.currentTime + options[1]);
        if (name === 'lose') oscillator.frequency.exponentialRampToValueAtTime(options[0] * .55, audioContext.currentTime + options[1]);
        gain.gain.setValueAtTime(Math.max(.001, Math.min(.2, volume)), audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + options[1]);
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + options[1]);
      } catch {}
    }

    function animate(element, name = 'pulse') {
      if (!element) return;
      element.classList.remove(`fx-${name}`);
      void element.offsetWidth;
      element.classList.add(`fx-${name}`);
    }

    function transfer(from, to, markup, options = {}) {
      const { axis = 'vertical', duration = 520, flip = true, onFinish } = options;
      if (!(from instanceof Element) || !(to instanceof Element) || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        onFinish?.();
        return null;
      }
      const start = from.getBoundingClientRect();
      const end = to.getBoundingClientRect();
      const ghost = document.createElement('div');
      ghost.className = 'game-transfer-ghost card-transfer';
      ghost.style.cssText = `left:${start.left}px;top:${start.top}px;width:${start.width}px;height:${start.height}px;--transfer-duration:${duration}ms;--transfer-half-duration:${Math.round(duration / 2)}ms;`;
      const inner = document.createElement('div');
      inner.className = 'game-transfer-inner card-transfer-inner';
      if (markup instanceof Node) inner.appendChild(markup.cloneNode(true));
      else inner.innerHTML = String(markup || from.innerHTML);
      ghost.appendChild(inner);
      document.body.appendChild(ghost);
      requestAnimationFrame(() => {
        ghost.style.transform = `translate(${end.left - start.left}px,${end.top - start.top}px) scale(${end.width / Math.max(1, start.width)},${end.height / Math.max(1, start.height)})`;
        if (flip) window.setTimeout(() => { inner.style.transform = axis === 'horizontal' ? 'scaleX(.03)' : 'scaleY(.03)'; }, duration * .28);
        if (flip) window.setTimeout(() => { inner.style.transform = 'scale(1)'; }, duration * .54);
      });
      const timer = window.setTimeout(() => { ghost.remove(); onFinish?.(); }, duration + 45);
      ghost.addEventListener('click', () => { clearTimeout(timer); ghost.remove(); onFinish?.(); }, { once: true });
      return ghost;
    }

    function result(outcome, target = document.querySelector('main')) {
      const normalized = outcome === 'win' ? 'win' : outcome === 'loss' ? 'loss' : 'draw';
      play(normalized === 'loss' ? 'lose' : normalized);
      animate(target, normalized === 'loss' ? 'shake' : 'result');
    }

    const style = document.createElement('style');
    style.textContent = `
      .fx-pulse{animation:fx-pulse .28s ease-out}.fx-shake{animation:fx-shake .42s ease}.fx-flip{animation:fx-flip .36s ease-in-out}.fx-result{animation:fx-result .72s ease-out}
      .game-transfer-ghost{position:fixed;z-index:2147482000;display:grid;place-items:center;pointer-events:none;opacity:1;transform-origin:top left;transition:transform var(--transfer-duration) cubic-bezier(.2,.8,.25,1);will-change:transform}
      .game-transfer-inner{width:100%;height:100%;opacity:1;transform-origin:center;transition:transform var(--transfer-half-duration) ease-in-out;will-change:transform}
      @keyframes fx-pulse{50%{transform:scale(1.08)}}@keyframes fx-shake{20%,60%{transform:translateX(-7px)}40%,80%{transform:translateX(7px)}}@keyframes fx-flip{50%{transform:scaleY(.05)}}@keyframes fx-result{40%{transform:scale(1.035);filter:brightness(1.12)}}
      @media(prefers-reduced-motion:reduce){.fx-pulse,.fx-shake,.fx-flip,.fx-result{animation:none}.game-transfer-ghost{display:none}}
    `;
    document.head.appendChild(style);
    return { play, animate, transfer, result };
  })();
}
