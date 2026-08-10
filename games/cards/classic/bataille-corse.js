const scores = document.getElementById('scores');
const pileElement = document.getElementById('pile');
const actions = document.getElementById('actions');
const status = document.getElementById('status');
const history = document.getElementById('history');
const newGameButton = document.getElementById('newGame');
const opponentSelect = document.getElementById('opponent');
const playerCountSelect = document.getElementById('playerCount');
const slapOnSeven = document.getElementById('slapOnSeven');
const slapOnTenSandwich = document.getElementById('slapOnTenSandwich');
const attemptsForFigure = { V: 1, D: 2, R: 3, A: 4 };
const botProfiles = { easy: { minimumDelay: 900, maximumDelay: 1550, accuracy: .48 }, normal: { minimumDelay: 520, maximumDelay: 980, accuracy: .72 }, hard: { minimumDelay: 180, maximumDelay: 480, accuracy: .93 } };
let game;
let botTimer = null;
opponentSelect.querySelector('option[value="human"]')?.remove();

function playerName(player) { return player === 0 ? 'Vous' : `Bot ${player}`; }
function cardMarkup(card) { return `<div class="card ${card.suit.color}"><span>${card.label}</span><strong>${card.suit.symbol}</strong></div>`; }
function log(message) { game.logs.unshift(message); game.logs = game.logs.slice(0, 7); }
function clearBotTimer() { if (botTimer !== null) window.clearTimeout(botTimer); botTimer = null; }
function nextPlayer(player) { for (let offset = 1; offset <= game.players; offset += 1) { const candidate = (player + offset) % game.players; if (game.hands[candidate].length) return candidate; } return player; }
function activePlayers() { return game.hands.map((hand, player) => hand.length ? player : -1).filter(player => player >= 0); }
function isBot(player) { return player !== 0; }
function cardFaceValue(card) { return card.label === 'A' ? 1 : card.value; }
function isSlappable() { const pile = game.pile; return pile.length && ((slapOnSeven.checked && pile.at(-1).label === '7') || (slapOnTenSandwich.checked && pile.length > 2 && cardFaceValue(pile.at(-1)) + cardFaceValue(pile.at(-3)) === 10) || (pile.length > 1 && (pile.at(-1).value === pile.at(-2).value || (pile.length > 2 && pile.at(-1).value === pile.at(-3).value)))); }
function scheduleBot() {
  if (game.over || game.current === 0 || botTimer !== null) return;
  const profile = botProfiles[opponentSelect.value] || botProfiles.normal;
  const delay = profile.minimumDelay + Math.random() * (profile.maximumDelay - profile.minimumDelay);
  const shouldSlap = isSlappable() && Math.random() < profile.accuracy;
  const player = game.current;
  botTimer = window.setTimeout(() => { botTimer = null; if (!game.over && game.current === player) { if (shouldSlap && isSlappable()) slap(player); else play(player); } }, delay);
}
function awardPile(player, reason) { const count = game.pile.length; game.hands[player].push(...game.pile); game.pile = []; game.current = player; game.challenger = null; game.remainingAttempts = 0; log(`${playerName(player)} remporte ${count} carte${count > 1 ? 's' : ''} : ${reason}.`); }
function finish(winner) { game.over = true; clearBotTimer(); status.textContent = winner === null ? 'Partie nulle.' : `${playerName(winner)} remporte la partie !`; }
function play(player) {
  if (game.over || player !== game.current || !game.hands[player].length) return;
  clearBotTimer();
  const card = game.hands[player].shift();
  game.pile.push(card); game.lastCard = card; game.lastPlayer = player;
  const attempts = attemptsForFigure[card.label];
  if (attempts) { game.challenger = player; game.remainingAttempts = attempts; game.current = nextPlayer(player); status.textContent = `${playerName(game.current)} doit répondre à ${card.label} en ${attempts} tentative${attempts > 1 ? 's' : ''}.`; }
  else if (game.remainingAttempts) { game.remainingAttempts -= 1; if (!game.remainingAttempts) { awardPile(game.challenger, 'la figure n’a pas été contrée'); status.textContent = `${playerName(game.challenger)} reprend la main.`; } else { game.current = nextPlayer(player); status.textContent = `${playerName(game.current)} a encore ${game.remainingAttempts} tentative${game.remainingAttempts > 1 ? 's' : ''}.`; } }
  else { game.current = nextPlayer(player); status.textContent = `À ${playerName(game.current)} de jouer.`; }
  const remaining = activePlayers();
  if (remaining.length < 2) finish(remaining[0] ?? null);
  render();
}
function slap(player) {
  if (game.over || !game.pile.length || !game.hands[player].length) return;
  clearBotTimer();
  if (isSlappable()) { awardPile(player, 'tape correcte'); status.textContent = `${playerName(player)} tape correctement !`; }
  else { const penalty = game.hands[player].shift(); game.hands[nextPlayer(player)].push(penalty); status.textContent = `Tape incorrecte : ${playerName(player)} donne une carte.`; log(`${playerName(player)} tape sans combinaison et donne une carte.`); }
  render();
}
function render() {
  opponentSelect.closest('label').firstChild.textContent = 'Bots ';
  scores.innerHTML = game.hands.map((hand, player) => `<div class="score">${playerName(player)}<strong>${hand.length}</strong></div>`).join('');
  pileElement.innerHTML = game.pile.length ? game.pile.slice(-5).map((card, index, cards) => `<div class="pile-card${card === game.lastCard ? ' newest' : ''}" style="--offset:${(index - cards.length + 1) * 14}px">${cardMarkup(card)}</div>`).join('') : '<div class="muted">Le tas est vide.</div>';
  const hand = game.hands[0];
  actions.innerHTML = `<button class="primary" data-play="0" ${game.over || game.current !== 0 || !hand.length ? 'disabled' : ''}>Vous jouez</button><button class="slap" data-slap="0" ${game.over || !game.pile.length || !hand.length ? 'disabled' : ''}>Vous tapez</button>`;
  actions.querySelectorAll('[data-play]').forEach(button => button.addEventListener('click', () => play(Number(button.dataset.play))));
  actions.querySelectorAll('[data-slap]').forEach(button => button.addEventListener('click', () => slap(Number(button.dataset.slap))));
  history.innerHTML = game.logs.length ? game.logs.map(message => `<li>${message}</li>`).join('') : '<li>Joueur 1 commence.</li>';
  scheduleBot();
}
function createGame() {
  clearBotTimer();
  const players = Number(playerCountSelect.value);
  const hands = Array.from({ length: players }, () => []);
  CardTools.shuffle(CardTools.createDeck()).forEach((card, index) => hands[index % players].push(card));
  game = { players, hands, pile: [], current: 0, challenger: null, remainingAttempts: 0, lastPlayer: null, lastCard: null, logs: [], over: false };
  status.textContent = 'Joueur 1 commence.';
  render();
}
newGameButton.addEventListener('click', createGame);
opponentSelect.addEventListener('change', createGame);
playerCountSelect.addEventListener('change', createGame);
slapOnSeven.addEventListener('change', render);
slapOnTenSandwich.addEventListener('change', render);
window.addEventListener('keydown', event => { if (event.repeat) return; if (event.key === ' ') { event.preventDefault(); play(0); } if (event.key.toLowerCase() === 'a') slap(0); });
localStorage.setItem('game-hub:last-game', 'bataille-corse');
createGame();
