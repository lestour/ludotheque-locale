import('../../../shared/options-help.js?v=2');
const playersElement = document.getElementById('players');
document.title = 'Dernière Couleur';
document.querySelector('h1').textContent = 'Dernière Couleur';
document.getElementById('announceLastCard').textContent = 'Annoncer dernière carte !';
document.getElementById('contestAnnouncement').textContent = 'Contester l’oubli';
document.getElementById('announcementPenalty').parentElement.lastChild.textContent = ' pénalité d’annonce';
const handElement = document.getElementById('hand');
const discardElement = document.getElementById('discard');
const status = document.getElementById('status');
const logElement = document.getElementById('log');
const deckButton = document.getElementById('deck');
const drawButton = document.getElementById('draw');
const announcementButton = document.getElementById('announceLastCard');
const challengeButton = document.getElementById('challenge');
const contestAnnouncementButton = document.getElementById('contestAnnouncement');
const colorSelect = document.getElementById('color');
const playerCountSelect = document.getElementById('playerCount');
const difficultySelect = document.getElementById('difficulty');

const colors = ['red', 'yellow', 'green', 'blue'];
const labels = { skip: '⦸', reverse: '↺', draw2: '+2', wild: '★', draw4: '+4', swap: '⇄', shuffle: '⤨' };
const botTimes = { easy: [900, 1500], normal: [550, 950], hard: [250, 550] };
let game;
let botTimer = null;
let audioContext;

document.querySelector('.rules').insertAdjacentHTML('beforeend', '<label><input id="skipPenalty" type="checkbox" checked> +2/+4 saute le tour</label><label><input id="drawTwoOnFour" type="checkbox"> +2 sur +4</label><label><input id="chainActions" type="checkbox"> enchaîner les actions identiques</label><label><input id="extraCards" type="checkbox"> cartes échange/mélange</label>');
document.querySelector('.toolbar').insertAdjacentHTML('beforeend', '<label class="muted"><input id="lightBack" type="checkbox"> Dos de cartes clair</label>');
const lightBack = document.getElementById('lightBack');
lightBack.checked = localStorage.getItem('derniere-couleur:light-backs') === 'true';
document.body.classList.toggle('light-card-backs', lightBack.checked);
lightBack.addEventListener('change', () => { localStorage.setItem('derniere-couleur:light-backs', String(lightBack.checked)); document.body.classList.toggle('light-card-backs', lightBack.checked); });
document.body.insertAdjacentHTML('beforeend', '<div id="actionBanner" aria-live="polite"></div>');
document.head.insertAdjacentHTML('beforeend', `<style>
  #actionBanner{position:fixed;z-index:90;left:50%;top:18%;transform:translate(-50%,-20px) scale(.75);opacity:0;pointer-events:none;padding:16px 28px;border-radius:18px;background:#172d68;color:#fff;font-weight:800;font-size:24px;box-shadow:0 12px 34px #0005;transition:opacity .18s,transform .28s}
  #actionBanner.visible{opacity:1;transform:translate(-50%,0) scale(1)}
  .player .mini-stack{height:33px;display:flex;justify-content:center;align-items:center;margin:5px auto 2px}.player .mini-stack i{display:block;width:27px;height:31px;margin-left:-19px;border:1px solid #172d68;border-radius:5px;background:repeating-linear-gradient(45deg,#172d68,#172d68 4px,#f1f5ff 4px,#f1f5ff 8px)}.player .mini-stack i:first-child{margin-left:0}.player.active .mini-stack i{border-color:#efab24}
  .card.jump{outline:4px solid #f97316;outline-offset:2px;animation:jump-card .7s infinite alternate}@keyframes jump-card{to{transform:translateY(-8px)}}
  .deck.reshuffle{animation:reshuffle .48s ease-in-out 2}@keyframes reshuffle{50%{transform:rotate(14deg) translateX(15px)}}
</style>`);

const originalPlay = play;
play = function safePlay(...args) { return originalPlay(...args); };

const optionDescriptions = {
  stacking: 'Autorise à répondre à une pénalité par une autre carte +2 ou +4.',
  drawTwoOnFour: 'Autorise un +2 à répondre à un +4 afin de cumuler la pénalité ; désactivé par défaut.',
  sevenZero: 'Un 7 échange deux mains ; un 0 fait tourner toutes les mains.',
  jumpIn: 'Autorise à jouer immédiatement une carte strictement identique à la défausse.',
  drawUntil: 'La pioche continue jusqu’à obtenir une carte jouable.',
  strictFour: 'Le +4 est interdit si une carte de la couleur active est disponible, et peut être contesté.',
  announcementPenalty: 'Oublier d’annoncer sa dernière carte coûte deux cartes.',
  skipPenalty: 'Après une pénalité, le joueur piochant passe son tour.',
  chainActions: 'Permet de jouer plusieurs actions identiques durant le même tour.',
  extraCards: 'Ajoute les cartes Joker échange de mains et mélange de toutes les mains.'
};
const rulesPanel = document.createElement('aside');
rulesPanel.className = 'color-game-rules-panel';
document.querySelector('main').classList.add('color-game-layout');
document.querySelector('main').appendChild(rulesPanel);
colorSelect.closest('label')?.remove();
const launchOptions = new URLSearchParams(window.location.search);
if (launchOptions.has('players')) playerCountSelect.value = launchOptions.get('players');
if (launchOptions.has('difficulty')) difficultySelect.value = launchOptions.get('difficulty');
launchOptions.get('rules')?.split(',').forEach(id => { const input = document.getElementById(id); if (input) input.checked = true; });
document.querySelectorAll('.rules input').forEach(input => { input.closest('label').title = optionDescriptions[input.id] || ''; input.addEventListener('change', () => renderRulesPanel()); });
document.head.insertAdjacentHTML('beforeend', `<style>
  main.color-game-layout{max-width:1500px;display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:18px;align-items:start}.color-game-rules-panel{position:sticky;top:18px;background:#fff;border:1px solid #d7e0ed;border-radius:16px;padding:16px;box-shadow:0 8px 24px #00000014;line-height:1.45}.color-game-rules-panel h2{margin:0 0 8px;font-size:20px}.color-game-rules-panel h3{margin:15px 0 6px;font-size:15px}.color-game-rules-panel ul{margin:0;padding-left:19px}.color-game-rules-panel li{margin:6px 0}.color-game-rules-panel .enabled{color:#17653c}.deck,.discard-stack{position:relative;isolation:isolate}.deck{z-index:4;overflow:visible;display:grid;place-items:center}.deck-label{position:absolute;z-index:3;top:calc(100% + var(--pile-height,0px) + 9px);white-space:nowrap}.pile-layer{position:absolute;z-index:1;inset:0;border:3px solid #203048;border-radius:12px;background:repeating-linear-gradient(45deg,#172d68,#172d68 8px,#f1f5ff 8px,#f1f5ff 16px);transform:translate(calc(var(--layer) * .34px),calc(var(--layer) * .52px));pointer-events:none}.deck .pile-layer{pointer-events:auto;cursor:pointer}.discard-stack{z-index:2;width:94px;height:132px}.discard-stack>.card{position:relative;z-index:2;transform:translate(var(--pile-width,0px),var(--pile-height,0px))}.card-transfer-card{width:100%!important;height:100%!important;box-sizing:border-box!important;transition:transform 260ms ease-in-out;transform-origin:center}.card-transfer-card>.card{width:100%!important;height:100%!important}.card-transfer-back{width:100%;height:100%;border:3px solid #203048;border-radius:12px;box-sizing:border-box;background:repeating-linear-gradient(45deg,#172d68,#172d68 8px,#f1f5ff 8px,#f1f5ff 16px)}.player .mini-stack{width:52px;min-width:52px;max-width:52px;overflow:visible}.player .mini-stack i{flex:0 0 27px}.announcement-badge{display:inline-grid;place-items:center;min-width:25px;height:25px;margin-left:6px;border-radius:99px;color:#fff;font-size:14px;vertical-align:middle}.announcement-badge.declared{background:#2563eb}.announcement-badge.counter{background:#dc2626}@media(prefers-color-scheme:dark){.color-game-rules-panel{background:#172235;border-color:#34445e}}@media(max-width:1050px){main.color-game-layout{display:block}.color-game-rules-panel{position:static;margin-top:18px}}
</style>`);
document.head.insertAdjacentHTML('beforeend', `<style>
  .deck,.pile-layer,.card-transfer-back,.player .mini-stack i{background:radial-gradient(ellipse at 50% 50%,#ef4444 0 33%,#facc15 34% 38%,#111827 39% 100%)!important}
  .light-card-backs .deck,.light-card-backs .pile-layer,.light-card-backs .card-transfer-back,.light-card-backs .player .mini-stack i{background:radial-gradient(ellipse at 50% 50%,#ef4444 0 31%,#facc15 32% 37%,#f8fafc 38% 100%)!important}
  .light-card-backs .pile-layer,.light-card-backs .card-transfer-back,.light-card-backs .player .mini-stack i{border-color:#475569!important}
  .pile-layer::after,.card-transfer-back::after,.player .mini-stack i::after{content:'DC';position:absolute;inset:0;display:grid;place-items:center;color:#fff;font-weight:900;font-style:italic;font-family:Arial,sans-serif;font-size:12px;letter-spacing:-1px;text-shadow:2px 2px 0 #111827;transform:skew(-13deg);pointer-events:none}
  .pile-layer::after{font-size:25px}.card-transfer-back{container-type:inline-size}.card-transfer-back::after{font-size:40cqw}.player .mini-stack i{position:relative}.player .mini-stack i::after{font-size:10px;letter-spacing:-1px;text-shadow:1px 1px 0 #111827}
</style>`);

function stackLayers(count) { return Array.from({ length: count }, (_, index) => `<i class="pile-layer" style="--layer:${index + 1}"></i>`).join(''); }
function renderPiles() {
  deckButton.style.setProperty('--pile-height', `${game.deck.length * .52}px`);
  deckButton.innerHTML = `${stackLayers(game.deck.length)}<span class="deck-label">PIOCHE ${game.deck.length}</span>`;
  const top = topCard();
  const depth = Math.max(0, game.discard.length - 1);
  discardElement.innerHTML = top ? `<div class="discard-stack" style="--pile-width:${depth * .34}px;--pile-height:${depth * .52}px">${stackLayers(depth)}${cardMarkup(top)}</div>` : '';
}
function renderRulesPanel() {
  const enabled = Object.keys(optionDescriptions).filter(id => document.getElementById(id)?.checked);
  rulesPanel.innerHTML = `<h2>Règles de la partie</h2><p class="muted">Défausse : ${game?.discard?.length || 0} carte${game?.discard?.length === 1 ? '' : 's'} · Pioche : ${game?.deck?.length || 0}</p><h3>Base</h3><ul><li>Jouez une couleur, un chiffre ou un symbole identique.</li><li>Les jokers choisissent la prochaine couleur.</li><li>Le premier joueur sans carte gagne.</li></ul><h3>Options actives</h3>${enabled.length ? `<ul class="enabled">${enabled.map(id => `<li><strong>${document.getElementById(id).closest('label').textContent.trim()}</strong> — ${optionDescriptions[id]}</li>`).join('')}</ul>` : '<p class="muted">Aucune variante activée.</p>'}`;
}

animateTransfer = function animatedTransfer(from, to, markup, settings = {}) {
  if (!from || !to) return;
  const { axis = typeof settings === 'string' ? settings : 'vertical', reveal = false, flip = true, onFinish = null } = typeof settings === 'string' ? { axis: settings } : settings;
  const start = from.getBoundingClientRect();
  const end = to.getBoundingClientRect();
  const ghost = document.createElement('div');
  ghost.style.cssText = `position:fixed;z-index:100;left:${start.left}px;top:${start.top}px;width:${start.width}px;height:${start.height}px;pointer-events:none;transition:transform 560ms cubic-bezier(.2,.8,.25,1),width 560ms cubic-bezier(.2,.8,.25,1),height 560ms cubic-bezier(.2,.8,.25,1)`;
  ghost.innerHTML = `<div class="card-transfer-card">${reveal ? '<div class="card-transfer-back"></div>' : markup}</div>`;
  document.body.appendChild(ghost);
  const inner = ghost.firstElementChild;
  window.requestAnimationFrame(() => { ghost.style.transform = `translate(${end.left - start.left}px,${end.top - start.top}px)`; ghost.style.width = `${end.width}px`; ghost.style.height = `${end.height}px`; if (!flip) return; window.setTimeout(() => { inner.style.transform = axis === 'horizontal' ? 'scaleX(.03)' : 'scaleY(.03)'; }, 165); window.setTimeout(() => { if (reveal) inner.innerHTML = markup; inner.style.transform = 'scale(1)'; }, 305); });
  window.setTimeout(() => { ghost.remove(); onFinish?.(); }, 610);
};

const baseDrawCards = drawCards;
drawCards = function animatedDrawCards(player, count, animated = false) {
  if (!animated) return baseDrawCards(player, count, false);
  if (game.announcementCandidate === player && count === 2) { game.contestedAnnouncement ||= []; game.contestedAnnouncement[player] = true; game.lastCardDeclared ||= []; game.lastCardDeclared[player] = false; }
  for (let index = 0; index < count; index += 1) {
    refillDeck();
    if (!game.deck.length) continue;
    const card = game.deck.pop();
    game.hands[player].push(card);
    const cardIndex = game.hands[player].length - 1;
    game.pendingDraws ||= [];
    game.pendingDraws.push({ player, cardIndex });
    window.setTimeout(() => { const destination = player === 0 ? handElement.querySelector(`[data-index="${cardIndex}"] .card`) : playersElement.children[player]?.querySelector('.mini-stack i:last-child'); animateTransfer(deckButton, destination, player === 0 ? cardMarkup(card) : '<div class="card-transfer-back"></div>', { axis: 'vertical', reveal: player === 0, onFinish: () => { game.pendingDraws = (game.pendingDraws || []).filter(pending => pending.player !== player || pending.cardIndex !== cardIndex); if (game.contestedAnnouncement?.[player] && !game.pendingDraws.some(pending => pending.player === player)) game.contestedAnnouncement[player] = false; render(); } }); }, index * 115 + 40);
  }
};

const baseRender = render;
render = function enhancedRender() { game.lastCardDeclared ||= []; game.contestedAnnouncement ||= []; game.hands.forEach((hand, player) => { if (hand.length !== 1) game.lastCardDeclared[player] = false; }); baseRender(); renderPiles(); renderRulesPanel(); [...playersElement.children].forEach((player, index) => { const stack = player.querySelector('.mini-stack'); if (stack) stack.style.width = stack.style.minWidth = stack.style.maxWidth = '52px'; if (game.lastCardDeclared[index]) player.insertAdjacentHTML('beforeend', '<span class="announcement-badge declared" title="Dernière carte annoncée">1</span>'); if (game.contestedAnnouncement[index]) player.insertAdjacentHTML('beforeend', '<span class="announcement-badge counter" title="Oubli contesté : pénalité en cours">!</span>'); }); (game.pendingDraws || []).forEach(pending => { if (pending.player === 0) handElement.querySelector(`[data-index="${pending.cardIndex}"]`)?.style.setProperty('visibility', 'hidden'); else { const player = playersElement.children[pending.player]; player?.querySelector('.mini-stack i:last-child')?.style.setProperty('visibility', 'hidden'); const count = player?.querySelector('strong'); if (count) count.textContent = game.hands[pending.player].length - game.pendingDraws.filter(other => other.player === pending.player).length; } }); contestAnnouncementButton.hidden = !(rule('announcementPenalty') && game.announcementCandidate !== null && game.announcementCandidate !== 0); contestAnnouncementButton.textContent = 'Contester l’oubli'; };

const validatedPlay = play;
play = function animatedPlay(...args) {
  const [player, index, selectedColor] = args;
  const card = game?.hands[player]?.[index];
  const playable = card && ((player === game.current && canPlay(card, player)) || canJumpIn(card, player));
  if (playable && !(player === 0 && card.color === 'wild' && !selectedColor)) {
    const source = player === 0 ? handElement.querySelector(`[data-index="${index}"] .card`) : playersElement.children[player]?.querySelector('.mini-stack');
    const destination = discardElement.querySelector('.card') || discardElement;
    animateTransfer(source, destination, cardMarkup(card), { axis: 'horizontal', reveal: player !== 0, flip: player !== 0 });
  }
  const result = validatedPlay(...args);
  if (player !== 0 && playable && game.discard.at(-1) === card && game.hands[player]?.length === 1 && rule('announcementPenalty')) {
    game.announcementCandidate = player;
    render();
    const chanceToAnnounce = { easy: .35, normal: .6, hard: .82 }[difficultySelect.value];
    window.setTimeout(() => { if (game.announcementCandidate === player && Math.random() < chanceToAnnounce) { game.announcementCandidate = null; game.lastCardDeclared ||= []; game.lastCardDeclared[player] = true; status.textContent = `${name(player)} annonce sa dernière carte !`; render(); } }, 1400);
  }
  return result;
};

const baseAnnounceLastCard = announceLastCard;
announceLastCard = function trackedAnnounceLastCard() {
  const result = baseAnnounceLastCard();
  if (game.hands[0].length === 1) { game.lastCardDeclared ||= []; game.lastCardDeclared[0] = true; render(); }
  return result;
};
const baseContestAnnouncement = contestAnnouncement;
contestAnnouncement = function trackedContestAnnouncement() {
  const player = game.announcementCandidate;
  if (player !== null && player !== 0) { game.contestedAnnouncement ||= []; game.contestedAnnouncement[player] = true; game.lastCardDeclared ||= []; game.lastCardDeclared[player] = false; }
  const result = baseContestAnnouncement();
  render();
  return result;
};

function sound(frequency, duration = .07) { try { audioContext ||= new AudioContext(); const oscillator = audioContext.createOscillator(); const gain = audioContext.createGain(); oscillator.frequency.value = frequency; gain.gain.setValueAtTime(.045, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration); oscillator.connect(gain).connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + duration); } catch { } }
function animateTransfer(from, to, markup, axis = 'vertical') { if (!from || !to) return; const start = from.getBoundingClientRect(); const end = to.getBoundingClientRect(); const ghost = document.createElement('div'); ghost.style.cssText = `position:fixed;z-index:100;left:${start.left}px;top:${start.top}px;width:${start.width}px;height:${start.height}px;pointer-events:none;transition:transform 520ms cubic-bezier(.2,.8,.25,1)`; ghost.innerHTML = `<div style="width:100%;height:100%;transition:transform 260ms ease-in-out;transform-origin:center">${markup}</div>`; document.body.appendChild(ghost); const inner = ghost.firstElementChild; window.requestAnimationFrame(() => { ghost.style.transform = `translate(${end.left - start.left}px,${end.top - start.top}px)`; window.setTimeout(() => { inner.style.transform = axis === 'horizontal' ? 'scaleX(.03)' : 'scaleY(.03)'; }, 145); window.setTimeout(() => { inner.style.transform = 'scale(1)'; }, 280); }); window.setTimeout(() => ghost.remove(), 560); }
function shuffle(values) { for (let index = values.length - 1; index > 0; index -= 1) { const target = Math.floor(Math.random() * (index + 1)); [values[index], values[target]] = [values[target], values[index]]; } return values; }
function createDeck() { const cards = []; colors.forEach(color => { cards.push({ color, value: 0 }); for (let value = 1; value < 10; value += 1) cards.push({ color, value }, { color, value }); ['skip', 'reverse', 'draw2'].forEach(value => cards.push({ color, value }, { color, value })); }); for (let index = 0; index < 4; index += 1) cards.push({ color: 'wild', value: 'wild' }, { color: 'wild', value: 'draw4' }); if (rule('extraCards')) for (let index = 0; index < 2; index += 1) cards.push({ color: 'wild', value: 'swap' }, { color: 'wild', value: 'shuffle' }); return shuffle(cards); }
function rule(id) { return document.getElementById(id).checked; }
function name(player) { return player === 0 ? 'Vous' : `Bot ${player}`; }
function next(player, steps = 1) { let target = player; for (let step = 0; step < steps; step += 1) target = (target + game.direction + game.players) % game.players; return target; }
function topCard() { return game.discard.at(-1); }
function cardText(card) { return typeof card.value === 'number' ? card.value : labels[card.value]; }
function cardMarkup(card, playable = false, jump = false) { return `<button class="card ${card.color}${playable ? ' playable' : ''}${jump ? ' jump' : ''}"><span>${cardText(card)}</span><strong>${cardText(card)}</strong></button>`; }
function log(message) { game.logs.unshift(message); game.logs = game.logs.slice(0, 7); }
function clearBot() { if (botTimer !== null) window.clearTimeout(botTimer); botTimer = null; }
function announce(text) { const banner = document.getElementById('actionBanner'); banner.textContent = text; banner.classList.remove('visible'); void banner.offsetWidth; banner.classList.add('visible'); window.setTimeout(() => banner.classList.remove('visible'), 950); }
function refillDeck() { if (game.deck.length || game.discard.length < 2) return; game.deck = shuffle(game.discard.splice(0, game.discard.length - 1)); deckButton.classList.remove('reshuffle'); void deckButton.offsetWidth; deckButton.classList.add('reshuffle'); log('La défausse est mélangée pour reformer la pioche.'); }
function drawCards(player, count, animated = false) { for (let index = 0; index < count; index += 1) { refillDeck(); if (!game.deck.length) continue; const card = game.deck.pop(); game.hands[player].push(card); if (animated) { const destination = player === 0 ? handElement : playersElement.children[player]; const markup = player === 0 ? cardMarkup(card) : '<div class="deck"></div>'; window.setTimeout(() => animateTransfer(deckButton, destination, markup, player === 0 ? 'horizontal' : 'vertical'), index * 90); } } }
function canPlay(card, player) { if (!card) return false; if (game.chain) return player === game.current && card.value === game.chain.value; if (game.pending) return rule('stacking') && (card.value === game.pending.type || (game.pending.type === 'draw4' && card.value === 'draw2' && rule('drawTwoOnFour'))); if (card.color === 'wild') return card.value !== 'draw4' || !rule('strictFour') || !game.hands[player].some(other => other.color === game.color); return card.color === game.color || card.value === topCard().value; }
function canJumpIn(card, player) { return Boolean(card) && rule('jumpIn') && !game.pending && !game.chain && player !== game.current && card.color === topCard().color && card.value === topCard().value; }
function botColor(player) { return colors.reduce((best, color) => game.hands[player].filter(card => card.color === color).length > game.hands[player].filter(card => card.color === best).length ? color : best, colors[0]); }
function changeTurn(from, steps = 1) { game.current = next(from, steps); scheduleBot(); render(); }
function continueChain(player, value) { game.chain = { player, value }; game.current = player; status.textContent = `${name(player)} peut enchaîner ${labels[value]}.`; scheduleBot(); render(); }
function win(player) { game.over = true; clearBot(); status.textContent = `${name(player)} gagne la manche !`; announce(`${name(player)} gagne !`); render(); }
function applyPending() { const player = game.current; drawCards(player, game.pending.count, true); log(`${name(player)} pioche ${game.pending.count} cartes.`); announce(`${name(player)} pioche ${game.pending.count} cartes`); game.pending = null; if (rule('skipPenalty')) changeTurn(player); else { scheduleBot(); render(); } }
function showColorPicker(index) { const picker = document.createElement('div'); picker.style.cssText = 'position:fixed;inset:0;z-index:80;display:grid;place-items:center;background:#0008'; picker.innerHTML = '<div style="width:300px;height:300px;border-radius:50%;overflow:hidden;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;border:8px solid white"><button data-color="red" style="background:#e84142;border:0"></button><button data-color="yellow" style="background:#f4c430;border:0"></button><button data-color="green" style="background:#32a55d;border:0"></button><button data-color="blue" style="background:#3979d8;border:0"></button></div>'; picker.querySelectorAll('[data-color]').forEach(button => button.addEventListener('click', () => { const color = button.dataset.color; picker.remove(); if (game.hands[0][index]?.value === 'swap') showSwapPicker(index, color); else play(0, index, color); })); document.body.appendChild(picker); }
function showSwapPicker(index, color) { const picker = document.createElement('div'); picker.style.cssText = 'position:fixed;inset:0;z-index:80;display:grid;place-items:center;background:#0008'; picker.innerHTML = `<div style="padding:22px;border-radius:16px;background:#fff;color:#152238;text-align:center"><strong>Échanger avec</strong><div class="actions">${game.hands.slice(1).map((_, player) => `<button data-player="${player + 1}">${name(player + 1)}</button>`).join('')}</div></div>`; picker.querySelectorAll('[data-player]').forEach(button => button.addEventListener('click', () => { picker.remove(); play(0, index, color, Number(button.dataset.player)); })); document.body.appendChild(picker); }
function play(player, index, selectedColor = null, swapTarget = null) { const card = game.hands[player]?.[index]; if (game.over || !card || (player === 0 && game.mustPlayDrawn !== null && index !== game.mustPlayDrawn) || (player !== game.current && !canJumpIn(card, player)) || (!canPlay(card, player) && !canJumpIn(card, player))) return; if (player === 0 && card.color === 'wild' && !selectedColor) { showColorPicker(index); return; } clearBot(); game.mustPlayDrawn = null; sound(card.value === 'draw2' || card.value === 'draw4' ? 180 : 510); const oldColor = game.color; const wasChaining = Boolean(game.chain); game.hands[player].splice(index, 1); game.discard.push(card); game.color = card.color === 'wild' ? (selectedColor || (player === 0 ? colorSelect.value : botColor(player))) : card.color; game.lastDrawFour = card.value === 'draw4' ? { player, legal: !game.hands[player].some(other => other.color === oldColor) } : null; game.chain = null; if (card.value === 'swap') { const target = swapTarget ?? next(player); [game.hands[player], game.hands[target]] = [game.hands[target], game.hands[player]]; announce(`${name(player)} échange sa main avec ${name(target)} !`); log(`${name(player)} échange sa main avec ${name(target)}.`); } if (card.value === 'shuffle') { const sizes = game.hands.map(hand => hand.length); const allCards = shuffle(game.hands.flat()); game.hands = sizes.map(size => allCards.splice(0, size)); announce('Les mains sont mélangées !'); log('Toutes les mains sont mélangées.'); } game.announcementCandidate = game.hands[player].length === 1 ? player : null; if (player !== 0 && Math.random() < ({ easy: .5, normal: .78, hard: .94 }[difficultySelect.value])) game.announcementCandidate = null; if (!game.hands[player].length) { if (card.value === 'draw2' || card.value === 'draw4') drawCards(next(player), card.value === 'draw2' ? 2 : 4); win(player); return; } const canChain = rule('chainActions') && ['skip', 'reverse', 'draw2'].includes(card.value) && game.hands[player].some(other => other.value === card.value); if (card.value === 'draw2' || card.value === 'draw4') { const amount = card.value === 'draw2' ? 2 : 4; game.pending = game.pending && (rule('stacking') || wasChaining) ? { type: card.value, count: game.pending.count + amount } : { type: card.value, count: amount }; announce(`${cardText(card)} sur ${name(next(player))}`); status.textContent = `${name(player)} joue ${cardText(card)}.`; if (canChain) continueChain(player, card.value); else changeTurn(player); return; } if (card.value === 'reverse') { game.direction *= -1; announce('Le sens change !'); if (canChain) continueChain(player, card.value); else changeTurn(player, game.players === 2 ? 2 : 1); return; } if (card.value === 'skip') { announce(`${name(next(player))} passe son tour !`); if (canChain) continueChain(player, card.value); else changeTurn(player, 2); return; } if (rule('sevenZero') && card.value === 0) { const rotated=game.direction===1?game.hands.pop():game.hands.shift();if(game.direction===1)game.hands.unshift(rotated);else game.hands.push(rotated); } if (rule('sevenZero') && card.value === 7) { const target = next(player),playerHand=game.hands[player];game.hands[player]=game.hands[target];game.hands[target]=playerHand;announce(`${name(player)} échange avec ${name(target)}.`); } changeTurn(player); }
function draw() { if (game.over || game.current !== 0) return; if (game.mustPlayDrawn !== null) { game.mustPlayDrawn = null; status.textContent = 'Vous passez après la pioche.'; changeTurn(0); return; } if (game.pending) { applyPending(); return; } let count = 1; sound(300); drawCards(0, 1, true); let drawnIndex=game.hands[0].length-1;while (rule('drawUntil') && !canPlay(game.hands[0][drawnIndex],0) && game.deck.length) { drawCards(0, 1, true); count += 1; drawnIndex=game.hands[0].length-1;}if(canPlay(game.hands[0][drawnIndex],0)){game.mustPlayDrawn=drawnIndex;status.textContent=`Vous piochez ${count} carte${count>1?'s':''}. Jouez la dernière carte ou cliquez sur Passer.`;render();return}status.textContent = `Vous piochez ${count} carte${count > 1 ? 's' : ''}, sans carte jouable.`; changeTurn(0); }
function challengeDrawFour() { if (!game.pending || game.pending.type !== 'draw4' || game.current !== 0 || !game.lastDrawFour) return; if (game.lastDrawFour.legal) { drawCards(0, 6, true); status.textContent = 'Contestataire perdant : vous piochez 6 cartes et passez.'; game.pending = null; changeTurn(0); } else { drawCards(game.lastDrawFour.player, 4, true); game.pending = null; status.textContent = 'Contestataire gagnant : le +4 était illégal, vous gardez votre tour.'; scheduleBot(); render(); } }
function announceLastCard() { if (game.hands[0].length === 1) { game.announcementCandidate = null; status.textContent = 'Dernière carte annoncée !'; render(); } }
function contestAnnouncement() { if (game.announcementCandidate === null || game.announcementCandidate === 0) return; drawCards(game.announcementCandidate, 2, true); game.announcementCandidate = null; status.textContent = 'Annonce oubliée : le bot pioche 2 cartes.'; render(); }
function scheduleBot() { if (game.over || game.current === 0 || botTimer !== null) return; const [minimum, maximum] = botTimes[difficultySelect.value]; botTimer = window.setTimeout(() => { botTimer = null; if (game.announcementCandidate === 0 && rule('announcementPenalty') && Math.random() < .55) { drawCards(0, 2, true); game.announcementCandidate = null; status.textContent = 'Un bot conteste votre oubli : vous piochez 2 cartes.'; render(); } if (game.pending && !rule('stacking')) { applyPending(); return; } const player = game.current; const index = game.hands[player].findIndex(card => canPlay(card, player)); if (index >= 0) play(player, index); else { drawCards(player, 1, true);const drawn=game.hands[player].length-1;if(canPlay(game.hands[player][drawn],player))window.setTimeout(()=>play(player,drawn),260);else changeTurn(player); } }, minimum + Math.random() * (maximum - minimum)); }
function render() { playersElement.innerHTML = game.hands.map((hand, player) => `<div class="player${player === game.current ? ' active' : ''}">${name(player)}<span class="mini-stack" aria-label="${hand.length} cartes">${Array.from({ length: Math.min(hand.length, 12) }, () => '<i></i>').join('')}</span><strong>${hand.length}</strong> cartes</div>`).join(''); discardElement.innerHTML = topCard() ? cardMarkup(topCard()) : ''; handElement.innerHTML = game.hands[0].map((card, index) => `<span data-index="${index}"${game.mustPlayDrawn!==null&&index!==game.mustPlayDrawn?' style="opacity:.4;pointer-events:none"':''}>${cardMarkup(card, game.current === 0 && canPlay(card, 0)&&(game.mustPlayDrawn===null||index===game.mustPlayDrawn), canJumpIn(card, 0))}</span>`).join(''); handElement.querySelectorAll('[data-index]').forEach(item => item.addEventListener('click', () => play(0, Number(item.dataset.index)))); deckButton.textContent = `PIOCHE ${game.deck.length}`; drawButton.textContent=game.mustPlayDrawn!==null?'Passer':'Piocher';drawButton.disabled = game.over || game.current !== 0; announcementButton.disabled = game.hands[0].length !== 1; challengeButton.hidden = !(game.pending?.type === 'draw4' && game.current === 0); contestAnnouncementButton.hidden = !(rule('announcementPenalty') && game.announcementCandidate !== null && game.announcementCandidate !== 0 && game.current === 0); logElement.innerHTML = game.logs.map(item => `<li>${item}</li>`).join('') || '<li>La partie commence.</li>'; }
function createGame() { clearBot(); const playerCount = Number(playerCountSelect.value); game = { players: playerCount, hands: Array.from({ length: playerCount }, () => []), deck: createDeck(), discard: [], color: 'red', current: 0, direction: 1, pending: null, chain: null, mustPlayDrawn:null, announcementCandidate: null, lastDrawFour: null, logs: [], over: false }; for (let index = 0; index < 7; index += 1) game.hands.forEach(hand => hand.push(game.deck.pop())); let first = game.deck.pop(); while (first.value === 'draw4') { game.deck.unshift(first); first = game.deck.pop(); } game.discard.push(first); game.color = first.color === 'wild' ? colors[Math.floor(Math.random() * colors.length)] : first.color; status.textContent = 'À vous de jouer.'; render(); }
const renderWithGenericNames = render;
render = function renderGenericNames() {
  renderWithGenericNames();
  announcementButton.textContent = 'Annoncer dernière carte !';
  contestAnnouncementButton.textContent = 'Contester l’oubli';
  document.querySelectorAll('.announcement-badge.declared').forEach(badge => { badge.textContent = '1'; badge.title = 'Dernière carte annoncée'; });
  document.querySelectorAll('.announcement-badge.counter').forEach(badge => { badge.title = 'Oubli contesté : pénalité en cours'; });
};
document.getElementById('newGame').addEventListener('click', createGame); deckButton.addEventListener('click', draw); drawButton.addEventListener('click', draw); announcementButton.addEventListener('click', announceLastCard); challengeButton.addEventListener('click', challengeDrawFour); contestAnnouncementButton.addEventListener('click', contestAnnouncement); playerCountSelect.addEventListener('change', createGame); difficultySelect.addEventListener('change', createGame); ['extraCards', 'drawTwoOnFour', 'chainActions'].forEach(id => document.getElementById(id).addEventListener('change', createGame)); localStorage.setItem('game-hub:last-game', 'derniere-couleur'); createGame();
