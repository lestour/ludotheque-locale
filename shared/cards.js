if (!document.querySelector('script[data-options-help]')) { const source = document.currentScript?.src; const script = document.createElement('script'); script.src = source ? new URL('options-help.js?v=3', source).href : '../../shared/options-help.js?v=3'; script.dataset.optionsHelp = 'true'; document.head.append(script); }
window.CardTools = (() => {
  const suits = [
    { symbol: '♠', name: 'Pique', color: 'black' },
    { symbol: '♥', name: 'Cœur', color: 'red' },
    { symbol: '♦', name: 'Carreau', color: 'red' },
    { symbol: '♣', name: 'Trèfle', color: 'black' }
  ];
  const ranks = [
    { label: '2', value: 2 }, { label: '3', value: 3 }, { label: '4', value: 4 }, { label: '5', value: 5 },
    { label: '6', value: 6 }, { label: '7', value: 7 }, { label: '8', value: 8 }, { label: '9', value: 9 },
    { label: '10', value: 10 }, { label: 'V', value: 11 }, { label: 'D', value: 12 }, { label: 'R', value: 13 }, { label: 'A', value: 14 }
  ];

  function createDeck() {
    return suits.flatMap(suit => ranks.map(rank => ({ ...rank, suit })));
  }

  function shuffle(cards) {
    const deck = cards.slice();
    for (let index = deck.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
    }
    return deck;
  }

  function animateTransfer(from, to, markup, options = {}) {
    if (window.GameEffects?.transfer) return window.GameEffects.transfer(from, to, markup, options);
    const { axis = 'vertical', duration = 520, onFinish } = options;
    if (!(from instanceof Element) || !(to instanceof Element)) {
      onFinish?.();
      return;
    }
    const start = from.getBoundingClientRect();
    const end = to.getBoundingClientRect();
    const ghost = document.createElement('div');
    ghost.className = 'card-transfer';
    ghost.style.cssText = `position:fixed;z-index:100;left:${start.left}px;top:${start.top}px;width:${start.width}px;height:${start.height}px;pointer-events:none;transition:transform ${duration}ms cubic-bezier(.2,.8,.25,1);`;
    ghost.innerHTML = `<div class="card-transfer-inner">${markup}</div>`;
    document.body.appendChild(ghost);
    const inner = ghost.firstElementChild;
    inner.style.cssText = `width:100%;height:100%;transition:transform ${Math.round(duration / 2)}ms ease-in-out;transform-origin:center;`;
    window.requestAnimationFrame(() => {
      ghost.style.transform = `translate(${end.left - start.left}px,${end.top - start.top}px)`;
      window.setTimeout(() => { inner.style.transform = axis === 'horizontal' ? 'scaleX(.03)' : 'scaleY(.03)'; }, Math.round(duration * .28));
      window.setTimeout(() => { inner.style.transform = 'scaleX(1) scaleY(1)'; }, Math.round(duration * .54));
    });
    window.setTimeout(() => { ghost.remove(); onFinish?.(); }, duration + 40);
  }

  return { createDeck, shuffle, animateTransfer };
})();
