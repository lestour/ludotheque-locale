const boardElement = document.getElementById('board');
const statusElement = document.getElementById('status');
const scoreElement = document.getElementById('score');
const historyElement = document.getElementById('history');
const rulesElement = document.getElementById('rules');
const sizeSelect = document.getElementById('size');
const variantSelect = document.getElementById('variant');
const difficultySelect = document.getElementById('difficulty');
const komiInput = document.getElementById('komi');
const passButton = document.getElementById('pass');
const undoButton = document.getElementById('undo');
const redoButton = document.getElementById('redo');
const hintButton = document.getElementById('hint');
let game;
let botTimer;
const stoneAnimationDuration = 430;

function lanActive() { return Boolean(window.LanMultiplayer?.active); }
function lanPlaying() { return !lanActive() || window.LanMultiplayer.room?.phase === 'playing'; }
function localColor() { return lanActive() && window.LanMultiplayer.playerIndex === 1 ? 2 : 1; }
function colorSeat(color) { return color - 1; }
function stopBot() { clearTimeout(botTimer); botTimer = 0; }
function colorName(color) {
  if (!lanActive()) return color === 1 ? 'Vous' : 'Bot';
  return window.LanMultiplayer.room?.seats?.[colorSeat(color)]?.label || (color === 1 ? 'Noirs' : 'Blancs');
}
function localCanPlay() { return lanPlaying() && !game.over && game.turn === localColor(); }
function controlsLanBot(color) {
  const room = window.LanMultiplayer?.room;
  const seat = room?.seats?.[colorSeat(color)];
  return Boolean(lanActive() && room?.hostId === window.LanMultiplayer.playerId && seat?.controller === 'bot');
}

function reducedMotion() { return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; }
function pointAt(index) { return boardElement.querySelector(`[data-index="${index}"]`); }

function animateCapturedStones(indexes) {
  if (reducedMotion()) return;
  indexes.forEach((index, captureIndex) => {
    const point = pointAt(index);
    const stone = point?.querySelector('.stone');
    if (!point || !stone) return;
    const rect = point.getBoundingClientRect();
    const layer = document.createElement('div');
    layer.className = 'go-capture-ghost';
    layer.style.left = `${rect.left}px`;
    layer.style.top = `${rect.top}px`;
    layer.style.width = `${rect.width}px`;
    layer.style.height = `${rect.height}px`;
    layer.appendChild(stone.cloneNode(true));
    document.body.appendChild(layer);
    const angle = (captureIndex % 2 ? 1 : -1) * (12 + captureIndex % 4 * 4);
    const animation = layer.animate([
      { transform: 'scale(1) translateY(0) rotate(0)', opacity: 1, filter: 'drop-shadow(0 2px 3px #0008)' },
      { transform: `scale(1.18) translateY(-7px) rotate(${angle * .25}deg)`, opacity: 1, filter: 'drop-shadow(0 0 10px #ef4444)', offset: .35 },
      { transform: `scale(.12) translateY(18px) rotate(${angle}deg)`, opacity: 0, filter: 'drop-shadow(0 0 12px #ef4444)' }
    ], { duration: stoneAnimationDuration, delay: captureIndex * 24, easing: 'ease-in', fill: 'forwards' });
    animation.finished.then(() => layer.remove()).catch(() => layer.remove());
  });
}

function setMotion(index, capturedIndexes) {
  game.motion = { placed: index, captured: capturedIndexes.slice(), until: Date.now() + stoneAnimationDuration + 80 };
  setTimeout(() => { if (game?.motion?.until <= Date.now()) game.motion = null; }, stoneAnimationDuration + 100);
}

function other(color) { return color === 1 ? 2 : 1; }
function indexOf(row, column) { return row * game.size + column; }
function coordinates(index) { return [Math.floor(index / game.size), index % game.size]; }
function neighbors(index) {
  const [row, column] = coordinates(index);
  return [[row - 1, column], [row + 1, column], [row, column - 1], [row, column + 1]]
    .filter(([nextRow, nextColumn]) => nextRow >= 0 && nextRow < game.size && nextColumn >= 0 && nextColumn < game.size)
    .map(([nextRow, nextColumn]) => indexOf(nextRow, nextColumn));
}
function boardKey(board) { return board.join(''); }
function columnLabel(column) {
  let value = column + 1;
  let label = '';
  while (value) { value -= 1; label = String.fromCharCode(65 + value % 26) + label; value = Math.floor(value / 26); }
  return label;
}
function moveLabel(index) { const [row, column] = coordinates(index); return `${columnLabel(column)}${game.size - row}`; }

function groupAt(board, start) {
  const color = board[start];
  const stones = new Set([start]);
  const liberties = new Set();
  const queue = [start];
  while (queue.length) {
    const current = queue.pop();
    neighbors(current).forEach(next => {
      if (!board[next]) liberties.add(next);
      else if (board[next] === color && !stones.has(next)) { stones.add(next); queue.push(next); }
    });
  }
  return { stones: [...stones], liberties: [...liberties] };
}

function simulateMove(board, index, color) {
  if (board[index]) return null;
  const next = board.slice();
  next[index] = color;
  let captured = 0;
  const capturedIndexes = [];
  neighbors(index).forEach(neighbor => {
    if (next[neighbor] !== other(color)) return;
    const group = groupAt(next, neighbor);
    if (!group.liberties.length) {
      captured += group.stones.length;
      capturedIndexes.push(...group.stones);
      group.stones.forEach(stone => { next[stone] = 0; });
    }
  });
  if (!groupAt(next, index).liberties.length) return null;
  if (game.variant === 'nogo' && captured) return null;
  if (game.seenPositions?.has(boardKey(next))) return null;
  return { board: next, captured, capturedIndexes };
}

function legalMoves(color, board = game.board) {
  const moves = [];
  board.forEach((cell, index) => { if (!cell && simulateMove(board, index, color)) moves.push(index); });
  return moves;
}

function territoryScore() {
  const visited = new Set();
  const score = [0, 0, Number(komiInput.value || 0)];
  game.board.forEach((color, start) => {
    if (color) score[color] += 1;
    if (color || visited.has(start)) return;
    const region = [];
    const borders = new Set();
    const queue = [start];
    visited.add(start);
    while (queue.length) {
      const current = queue.pop();
      region.push(current);
      neighbors(current).forEach(next => {
        if (game.board[next]) borders.add(game.board[next]);
        else if (!visited.has(next)) { visited.add(next); queue.push(next); }
      });
    }
    if (borders.size === 1) score[[...borders][0]] += region.length;
  });
  return score;
}

function snapshot() {
  return { board: game.board.slice(), previousBoard: game.previousBoard, seenPositions: [...game.seenPositions], turn: game.turn, passes: game.passes, captures: game.captures.slice(), last: game.last, hint: game.hint, over: game.over, outcome: game.outcome, motion: null, log: game.log.slice(), status: statusElement.textContent };
}
function restore(state) {
  Object.assign(game, { ...state, board: state.board.slice(), seenPositions: new Set(state.seenPositions), captures: state.captures.slice(), log: state.log.slice() });
  statusElement.textContent = state.status;
}

function finishGame(reason, winnerColor = null) {
  game.over = true;
  stopBot();
  let outcome;
  if (winnerColor) statusElement.textContent = `${reason} ${colorName(winnerColor)} gagne.`;
  else {
    const score = territoryScore();
    const winner = score[1] > score[2] ? `${colorName(1)} gagne` : score[2] > score[1] ? `${colorName(2)} gagne` : 'Égalité';
    statusElement.textContent = `${reason} ${winner}, ${score[1].toFixed(1)} à ${score[2].toFixed(1)}.`;
    outcome = score[1] === score[2] ? 'draw' : (score[1] > score[2] ? 1 : 2) === localColor() ? 'win' : 'loss';
  }
  game.outcome = outcome || (winnerColor === localColor() ? 'win' : 'loss');
  window.GameEffects?.play(game.outcome === 'win' ? 'win' : game.outcome === 'loss' ? 'error' : 'draw');
  const finalScore = territoryScore();
  const resolvedWinner = winnerColor || (finalScore[1] === finalScore[2] ? null : finalScore[1] > finalScore[2] ? 1 : 2);
  window.GameRecords?.finish({ score: finalScore[localColor()], scoreLabel: `${finalScore[localColor()].toFixed(1)} points`, won: resolvedWinner === localColor(), winnerSeat: resolvedWinner === null ? null : colorSeat(resolvedWinner) });
  render();
}

function checkForcedEnding(lastColor) {
  if (game.variant === 'capture5' && game.captures[lastColor] >= 5) { finishGame('Cinq pierres ont été capturées.', lastColor); return true; }
  if (game.variant === 'nogo' && !legalMoves(other(lastColor)).length) { finishGame('Le prochain joueur ne dispose plus d’aucun coup légal.', lastColor); return true; }
  return false;
}

function playMove(index, color = game.turn, broadcast = false, controlledSeat = null) {
  if (game.over || color !== game.turn) return false;
  const result = simulateMove(game.board, index, color);
  if (!result) {
    if (color === 1) statusElement.textContent = game.variant === 'nogo' ? 'Coup illégal : en NoGo, capturer est également interdit.' : 'Coup illégal : intersection occupée, suicide ou répétition de ko.';
    return false;
  }
  game.history.push(snapshot());
  game.future = [];
  animateCapturedStones(result.capturedIndexes);
  setMotion(index, result.capturedIndexes);
  game.previousBoard = boardKey(game.board);
  game.board = result.board;
  game.seenPositions.add(boardKey(game.board));
  game.captures[color] += result.captured;
  game.last = index;
  game.hint = -1;
  game.passes = 0;
  game.log.unshift(`${colorName(color)} joue ${moveLabel(index)}${result.captured ? ` et capture ${result.captured}` : ''}.`);
  game.log = game.log.slice(0, 20);
  window.GameEffects?.play(result.captured ? 'success' : 'move');
  if (broadcast && lanActive()) sendLanAction({ type: 'go-move', index, controlledSeat });
  if (game.variant === 'atari' && result.captured) { finishGame('Première capture.', color); return true; }
  if (checkForcedEnding(color)) return true;
  game.turn = other(color);
  statusElement.textContent = game.turn === localColor() ? 'À vous de jouer.' : `${colorName(game.turn)} réfléchit.`;
  render();
  scheduleBot();
  return true;
}

function tacticalScore(index, color, board = game.board) {
  const result = simulateMove(board, index, color);
  if (!result) return -Infinity;
  const ownGroup = groupAt(result.board, index);
  let enemyAtari = 0;
  let rescued = 0;
  neighbors(index).forEach(neighbor => {
    if (result.board[neighbor] === other(color)) {
      const enemyGroup = groupAt(result.board, neighbor);
      if (enemyGroup.liberties.length === 1) enemyAtari += enemyGroup.stones.length;
    }
    if (board[neighbor] === color) {
      const oldGroup = groupAt(board, neighbor);
      if (oldGroup.liberties.length === 1 && ownGroup.liberties.length > 1) rescued += oldGroup.stones.length;
    }
  });
  const center = (game.size - 1) / 2;
  const [row, column] = coordinates(index);
  const centerBonus = Math.max(0, game.size - Math.abs(row - center) - Math.abs(column - center)) / game.size;
  const selfAtariPenalty = ownGroup.liberties.length === 1 && !result.captured ? 18 + ownGroup.stones.length * 2 : 0;
  return result.captured * 42 + enemyAtari * 8 + rescued * 7 + ownGroup.liberties * 1.4 + centerBonus - selfAtariPenalty;
}

function candidateMoves(color) {
  const all = legalMoves(color);
  if (game.board.every(cell => !cell)) return all;
  const active = all.filter(index => neighbors(index).some(neighbor => game.board[neighbor]));
  return active.length >= Math.min(12, all.length) ? active : all;
}

function bestMoveFor(color) {
  const moves = candidateMoves(color);
  if (!moves.length) return null;
  return moves.map(index => ({ index, score: tacticalScore(index, color) })).sort((left, right) => right.score - left.score)[0];
}

function showHint() {
  if (!localCanPlay() || lanActive()) return;
  const hint = bestMoveFor(localColor());
  if (!hint) { statusElement.textContent = 'Aucun coup légal : il faut passer.'; return; }
  const result = simulateMove(game.board, hint.index, 1);
  const liberties = groupAt(result.board, hint.index).liberties.length;
  game.hint = hint.index;
  statusElement.textContent = `Indice : ${moveLabel(hint.index)} offre ${liberties} liberté(s)${result.captured ? ` et capture ${result.captured} pierre(s)` : ''}.`;
  render();
}

function chooseBotMove(color = 2) {
  const level = difficultySelect.value;
  const moves = candidateMoves(color);
  if (!moves.length) return null;
  const noise = level === 'easy' ? 22 : level === 'normal' ? 7 : level === 'hard' ? 1.4 : 0;
  const ranked = moves.map(index => ({ index, score: tacticalScore(index, color) + Math.random() * noise })).sort((left, right) => right.score - left.score);
  if (level !== 'extreme') return ranked[0].index;
  const shortlist = ranked.slice(0, game.size >= 19 ? 12 : 18);
  shortlist.forEach(candidate => {
    const result = simulateMove(game.board, candidate.index, color);
    const savedBoard = game.board;
    const savedPrevious = game.previousBoard;
    game.board = result.board;
    game.previousBoard = boardKey(savedBoard);
    const opponent = other(color);
    const replies = candidateMoves(opponent).map(index => tacticalScore(index, opponent)).sort((left, right) => right - left).slice(0, 10);
    game.board = savedBoard;
    game.previousBoard = savedPrevious;
    candidate.score -= (replies[0] || 0) * .78;
  });
  shortlist.sort((left, right) => right.score - left.score);
  return shortlist[0].index;
}

function scheduleBot() {
  if (botTimer || game.over) return;
  const automatedColor = game.turn;
  if (lanActive()) {
    if (!lanPlaying() || !controlsLanBot(automatedColor)) return;
  } else if (automatedColor !== 2) return;
  const delays = { easy: 720, normal: 430, hard: 230, extreme: 120 };
  botTimer = setTimeout(() => {
    botTimer = 0;
    if (game.over || game.turn !== automatedColor || (lanActive() ? !controlsLanBot(automatedColor) : automatedColor !== 2)) return;
    const move = chooseBotMove(automatedColor);
    if (move === null) {
      if (game.variant === 'nogo') finishGame(`${colorName(automatedColor)} ne dispose plus d’aucun coup légal.`, other(automatedColor));
      else passTurn(automatedColor, lanActive(), lanActive() ? colorSeat(automatedColor) : null);
      return;
    }
    if (game.variant === 'area' && game.board.filter(Boolean).length > game.board.length * .72 && Math.random() < .28) passTurn(automatedColor, lanActive(), lanActive() ? colorSeat(automatedColor) : null);
    else playMove(move, automatedColor, lanActive(), lanActive() ? colorSeat(automatedColor) : null);
  }, Math.max(stoneAnimationDuration + 70, delays[difficultySelect.value]));
}

function passTurn(color = game.turn, broadcast = false, controlledSeat = null) {
  if (game.over || color !== game.turn || game.variant !== 'area') return;
  game.history.push(snapshot());
  game.future = [];
  game.hint = -1;
  game.passes += 1;
  game.log.unshift(`${colorName(color)} passe.`);
  game.turn = other(color);
  if (broadcast && lanActive()) sendLanAction({ type: 'go-pass', controlledSeat });
  if (game.passes >= 2) { finishGame('Deux passes consécutives.'); return; }
  render();
  scheduleBot();
}

function sendLanAction(action) {
  window.LanMultiplayer.sendAction(action).catch(error => { statusElement.textContent = `Synchronisation LAN interrompue : ${error.message}`; });
}

function rulesText() {
  const common = 'Les groupes sans liberté sont capturés ; le suicide et toute répétition d’une position antérieure (superko positionnel) sont interdits.';
  if (game.variant === 'atari') return `Atari Go : ${common} La première capture gagne immédiatement.`;
  if (game.variant === 'capture5') return `Capture 5 : ${common} Le premier camp totalisant cinq pierres capturées gagne.`;
  if (game.variant === 'nogo') return 'NoGo : les captures et le suicide sont interdits. Le premier joueur ne disposant plus d’aucune intersection légale perd.';
  return `Posez alternativement les pierres sur les intersections. ${common} Deux passes terminent la partie ; les pierres et territoires contrôlés sont alors comptés, avec le komi des Blancs.`;
}

function render() {
  boardElement.style.setProperty('--size', game.size);
  ['win', 'loss', 'draw'].forEach(outcome => boardElement.classList.toggle(`game-${outcome}`, game.outcome === outcome));
  statusElement.classList.toggle('result-win', game.outcome === 'win');
  statusElement.classList.toggle('result-loss', game.outcome === 'loss');
  statusElement.classList.toggle('result-draw', game.outcome === 'draw');
  boardElement.innerHTML = game.board.map((color, index) => {
    const [row, column] = coordinates(index);
    const edges = `${column === 0 ? ' edge-left' : ''}${column === game.size - 1 ? ' edge-right' : ''}${row === 0 ? ' edge-top' : ''}${row === game.size - 1 ? ' edge-bottom' : ''}`;
    const placed = game.motion?.until > Date.now() && game.motion.placed === index;
    return `<button class="point${edges}${game.last === index ? ' last' : ''}${game.hint === index ? ' hint' : ''}" data-index="${index}">${color ? `<span class="stone ${color === 1 ? 'black' : 'white'}${placed ? ' placed' : ''}"></span>` : ''}</button>`;
  }).join('');
  boardElement.querySelectorAll('.point').forEach(point => point.addEventListener('click', () => {
    if (!localCanPlay()) return;
    playMove(Number(point.dataset.index), localColor(), lanActive());
  }));
  const score = territoryScore();
  scoreElement.innerHTML = `<div>Noir · ${colorName(1)}<br><strong>${score[1].toFixed(1)}</strong><small><br>${game.captures[1]} capture(s)</small></div><div>Blanc · ${colorName(2)}<br><strong>${score[2].toFixed(1)}</strong><small><br>${game.captures[2]} capture(s) + komi</small></div>`;
  historyElement.innerHTML = game.log.map(entry => `<li>${entry}</li>`).join('') || `<li>${colorName(1)} pose la première pierre.</li>`;
  rulesElement.textContent = rulesText();
  passButton.disabled = game.variant !== 'area' || !localCanPlay();
  undoButton.disabled = lanActive() || !game.history.length;
  redoButton.disabled = lanActive() || !game.future.length;
  hintButton.disabled = lanActive() || !localCanPlay();
}

function newGame() {
  stopBot();
  const size = Number(sizeSelect.value);
  const board = Array(size * size).fill(0);
  game = { size, variant: variantSelect.value, board, previousBoard: '', seenPositions: new Set([boardKey(board)]), turn: 1, passes: 0, captures: [0, 0, 0], last: -1, hint: -1, over: false, outcome: null, motion: null, log: [], history: [], future: [] };
  statusElement.textContent = localColor() === 1 ? 'À vous de jouer avec les Noirs.' : `${colorName(1)} commence avec les Noirs.`;
  render();
}

document.getElementById('newGame').addEventListener('click', newGame);
passButton.addEventListener('click', () => { if (localCanPlay()) passTurn(localColor(), lanActive()); });
hintButton.addEventListener('click', showHint);
undoButton.addEventListener('click', () => {
  if (lanActive()) return;
  stopBot();
  if (!game.history.length) return;
  const steps = game.turn === 1 ? Math.min(2, game.history.length) : 1;
  for (let step = 0; step < steps; step += 1) {
    game.future.push(snapshot());
    restore(game.history.pop());
  }
  render();
});
redoButton.addEventListener('click', () => {
  if (lanActive()) return;
  stopBot();
  if (!game.future.length) return;
  game.history.push(snapshot());
  restore(game.future.pop());
  render();
  if (!game.over && game.turn === 2) scheduleBot();
});
[sizeSelect, variantSelect, difficultySelect].forEach(control => control.addEventListener('change', newGame));
komiInput.addEventListener('change', render);
newGame();

function registerLanAdapter() {
  if (!window.LanMultiplayer || registerLanAdapter.done) return;
  registerLanAdapter.done = true;
  window.LanMultiplayer.registerAdapter({
    receive(action, playerId) {
      if (!action || game.over) return;
      const senderIndex = window.LanMultiplayer.room?.seats?.findIndex(seat => seat.playerId === playerId);
      const controlledSeat = Number.isInteger(action.controlledSeat) ? action.controlledSeat : senderIndex;
      const controlledByHost = window.LanMultiplayer.room?.hostId === playerId && window.LanMultiplayer.room?.seats?.[controlledSeat]?.controller === 'bot';
      if (controlledSeat !== senderIndex && !controlledByHost) return;
      const senderColor = controlledSeat === 1 ? 2 : 1;
      if (senderColor !== game.turn) return;
      if (action.type === 'go-move' && Number.isInteger(action.index) && action.index >= 0 && action.index < game.board.length) playMove(action.index, senderColor, false);
      else if (action.type === 'go-pass') passTurn(senderColor, false);
    }
  });
}

registerLanAdapter();
window.addEventListener('lan:available', registerLanAdapter);
window.addEventListener('lan:start', () => { newGame(); scheduleBot(); });
window.addEventListener('lan:room', () => { render(); scheduleBot(); });
window.addEventListener('lan:finished', () => { stopBot(); if (!game.over) { game.over = true; render(); } });

window.GoTestAPI = {
  diagnostics() {
    const legal = legalMoves(1);
    const sample = simulateMove(game.board, legal[0], 1);
    const sampleKey = sample ? boardKey(sample.board) : '';
    const wasSeen = game.seenPositions.has(sampleKey);
    if (sampleKey) game.seenPositions.add(sampleKey);
    const superkoBlocks = sampleKey ? simulateMove(game.board, legal[0], 1) === null : false;
    if (sampleKey && !wasSeen) game.seenPositions.delete(sampleKey);
    return {
      size: game.size,
      intersections: game.board.length,
      legalInitialMoves: legal.length,
      capturesValid: game.captures.length === 3 && game.captures.every(value => Number.isInteger(value) && value >= 0),
      superkoBlocks,
      historyReady: Array.isArray(game.history) && Array.isArray(game.future),
      hintAvailable: Boolean(bestMoveFor(1)),
      variants: [...variantSelect.options].map(option => option.value),
      rulesVisible: rulesText().length > 40
    };
  }
};

localStorage.setItem('game-hub:last-game', 'go');
