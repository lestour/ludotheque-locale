const stockSlot = document.getElementById('stock');
const wasteSlot = document.getElementById('waste');
const foundations = document.getElementById('foundations');
const tableau = document.getElementById('tableau');
const newGameButton = document.getElementById('newGame');
const autoFoundationButton = document.getElementById('autoFoundation');
const drawCount = document.getElementById('drawCount');
const dealDifficulty = document.getElementById('dealDifficulty');
const redealLimit = document.getElementById('redealLimit');
const acePosition = document.getElementById('acePosition');
const undoButton = document.getElementById('undo');
const redoButton = document.getElementById('redo');
const hintButton = document.getElementById('hint');
const solveStepButton = document.getElementById('solveStep');
const solveAllButton = document.getElementById('solveAll');
const finishGameButton = document.getElementById('finishGame');
const traceModeButton = document.getElementById('traceMode');
const previousTraceButton = document.getElementById('previousTrace');
const nextTraceButton = document.getElementById('nextTrace');
const traceSlider = document.getElementById('traceSlider');
const traceLabel = document.getElementById('traceLabel');
const status = document.getElementById('status');
const score = document.getElementById('score');
const errorCount = document.getElementById('errorCount');
const stockCount = document.getElementById('stockCount');
const wasteCount = document.getElementById('wasteCount');
const hiddenCount = document.getElementById('hiddenCount');
const rulesSummary = document.getElementById('rulesSummary');

const launchOptions = new URLSearchParams(window.location.search);
const requestedDrawCount = launchOptions.get('draw');
const requestedDifficulty = launchOptions.get('difficulty');
if (requestedDrawCount === '1' || requestedDrawCount === '3') drawCount.value = requestedDrawCount;
if (['easy', 'normal', 'hard', 'expert'].includes(requestedDifficulty)) dealDifficulty.value = requestedDifficulty;

let game;
let gameHistory = [];
let historyIndex = -1;
let pointerDrag = null;
let solverTrace = [];
let solverTraceMessages = [];
let traceIndex = 0;
let isViewingTrace = false;

function cardMarkup(card, selected = false, hidden = false, hinted = false) {
  if (hidden) return '<button class="card back" aria-label="Carte cachée">?</button>';
  if (!card) return '<span class="slot-empty">—</span>';
  return `<button class="card ${card.suit.color}${selected ? ' selected' : ''}${hinted ? ' hint' : ''}" aria-label="${card.label} de ${card.suit.name}"><span>${card.label}</span><strong>${card.suit.symbol}</strong></button>`;
}

function selectedIs(source, column, index) {
  return game.selected && game.selected.source === source && game.selected.column === column && game.selected.index === index;
}

function sameColor(first, second) {
  return first.suit.color === second.suit.color;
}

function foundationValue(card) {
  return card.label === 'A' ? 1 : card.value;
}

function tableauValue(card) {
  return game.acePosition === 'end' ? foundationValue(card) : card.value;
}

function firstTableauValue() {
  return game.acePosition === 'end' ? 13 : 14;
}

function cloneGameState(source = game) {
  return {
    ...source,
    stock: source.stock.map(card => ({ ...card })),
    waste: source.waste.map(card => ({ ...card })),
    tableau: source.tableau.map(pile => pile.map(card => ({ ...card }))),
    foundations: source.foundations.map(pile => pile.map(card => ({ ...card }))),
    selected: null,
    hint: null
  };
}

function saveHistory() {
  gameHistory = gameHistory.slice(0, historyIndex + 1);
  gameHistory.push(cloneGameState());
  historyIndex = gameHistory.length - 1;
}

function updateHistoryButtons() {
  undoButton.disabled = historyIndex <= 0;
  redoButton.disabled = historyIndex >= gameHistory.length - 1;
}

function restoreHistory(index) {
  if (index < 0 || index >= gameHistory.length) return;
  game = cloneGameState(gameHistory[index]);
  historyIndex = index;
  game.message = 'Coup restauré.';
  render();
}

function updateTraceControls() {
  const hasTrace = solverTrace.length > 1;
  const lastIndex = Math.max(0, solverTrace.length - 1);
  traceModeButton.disabled = false;
  previousTraceButton.disabled = !hasTrace || traceIndex === 0;
  nextTraceButton.disabled = !hasTrace || traceIndex === lastIndex;
  traceSlider.disabled = !hasTrace;
  traceSlider.max = lastIndex;
  traceSlider.value = traceIndex;
  traceModeButton.textContent = isViewingTrace ? 'Revenir au résultat' : (hasTrace ? 'Voir la trace' : 'Résoudre étape par étape');
  traceLabel.textContent = hasTrace ? `Étape ${traceIndex} / ${lastIndex}` : 'Aucune trace de résolution.';
}

function clearSolverTrace() {
  solverTrace = [];
  solverTraceMessages = [];
  traceIndex = 0;
  isViewingTrace = false;
}

function showTrace(index) {
  if (!solverTrace.length) return;
  traceIndex = Math.max(0, Math.min(index, solverTrace.length - 1));
  game = cloneGameState(solverTrace[traceIndex]);
  isViewingTrace = true;
  game.message = solverTraceMessages[traceIndex] || `Trace de résolution : étape ${traceIndex}.`;
  render();
}

function toggleTraceMode() {
  if (solverTrace.length < 2) {
    solveAll(true);
    return;
  }
  if (isViewingTrace) {
    traceIndex = solverTrace.length - 1;
    game = cloneGameState(solverTrace[traceIndex]);
    isViewingTrace = false;
    game.message = 'Résultat de la résolution automatique.';
    render();
  } else showTrace(0);
}

function beginManualAction() {
  if (isViewingTrace) game = cloneGameState(solverTrace.at(-1));
  if (solverTrace.length) clearSolverTrace();
}

function playAnimation(animation) {
  game.animation = animation;
  window.setTimeout(() => {
    if (game.animation !== animation) return;
    game.animation = null;
    render();
  }, 360);
}

function flipTableauTop(column) {
  const top = game.tableau[column].at(-1);
  if (top && !top.faceUp) {
    top.faceUp = true;
    playAnimation({ type: 'flip', column, index: game.tableau[column].length - 1 });
  }
}

function selectedCards(selection = game.selected) {
  if (!selection) return [];
  if (selection.source === 'waste') return game.waste.length ? [game.waste.at(-1)] : [];
  if (selection.source === 'foundation') return game.foundations[selection.column].length ? [game.foundations[selection.column].at(-1)] : [];
  return game.tableau[selection.column].slice(selection.index);
}

function validTableauStack(cards) {
  return cards.length && cards.every((card, index) => card.faceUp && (!index || (tableauValue(cards[index - 1]) === tableauValue(card) + 1 && !sameColor(cards[index - 1], card))));
}

function clearSelection() {
  game.selected = null;
  game.hint = null;
}

function selectCard(source, column = null, index = null) {
  beginManualAction();
  const selection = { source, column, index };
  const cards = selectedCards(selection);
  if (!cards.length || (source === 'tableau' && !validTableauStack(cards))) return;
  if (game.selected && game.selected.source === source && game.selected.column === column && game.selected.index === index) clearSelection();
  else game.selected = selection;
  game.message = game.selected ? 'Choisissez la destination de la carte ou de la suite.' : 'Sélection annulée.';
  render();
}

function removeSelectedCards(cards) {
  const selection = game.selected;
  if (selection.source === 'waste') game.waste.pop();
  else if (selection.source === 'foundation') game.foundations[selection.column].pop();
  else {
    game.tableau[selection.column].splice(selection.index, cards.length);
    flipTableauTop(selection.column);
  }
}

function moveToTableau(column) {
  const cards = selectedCards();
  const target = game.tableau[column].at(-1);
  const first = cards[0];
  const allowed = validTableauStack(cards) && (target ? target.faceUp && tableauValue(target) === tableauValue(first) + 1 && !sameColor(target, first) : tableauValue(first) === firstTableauValue());
  if (!allowed) return false;
  removeSelectedCards(cards);
  game.tableau[column].push(...cards);
  playAnimation({ type: 'move', area: 'tableau', column });
  clearSelection();
  game.message = 'Déplacement effectué.';
  return true;
}

function moveToFoundation(column) {
  const cards = selectedCards();
  const card = cards[0];
  const target = game.foundations[column].at(-1);
  const allowed = cards.length === 1 && (!target ? foundationValue(card) === 1 : target.suit.symbol === card.suit.symbol && foundationValue(card) === foundationValue(target) + 1);
  if (!allowed) return false;
  removeSelectedCards(cards);
  game.foundations[column].push(card);
  playAnimation({ type: 'move', area: 'foundation', column });
  clearSelection();
  game.message = 'Carte placée dans une fondation.';
  if (game.foundations.every(pile => pile.length === 13)) game.message = 'Bravo, le solitaire est terminé !';
  return true;
}

function invalidMove() {
  game.errors += 1;
  game.message = 'Déplacement impossible avec les règles du Klondike.';
  render();
}

function targetTableau(column) {
  beginManualAction();
  if (!game.selected) return;
  if (!moveToTableau(column)) invalidMove();
  else { saveHistory(); render(); }
}

function targetFoundation(column) {
  beginManualAction();
  if (!game.selected) return;
  if (!moveToFoundation(column)) invalidMove();
  else { saveHistory(); render(); }
}

function drawCards() {
  clearSelection();
  if (game.stock.length) {
    const amount = Math.min(game.drawCount, game.stock.length);
    for (let count = 0; count < amount; count += 1) {
      const card = game.stock.pop();
      card.faceUp = true;
      game.waste.push(card);
    }
    game.message = `${amount} carte${amount > 1 ? 's' : ''} piochée${amount > 1 ? 's' : ''}.`;
  } else if (game.waste.length) {
    if (game.redeals >= game.redealLimit) {
      game.message = 'Limite de recyclages atteinte.';
      return false;
    }
    game.stock = game.waste.reverse().map(card => ({ ...card, faceUp: false }));
    game.waste = [];
    game.redeals += 1;
    game.message = 'Pioche recyclée.';
  } else { game.message = 'La pioche est vide.'; return false; }
  return true;
}

function drawStock() {
  if (game.animatingDraw) return;
  beginManualAction();
  const amount = game.stock.length ? Math.min(game.drawCount, game.stock.length) : 0;
  const drawnCards = amount ? game.stock.slice(-amount).reverse() : [];
  if (!drawCards()) { render(); return; }
  saveHistory();
  if (!drawnCards.length) { render(); return; }
  game.animatingDraw = true;
  animateStockDraw(drawnCards, () => { game.animatingDraw = false; render(); });
}

function animateStockDraw(cards, onFinish) {
  const start = stockSlot.getBoundingClientRect();
  const end = wasteSlot.getBoundingClientRect();
  cards.forEach((drawnCard, index) => {
    const card = document.createElement('div');
    card.className = 'stock-draw-animation';
    card.style.left = `${start.left}px`;
    card.style.top = `${start.top}px`;
    const axis = index % 2 ? 'flip-vertical' : 'flip-horizontal';
    card.innerHTML = `<div class="flip-inner ${axis}"><div class="flip-face flip-back">?</div><div class="flip-face flip-front ${drawnCard.suit.color}"><span>${drawnCard.label}</span><strong>${drawnCard.suit.symbol}</strong></div></div>`;
    document.body.appendChild(card);
    window.setTimeout(() => {
      card.style.transform = `translate(${end.left - start.left + index * 20}px, ${end.top - start.top}px) rotate(${index * 3}deg)`;
      card.classList.add('move');
    }, index * 70);
    window.setTimeout(() => card.querySelector('.flip-inner')?.classList.add('revealed'), 220 + index * 70);
    window.setTimeout(() => {
      card.remove();
      if (index === cards.length - 1) onFinish?.();
    }, 610 + index * 70);
  });
}

function autoFoundation() {
  beginManualAction();
  if (!game.selected) {
    game.message = 'Sélectionnez une carte avant de l’envoyer vers une fondation.';
    render();
    return;
  }
  const card = selectedCards()[0];
  const target = game.foundations.findIndex(pile => {
    const top = pile.at(-1);
    return !top ? foundationValue(card) === 1 : top.suit.symbol === card.suit.symbol && foundationValue(card) === foundationValue(top) + 1;
  });
  if (target === -1 || !moveToFoundation(target)) invalidMove();
  else { saveHistory(); render(); }
}

function findFoundationTarget(selection) {
  const cards = selectedCards(selection);
  if (cards.length !== 1) return -1;
  const card = cards[0];
  return game.foundations.findIndex(pile => {
    const top = pile.at(-1);
    return !top ? foundationValue(card) === 1 : top.suit.symbol === card.suit.symbol && foundationValue(card) === foundationValue(top) + 1;
  });
}

function findTableauTarget(cards, sourceColumn = null) {
  if (!validTableauStack(cards)) return -1;
  const first = cards[0];
  return game.tableau.findIndex((pile, target) => {
    if (target === sourceColumn) return false;
    const top = pile.at(-1);
    return top ? top.faceUp && tableauValue(top) === tableauValue(first) + 1 && !sameColor(top, first) : tableauValue(first) === firstTableauValue();
  });
}

function findHint(includeDraw = true) {
  const sources = [];
  if (game.waste.length) sources.push({ source: 'waste', column: null, index: null });
  game.tableau.forEach((pile, column) => {
    const topIndex = pile.length - 1;
    if (topIndex >= 0 && pile[topIndex].faceUp) sources.push({ source: 'tableau', column, index: topIndex });
  });
  for (const source of sources) {
    const foundation = findFoundationTarget(source);
    if (foundation !== -1) return { type: 'foundation', source, target: foundation, message: 'Cette carte peut monter dans une fondation.' };
  }
  const tableauCandidates = [];
  if (game.waste.length) {
    const source = { source: 'waste', column: null, index: null };
    const target = findTableauTarget(selectedCards(source));
    if (target !== -1) tableauCandidates.push({ type: 'tableau', source, target, score: 80, message: 'La carte de défausse peut rejoindre le tableau.' });
  }
  for (let sourceColumn = 0; sourceColumn < game.tableau.length; sourceColumn += 1) {
    const pile = game.tableau[sourceColumn];
    for (let index = 0; index < pile.length; index += 1) {
      const cards = selectedCards({ source: 'tableau', column: sourceColumn, index });
      if (!validTableauStack(cards)) continue;
      const target = findTableauTarget(cards, sourceColumn);
      if (target === -1) continue;
      const revealsCard = index > 0 && !pile[index - 1].faceUp;
      const emptiesColumn = index === 0;
      if (!revealsCard && !emptiesColumn) continue;
      tableauCandidates.push({
        type: 'tableau', source: { source: 'tableau', column: sourceColumn, index }, target,
        score: (revealsCard ? 120 : 0) + (emptiesColumn ? 25 : 0) + cards.length,
        message: revealsCard ? 'Cette suite dévoile une carte cachée.' : 'Cette suite prépare un nouveau déplacement utile.'
      });
    }
  }
  if (tableauCandidates.length) {
    tableauCandidates.sort((left, right) => right.score - left.score);
    const { score, ...hint } = tableauCandidates[0];
    return hint;
  }
  for (let column = 0; column < game.tableau.length; column += 1) {
    const top = game.tableau[column].at(-1);
    if (top && !top.faceUp) return { type: 'flip', target: column, message: 'Cette carte cachée peut être retournée.' };
  }
  return includeDraw && (game.stock.length || game.waste.length) ? { type: 'draw', message: 'Piochez pour découvrir une nouvelle carte.' } : null;
}

function stateTableauValue(state, card) {
  return state.acePosition === 'end' ? foundationValue(card) : card.value;
}

function stateFirstTableauValue(state) {
  return state.acePosition === 'end' ? 13 : 14;
}

function stateValidTableauStack(state, cards) {
  return cards.length && cards.every((card, index) => card.faceUp && (!index || (stateTableauValue(state, cards[index - 1]) === stateTableauValue(state, card) + 1 && !sameColor(cards[index - 1], card))));
}

function stateFoundationTarget(state, card) {
  return state.foundations.findIndex(pile => {
    const top = pile.at(-1);
    return !top ? foundationValue(card) === 1 : top.suit.symbol === card.suit.symbol && foundationValue(card) === foundationValue(top) + 1;
  });
}

function stateTableauTarget(state, cards, sourceColumn = null) {
  return stateTableauTargets(state, cards, sourceColumn)[0] ?? -1;
}

function stateTableauTargets(state, cards, sourceColumn = null) {
  if (!stateValidTableauStack(state, cards)) return [];
  const first = cards[0];
  return state.tableau.flatMap((pile, target) => {
    if (target === sourceColumn) return [];
    const top = pile.at(-1);
    const allowed = top
      ? top.faceUp && stateTableauValue(state, top) === stateTableauValue(state, first) + 1 && !sameColor(top, first)
      : stateTableauValue(state, first) === stateFirstTableauValue(state);
    return allowed ? [target] : [];
  });
}

function solverMoves(state) {
  const moves = [];
  const exposedWasteScore = () => {
    const nextCard = state.waste.at(-2);
    if (!nextCard) return 0;
    const foundationTarget = stateFoundationTarget(state, nextCard);
    const tableauTargets = stateTableauTargets(state, [nextCard]);
    return foundationTarget !== -1 ? 120 : (tableauTargets.length ? 75 : 15);
  };
  const addFoundationMove = source => {
    const card = source.source === 'waste' ? state.waste.at(-1) : state.tableau[source.column].at(-1);
    const target = card?.faceUp ? stateFoundationTarget(state, card) : -1;
    if (target !== -1) moves.push({
      type: 'foundation', source, target,
      score: source.source === 'tableau' ? 90 : 70 + (source.source === 'waste' ? exposedWasteScore() : 0)
    });
  };
  if (state.waste.length) addFoundationMove({ source: 'waste', column: null, index: null });
  state.tableau.forEach((pile, column) => { if (pile.length) addFoundationMove({ source: 'tableau', column, index: pile.length - 1 }); });
  const addTableauMove = (source, cards) => {
    const sourcePile = source.source === 'tableau' ? state.tableau[source.column] : null;
    const revealsCard = sourcePile && source.index > 0 && !sourcePile[source.index - 1].faceUp;
    const emptiesColumn = sourcePile && source.index === 0;
    for (const target of stateTableauTargets(state, cards, source.column)) {
      moves.push({
        type: 'tableau', source, target,
        score: (revealsCard ? 1000 : 0)
          + (source.source === 'waste' ? 500 + exposedWasteScore() : 0)
          + (source.source === 'foundation' ? -500 : 0)
          + (emptiesColumn ? 150 : 0)
          + cards.length
      });
    }
  };
  if (state.waste.length) addTableauMove({ source: 'waste', column: null, index: null }, [state.waste.at(-1)]);
  state.tableau.forEach((pile, column) => {
    for (let index = 0; index < pile.length; index += 1) {
      const cards = pile.slice(index);
      if (stateValidTableauStack(state, cards)) addTableauMove({ source: 'tableau', column, index }, cards);
    }
  });
  state.foundations.forEach((pile, column) => {
    if (pile.length) addTableauMove({ source: 'foundation', column, index: null }, [pile.at(-1)]);
  });
  if (state.stock.length || (state.waste.length && state.redeals < state.redealLimit)) moves.push({ type: 'draw', score: 1 });
  return moves.sort((left, right) => right.score - left.score);
}

function applySolverMove(state, move) {
  const next = cloneGameState(state);
  if (move.type === 'draw') {
    if (next.stock.length) {
      for (let count = 0; count < Math.min(next.drawCount, next.stock.length); count += 1) {
        const card = next.stock.pop();
        card.faceUp = true;
        next.waste.push(card);
      }
    } else {
      next.stock = next.waste.reverse().map(card => ({ ...card, faceUp: false }));
      next.waste = [];
      next.redeals += 1;
    }
    return next;
  }
  const cards = move.source.source === 'waste'
    ? [next.waste.pop()]
    : (move.source.source === 'foundation' ? [next.foundations[move.source.column].pop()] : next.tableau[move.source.column].splice(move.source.index));
  if (move.source.source === 'tableau' && next.tableau[move.source.column].length) next.tableau[move.source.column].at(-1).faceUp = true;
  if (move.type === 'foundation') next.foundations[move.target].push(cards[0]);
  else next.tableau[move.target].push(...cards);
  return next;
}

function solverStateSignature(state) {
  const signature = cardStateSignature(state);
  return state.redealLimit === Infinity ? signature.replace(`,"redeals":${state.redeals}`, ',"redeals":0') : signature;
}

function stateFitness(state) {
  const foundationCards = state.foundations.reduce((total, pile) => total + pile.length, 0);
  const visibleCards = state.tableau.reduce((total, pile) => total + pile.filter(card => card.faceUp).length, 0);
  const emptyColumns = state.tableau.filter(pile => !pile.length).length;
  const hiddenCards = state.tableau.reduce((total, pile) => total + pile.filter(card => !card.faceUp).length, 0);
  return foundationCards * 1000 + visibleCards * 80 + emptyColumns * 45 - hiddenCards * 25;
}

function searchBeam(initialState, maximumNodes, jitter) {
  const visited = new Set([solverStateSignature(initialState)]);
  const start = { state: cloneGameState(initialState), parent: null, score: stateFitness(initialState) };
  let frontier = [start];
  let nodes = 0;
  for (let depth = 0; depth < 420 && frontier.length && nodes < maximumNodes; depth += 1) {
    const candidates = [];
    for (const current of frontier) {
      for (const move of solverMoves(current.state)) {
        if (nodes >= maximumNodes) break;
        const next = applySolverMove(current.state, move);
        const signature = solverStateSignature(next);
        if (visited.has(signature)) continue;
        visited.add(signature);
        nodes += 1;
        const candidate = { state: next, parent: current, score: stateFitness(next) + Math.random() * jitter };
        if (next.foundations.every(pile => pile.length === 13)) {
          const states = [];
          for (let cursor = candidate; cursor; cursor = cursor.parent) states.push(cursor.state);
          return { states: states.reverse(), nodes };
        }
        candidates.push(candidate);
      }
    }
    candidates.sort((left, right) => right.score - left.score);
    frontier = candidates.slice(0, 220);
  }
  return { states: null, nodes };
}

function searchSolution(initialState, maximumNodes = 48000) {
  const foundationPlan = buildFoundationPlan(initialState);
  if (foundationPlan) return { states: foundationPlan, nodes: foundationPlan.length - 1 };
  const runs = 4;
  const budget = Math.floor(maximumNodes / runs);
  let explored = 0;
  for (let run = 0; run < runs; run += 1) {
    const result = searchBeam(initialState, budget, 35 + run * 70);
    explored += result.nodes;
    if (result.states) return { states: result.states, nodes: explored };
  }
  return { states: null, nodes: explored };
}

function executeHint(hint) {
  game.hint = null;
  if (hint.type === 'foundation') {
    game.selected = hint.source;
    moveToFoundation(hint.target);
  } else if (hint.type === 'tableau') {
    game.selected = hint.source;
    moveToTableau(hint.target);
  } else if (hint.type === 'flip') {
    game.tableau[hint.target].at(-1).faceUp = true;
    game.message = 'Carte cachée retournée.';
  } else if (hint.type === 'draw') {
    if (!drawCards()) return false;
  } else return false;
  saveHistory();
  return true;
}

function showHint() {
  beginManualAction();
  const hint = findHint();
  if (!hint) {
    game.message = 'Aucun coup sûr détecté : essayez une autre organisation du tableau.';
    game.hint = null;
  } else {
    game.hint = hint;
    game.message = `Indice : ${hint.message}`;
  }
  render();
}

function solveStep() {
  beginManualAction();
  solverTrace = [cloneGameState()];
  solverTraceMessages = ['État de départ.'];
  const hint = findHint(true);
  if (!hint || !executeHint(hint)) game.message = 'Aucune déduction automatique sûre disponible.';
  else {
    solverTrace.push(cloneGameState());
    solverTraceMessages.push(hint.message);
    traceIndex = 1;
  }
  updateTraceControls();
  render();
}

function solverTransitionMessage(previous, next) {
  const previousFoundationCards = previous.foundations.flat().length;
  const nextFoundationCards = next.foundations.flat().length;
  if (nextFoundationCards > previousFoundationCards) return 'Plan vérifié : une carte rejoint sa fondation.';
  if (next.stock.length < previous.stock.length) return `Plan vérifié : pioche de ${previous.drawCount} carte${previous.drawCount > 1 ? 's' : ''}.`;
  if (previous.stock.length === 0 && next.stock.length > 0) return 'Plan vérifié : recyclage de la pioche.';
  if (next.tableau.flat().filter(card => !card.faceUp).length < previous.tableau.flat().filter(card => !card.faceUp).length) return 'Plan vérifié : une carte cachée est retournée.';
  return 'Plan vérifié : déplacement utile.';
}

function solveAll(showTraceAtStart = false) {
  beginManualAction();
  solverTrace = [cloneGameState()];
  solverTraceMessages = ['État de départ.'];
  const search = searchSolution(game, 48000);
  if (search.states) {
    search.states.slice(1).forEach((state, index) => {
      solverTrace.push(cloneGameState(state));
      solverTraceMessages.push(solverTransitionMessage(search.states[index], state));
    });
    game = cloneGameState(search.states.at(-1));
  }
  const steps = Math.max(0, solverTrace.length - 1);
  game.message = steps
    ? `${steps} actions du plan de résolution appliquées.`
    : 'Aucun plan de résolution automatique trouvé après exploration complète de la pioche.';
  traceIndex = Math.max(0, solverTrace.length - 1);
  isViewingTrace = false;
  if (showTraceAtStart && solverTrace.length > 1) {
    showTrace(0);
    return;
  }
  updateTraceControls();
  render();
}

function canAutoFinish() {
  return game.stock.length === 0 && game.tableau.every(pile => pile.every(card => card.faceUp));
}

function finishGameAutomatically() {
  beginManualAction();
  if (!canAutoFinish()) {
    game.message = 'La finition automatique attend que toutes les cartes soient visibles et que la pioche soit vide.';
    render();
    return;
  }
  let moves = 0;
  while (moves < 100) {
    const hint = findHint(false);
    if (!hint || !executeHint(hint)) break;
    moves += 1;
  }
  game.message = moves ? `${moves} carte${moves > 1 ? 's' : ''} placée${moves > 1 ? 's' : ''} automatiquement.` : 'Aucune carte supplémentaire ne peut rejoindre les fondations.';
  render();
}

function isHintedCard(source, column, index) {
  return game.hint && game.hint.source && game.hint.source.source === source && game.hint.source.column === column && game.hint.source.index === index;
}

function enableDrag(cardButton, source, column = null, index = null) {
  const selection = { source, column, index };
  let justDragged = false;
  cardButton.draggable = true;
  cardButton.addEventListener('dragstart', event => {
    const cards = selectedCards(selection);
    if (!cards.length || (source === 'tableau' && !validTableauStack(cards))) { event.preventDefault(); return; }
    game.selected = selection;
    game.hint = null;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', `${source}:${column ?? ''}:${index ?? ''}`);
  });
  cardButton.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    pointerDrag = { selection, startX: event.clientX, startY: event.clientY, active: false, cardButton };
    cardButton.setPointerCapture?.(event.pointerId);
  });
  cardButton.addEventListener('pointermove', event => {
    if (!pointerDrag || pointerDrag.cardButton !== cardButton || pointerDrag.active) return;
    if (Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY) < 7) return;
    pointerDrag.active = true;
    cardButton.classList.add('dragging');
  });
  cardButton.addEventListener('pointerup', event => {
    if (!pointerDrag || pointerDrag.cardButton !== cardButton) return;
    const drag = pointerDrag;
    pointerDrag = null;
    cardButton.classList.remove('dragging');
    if (!drag.active) return;
    justDragged = true;
    window.setTimeout(() => { justDragged = false; }, 0);
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-drop-type]');
    if (!target) { game.message = 'Déposez la carte sur une colonne ou une fondation valide.'; render(); return; }
    game.selected = drag.selection;
    if (target.dataset.dropType === 'foundation') targetFoundation(Number(target.dataset.column));
    else targetTableau(Number(target.dataset.column));
  });
  cardButton.addEventListener('click', event => {
    if (!justDragged) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  cardButton.addEventListener('pointercancel', () => { if (pointerDrag?.cardButton === cardButton) pointerDrag = null; cardButton.classList.remove('dragging'); });
  cardButton.addEventListener('dblclick', event => {
    event.preventDefault();
    game.selected = selection;
    autoFoundation();
  });
}

function render() {
  stockSlot.classList.toggle('has-cards', game.stock.length > 0);
  stockSlot.style.setProperty('--stock-layers', Math.min(8, game.stock.length));
  stockSlot.innerHTML = game.stock.length ? cardMarkup(null, false, true) : '<span class="slot-empty">↻</span>';
  wasteSlot.innerHTML = '';
  const visibleWaste = game.waste.slice(-game.drawCount);
  wasteSlot.style.width = `${92 + Math.max(0, visibleWaste.length - 1) * 20}px`;
  if (!visibleWaste.length) wasteSlot.innerHTML = '<span class="slot-empty">—</span>';
  visibleWaste.forEach((card, index) => {
    const playable = index === visibleWaste.length - 1;
    const wrapper = document.createElement('div');
    wrapper.className = `waste-card${playable ? ' playable' : ''}`;
    wrapper.style.left = `${index * 20}px`;
    wrapper.style.zIndex = index + 1;
    wrapper.innerHTML = cardMarkup(card, playable && selectedIs('waste', null, null), false, playable && isHintedCard('waste', null, null));
    const cardButton = wrapper.querySelector('.card');
    if (playable) enableDrag(cardButton, 'waste');
    wasteSlot.appendChild(wrapper);
  });
  foundations.innerHTML = '';
  game.foundations.forEach((pile, column) => {
    const slot = document.createElement('div');
    slot.className = `foundation-slot${game.hint && game.hint.type === 'foundation' && game.hint.target === column ? ' hint-target' : ''}`;
    slot.setAttribute('role', 'button');
    slot.tabIndex = 0;
    slot.dataset.dropType = 'foundation';
    slot.dataset.column = column;
    slot.innerHTML = cardMarkup(pile.at(-1), selectedIs('foundation', column, null), false, isHintedCard('foundation', column, null));
    slot.addEventListener('click', () => targetFoundation(column));
    slot.addEventListener('dragover', event => event.preventDefault());
    slot.addEventListener('drop', event => { event.preventDefault(); targetFoundation(column); });
    const cardButton = slot.querySelector('.card');
    if (cardButton && game.animation?.type === 'move' && game.animation.area === 'foundation' && game.animation.column === column) cardButton.classList.add('arrive');
    if (cardButton && pile.length) cardButton.addEventListener('click', event => {
      event.stopPropagation();
      if (game.selected && !selectedIs('foundation', column, null)) targetFoundation(column);
      else selectCard('foundation', column, null);
    });
    if (cardButton && pile.length) enableDrag(cardButton, 'foundation', column);
    foundations.appendChild(slot);
  });
  tableau.innerHTML = '';
  game.tableau.forEach((pile, column) => {
    const slot = document.createElement('div');
    slot.className = `tableau-slot${game.hint && game.hint.type === 'tableau' && game.hint.target === column ? ' hint-target' : ''}`;
    slot.dataset.dropType = 'tableau';
    slot.dataset.column = column;
    slot.addEventListener('click', () => targetTableau(column));
    slot.addEventListener('dragover', event => event.preventDefault());
    slot.addEventListener('drop', event => { event.preventDefault(); targetTableau(column); });
    slot.style.minHeight = `${Math.max(410, pile.length * 29 + 130)}px`;
    pile.forEach((card, index) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'tableau-card';
      if (game.animation?.type === 'flip' && game.animation.column === column && game.animation.index === index) wrapper.classList.add('flipping');
      wrapper.style.top = `${index * 29}px`;
      wrapper.innerHTML = cardMarkup(card, selectedIs('tableau', column, index), !card.faceUp, isHintedCard('tableau', column, index));
      const cardButton = wrapper.querySelector('.card');
      if (cardButton && game.animation?.type === 'move' && game.animation.area === 'tableau' && game.animation.column === column && index === pile.length - 1) cardButton.classList.add('arrive');
      if (card.faceUp) cardButton.addEventListener('click', event => {
        event.stopPropagation();
        if (game.selected && !selectedIs('tableau', column, index)) targetTableau(column);
        else selectCard('tableau', column, index);
      });
      if (card.faceUp) enableDrag(cardButton, 'tableau', column, index);
      wrapper.addEventListener('click', event => {
        if (card.faceUp) return;
        event.stopPropagation();
        if (index === pile.length - 1) { card.faceUp = true; game.message = 'Carte retournée.'; playAnimation({ type: 'flip', column, index }); saveHistory(); render(); }
      });
      slot.appendChild(wrapper);
    });
    tableau.appendChild(slot);
  });
  const foundationCards = game.foundations.reduce((total, pile) => total + pile.length, 0);
  score.textContent = foundationCards * 10;
  errorCount.textContent = `Erreurs : ${game.errors}`;
  stockCount.textContent = game.stock.length;
  wasteCount.textContent = game.waste.length;
  hiddenCount.textContent = game.tableau.flat().filter(card => !card.faceUp).length;
  rulesSummary.textContent = `pioche de ${game.drawCount} · ${game.redealLimit === Infinity ? 'recyclages illimités' : `${game.redealLimit} recyclage${game.redealLimit > 1 ? 's' : ''}`} · ${game.generationDifficulty || 'Personnalisé'} · As ${game.acePosition === 'end' ? 'en fin de suite (K → A)' : 'au début de suite (A → K)'}`;
  status.textContent = game.message;
  updateHistoryButtons();
  updateTraceControls();
  finishGameButton.disabled = !canAutoFinish();
}

function cardStateSignature(state) {
  const card = value => `${value.label}${value.suit.symbol}${value.faceUp ? '+' : '-'}`;
  return JSON.stringify({ stock: state.stock.map(card), waste: state.waste.map(card), tableau: state.tableau.map(pile => pile.map(card)), foundations: state.foundations.map(pile => pile.map(card)), redeals: state.redeals });
}

function buildFoundationPlan(initialState, keepTrace = true) {
  const state = cloneGameState(initialState);
  const states = keepTrace ? [cloneGameState(state)] : null;
  let actionCount = 0;
  let productiveActionDuringPass = false;
  const recordState = () => {
    actionCount += 1;
    if (keepTrace) states.push(cloneGameState(state));
  };
  for (let step = 0; step < 600; step += 1) {
    if (state.foundations.every(pile => pile.length === 13)) return keepTrace ? states : actionCount;
    const targetFor = card => state.foundations.findIndex(pile => {
      const top = pile.at(-1);
      return !top ? foundationValue(card) === 1 : top.suit.symbol === card.suit.symbol && foundationValue(card) === foundationValue(top) + 1;
    });
    let moved = false;
    for (const pile of state.tableau) {
      const card = pile.at(-1);
      const target = card?.faceUp ? targetFor(card) : -1;
      if (target === -1) continue;
      state.foundations[target].push(pile.pop());
      if (pile.length) pile.at(-1).faceUp = true;
      moved = true;
      productiveActionDuringPass = true;
      recordState();
      break;
    }
    if (moved) continue;
    const wasteCard = state.waste.at(-1);
    const wasteTarget = wasteCard ? targetFor(wasteCard) : -1;
    if (wasteTarget !== -1) {
      state.foundations[wasteTarget].push(state.waste.pop());
      productiveActionDuringPass = true;
      recordState();
      continue;
    }
    if (state.stock.length) {
      for (let count = 0; count < Math.min(state.drawCount, state.stock.length); count += 1) {
        const card = state.stock.pop();
        card.faceUp = true;
        state.waste.push(card);
      }
      recordState();
      continue;
    }
    if (state.waste.length && state.redeals < state.redealLimit) {
      if (!productiveActionDuringPass) return null;
      state.stock = state.waste.reverse().map(card => ({ ...card, faceUp: false }));
      state.waste = [];
      state.redeals += 1;
      productiveActionDuringPass = false;
      recordState();
      continue;
    }
    return null;
  }
  return null;
}

function verifyFoundationPlan(initialState) {
  return buildFoundationPlan(initialState, false) !== null;
}

const difficultyProfiles = {
  easy: { label: 'Facile', minimumPlanLengths: { 1: 76, 3: 61 }, swapOptions: [0, 0, 1, 2], startIndexes: [0, 4, 8, 12], maximumAttempts: { 1: 250, 3: 500 } },
  normal: { label: 'Moyen', minimumPlanLengths: { 1: 90, 3: 80 }, swapOptions: [2, 2, 2, 4], startIndexes: [8, 12, 16, 20], maximumAttempts: { 1: 800, 3: 2000 } },
  hard: { label: 'Difficile', minimumPlanLengths: { 1: 105, 3: 85 }, swapOptions: [4, 4, 6, 8], startIndexes: [12, 16, 20], maximumAttempts: { 1: 1600, 3: 3500 } },
  expert: { label: 'Expert', minimumPlanLengths: { 1: 120, 3: 95 }, swapOptions: [4, 6, 8, 10], startIndexes: [12, 16, 20], maximumAttempts: { 1: 5000, 3: 10000 } }
};

function createVerifiedDeal(selectedDrawCount, selectedDifficulty = 'normal') {
  const profile = difficultyProfiles[selectedDifficulty] || difficultyProfiles.normal;
  const suitChains = CardTools.createDeck().reduce((chains, card) => {
    if (!chains.has(card.suit.symbol)) chains.set(card.suit.symbol, []);
    chains.get(card.suit.symbol).push({ ...card });
    return chains;
  }, new Map());
  const orderedSuitChains = [...suitChains.values()].map(cards => cards.sort((left, right) => foundationValue(left) - foundationValue(right)));
  const createOrderedAction = () => {
    const suitPositions = Array(4).fill(0);
    const actionOrder = [];
    while (actionOrder.length < 52) {
      const available = orderedSuitChains.map((cards, index) => index).filter(index => suitPositions[index] < orderedSuitChains[index].length);
      const suitIndex = CardTools.shuffle(available)[0];
      actionOrder.push(orderedSuitChains[suitIndex][suitPositions[suitIndex]]);
      suitPositions[suitIndex] += 1;
    }
    return actionOrder;
  };
  const jumbleAction = (actionOrder, swaps) => {
    const jumbled = actionOrder.slice();
    for (let swap = 0; swap < swaps; swap += 1) {
      const left = Math.floor(Math.random() * jumbled.length);
      const right = Math.floor(Math.random() * jumbled.length);
      [jumbled[left], jumbled[right]] = [jumbled[right], jumbled[left]];
    }
    return jumbled;
  };
  const buildDeal = (actionOrder, tableauIndexes) => {
    const columnPlans = Array.from({ length: 7 }, () => []);
    const capacities = Array.from({ length: 7 }, (_, column) => column + 1);
    const tableauActions = actionOrder.filter((_, index) => tableauIndexes.has(index));
    const stockActions = actionOrder.filter((_, index) => !tableauIndexes.has(index));
    tableauActions.forEach(card => {
      const available = capacities.map((capacity, column) => column).filter(column => columnPlans[column].length < capacities[column]);
      columnPlans[CardTools.shuffle(available)[0]].push(card);
    });
    const stockGroups = [];
    for (let index = 0; index < stockActions.length; index += selectedDrawCount) stockGroups.push(stockActions.slice(index, index + selectedDrawCount));
    return {
      stock: stockGroups.reverse().flat().map(card => ({ ...card, faceUp: false })),
      waste: [],
      tableau: columnPlans.map(plan => plan.slice().reverse().map((card, index) => ({ ...card, faceUp: index === plan.length - 1 }))),
      foundations: Array.from({ length: 4 }, () => [])
    };
  };
  const faceUpFaceCount = deal => deal.tableau.reduce((total, pile) => {
    const card = pile.at(-1);
    return total + (card && foundationValue(card) >= 11 ? 1 : 0);
  }, 0);
  const minimumPlanLength = profile.minimumPlanLengths[selectedDrawCount];
  const maximumAttempts = profile.maximumAttempts[selectedDrawCount];
  const decorateDeal = (deal, planLength) => ({
    ...deal,
    generationDifficulty: profile.label,
    generationPlanLength: planLength,
    generationTarget: minimumPlanLength,
    generationTargetReached: planLength >= minimumPlanLength
  });
  let bestCandidate = null;
  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    const actionOrder = jumbleAction(createOrderedAction(), CardTools.shuffle(profile.swapOptions)[0]);
    const startIndex = CardTools.shuffle(profile.startIndexes)[0];
    const nonAceIndexes = actionOrder
      .map((card, index) => ({ card, index }))
      .filter(({ card, index }) => index >= startIndex && foundationValue(card) !== 1)
      .map(({ index }) => index);
    if (nonAceIndexes.length < 28) continue;
    const tableauIndexes = new Set(CardTools.shuffle(nonAceIndexes).slice(0, 28));
    const deal = buildDeal(actionOrder, tableauIndexes);
    const testState = { ...deal, drawCount: selectedDrawCount, redeals: 0, redealLimit: Infinity, acePosition: 'end' };
    const planLength = buildFoundationPlan(testState, false);
    if (planLength === null || faceUpFaceCount(deal) === 0) continue;
    if (!bestCandidate || planLength > bestCandidate.planLength) bestCandidate = { deal, planLength };
    if (planLength >= minimumPlanLength) return decorateDeal(deal, planLength);
  }
  if (bestCandidate) return decorateDeal(bestCandidate.deal, bestCandidate.planLength);
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const actionOrder = createOrderedAction();
    const tableauIndexes = new Set(actionOrder
      .map((card, index) => ({ card, index }))
      .filter(({ card }) => foundationValue(card) !== 1)
      .map(({ index }) => index));
    const selectedIndexes = CardTools.shuffle([...tableauIndexes]).slice(0, 28);
    tableauIndexes.clear();
    selectedIndexes.forEach(index => tableauIndexes.add(index));
    const deal = buildDeal(actionOrder, tableauIndexes);
    const testState = { ...deal, drawCount: selectedDrawCount, redeals: 0, redealLimit: Infinity, acePosition: 'end' };
    const planLength = buildFoundationPlan(testState, false);
    if (planLength !== null && faceUpFaceCount(deal) > 0) return decorateDeal(deal, planLength);
  }
  throw new Error('Impossible de générer une distribution Klondike vérifiée.');
}

function createGame() {
  const selectedDrawCount = Number(drawCount.value);
  const deal = createVerifiedDeal(selectedDrawCount, dealDifficulty.value);
  game = { ...deal, selected: null, hint: null, animation: null, errors: 0, drawCount: selectedDrawCount, redeals: 0, redealLimit: Number(redealLimit.value), acePosition: acePosition.value, message: '' };
  game.solvable = verifyFoundationPlan(game);
  game.message = game.solvable
    ? `${game.generationDifficulty} : ${game.generationPlanLength} actions certifiées${game.generationTargetReached ? '' : ` (objectif ${game.generationTarget} non atteint après recherche exhaustive)`}.`
    : 'Distribution créée, mais sa vérification automatique a échoué.';
  gameHistory = [];
  historyIndex = -1;
  clearSolverTrace();
  saveHistory();
  render();
}

stockSlot.addEventListener('click', drawStock);
wasteSlot.addEventListener('click', () => selectCard('waste'));
newGameButton.addEventListener('click', createGame);
autoFoundationButton.addEventListener('click', autoFoundation);
undoButton.addEventListener('click', () => restoreHistory(historyIndex - 1));
redoButton.addEventListener('click', () => restoreHistory(historyIndex + 1));
hintButton.addEventListener('click', showHint);
solveStepButton.addEventListener('click', solveStep);
solveAllButton.addEventListener('click', solveAll);
finishGameButton.addEventListener('click', finishGameAutomatically);
drawCount.addEventListener('change', () => {
  createGame();
  game.message = `Nouvelle distribution Klondike avec une pioche de ${game.drawCount} carte${game.drawCount > 1 ? 's' : ''}.`;
  render();
});
dealDifficulty.addEventListener('change', createGame);
redealLimit.addEventListener('change', createGame);
acePosition.addEventListener('change', () => {
  createGame();
  game.message = 'Nouvelle partie avec la nouvelle position de l’As dans les suites.';
  render();
});
traceModeButton.addEventListener('click', toggleTraceMode);
previousTraceButton.addEventListener('click', () => showTrace(traceIndex - 1));
nextTraceButton.addEventListener('click', () => showTrace(traceIndex + 1));
traceSlider.addEventListener('input', () => showTrace(Number(traceSlider.value)));
localStorage.setItem('game-hub:last-game', 'klondike');
createGame();
