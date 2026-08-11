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
let captureTimer = null;
opponentSelect.querySelector('option[value="human"]')?.remove();
opponentSelect.closest('label').childNodes[0].textContent = 'Bots ';

function playerName(player) { return player === 0 ? 'Vous' : `Bot ${player}`; }
function cardFace(card) { return `<div class="card ${card.suit.color}"><span>${card.label}</span><strong>${card.suit.symbol}</strong></div>`; }
function cardMarkup(card) { return `<div class="flip-card"><div class="flip-inner"><div class="card-face"><div class="card back">♠</div></div><div class="card-face front">${cardFace(card)}</div></div></div>`; }
function log(message) { game.logs.unshift(message); game.logs = game.logs.slice(0, 7); }
function clearBotTimer() { if (botTimer !== null) window.clearTimeout(botTimer); botTimer = null; }
function clearCaptureTimer() { if (captureTimer !== null) window.clearTimeout(captureTimer); captureTimer = null; }
function nextPlayer(player) { for (let offset = 1; offset <= game.players; offset += 1) { const candidate = (player + offset) % game.players; if (game.hands[candidate].length) return candidate; } return player; }
function activePlayers() { return game.hands.map((hand, player) => hand.length ? player : -1).filter(player => player >= 0); }
function cardFaceValue(card) { return card.label === 'A' ? 1 : card.value; }
function isSlappable() { const pile = game.pile; return pile.length && ((slapOnSeven.checked && pile.at(-1).label === '7') || (slapOnTenSandwich.checked && pile.length > 2 && cardFaceValue(pile.at(-1)) + cardFaceValue(pile.at(-3)) === 10) || (pile.length > 1 && (pile.at(-1).value === pile.at(-2).value || (pile.length > 2 && pile.at(-1).value === pile.at(-3).value)))); }

function deckStackMarkup(count) {
  if (!count) return '<div class="mini-stack empty" style="--count:0" aria-label="Paquet vide"></div>';
  const layers = Array.from({ length: count }, (_, layer) => `<span class="mini-layer" style="left:${(layer * .11).toFixed(2)}px;top:${(layer * .28).toFixed(2)}px;z-index:${layer}"></span>`).join('');
  return `<div class="mini-stack" style="--stack-offset:${(count * .28).toFixed(2)}px" aria-label="${count} cartes restantes">${layers}</div>`;
}

function scheduleBot() {
  if (game.over || game.transitioning || game.current === 0 || botTimer !== null) return;
  const profile = botProfiles[opponentSelect.value] || botProfiles.normal;
  const delay = profile.minimumDelay + Math.random() * (profile.maximumDelay - profile.minimumDelay);
  const shouldSlap = isSlappable() && Math.random() < profile.accuracy;
  const player = game.current;
  botTimer = window.setTimeout(() => {
    botTimer = null;
    if (!game.over && !game.transitioning && game.current === player) {
      if (shouldSlap && isSlappable()) slap(player); else play(player);
    }
  }, delay);
}

function finish(winner) {
  game.over = true;
  clearBotTimer();
  status.textContent = winner === null ? 'Partie nulle.' : `${playerName(winner)} remporte la partie !`;
}

function settleCapturedPile() {
  if (!game?.capture) return;
  const { cards, winner } = game.capture;
  game.hands[winner].push(...cards);
  game.capture = null;
  game.transitioning = false;
  game.lastWinner = winner;
  game.lastCard = null;
  const remaining = activePlayers();
  if (remaining.length < 2) finish(remaining[0] ?? winner);
  render();
}

function awardPile(player, reason, action = 'win') {
  clearBotTimer();
  const cards = game.pile.splice(0);
  game.capture = { cards, winner: player, reason, action };
  game.transitioning = true;
  game.current = player;
  game.challenger = null;
  game.remainingAttempts = 0;
  game.lastWinner = player;
  log(`${playerName(player)} remporte ${cards.length} carte${cards.length > 1 ? 's' : ''} : ${reason}.`);
  status.textContent = action === 'slap' ? `${playerName(player)} tape correctement et gagne le tas !` : `${playerName(player)} remporte le tas.`;
  render();
  captureTimer = window.setTimeout(() => { captureTimer = null; settleCapturedPile(); }, 1350);
}

function play(player) {
  if (game.over || game.transitioning || player !== game.current || !game.hands[player].length) return;
  clearBotTimer();
  const card = game.hands[player].shift();
  card.playedBy = player;
  game.pile.push(card);
  game.lastCard = card;
  game.lastPlayer = player;
  game.slapEffect = null;
  const attempts = attemptsForFigure[card.label];
  if (attempts) {
    game.challenger = player;
    game.remainingAttempts = attempts;
    game.current = nextPlayer(player);
    status.textContent = `${playerName(game.current)} doit répondre à ${card.label} en ${attempts} tentative${attempts > 1 ? 's' : ''}.`;
  } else if (game.remainingAttempts) {
    game.remainingAttempts -= 1;
    if (!game.remainingAttempts) { awardPile(game.challenger, 'la figure n’a pas été contrée'); return; }
    game.current = nextPlayer(player);
    status.textContent = `${playerName(game.current)} a encore ${game.remainingAttempts} tentative${game.remainingAttempts > 1 ? 's' : ''}.`;
  } else {
    game.current = nextPlayer(player);
    status.textContent = `À ${playerName(game.current)} de jouer.`;
  }
  const remaining = activePlayers();
  if (remaining.length < 2) finish(remaining[0] ?? null);
  render();
}

function slap(player) {
  if (game.over || game.transitioning || !game.pile.length || !game.hands[player].length) return;
  clearBotTimer();
  if (isSlappable()) { game.slapEffect = { player, correct: true }; awardPile(player, 'tape correcte', 'slap'); return; }
  const recipient = nextPlayer(player);
  const penalty = game.hands[player].shift();
  game.hands[recipient].push(penalty);
  game.slapEffect = { player, correct: false };
  status.textContent = `Tape incorrecte : ${playerName(player)} donne une carte.`;
  log(`${playerName(player)} tape sans combinaison et donne une carte.`);
  render();
  window.setTimeout(() => { if (game) { game.slapEffect = null; render(); } }, 800);
}

function normalPileMarkup() {
  if (!game.pile.length) return '<div class="empty-pile muted">Tas vide</div>';
  const visible = game.pile.slice(-6);
  return visible.map((card, index) => {
    const distance = visible.length - index - 1;
    const newest = card === game.lastCard;
    return `<div class="pile-card${newest ? ' newest' : ''}" style="--offset-x:${-distance * 13}px;--offset-y:${distance * 2}px;--rotation:${(index - visible.length / 2) * 1.1}deg;z-index:${index}">${cardMarkup(card)}</div>`;
  }).join('');
}

function capturePileMarkup() {
  const { cards, winner, action } = game.capture;
  const visible = cards.slice(-9);
  const middle = (visible.length - 1) / 2;
  const cardsMarkup = visible.map((card, index) => {
    const outcome = card.playedBy === winner ? 'won' : 'lost';
    const icon = outcome === 'won' ? '✓' : '×';
    return `<div class="pile-card capture ${outcome}" style="--offset-x:${(index - middle) * 39}px;--offset-y:${Math.abs(index - middle) * 4}px;--rotation:${(index - middle) * 3.2}deg;z-index:${index}">${cardMarkup(card)}<span class="outcome-icon" aria-label="${outcome === 'won' ? 'Carte du gagnant' : 'Carte perdante'}">${icon}</span></div>`;
  }).join('');
  return `${cardsMarkup}<span class="capture-count">${cards.length} cartes → ${playerName(winner)}</span>${action === 'slap' ? '<span class="slap-burst" aria-label="Tape correcte">✋</span>' : ''}`;
}

function render() {
  scores.innerHTML = game.hands.map((hand, player) => `<div class="score${game.current === player && !game.transitioning ? ' active' : ''}${game.lastWinner === player && game.transitioning ? ' winner' : ''}" data-player-score="${player}"><span>${playerName(player)}</span>${deckStackMarkup(hand.length)}<strong>${hand.length} carte${hand.length > 1 ? 's' : ''}</strong></div>`).join('');
  pileElement.innerHTML = game.capture ? capturePileMarkup() : normalPileMarkup();
  if (!game.capture && game.slapEffect) pileElement.insertAdjacentHTML('beforeend', `<span class="slap-burst${game.slapEffect.correct ? '' : ' bad'}" aria-label="${game.slapEffect.correct ? 'Tape correcte' : 'Tape incorrecte'}">✋</span>`);
  const hand = game.hands[0];
  actions.innerHTML = `<button class="primary" data-play="0" ${game.over || game.transitioning || game.current !== 0 || !hand.length ? 'disabled' : ''}>Vous jouez</button><button class="slap" data-slap="0" ${game.over || game.transitioning || !game.pile.length || !hand.length ? 'disabled' : ''}>Vous tapez</button>`;
  actions.querySelectorAll('[data-play]').forEach(button => button.addEventListener('click', () => play(Number(button.dataset.play))));
  actions.querySelectorAll('[data-slap]').forEach(button => button.addEventListener('click', () => slap(Number(button.dataset.slap))));
  history.innerHTML = game.logs.length ? game.logs.map(message => `<li>${message}</li>`).join('') : '<li>Vous commencez.</li>';
  scheduleBot();
}

function createGame() {
  clearBotTimer();
  clearCaptureTimer();
  const players = Number(playerCountSelect.value);
  const hands = Array.from({ length: players }, () => []);
  CardTools.shuffle(CardTools.createDeck()).forEach((card, index) => hands[index % players].push(card));
  game = { players, hands, pile: [], capture: null, transitioning: false, current: 0, challenger: null, remainingAttempts: 0, lastPlayer: null, lastCard: null, lastWinner: null, slapEffect: null, logs: [], over: false };
  status.textContent = 'Vous commencez.';
  render();
}

newGameButton.addEventListener('click', createGame);
opponentSelect.addEventListener('change', createGame);
playerCountSelect.addEventListener('change', createGame);
slapOnSeven.addEventListener('change', render);
slapOnTenSandwich.addEventListener('change', render);
window.addEventListener('keydown', event => {
  if (event.repeat) return;
  if (event.key === ' ') { event.preventDefault(); play(0); }
  if (event.key.toLowerCase() === 'a') slap(0);
});
localStorage.setItem('game-hub:last-game', 'bataille-corse');
createGame();

if (new URLSearchParams(location.search).has('battleTest')) {
  const checks = [document.querySelectorAll('.mini-layer').length === 52];
  const winnerBefore = game.hands[0].length;
  const winnerCard = game.hands[0].shift();
  const loserCard = game.hands[1].shift();
  winnerCard.playedBy = 0;
  loserCard.playedBy = 1;
  game.pile.push(winnerCard, loserCard);
  game.lastCard = loserCard;
  game.slapEffect = { player: 0, correct: true };
  awardPile(0, 'test visuel', 'slap');
  checks.push(game.transitioning && game.capture.cards.length === 2);
  checks.push(document.querySelectorAll('.capture.lost .outcome-icon').length === 1);
  checks.push(Boolean(document.querySelector('.slap-burst')));
  checks.push(document.querySelectorAll('.mini-layer').length === 50);
  window.setTimeout(() => {
    checks.push(!game.transitioning && game.hands[0].length === winnerBefore + 1);
    checks.push(document.querySelectorAll('.mini-layer').length === 52);
    document.title = `CORSE TEST · ${checks.filter(Boolean).length}/${checks.length}`;
  }, 1500);
}
