const board = document.querySelector('.board');
document.title = 'Totem Réflexe';
document.querySelector('h1').textContent = 'Totem Réflexe';
const flipButton = document.getElementById('flip');
const slapButton = document.getElementById('slap');
const status = document.getElementById('status');
const logElement = document.getElementById('log');
const difficulty = document.getElementById('difficulty');
const toolbar = document.querySelector('.toolbar');
const profile = { easy: [1200, 2200], normal: [700, 1400], hard: [260, 650], extreme: [100, 280] };
const symbols = ['●', '◉', '○', '⊙', '◍', '◌', '◐', '◑', '◒', '◓', '◔', '◕', '◖', '◗', '◈', '◇'];
const launchOptions = new URLSearchParams(window.location.search);
let game;
let botTimer = null;
let flipTimer = null;

difficulty.insertAdjacentHTML('beforeend', '<option value="extreme">Extrême</option>');
if (launchOptions.has('difficulty')) difficulty.value = launchOptions.get('difficulty');
toolbar.insertAdjacentHTML('beforeend', '<label class="muted">Joueurs <select id="playerCount"><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></label>');
const playerCount = document.getElementById('playerCount');
if (launchOptions.has('players')) playerCount.value = launchOptions.get('players');
document.head.insertAdjacentHTML('beforeend', `<style>
  .board{position:relative;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));align-items:start}.player{position:relative;isolation:isolate;min-height:315px}.totem-zone{position:absolute;z-index:20;left:50%;top:50%;transform:translate(-50%,-50%);text-align:center}.deck-layer{position:absolute;z-index:0;width:170px;height:230px;left:50%;top:29px;transform:translateX(calc(-50% + var(--deck-offset) * .65px)) translateY(calc(var(--deck-offset) * .9px));border:3px solid #203048;border-radius:15px;box-sizing:border-box;background:radial-gradient(circle at 50% 45%,#f8d36c 0 8%,transparent 9%),repeating-linear-gradient(45deg,#166534,#166534 8px,#65a30d 8px,#65a30d 16px);pointer-events:none}.card{position:relative;z-index:2;color:#152238!important;-webkit-text-stroke:.65px #152238;text-shadow:0 0 2px #fff}.card.back{background:radial-gradient(circle at 50% 45%,#f8d36c 0 8%,transparent 9%),repeating-linear-gradient(45deg,#166534,#166534 8px,#65a30d 8px,#65a30d 16px)!important}.card.flip{animation:js-flip .44s ease-in-out}@keyframes js-flip{0%{transform:translateY(-34px) scaleY(.03);opacity:0}100%{transform:translateY(0) scaleY(1);opacity:1}}.card.duel{outline:5px solid #efab24}.totem{transition:transform .42s ease}.totem.bot-duel{background:linear-gradient(90deg,#6d28d9,#a855f7);box-shadow:0 8px 0 #4c1d95}.totem.to-player{transform:translateY(80px) rotate(10deg)}
</style>`);

function shuffle(values) { return CardTools.shuffle(values); }
function log(message) { game.log.unshift(message); game.log = game.log.slice(0, 6); }
function clearBot() { if (botTimer) clearTimeout(botTimer); botTimer = null; }
function clearFlip() { if (flipTimer) clearTimeout(flipTimer); flipTimer = null; }
function contenders() { const bySymbol = new Map(); game.up.forEach((symbol, player) => { if (symbol) bySymbol.set(symbol, [...(bySymbol.get(symbol) || []), player]); }); return [...bySymbol.values()].filter(group => group.length > 1).flat(); }
function nextTurn(player) { for (let step = 1; step <= game.players; step += 1) { const candidate = (player + step) % game.players; if (!game.finished[candidate]) return candidate; } return player; }
function cardCount() { return game.decks.reduce((total, deck) => total + deck.length, 0) + game.piles.reduce((total, pile) => total + pile.length, 0) + game.up.filter(Boolean).length; }
function receiveCards(player, cards) { if (!cards.length) return; game.decks[player].push(...cards); game.finished[player] = false; }
function renderDeck(player) { const section = board.querySelector(`[data-player="${player}"]`); const card = section.querySelector('.card'); section.querySelectorAll('.deck-layer').forEach(layer => layer.remove()); for (let index = game.decks[player].length; index > 0; index -= 1) { const layer = document.createElement('div'); layer.className = 'deck-layer'; layer.style.setProperty('--deck-offset', index); section.insertBefore(layer, card); } }
function finish(winner = null) { game.over = true; clearBot(); status.textContent = winner === null ? 'Égalité : aucun symbole commun ne permet de départager les joueurs.' : `${winner === 0 ? 'Vous' : `Bot ${winner}`} remportez le duel final !`; log(status.textContent); window.GameRecords?.finish({ won: winner === 0 }); render(); }
function resolveTurn(player) { const duelPlayers = contenders(); if (game.finished.every(Boolean)) { if (duelPlayers.length) { game.duel = true; status.textContent = 'DUEL FINAL ! Attrapez le totem.'; scheduleBotSlap(); } else finish(); return; } if (duelPlayers.length) { game.duel = true; status.textContent = 'DUEL ! Attrapez le totem.'; scheduleBotSlap(); return; } game.turn = nextTurn(player); resumeTurn(); }
function draw(player) { if (game.over || game.duel) return; if (!game.decks[player].length) { game.finished[player] = true; resolveTurn(player); render(); return; } if (game.up[player]) game.piles[player].push(game.up[player]); game.up[player] = game.decks[player].shift(); game.lastFlip = player; if (!game.decks[player].length) game.finished[player] = true; resolveTurn(player); render(); clearFlip(); flipTimer = window.setTimeout(() => { game.lastFlip = null; render(); }, 460); }
function scheduleBotDraw() { if (game.over || game.duel || game.turn === 0 || botTimer) return; const [min, max] = profile[difficulty.value]; botTimer = window.setTimeout(() => { botTimer = null; if (!game.over && !game.duel && game.turn !== 0) draw(game.turn); }, min + Math.random() * (max - min)); }
function scheduleBotSlap() { if (botTimer) return; const bots = contenders().filter(player => player !== 0); if (!bots.length) return; const [min, max] = profile[difficulty.value]; botTimer = window.setTimeout(() => { botTimer = null; if (game.duel) slap(bots[Math.floor(Math.random() * bots.length)]); }, min + Math.random() * (max - min)); }
function resumeTurn() { if (game.over || game.duel) return; status.textContent = game.turn === 0 ? 'À vous de retourner une carte.' : `Bot ${game.turn} retourne une carte.`; if (game.turn !== 0) scheduleBotDraw(); }
function slap(player) { if (game.over) return; const duelPlayers = contenders(); if (game.duel && !duelPlayers.includes(player)) return; clearBot(); if (!game.duel) { if (game.decks[player].length) game.decks[player].push(game.decks[player].shift()); status.textContent = player === 0 ? 'Trop tôt : vous replacez une carte sous votre paquet.' : `Bot ${player} tape trop tôt.`; log(status.textContent); render(); resumeTurn(); return; } const totem = board.querySelector('#totem'); totem?.classList.add('to-player'); setTimeout(() => totem?.classList.remove('to-player'), 420); if (game.finished.some(Boolean)) { finish(player); return; } const losers = duelPlayers.filter(other => other !== player); const loser = losers[Math.floor(Math.random() * losers.length)]; receiveCards(loser, [...game.piles.flat(), ...game.up.filter(Boolean)]); game.piles = Array.from({ length: game.players }, () => []); game.up = Array(game.players).fill(null); game.duel = false; game.turn = player; status.textContent = `${player === 0 ? 'Vous' : `Bot ${player}`} remportez le duel.`; log(status.textContent); render(); window.setTimeout(resumeTurn, 0); }
function humanFlip() { if (!game.over && !game.duel && game.turn === 0) draw(0); }
function render() { const duelPlayers = contenders(); const humanCanSlap = !game.duel || duelPlayers.includes(0); const botOnlyDuel = game.duel && !duelPlayers.includes(0); board.innerHTML = game.decks.map((deck, player) => `<section class="player" data-player="${player}">${player === 0 ? 'Vous' : `Bot ${player}`}<div class="card${game.up[player] ? '' : ' back'}${game.duel && duelPlayers.includes(player) ? ' duel' : ''}${game.lastFlip === player ? ' flip' : ''}">${game.up[player] || '?'}</div><span class="count" style="display:block;margin-top:${8 + Math.min(34, deck.length * .9)}px">${deck.length} cartes${game.finished[player] ? ' · terminé' : ''}</span></section>`).join('') + `<section class="totem-zone"><button id="totem" class="totem${game.duel ? ' duel' : ''}${botOnlyDuel ? ' bot-duel' : ''}"${!humanCanSlap ? ' disabled' : ''}>TOTEM</button><div class="muted">${game.duel ? (botOnlyDuel ? 'Duel entre bots' : 'Attrapez-le !') : ''}</div></section>`; game.decks.forEach((_, player) => renderDeck(player)); board.querySelector('[data-player="0"] .card')?.addEventListener('click', humanFlip); board.querySelector('#totem')?.addEventListener('click', () => slap(0)); flipButton.disabled = game.over || game.duel || game.turn !== 0; slapButton.disabled = game.over || !humanCanSlap; logElement.innerHTML = game.log.map(item => `<li>${item}</li>`).join('') || '<li>Retournez une carte pour commencer.</li>'; }
function createGame() { clearBot(); clearFlip(); const players = Number(playerCount.value); const deck = shuffle(Array.from({ length: players * symbols.length }, (_, index) => symbols[index % symbols.length])); const decks = Array.from({ length: players }, () => []); deck.forEach((symbol, index) => decks[index % players].push(symbol)); game = { players, decks, piles: Array.from({ length: players }, () => []), up: Array(players).fill(null), finished: Array(players).fill(false), turn: 0, duel: false, over: false, log: [], lastFlip: null }; status.textContent = 'À vous de retourner une carte.'; render(); }
flipButton.addEventListener('click', humanFlip); slapButton.addEventListener('click', () => slap(0)); document.getElementById('newGame').addEventListener('click', createGame); difficulty.addEventListener('change', createGame); playerCount.addEventListener('change', createGame); localStorage.setItem('game-hub:last-game', 'totem-reflexe'); createGame();

window.TotemReflexeTestAPI = {
  diagnostics() {
    const expectedCards = game.players * symbols.length;
    const currentGame = game;
    game = { decks: [[], []], piles: [[], []], up: [null, null], finished: [true, false] };
    receiveCards(0, ['●']);
    const reactivatesRecipient = !game.finished[0] && game.decks[0].length === 1;
    game = currentGame;
    return {
      expectedCards,
      currentCards: cardCount(),
      cardsConserved: cardCount() === expectedCards,
      reactivatesRecipient,
      turnCanProgress: game.over || game.duel || !game.finished[game.turn]
    };
  }
};
