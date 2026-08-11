const playersTable = document.getElementById('playersTable');
const potCount = document.getElementById('potCount');
const roundCount = document.getElementById('roundCount');
const drawButton = document.getElementById('draw');
const newGameButton = document.getElementById('newGame');
const playerCountSelect = document.getElementById('playerCount');
const status = document.getElementById('status');
const history = document.getElementById('history');
let game;

function cardFace(card, className = '') {
  return `<div class="card ${card.suit.color} ${className}"><span>${card.label}</span><strong>${card.suit.symbol}</strong></div>`;
}

function cardMarkup(card, outcome = '') {
  if (!card) return '<div class="card empty">—</div>';
  const icon = outcome === 'winner' ? '✓' : '×';
  return `<div class="flip-card ${outcome}"><div class="flip-inner"><div class="card-face"><div class="card back">♠</div></div><div class="card-face front">${cardFace(card)}</div></div>${outcome ? `<span class="outcome-icon" aria-label="${outcome === 'winner' ? 'Carte gagnante' : 'Carte perdante'}">${icon}</span>` : ''}</div>`;
}

function deckStackMarkup(count) {
  if (!count) return '<div class="deck-stack empty" style="--count:0" aria-label="Paquet vide"></div>';
  const layers = Array.from({ length: count }, (_, layer) => `<span class="deck-layer" style="left:${(layer * .16).toFixed(2)}px;top:${(layer * .45).toFixed(2)}px;z-index:${layer}"></span>`).join('');
  return `<div class="deck-stack" style="--stack-offset:${(count * .45).toFixed(2)}px" aria-label="${count} cartes restantes">${layers}<span class="deck-count">${count}</span></div>`;
}

function playerName(index) { return window.LanMultiplayer?.room?.seats?.[index]?.label || window.LanMultiplayer?.room?.players?.[index]?.name || `Joueur ${index + 1}`; }
function log(message) { game.logs.unshift(message); game.logs = game.logs.slice(0, 8); }
function drawFrom(player) { return game.hands[player].shift(); }
function eligiblePlayers() { return game.hands.map((hand, player) => hand.length ? player : -1).filter(player => player >= 0); }
function awardPot(winner) { const cardsWon = game.pot.length; game.hands[winner].push(...CardTools.shuffle(game.pot)); game.pot = []; return cardsWon; }
function finish(winner) { const localPlayer = window.LanMultiplayer?.active ? window.LanMultiplayer.playerIndex : 0; game.over = true; drawButton.disabled = true; status.textContent = winner === null ? 'Partie nulle.' : `${playerName(winner)} gagne la partie.`; window.GameRecords?.finish({ score: game.hands[localPlayer]?.length || 0, scoreLabel: `${game.hands[localPlayer]?.length || 0} cartes`, won: winner === localPlayer, winnerSeat: winner }); }

function battle(tied, revealed) {
  let contenders = tied;
  while (contenders.length > 1) {
    const able = contenders.filter(player => game.hands[player].length >= 4);
    contenders.filter(player => !able.includes(player)).forEach(player => { while (game.hands[player].length) game.pot.push(drawFrom(player)); });
    if (able.length < 2) return able[0] ?? contenders[0];
    able.forEach(player => {
      for (let count = 0; count < 3; count += 1) game.pot.push(drawFrom(player));
      revealed[player] = drawFrom(player);
      game.pot.push(revealed[player]);
    });
    const highest = Math.max(...able.map(player => revealed[player].value));
    contenders = able.filter(player => revealed[player].value === highest);
  }
  return contenders[0];
}

function playRound() {
  if (game.over || game.animating) return;
  const active = eligiblePlayers();
  if (active.length < 2) { finish(active[0] ?? null); render(); return; }
  game.animating = true;
  drawButton.disabled = true;
  game.round += 1;
  const revealed = Array(game.players).fill(null);
  active.forEach(player => { revealed[player] = drawFrom(player); game.pot.push(revealed[player]); });
  const highest = Math.max(...active.map(player => revealed[player].value));
  const tied = active.filter(player => revealed[player].value === highest);
  const winner = tied.length === 1 ? tied[0] : battle(tied, revealed);
  const cardsWon = awardPot(winner);
  game.lastPotCount = cardsWon;
  game.lastCards = revealed;
  game.lastWinner = winner;
  log(`${playerName(winner)} remporte ${cardsWon} carte${cardsWon > 1 ? 's' : ''}${tied.length > 1 ? ' après une bataille' : ''}.`);
  status.textContent = `${playerName(winner)} remporte ce pli.`;
  const remaining = eligiblePlayers();
  if (remaining.length < 2) finish(remaining[0] ?? winner);
  render();
  const currentGame = game;
  window.setTimeout(() => {
    if (game !== currentGame) return;
    game.animating = false;
    game.lastPotCount = 0;
    drawButton.disabled = game.over;
    potCount.textContent = '0';
  }, 850);
}

function render() {
  playersTable.innerHTML = game.hands.map((hand, player) => {
    const outcome = game.lastCards[player] ? (player === game.lastWinner ? 'winner' : 'loser') : '';
    return `<div class="player">${playerName(player)}<div class="play-zone">${deckStackMarkup(hand.length)}<div class="revealed">${cardMarkup(game.lastCards[player], outcome)}</div></div><span class="muted">${hand.length} carte${hand.length > 1 ? 's' : ''}</span></div>`;
  }).join('');
  potCount.textContent = game.pot.length || game.lastPotCount;
  roundCount.textContent = game.round;
  history.innerHTML = game.logs.length ? game.logs.map(message => `<li>${message}</li>`).join('') : '<li>Retournez les cartes pour commencer.</li>';
  drawButton.disabled = game.over || game.animating;
}

function createGame() {
  const players = Number(playerCountSelect.value);
  const hands = Array.from({ length: players }, () => []);
  CardTools.shuffle(CardTools.createDeck()).forEach((card, index) => hands[index % players].push(card));
  game = { players, hands, pot: [], lastPotCount: 0, round: 0, logs: [], lastCards: Array(players).fill(null), lastWinner: null, over: false, animating: false };
  status.textContent = 'Retournez les cartes pour commencer.';
  render();
}

function registerLanAdapter() {
  if (!window.LanMultiplayer || registerLanAdapter.done) return;
  registerLanAdapter.done = true;
  window.LanMultiplayer.registerAdapter({
    receive(action) {
      if (action?.type !== 'draw' || game.over || game.animating || Number(action.round) !== game.round + 1) return;
      playRound();
    }
  });
}

window.BatailleTestAPI = {
  diagnostics() {
    const handCards = game.hands.reduce((total, hand) => total + hand.length, 0);
    const handSizes = game.hands.map(hand => hand.length);
    return {
      players: game.players,
      totalCards: handCards + game.pot.length,
      distributionBalanced: Math.max(...handSizes) - Math.min(...handSizes) <= 1,
      validTurnState: game.over || eligiblePlayers().length >= 2
    };
  }
};

drawButton.addEventListener('click', () => {
  if (game.over || game.animating) return;
  playRound();
  if (window.LanMultiplayer?.active) window.LanMultiplayer.sendAction({ type: 'draw', round: game.round }).catch(error => { status.textContent = `Synchronisation LAN interrompue : ${error.message}`; });
});
newGameButton.addEventListener('click', createGame);
playerCountSelect.addEventListener('change', createGame);
localStorage.setItem('game-hub:last-game', 'bataille');
createGame();
registerLanAdapter();
window.addEventListener('lan:available', registerLanAdapter);
window.addEventListener('lan:room', render);

if (new URLSearchParams(location.search).has('battleTest')) {
  const checks = [document.querySelectorAll('.deck-layer').length === 52];
  playRound();
  checks.push(game.lastCards.filter(Boolean).length === game.players);
  checks.push(document.querySelectorAll('.flip-inner').length === game.players);
  checks.push(document.querySelectorAll('.outcome-icon').length === game.players);
  checks.push(document.querySelectorAll('.winner').length === 1);
  window.setTimeout(() => {
    checks.push(document.querySelectorAll('.deck-layer').length === 52);
    document.title = `BATAILLE TEST · ${checks.filter(Boolean).length}/${checks.length}`;
  }, 900);
}
