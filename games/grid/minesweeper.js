const board = document.getElementById('board');
const difficulty = document.getElementById('difficulty');
const newGame = document.getElementById('newGame');
const solveStepButton = document.getElementById('solveStep');
const solveAllButton = document.getElementById('solveAll');
const noGuess = document.getElementById('noGuess');
const adaptDensity = document.getElementById('adaptDensity');
const status = document.getElementById('status');

const boardViewport = document.createElement('div');
const boardCanvas = document.createElement('div');
const zoomControls = document.createElement('span');
let boardZoom = 1;
boardViewport.id = 'boardViewport';
boardCanvas.id = 'boardCanvas';
zoomControls.className = 'zoom-controls';
zoomControls.innerHTML = '<button type="button" data-zoom="out" title="Dézoomer">−</button><button type="button" data-zoom="reset" title="Taille d’origine">100 %</button><button type="button" data-zoom="in" title="Zoomer">+</button>';
board.parentElement.insertBefore(boardViewport, board);
boardViewport.appendChild(boardCanvas);
boardCanvas.appendChild(board);
newGame.parentElement.appendChild(zoomControls);
document.head.insertAdjacentHTML('beforeend', '<style>#boardViewport{max-width:100%;max-height:70vh;overflow:auto;overscroll-behavior:contain;border-radius:8px;cursor:grab}#boardViewport:active{cursor:grabbing}#boardCanvas{position:relative}#board{max-width:none!important;transform-origin:top left}.zoom-controls{display:inline-flex;gap:4px;align-items:center}.zoom-controls button{min-width:38px;padding-inline:8px}</style>');

const TOUCH_FLAG_DELAY = 420;
const TOUCH_MOVE_TOLERANCE = 10;
let touchHold = null;
let suppressTouchClickUntil = 0;

function cancelTouchHold(pointerId = null) {
  if (!touchHold || (pointerId !== null && touchHold.pointerId !== pointerId)) return;
  clearTimeout(touchHold.timer);
  touchHold = null;
}

const settings = { easy: { width: 9, height: 9, mines: 10 }, medium: { width: 16, height: 16, mines: 40 }, hard: { width: 30, height: 16, mines: 99 }, expert: { width: 40, height: 22, mines: 180 }, giant: { width: 50, height: 30, mines: 400 }, colossal: { width: 60, height: 36, mines: 600 }, titan: { width: 80, height: 48, mines: 900 } };
let game = null;
let lanFinished = false;
let autosave = null;

function finishGame(result) {
  if (window.GameRecords) window.GameRecords.finish(result);
  else window.LanMultiplayer?.finish(result);
}

function updateBoardZoom() {
  const width = board.offsetWidth;
  const height = board.offsetHeight;
  board.style.transform = `scale(${boardZoom})`;
  boardCanvas.style.width = `${Math.ceil(width * boardZoom)}px`;
  boardCanvas.style.height = `${Math.ceil(height * boardZoom)}px`;
  zoomControls.querySelector('[data-zoom="reset"]').textContent = `${Math.round(boardZoom * 100)} %`;
}
function setBoardZoom(nextZoom) { boardZoom = Math.max(1, Math.min(3, Math.round(nextZoom * 10) / 10)); updateBoardZoom(); }
zoomControls.addEventListener('click', event => { const action = event.target.dataset.zoom; if (action === 'in') setBoardZoom(boardZoom + .2); if (action === 'out') setBoardZoom(boardZoom - .2); if (action === 'reset') setBoardZoom(1); });
let boardPan = null;
boardViewport.addEventListener('wheel', event => { event.preventDefault(); if (event.shiftKey) { boardViewport.scrollLeft += event.deltaY; return; } setBoardZoom(boardZoom + (event.deltaY < 0 ? .1 : -.1)); }, { passive: false });
boardViewport.addEventListener('pointerdown', event => { if (event.button !== 1) return; boardPan = { x: event.clientX, y: event.clientY, left: boardViewport.scrollLeft, top: boardViewport.scrollTop }; boardViewport.setPointerCapture(event.pointerId); event.preventDefault(); });
boardViewport.addEventListener('pointermove', event => { if (!boardPan) return; boardViewport.scrollLeft = boardPan.left - (event.clientX - boardPan.x); boardViewport.scrollTop = boardPan.top - (event.clientY - boardPan.y); });
boardViewport.addEventListener('pointerup', () => { boardPan = null; });

function indexOf(row, col) { return row * game.width + col; }
function neighbours(index) {
  const row = Math.floor(index / game.width); const col = index % game.width; const cells = [];
  for (let deltaRow = -1; deltaRow <= 1; deltaRow += 1) for (let deltaCol = -1; deltaCol <= 1; deltaCol += 1) {
    if (!deltaRow && !deltaCol) continue;
    const nextRow = row + deltaRow; const nextCol = col + deltaCol;
    if (nextRow >= 0 && nextRow < game.height && nextCol >= 0 && nextCol < game.width) cells.push(indexOf(nextRow, nextCol));
  }
  return cells;
}
function assignMines(firstIndex) {
  game.cells.forEach(cell => { cell.mine = false; cell.count = 0; });
  const protectedCells = new Set([firstIndex, ...neighbours(firstIndex)]);
  const positions = Array.from({ length: game.cells.length }, (_, index) => index).filter(index => !protectedCells.has(index));
  for (let index = positions.length - 1; index > 0; index -= 1) { const target = Math.floor(Math.random() * (index + 1)); [positions[index], positions[target]] = [positions[target], positions[index]]; }
  positions.slice(0, game.mines).forEach(index => { game.cells[index].mine = true; });
  game.cells.forEach((cell, index) => { cell.count = neighbours(index).filter(next => game.cells[next].mine).length; });
}
function isLogicallySolvableFrom(firstIndex) {
  const original = game;
  game = {
    ...original,
    started: true,
    over: false,
    lost: false,
    simulating: true,
    cells: original.cells.map(cell => ({ ...cell, revealed: false, flagged: false, autoFlagged: false, exploded: false })),
    solverMistakes: new Set()
  };
  revealCovered(firstIndex);
  checkWin();
  let changes = 0;
  while (!game.over && changes < game.cells.length * 3) {
    const result = solveLogicalStep();
    if (!result) break;
    changes += result;
    checkWin();
  }
  const solvable = game.over && !game.lost;
  game = original;
  return solvable;
}
function nextAnimationFrame() {
  return new Promise(resolve => window.setTimeout(resolve, 0));
}
function mineCountCandidates(cells) {
  if (!noGuess.checked || !adaptDensity.checked || cells <= 480) return [game.requestedMines];
  const requestedDensity = game.requestedMines / cells;
  const densities = [requestedDensity, .20, .17, .14, .11, .08];
  const counts = densities.map(density => Math.min(game.requestedMines, Math.max(10, Math.floor(cells * density))));
  return [...new Set(counts)];
}
async function placeMines(firstIndex) {
  const cells = game.cells.length;
  const candidates = mineCountCandidates(cells);
  const attempts = noGuess.checked ? (adaptDensity.checked && cells > 480 ? 40 : 300) : (cells <= 81 ? 60 : (cells <= 256 ? 20 : (cells <= 480 ? 12 : (cells <= 880 ? 6 : 3))));
  game.generating = true;
  game.logicalStart = false;
  for (const mineCount of candidates) {
    game.mines = mineCount;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      assignMines(firstIndex);
      if (isLogicallySolvableFrom(firstIndex)) { game.logicalStart = true; break; }
      if ((attempt + 1) % 4 === 0) {
        status.textContent = `Recherche sans supposition : ${mineCount} mines, essai ${attempt + 1}/${attempts}…`;
        await nextAnimationFrame();
      }
    }
    if (game.logicalStart) break;
  }
  game.generating = false;
  if (lanFinished || game.over) return;
  if (!game.generationMessage) game.generationMessage = game.logicalStart
    ? `Grille vérifiée sans supposition : ${game.mines} mines.${game.mines !== game.requestedMines ? ' Densité adaptée au grand format.' : ''}`
    : (noGuess.checked ? `Aucune grille entièrement déductible trouvée après ${attempts} essais : réessayez ou désactivez ce mode.` : 'Grille aléatoire non vérifiée.');
  game.started = true;
}
function revealCovered(index) {
  const queue = [index];
  while (queue.length) {
    const current = queue.pop(); const cell = game.cells[current];
    if (cell.revealed || cell.flagged) continue;
    cell.revealed = true;
    if (cell.mine) { cell.exploded = true; game.over = true; game.lost = true; if (!game.simulating) finishGame({ won: false, scoreLabel: 'Mine touchée' }); break; }
    if (!cell.count) neighbours(current).forEach(next => { if (!game.cells[next].revealed && !game.cells[next].flagged) queue.push(next); });
  }
}
async function reveal(index) {
  if (game.over || game.generating || game.cells[index].flagged) return;
  if (!game.started) await placeMines(index);
  if (lanFinished || game.over) { render(); return; }
  const cell = game.cells[index];
  if (cell.revealed) {
    if (!cell.count) return;
    const adjacent = neighbours(index);
    if (adjacent.filter(next => game.cells[next].flagged).length !== cell.count) return;
    adjacent.filter(next => !game.cells[next].flagged && !game.cells[next].revealed).forEach(revealCovered);
  } else revealCovered(index);
  checkWin(); render();
}
function checkWin() {
  if (!game.over && game.cells.filter(cell => !cell.mine).every(cell => cell.revealed)) {
    game.over = true;
    if (!game.simulating) finishGame({ score: 1, scoreLabel: 'Grille terminée', won: true, raceWinner: true });
  }
}
function toggleFlag(index) {
  if (game.over || game.cells[index].revealed) return;
  game.cells[index].flagged = !game.cells[index].flagged;
  game.cells[index].autoFlagged = false;
  game.solverMistakes.delete(index);
  render();
}
function flagLogicalMine(index) {
  const cell = game.cells[index];
  if (cell.revealed || cell.flagged) return false;
  cell.flagged = true;
  cell.autoFlagged = true;
  if (!cell.mine) game.solverMistakes.add(index);
  return true;
}
function globalDeductions() {
  const covered = game.cells.flatMap((cell, index) => !cell.revealed && !cell.flagged ? [index] : []);
  const remaining = game.mines - game.cells.filter(cell => cell.flagged).length;
  if (remaining === 0) return { safe: covered, mines: [] };
  if (remaining === covered.length) return { safe: [], mines: covered };
  return { safe: [], mines: [] };
}
function reducedConstraintDeductions() {
  const constraints = game.cells.flatMap((cell, index) => {
    if (!cell.revealed || !cell.count) return [];
    const around = neighbours(index);
    const cells = around.filter(next => !game.cells[next].revealed && !game.cells[next].flagged);
    const mines = cell.count - around.filter(next => game.cells[next].flagged).length;
    return cells.length && mines >= 0 && mines <= cells.length ? [{ cells: new Set(cells), mines }] : [];
  });
  const known = new Map();
  const add = constraint => {
    const cells = [...constraint.cells].sort((left, right) => left - right);
    if (!cells.length || constraint.mines < 0 || constraint.mines > cells.length) return false;
    const key = cells.join(',');
    if (known.has(key)) return false;
    known.set(key, true);
    constraints.push({ cells: new Set(cells), mines: constraint.mines });
    return true;
  };
  constraints.forEach(constraint => known.set([...constraint.cells].sort((left, right) => left - right).join(','), true));
  for (let firstIndex = 0; firstIndex < constraints.length && constraints.length < 500; firstIndex += 1) {
    for (let secondIndex = 0; secondIndex < constraints.length && constraints.length < 500; secondIndex += 1) {
      if (firstIndex === secondIndex) continue;
      const first = constraints[firstIndex];
      const second = constraints[secondIndex];
      if (first.cells.size < second.cells.size && [...first.cells].every(cell => second.cells.has(cell))) {
        add({ cells: new Set([...second.cells].filter(cell => !first.cells.has(cell))), mines: second.mines - first.mines });
        continue;
      }
      const intersection = [...first.cells].filter(cell => second.cells.has(cell));
      if (!intersection.length || intersection.length === first.cells.size || intersection.length === second.cells.size) continue;
      const firstOnly = [...first.cells].filter(cell => !second.cells.has(cell));
      const secondOnly = [...second.cells].filter(cell => !first.cells.has(cell));
      const minimumIntersection = Math.max(0, first.mines - firstOnly.length, second.mines - secondOnly.length);
      const maximumIntersection = Math.min(intersection.length, first.mines, second.mines);
      if (minimumIntersection !== maximumIntersection) continue;
      add({ cells: new Set(intersection), mines: minimumIntersection });
      add({ cells: new Set(firstOnly), mines: first.mines - minimumIntersection });
      add({ cells: new Set(secondOnly), mines: second.mines - minimumIntersection });
    }
  }
  const safe = new Set();
  const mines = new Set();
  constraints.forEach(constraint => {
    if (constraint.mines === 0) constraint.cells.forEach(cell => safe.add(cell));
    if (constraint.mines === constraint.cells.size) constraint.cells.forEach(cell => mines.add(cell));
  });
  mines.forEach(cell => safe.delete(cell));
  return { safe, mines };
}
function frontierDeductions() {
  const constraints = game.cells.flatMap((cell, index) => {
    if (!cell.revealed || !cell.count) return [];
    const around = neighbours(index);
    const cells = around.filter(next => !game.cells[next].revealed && !game.cells[next].flagged);
    const mines = cell.count - around.filter(next => game.cells[next].flagged).length;
    return cells.length && mines >= 0 && mines <= cells.length ? [{ cells, mines }] : [];
  });
  const byCell = new Map();
  constraints.forEach((constraint, constraintIndex) => constraint.cells.forEach(cell => {
    if (!byCell.has(cell)) byCell.set(cell, []);
    byCell.get(cell).push(constraintIndex);
  }));
  const visited = new Set();
  const safe = new Set();
  const mines = new Set();
  const solvedComponents = [];
  constraints.forEach((_, start) => {
    if (visited.has(start)) return;
    const queue = [start];
    const component = [];
    const cells = new Set();
    visited.add(start);
    while (queue.length) {
      const current = queue.pop();
      component.push(constraints[current]);
      constraints[current].cells.forEach(cell => {
        cells.add(cell);
        byCell.get(cell).forEach(next => {
          if (!visited.has(next)) { visited.add(next); queue.push(next); }
        });
      });
    }
    const variables = [...cells];
    if (variables.length > 30) return;
    variables.sort((left, right) => byCell.get(right).length - byCell.get(left).length);
    const variableIndex = new Map(variables.map((cell, index) => [cell, index]));
    const local = component.map(constraint => ({ indexes: constraint.cells.map(cell => variableIndex.get(cell)), mines: constraint.mines }));
    const assignment = Array(variables.length).fill(-1);
    const mineTotals = Array(variables.length).fill(0);
    const modelsByMineCount = new Map();
    let models = 0;
    let stopped = false;
    const valid = () => local.every(constraint => {
      let assigned = 0;
      let unknown = 0;
      constraint.indexes.forEach(index => { if (assignment[index] === -1) unknown += 1; else assigned += assignment[index]; });
      return assigned <= constraint.mines && assigned + unknown >= constraint.mines;
    });
    const enumerate = position => {
      if (stopped || !valid()) return;
      if (position === variables.length) {
        models += 1;
        if (models > 1000000) { stopped = true; return; }
        const totalMines = assignment.reduce((total, value) => total + value, 0);
        if (!modelsByMineCount.has(totalMines)) modelsByMineCount.set(totalMines, { models: 0, mineTotals: Array(variables.length).fill(0) });
        const mineCountModel = modelsByMineCount.get(totalMines);
        mineCountModel.models += 1;
        assignment.forEach((value, index) => {
          mineTotals[index] += value;
          mineCountModel.mineTotals[index] += value;
        });
        return;
      }
      assignment[position] = 0;
      enumerate(position + 1);
      assignment[position] = 1;
      enumerate(position + 1);
      assignment[position] = -1;
    };
    enumerate(0);
    if (!models || stopped) return;
    variables.forEach((cell, index) => {
      if (mineTotals[index] === 0) safe.add(cell);
      if (mineTotals[index] === models) mines.add(cell);
    });
    solvedComponents.push({ variables, modelsByMineCount });
  });
  const solvedCells = new Set(solvedComponents.flatMap(component => component.variables));
  const freeCells = game.cells.filter((cell, index) => !cell.revealed && !cell.flagged && !solvedCells.has(index)).length;
  const remainingMines = game.mines - game.cells.filter(cell => cell.flagged).length;
  const possibleTotalsExcept = skipped => {
    let totals = new Set([0]);
    solvedComponents.forEach((component, index) => {
      if (index === skipped) return;
      totals = new Set([...totals].flatMap(total => [...component.modelsByMineCount.keys()].map(minesInComponent => total + minesInComponent)));
    });
    return new Set([...totals].flatMap(total => Array.from({ length: freeCells + 1 }, (_, minesInFreeCells) => total + minesInFreeCells)));
  };
  const globallyConsistent = possibleTotalsExcept(-1).has(remainingMines);
  if (globallyConsistent) solvedComponents.forEach((component, componentIndex) => {
    const possibleOtherTotals = possibleTotalsExcept(componentIndex);
    component.variables.forEach((cell, variableIndex) => {
      let canBeSafe = false;
      let canBeMine = false;
      component.modelsByMineCount.forEach((model, minesInComponent) => {
        if (!possibleOtherTotals.has(remainingMines - minesInComponent)) return;
        if (model.mineTotals[variableIndex] > 0) canBeMine = true;
        if (model.mineTotals[variableIndex] < model.models) canBeSafe = true;
      });
      if (!canBeMine) safe.add(cell);
      if (!canBeSafe) mines.add(cell);
    });
  });
  mines.forEach(cell => safe.delete(cell));
  return { safe, mines };
}
function solveLogicalStep() {
  if (!game.started || game.over) return 0;
  for (let index = 0; index < game.cells.length; index += 1) {
    const cell = game.cells[index];
    if (!cell.revealed || !cell.count) continue;
    const around = neighbours(index);
    const covered = around.filter(next => !game.cells[next].revealed && !game.cells[next].flagged);
    const flags = around.filter(next => game.cells[next].flagged).length;
    if (!covered.length) continue;
    if (flags === cell.count) {
      covered.forEach(revealCovered);
      game.lastDeduction = `Autour du ${cell.count}, tous les drapeaux sont posés : ${covered.length} case(s) sûre(s).`;
      return covered.length;
    }
    if (cell.count - flags === covered.length) {
      covered.forEach(flagLogicalMine);
      game.lastDeduction = `Autour du ${cell.count}, toutes les cases restantes sont des mines : ${covered.length} drapeau(x).`;
      return covered.length;
    }
  }
  const global = globalDeductions();
  if (global.safe.length) {
    global.safe.forEach(revealCovered);
    game.lastDeduction = `Le nombre total de mines rend ${global.safe.length} case(s) sûre(s).`;
    return global.safe.length;
  }
  if (global.mines.length) {
    global.mines.forEach(flagLogicalMine);
    game.lastDeduction = `Toutes les cases couvertes restantes sont des mines (${global.mines.length}).`;
    return global.mines.length;
  }
  const reduced = reducedConstraintDeductions();
  if (reduced.safe.size) {
    reduced.safe.forEach(revealCovered);
    game.lastDeduction = `Chevauchement de contraintes : ${reduced.safe.size} case(s) nécessairement sûre(s).`;
    return reduced.safe.size;
  }
  if (reduced.mines.size) {
    reduced.mines.forEach(flagLogicalMine);
    game.lastDeduction = `Chevauchement de contraintes : ${reduced.mines.size} mine(s) certaine(s).`;
    return reduced.mines.size;
  }
  const constraints = game.cells.flatMap((cell, index) => {
    if (!cell.revealed || !cell.count) return [];
    const around = neighbours(index);
    const cells = around.filter(next => !game.cells[next].revealed && !game.cells[next].flagged);
    const mines = cell.count - around.filter(next => game.cells[next].flagged).length;
    return cells.length ? [{ cells: new Set(cells), mines }] : [];
  });
  for (const first of constraints) {
    for (const second of constraints) {
      if (first === second || first.cells.size >= second.cells.size) continue;
      if (![...first.cells].every(cell => second.cells.has(cell))) continue;
      const difference = [...second.cells].filter(cell => !first.cells.has(cell));
      const mines = second.mines - first.mines;
      if (mines === 0) { difference.forEach(revealCovered); return difference.length; }
      if (mines === difference.length) { difference.forEach(flagLogicalMine); return difference.length; }
    }
  }
  const frontier = frontierDeductions();
  if (frontier.safe.size) {
    frontier.safe.forEach(revealCovered);
    game.lastDeduction = `Toutes les configurations de frontière rendent ${frontier.safe.size} case(s) sûre(s).`;
    return frontier.safe.size;
  }
  if (frontier.mines.size) {
    frontier.mines.forEach(flagLogicalMine);
    game.lastDeduction = `Toutes les configurations de frontière imposent ${frontier.mines.size} mine(s).`;
    return frontier.mines.size;
  }
  game.lastDeduction = 'Aucune conséquence certaine avec les contraintes actuellement visibles.';
  return 0;
}
function solveLogically() {
  let changes = 0;
  while (!game.over && changes < game.cells.length * 2) {
    const result = solveLogicalStep();
    if (!result) break;
    changes += result;
  }
  checkWin();
  render();
  status.textContent = game.solverMistakes.size
    ? `Erreur du solveur détectée sur ${game.solverMistakes.size} drapeau${game.solverMistakes.size > 1 ? 'x' : ''} orange${game.solverMistakes.size > 1 ? 's' : ''}.`
    : (changes ? `${changes} déduction${changes > 1 ? 's' : ''} appliquée${changes > 1 ? 's' : ''}. ${game.lastDeduction || ''}` : (game.lastDeduction || 'Aucune déduction logique certaine.'));
}
function render() {
  const availableWidth = Math.min(1120, Math.max(260, window.innerWidth - 72));
  const cellSize = Math.max(10, Math.min(30, Math.floor((availableWidth - game.width - 8) / game.width)));
  board.style.setProperty('--cell-size', `${cellSize}px`);
  board.style.gridTemplateColumns = `repeat(${game.width}, ${cellSize}px)`;
  board.innerHTML = '';
  game.cells.forEach((cell, index) => {
    const element = document.createElement('button');
    element.className = `cell${cell.revealed ? ' revealed' : ''}${cell.flagged ? ' flagged' : ''}${cell.autoFlagged ? ' solver-flag' : ''}${game.solverMistakes.has(index) ? ' solver-error' : ''}`;
    if (cell.revealed && cell.count) { element.textContent = cell.count; element.classList.add(`n${cell.count}`); }
    if (game.lost && cell.mine) { element.textContent = '✹'; element.classList.add(cell.exploded ? 'exploded' : 'mine'); }
    if (game.solverMistakes.has(index)) {
      element.textContent = '⚠';
    } else if (game.lost && cell.flagged) {
      element.textContent = '⚑';
      element.classList.add(cell.mine ? 'found-flag' : 'wrong-flag');
    } else if (cell.flagged) element.textContent = '⚑';
    element.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'touch' || event.button !== 0 || cell.revealed || game.over) return;
      cancelTouchHold();
      const hold = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, timer: 0 };
      hold.timer = window.setTimeout(() => {
        if (touchHold !== hold) return;
        touchHold = null;
        suppressTouchClickUntil = performance.now() + 650;
        navigator.vibrate?.(24);
        toggleFlag(index);
      }, TOUCH_FLAG_DELAY);
      touchHold = hold;
    });
    element.addEventListener('pointermove', event => {
      if (!touchHold || touchHold.pointerId !== event.pointerId) return;
      if (Math.hypot(event.clientX - touchHold.startX, event.clientY - touchHold.startY) > TOUCH_MOVE_TOLERANCE) cancelTouchHold(event.pointerId);
    });
    element.addEventListener('pointerup', event => cancelTouchHold(event.pointerId));
    element.addEventListener('pointercancel', event => cancelTouchHold(event.pointerId));
    element.addEventListener('click', event => {
      if (performance.now() < suppressTouchClickUntil) { event.preventDefault(); return; }
      reveal(index);
    });
    element.addEventListener('contextmenu', event => {
      event.preventDefault();
      if (performance.now() < suppressTouchClickUntil) return;
      toggleFlag(index);
    });
    board.appendChild(element);
  });
  const flags = game.cells.filter(cell => cell.flagged).length;
  status.textContent = game.solverMistakes.size
    ? `Erreur du solveur détectée : ${game.solverMistakes.size} drapeau${game.solverMistakes.size > 1 ? 'x' : ''} est orange.`
    : (lanFinished ? 'Partie LAN terminée : un joueur a remporté la course.' : (game.generating ? 'Recherche d’une grille sans supposition…' : (game.lost ? 'Mine touchée : partie perdue.' : (game.over ? 'Grille terminée !' : (game.generationMessage || `Mines restantes : ${Math.max(0, game.mines - flags)}.${game.logicalStart ? ' Départ entièrement déductible.' : ''}`)))));
  solveStepButton.disabled = !game.started || game.over || game.generating;
  solveAllButton.disabled = !game.started || game.over || game.generating;
  window.requestAnimationFrame(updateBoardZoom);
}
function createGame() {
  const config = settings[difficulty.value];
  game = { ...config, requestedMines: config.mines, started: false, over: false, lost: false, simulating: false, generating: false, logicalStart: false, generationMessage: '', lastDeduction: '', solverMistakes: new Set(), cells: Array.from({ length: config.width * config.height }, () => ({ mine: false, count: 0, revealed: false, flagged: false, autoFlagged: false })) };
  render();
  autosave?.save();
}

window.MinesweeperTestAPI = Object.freeze({
  diagnostics: () => {
    const currentGame = game;
    game = {
      width: 3,
      height: 2,
      mines: 1,
      started: true,
      over: false,
      lost: false,
      solverMistakes: new Set(),
      cells: Array.from({ length: 6 }, (_, index) => ({
        mine: index === 3,
        count: index < 2 ? 1 : 0,
        revealed: index < 2,
        flagged: false,
        autoFlagged: false,
      })),
    };
    const reduced = reducedConstraintDeductions();
    const frontier = frontierDeductions();
    game = currentGame;
    return {
      settings: Object.fromEntries(Object.entries(settings).map(([name, value]) => [name, { ...value }])),
      overlapSafe: reduced.safe.has(2) && reduced.safe.has(5),
      overlapDoesNotInventMine: reduced.mines.size === 0,
      frontierSafe: frontier.safe.has(2) && frontier.safe.has(5),
      frontierDoesNotInventMine: frontier.mines.size === 0,
      touchFlagDelay: TOUCH_FLAG_DELAY,
      squareCells: (() => { const cell = board.querySelector('.cell'); return !cell || Math.abs(cell.getBoundingClientRect().width - cell.getBoundingClientRect().height) < .5; })(),
    };
  },
});
newGame.addEventListener('click', createGame);
difficulty.addEventListener('change', createGame);
noGuess.addEventListener('change', createGame);
adaptDensity.addEventListener('change', createGame);
window.addEventListener('resize', () => { if (game) render(); });
solveStepButton.addEventListener('click', () => {
  const changes = solveLogicalStep();
  checkWin();
  render();
  status.textContent = game.solverMistakes.size
    ? `Erreur du solveur détectée : ${game.solverMistakes.size} drapeau${game.solverMistakes.size > 1 ? 'x' : ''} est orange.`
    : (changes ? game.lastDeduction : (game.lastDeduction || 'Aucune déduction logique certaine.'));
});
solveAllButton.addEventListener('click', solveLogically);
localStorage.setItem('game-hub:last-game', 'minesweeper');
autosave = window.GameRuntime?.createAutosave('partie', {
  enabled: () => Boolean(game && !game.simulating && !game.generating),
  capture: () => ({ ...game, solverMistakes: [...game.solverMistakes], boardZoom }),
  validate: value => Number.isInteger(value?.width) && Number.isInteger(value?.height) && Array.isArray(value?.cells),
  restore: value => { boardZoom = Math.max(1, Math.min(3, Number(value.boardZoom) || 1)); game = { ...value, solverMistakes: new Set(value.solverMistakes || []), simulating: false, generating: false }; render(); },
});
if (!autosave?.restore()) createGame();
window.addEventListener('lan:start', () => {
  lanFinished = false;
  if (!game.started && !game.generating) reveal(indexOf(Math.floor(game.height / 2), Math.floor(game.width / 2)));
});
window.addEventListener('lan:finished', () => {
  if (!game) return;
  lanFinished = true;
  game.over = true;
  game.generating = false;
  cancelTouchHold();
  render();
});
