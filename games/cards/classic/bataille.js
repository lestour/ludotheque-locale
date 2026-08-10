const playersTable = document.getElementById('playersTable');
const potCount = document.getElementById('potCount');
const roundCount = document.getElementById('roundCount');
const drawButton = document.getElementById('draw');
const newGameButton = document.getElementById('newGame');
const playerCountSelect = document.getElementById('playerCount');
const status = document.getElementById('status');
const history = document.getElementById('history');
let game;

function cardMarkup(card) { return card ? `<div class="card ${card.suit.color} flip-vertical"><span>${card.label}</span><strong>${card.suit.symbol}</strong></div>` : '<div class="card empty">—</div>'; }
function playerName(index) { return `Joueur ${index + 1}`; }
function log(message) { game.logs.unshift(message); game.logs = game.logs.slice(0, 8); }
function drawFrom(player) { return game.hands[player].shift(); }
function eligiblePlayers() { return game.hands.map((hand, player) => hand.length ? player : -1).filter(player => player >= 0); }
function awardPot(winner) { const cardsWon = game.pot.length; game.hands[winner].push(...CardTools.shuffle(game.pot)); game.pot = []; return cardsWon; }
function finish(winner) { game.over = true; drawButton.disabled = true; status.textContent = winner === null ? 'Partie nulle.' : `${playerName(winner)} gagne la partie.`; }
function battle(tied, revealed) {
  let contenders = tied;
  while (contenders.length > 1) {
    const able = contenders.filter(player => game.hands[player].length >= 4);
    contenders.filter(player => !able.includes(player)).forEach(player => { for (let count = 0; count < game.hands[player].length; count += 1) game.pot.push(drawFrom(player)); });
    if (able.length < 2) return able[0] ?? contenders[0];
    able.forEach(player => { for (let count = 0; count < 3; count += 1) game.pot.push(drawFrom(player)); revealed[player] = drawFrom(player); game.pot.push(revealed[player]); });
    const highest = Math.max(...able.map(player => revealed[player].value));
    contenders = able.filter(player => revealed[player].value === highest);
  }
  return contenders[0];
}
function playRound() {
  if (game.over) return;
  const active = eligiblePlayers();
  if (active.length < 2) { finish(active[0] ?? null); render(); return; }
  game.round += 1;
  const revealed = Array(game.players).fill(null);
  active.forEach(player => { revealed[player] = drawFrom(player); game.pot.push(revealed[player]); });
  const highest = Math.max(...active.map(player => revealed[player].value));
  const tied = active.filter(player => revealed[player].value === highest);
  const winner = tied.length === 1 ? tied[0] : battle(tied, revealed);
  const cardsWon = awardPot(winner);
  game.lastCards = revealed;
  log(`${playerName(winner)} remporte ${cardsWon} carte${cardsWon > 1 ? 's' : ''}${tied.length > 1 ? ' après une bataille' : ''}.`);
  status.textContent = `${playerName(winner)} remporte ce pli.`;
  const remaining = eligiblePlayers();
  if (remaining.length < 2) finish(remaining[0] ?? winner);
  render();
}
function render() {
  playersTable.innerHTML = game.hands.map((hand, player) => `<div class="player">${playerName(player)}<div class="card-slot" data-count="${hand.length}" style="--layers:${Math.min(8, hand.length)}">${cardMarkup(game.lastCards[player])}</div><span class="muted">${hand.length} carte${hand.length > 1 ? 's' : ''}</span></div>`).join('');
  potCount.textContent = game.pot.length;
  roundCount.textContent = game.round;
  history.innerHTML = game.logs.length ? game.logs.map(message => `<li>${message}</li>`).join('') : '<li>Retournez les cartes pour commencer.</li>';
  drawButton.disabled = game.over;
}
function createGame() {
  const players = Number(playerCountSelect.value);
  const hands = Array.from({ length: players }, () => []);
  CardTools.shuffle(CardTools.createDeck()).forEach((card, index) => hands[index % players].push(card));
  game = { players, hands, pot: [], round: 0, logs: [], lastCards: Array(players).fill(null), over: false };
  status.textContent = 'Retournez les cartes pour commencer.';
  render();
}
drawButton.addEventListener('click', playRound);
newGameButton.addEventListener('click', createGame);
playerCountSelect.addEventListener('change', createGame);
localStorage.setItem('game-hub:last-game', 'bataille');
createGame();
