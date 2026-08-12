const stage = document.getElementById('stage');
const statusElement = document.getElementById('status');
const pairsElement = document.getElementById('pairs');
const freeElement = document.getElementById('free');
const layoutNameElement = document.getElementById('layoutName');
const layoutSelect = document.getElementById('layout');
const tileCountSelect = document.getElementById('tileCount');
const difficultySelect = document.getElementById('difficulty');
const hintButton = document.getElementById('hint');
const solveButton = document.getElementById('solve');
const undoButton = document.getElementById('undo');
const traceToggleButton = document.getElementById('traceToggle');
const tracePreviousButton = document.getElementById('tracePrev');
const traceNextButton = document.getElementById('traceNext');
const traceComment = document.getElementById('traceComment');

const faces = [
  ...Array.from({ length: 9 }, (_, index) => ({ id: `man${index + 1}`, label: `${index + 1}萬`, family: 'man' })),
  ...Array.from({ length: 9 }, (_, index) => ({ id: `pin${index + 1}`, label: `${index + 1}●`, family: 'pin' })),
  ...Array.from({ length: 9 }, (_, index) => ({ id: `sou${index + 1}`, label: `${index + 1}竹`, family: 'sou' })),
  ...['東', '南', '西', '北'].map((label, index) => ({ id: `wind${index}`, label, family: 'honor' })),
  ...['中', '發', '白'].map((label, index) => ({ id: `dragon${index}`, label, family: 'dragon' })),
  ...['🌸', '🌼'].map((label, index) => ({ id: `flower${index}`, label, family: 'flower' })),
];

const layoutNames = {
  guaranteed: 'Secours garanti',
  random: 'Aléatoire',
  turtle: 'Tortue',
  pyramid: 'Pyramide',
  fortress: 'Forteresse',
  bridge: 'Pont',
  diamond: 'Diamant',
  cross: 'Croix',
  pagoda: 'Pagode',
  arena: 'Arène',
  wave: 'Vague',
  spiral: 'Spirale',
};

let game;
let autosave;

function shuffle(values) {
  const result = values.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function addRectangle(target, width, height, x, y, z) {
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) target.push({ x: x + column, y: y + row, z });
  }
}

function addRows(target, lengths, width, y, z) {
  lengths.forEach((length, row) => {
    const start = Math.floor((width - length) / 2);
    for (let column = 0; column < length; column += 1) target.push({ x: start + column, y: y + row, z });
  });
}

function addRing(target, width, height, x, y, z) {
  for (let column = 0; column < width; column += 1) {
    target.push({ x: x + column, y, z });
    target.push({ x: x + column, y: y + height - 1, z });
  }
  for (let row = 1; row < height - 1; row += 1) {
    target.push({ x, y: y + row, z });
    target.push({ x: x + width - 1, y: y + row, z });
  }
}

function connectedBlob(count, width, height, x, y, z) {
  const selected = new Set([`${Math.floor(width / 2)},${Math.floor(height / 2)}`]);
  while (selected.size < count) {
    const frontier = [];
    selected.forEach(key => {
      const [column, row] = key.split(',').map(Number);
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
        const nextColumn = column + dx;
        const nextRow = row + dy;
        const nextKey = `${nextColumn},${nextRow}`;
        if (nextColumn >= 0 && nextColumn < width && nextRow >= 0 && nextRow < height && !selected.has(nextKey)) frontier.push(nextKey);
      });
    });
    const uniqueFrontier = [...new Set(frontier)];
    if (!uniqueFrontier.length) break;
    selected.add(uniqueFrontier[Math.floor(Math.random() * uniqueFrontier.length)]);
  }
  return [...selected].map(key => {
    const [column, row] = key.split(',').map(Number);
    return { x: x + column, y: y + row, z };
  });
}

function finalizeLayout(coordinates, expectedCount = 72) {
  const unique = new Map();
  coordinates.forEach(position => unique.set(`${position.x},${position.y},${position.z}`, position));
  const positions = [...unique.values()];
  if (positions.length !== expectedCount) throw new Error(`Disposition invalide : ${positions.length} tuiles au lieu de ${expectedCount}.`);
  const minimumX = Math.min(...positions.map(position => position.x));
  const minimumY = Math.min(...positions.map(position => position.y));
  return positions.map((position, id) => ({ id, x: position.x - minimumX, y: position.y - minimumY, z: position.z }));
}

function turtleLayout() {
  const positions = [];
  [[3, 8], [1, 10], [0, 11], [0, 11], [1, 10], [3, 8]].forEach(([start, end], row) => {
    for (let column = start; column <= end; column += 1) positions.push({ x: column, y: row, z: 0 });
  });
  addRectangle(positions, 6, 2, 3, 2, 1);
  addRectangle(positions, 2, 2, 5, 2, 2);
  return finalizeLayout(positions);
}

function pyramidLayout() {
  const positions = [];
  addRectangle(positions, 9, 6, 1, 0, 0);
  addRectangle(positions, 6, 2, 2, 2, 1);
  addRectangle(positions, 3, 2, 4, 2, 2);
  return finalizeLayout(positions);
}

function fortressLayout() {
  const positions = [];
  addRectangle(positions, 10, 6, 0, 0, 0);
  addRectangle(positions, 4, 3, 3, 1, 1);
  return finalizeLayout(positions);
}

function bridgeLayout() {
  const positions = [];
  addRectangle(positions, 5, 6, 0, 0, 0);
  addRectangle(positions, 5, 6, 8, 0, 0);
  addRectangle(positions, 6, 2, 4, 2, 1);
  return finalizeLayout(positions);
}

function diamondLayout() {
  const positions = [];
  addRows(positions, [4, 8, 10, 12, 10, 8, 4], 12, 0, 0);
  addRectangle(positions, 4, 3, 4, 2, 1);
  addRectangle(positions, 4, 1, 4, 3, 2);
  return finalizeLayout(positions);
}

function crossLayout() {
  const positions = [];
  addRectangle(positions, 12, 2, 0, 3, 0);
  addRectangle(positions, 4, 8, 4, 0, 0);
  addRectangle(positions, 6, 2, 3, 3, 1);
  addRectangle(positions, 2, 6, 5, 1, 1);
  addRectangle(positions, 2, 2, 5, 3, 2);
  return finalizeLayout(positions);
}

function pagodaLayout() {
  const positions = [];
  addRectangle(positions, 8, 6, 2, 0, 0);
  addRectangle(positions, 6, 3, 3, 1, 1);
  addRectangle(positions, 3, 2, 4, 2, 2);
  return finalizeLayout(positions);
}

function arenaLayout() {
  const positions = [];
  addRing(positions, 12, 6, 0, 0, 0);
  addRing(positions, 10, 5, 1, 0, 1);
  addRectangle(positions, 7, 2, 2, 2, 2);
  return finalizeLayout(positions);
}

function waveLayout() {
  const positions = [];
  addRows(positions, [8, 10, 12, 10, 8], 12, 0, 0);
  addRows(positions, [6, 8, 6], 12, 1, 1);
  addRows(positions, [4], 12, 2, 2);
  return finalizeLayout(positions);
}

function spiralLayout() {
  const positions = [];
  addRing(positions, 8, 8, 2, 0, 0);
  addRing(positions, 6, 6, 3, 1, 0);
  addRectangle(positions, 5, 4, 3, 2, 1);
  addRectangle(positions, 2, 2, 5, 3, 2);
  return finalizeLayout(positions);
}

function randomLayout() {
  const baseCount = 50 + Math.floor(Math.random() * 4) * 2;
  const middleCount = 72 - baseCount - 4;
  return finalizeLayout([
    ...connectedBlob(baseCount, 12, 7, 0, 0, 0),
    ...connectedBlob(middleCount, 8, 5, 2, 1, 1),
    ...connectedBlob(4, 3, 2, 4, 2, 2),
  ]);
}

function guaranteedLayout(tileCount) {
  const pairsPerRow = 6;
  const positions = [];
  for (let pair = 0; pair < tileCount / 2; pair += 1) {
    const row = Math.floor(pair / pairsPerRow);
    const column = pair % pairsPerRow;
    positions.push({ x: column * 3, y: row * 2, z: 0 });
    positions.push({ x: column * 3 + 1, y: row * 2, z: 0 });
  }
  return finalizeLayout(positions, tileCount);
}

function createLayout(type, tileCount = 72) {
  const creators = {
    turtle: turtleLayout,
    pyramid: pyramidLayout,
    fortress: fortressLayout,
    bridge: bridgeLayout,
    diamond: diamondLayout,
    cross: crossLayout,
    pagoda: pagodaLayout,
    arena: arenaLayout,
    wave: waveLayout,
    spiral: spiralLayout,
    random: randomLayout,
  };
  const creator = creators[type] || randomLayout;
  if (tileCount === 72) return creator();
  const copies = tileCount / 72;
  const columns = copies > 2 ? 2 : copies;
  const expanded = [];
  for (let copy = 0; copy < copies; copy += 1) {
    const base = creator();
    const offsetX = (copy % columns) * 16;
    const offsetY = Math.floor(copy / columns) * 11;
    base.forEach(position => expanded.push({ x: position.x + offsetX, y: position.y + offsetY, z: position.z }));
  }
  return finalizeLayout(expanded, tileCount);
}

function activePositions(ids) {
  return game.positions.filter(position => ids.has(position.id));
}

function freePosition(position, ids) {
  const occupied = activePositions(ids);
  return positionIsFree(position, occupied);
}

function positionIsFree(position, occupied) {
  const covered = occupied.some(other => other.z > position.z && Math.abs(other.x - position.x) <= 1 && Math.abs(other.y - position.y) <= 1);
  if (covered) return false;
  const left = occupied.some(other => other.z === position.z && other.y === position.y && other.x === position.x - 1);
  const right = occupied.some(other => other.z === position.z && other.y === position.y && other.x === position.x + 1);
  return !left || !right;
}

function freePositions(ids) {
  const occupied = activePositions(ids);
  return occupied.filter(position => positionIsFree(position, occupied));
}

function solvableAssignment() {
  const maximumAttempts = Math.max(240, game.tileCount * 5);
  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    const remaining = new Set(game.positions.map(position => position.id));
    const pairs = [];
    let valid = true;
    while (remaining.size) {
      const free = shuffle(freePositions(remaining));
      if (free.length < 2) { valid = false; break; }
      const pair = [free[0], free[1]];
      pair.forEach(position => remaining.delete(position.id));
      pairs.push(pair);
    }
    if (valid) return pairs;
  }
  return null;
}

function createGuaranteedPairs() {
  game.positions = guaranteedLayout(game.tileCount);
  game.layoutType = 'guaranteed';
  return Array.from({ length: game.tileCount / 2 }, (_, pair) => [game.positions[pair * 2], game.positions[pair * 2 + 1]]);
}

function buildSolvableLayout(type) {
  const attempts = type === 'random' ? 24 : 2;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let positions;
    try {
      positions = createLayout(type, game.tileCount);
    } catch (error) {
      console.warn(`Disposition Mahjong ignorée : ${error.message}`);
      continue;
    }
    game.positions = positions;
    const pairs = solvableAssignment();
    if (pairs) return pairs;
  }
  if (type !== 'turtle') {
    try {
      game.positions = createLayout('turtle', game.tileCount);
      const fallback = solvableAssignment();
      if (fallback) {
        game.layoutType = 'turtle';
        return fallback;
      }
    } catch (error) {
      console.warn(`Disposition de secours Mahjong ignorée : ${error.message}`);
    }
  }
  return createGuaranteedPairs();
}

function displayRemoved() {
  if (!game.trace) return game.removed;
  const removed = new Set(game.trace.baseRemoved);
  for (let index = 0; index < game.trace.index; index += 1) game.trace.steps[index].forEach(id => removed.add(id));
  return removed;
}

function isFree(id, removed = game.removed) {
  if (removed.has(id)) return false;
  const remaining = new Set(game.positions.map(position => position.id).filter(positionId => !removed.has(positionId)));
  return freePosition(game.positions.find(position => position.id === id), remaining);
}

function matching(left, right) {
  return left.id === right.id;
}

function newGame() {
  game = {
    layoutType: layoutSelect.value,
    tileCount: Number(tileCountSelect.value),
    difficulty: difficultySelect.value,
    positions: [],
    tiles: new Map(),
    removed: new Set(),
    selected: null,
    history: [],
    hint: [],
    solution: [],
    trace: null,
  };
  const pairs = buildSolvableLayout(game.layoutType);
  const pairFaces = Array.from({ length: pairs.length }, (_, index) => faces[index % faces.length]);
  const values = game.difficulty === 'easy'
    ? pairFaces
    : game.difficulty === 'extreme'
      ? shuffle(pairFaces.map((_, index) => faces[index % Math.min(10, faces.length)]))
      : game.difficulty === 'hard'
      ? shuffle(pairFaces).sort((left, right) => left.id.localeCompare(right.id))
      : shuffle(pairFaces);
  pairs.forEach((pair, index) => {
    game.solution.push(pair.map(position => position.id));
    pair.forEach(position => game.tiles.set(position.id, { ...values[index], pair: index }));
  });
  const requested = layoutNames[layoutSelect.value];
  const actual = layoutNames[game.layoutType];
  statusElement.textContent = requested === actual
    ? `${actual} vérifiée : ${game.tileCount} tuiles, ${game.tileCount / 2} paires, difficulté ${difficultySelect.selectedOptions[0].textContent.toLowerCase()} et retrait complet garanti.`
    : `${requested} n’a pas pu être validée cette fois : le plateau de secours « ${actual} » garantit un retrait complet.`;
  render();
  autosave?.save();
}

function choose(id) {
  if (game.trace || game.removed.has(id) || !isFree(id)) return;
  const tile = game.tiles.get(id);
  if (game.selected === id) { game.selected = null; render(); return; }
  if (game.selected === null) { game.selected = id; render(); return; }
  const selectedTile = game.tiles.get(game.selected);
  if (!matching(selectedTile, tile)) {
    game.selected = id;
    statusElement.textContent = 'Ces tuiles ne correspondent pas : choisissez une autre tuile libre.';
    render();
    return;
  }
  const pair = [game.selected, id];
  pair.forEach(tileId => game.removed.add(tileId));
  game.history.push(pair);
  game.selected = null;
  game.hint = [];
  window.GameEffects?.play('success');
  if (game.removed.size === game.positions.length) {
    statusElement.textContent = 'Mahjong ! Le plateau est entièrement vidé.';
    window.GameRecords?.finish({ score: game.history.length, scoreLabel: `${game.history.length} paires`, lowerIsBetter: true, won: true, raceWinner: true });
    window.GameEffects?.play('win');
  } else statusElement.textContent = 'Paire retirée. De nouvelles tuiles peuvent être libres.';
  render();
}

function availablePairs(removed = game.removed) {
  const free = game.positions.filter(position => isFree(position.id, removed));
  const pairs = [];
  for (let index = 0; index < free.length; index += 1) {
    for (let other = index + 1; other < free.length; other += 1) {
      if (matching(game.tiles.get(free[index].id), game.tiles.get(free[other].id))) pairs.push([free[index].id, free[other].id]);
    }
  }
  return pairs;
}

function solveRemaining() {
  const initial = new Set(game.positions.map(position => position.id).filter(id => !game.removed.has(id)));
  const knownContinuation = [];
  const knownRemaining = new Set(initial);
  let knownValid = true;
  for (const pair of game.solution) {
    const present = pair.filter(id => knownRemaining.has(id));
    if (!present.length) continue;
    if (present.length !== 2 || !pair.every(id => freePosition(game.positions.find(position => position.id === id), knownRemaining))) {
      knownValid = false;
      break;
    }
    knownContinuation.push(pair.slice());
    pair.forEach(id => knownRemaining.delete(id));
  }
  if (knownValid && knownRemaining.size === 0) return knownContinuation;
  const memo = new Set();
  let visits = 0;
  const visitLimit = 240000 * Math.max(1, game.tileCount / 72);
  function search(remaining) {
    if (!remaining.size) return [];
    if (visits++ > visitLimit) return null;
    const key = [...remaining].sort((left, right) => left - right).join(',');
    if (memo.has(key)) return null;
    const free = freePositions(remaining);
    const byFace = new Map();
    free.forEach(position => {
      const face = game.tiles.get(position.id).id;
      if (!byFace.has(face)) byFace.set(face, []);
      byFace.get(face).push(position.id);
    });
    const candidates = [];
    byFace.forEach(ids => {
      for (let index = 0; index < ids.length; index += 1) {
        for (let other = index + 1; other < ids.length; other += 1) candidates.push([ids[index], ids[other]]);
      }
    });
    candidates.sort((left, right) => {
      const known = game.solution.findIndex(pair => pair.includes(left[0]) && pair.includes(left[1]));
      const otherKnown = game.solution.findIndex(pair => pair.includes(right[0]) && pair.includes(right[1]));
      return (otherKnown < 0) - (known < 0) || known - otherKnown;
    });
    for (const pair of candidates) {
      const next = new Set(remaining);
      pair.forEach(id => next.delete(id));
      const continuation = search(next);
      if (continuation) return [pair, ...continuation];
    }
    memo.add(key);
    return null;
  }
  return search(initial);
}

function hint() {
  if (game.trace) return;
  const solution = solveRemaining();
  const pair = solution?.[0];
  if (!pair) {
    statusElement.textContent = availablePairs().length ? 'Les coups libres actuels mènent à une impasse détectée : annulez un coup.' : 'Aucune paire libre : annulez un coup ou recommencez le plateau.';
    window.GameEffects?.play('error');
    return;
  }
  game.hint = pair;
  statusElement.textContent = `Indice vérifié : cette paire ouvre une solution complète de ${solution.length} étape(s).`;
  render();
}

function solveStep() {
  if (game.trace) { nextTraceStep(); return; }
  const pair = solveRemaining()?.[0];
  if (!pair) { statusElement.textContent = 'Aucune continuation complète trouvée : annulez un coup ou recommencez.'; return; }
  game.selected = null;
  choose(pair[0]);
  choose(pair[1]);
}

function undo() {
  if (game.trace) { stopTrace(); return; }
  const pair = game.history.pop();
  if (!pair) return;
  pair.forEach(id => game.removed.delete(id));
  game.selected = null;
  game.hint = [];
  statusElement.textContent = 'Dernière paire restaurée.';
  render();
}

function startTrace() {
  const steps = solveRemaining();
  if (!steps) {
    statusElement.textContent = 'Aucune résolution complète trouvée depuis l’état actuel.';
    return;
  }
  game.trace = { baseRemoved: new Set(game.removed), steps, index: 0 };
  game.selected = null;
  game.hint = [];
  statusElement.textContent = `Trace calculée : ${steps.length} étape(s), sans modifier votre partie.`;
  render();
}

function stopTrace() {
  game.trace = null;
  traceComment.textContent = 'La trace ne modifie pas votre partie.';
  statusElement.textContent = 'Retour à la partie en cours.';
  render();
}

function previousTraceStep() {
  if (!game.trace || game.trace.index === 0) return;
  game.trace.index -= 1;
  render();
}

function nextTraceStep() {
  if (!game.trace || game.trace.index >= game.trace.steps.length) return;
  game.trace.index += 1;
  render();
}

function toggleTrace() {
  if (game.trace) stopTrace(); else startTrace();
}

function updateTraceControls() {
  const active = Boolean(game.trace);
  traceToggleButton.textContent = active ? 'Revenir à la partie' : 'Voir la résolution';
  tracePreviousButton.hidden = !active;
  traceNextButton.hidden = !active;
  tracePreviousButton.disabled = !active || game.trace.index === 0;
  traceNextButton.disabled = !active || game.trace.index === game.trace.steps.length;
  if (!active) return;
  const current = game.trace.index;
  const total = game.trace.steps.length;
  if (current === total) traceComment.textContent = `Étape ${current}/${total} : plateau entièrement résolu.`;
  else {
    const pair = game.trace.steps[current];
    const label = game.tiles.get(pair[0]).label;
    traceComment.textContent = `Étape ${current}/${total} : la prochaine paire à retirer est ${label}.`;
  }
}

function render() {
  const removed = displayRemoved();
  const free = game.positions.filter(position => isFree(position.id, removed));
  const tracePair = game.trace?.steps[game.trace.index] || [];
  pairsElement.textContent = String(removed.size / 2);
  freeElement.textContent = String(free.length);
  layoutNameElement.textContent = `${layoutNames[game.layoutType]} · ${game.tileCount}`;
  const maximumX = Math.max(...game.positions.map(position => position.x + position.z * .12));
  const maximumY = Math.max(...game.positions.map(position => position.y));
  stage.style.width = `${Math.max(760, 130 + (maximumX + 1) * 52)}px`;
  stage.style.height = `${Math.max(520, 130 + (maximumY + 1) * 67)}px`;
  stage.innerHTML = game.positions
    .filter(position => !removed.has(position.id))
    .sort((left, right) => left.z - right.z || left.y - right.y)
    .map(position => {
      const tile = game.tiles.get(position.id);
      const freeTile = isFree(position.id, removed);
      const classes = `tile ${tile.family}${freeTile ? ' free' : ' locked'}${game.selected === position.id ? ' selected' : ''}${game.hint.includes(position.id) ? ' hint' : ''}${tracePair.includes(position.id) ? ' trace-next' : ''}`;
      const left = 42 + position.x * 52 + position.z * 6;
      const top = 42 + position.y * 67 - position.z * 16;
      return `<button class="${classes}" style="left:${left}px;top:${top}px;z-index:${position.z * 100 + position.y}" data-id="${position.id}">${tile.label}</button>`;
    }).join('');
  if (!game.trace) stage.querySelectorAll('[data-id]').forEach(button => button.onclick = () => choose(Number(button.dataset.id)));
  hintButton.disabled = Boolean(game.trace);
  undoButton.disabled = game.trace ? false : !game.history.length;
  updateTraceControls();
}

function verifyGeneratedSolution() {
  const remaining = new Set(game.positions.map(position => position.id));
  for (const pair of game.solution) {
    if (pair.length !== 2 || !pair.every(id => remaining.has(id) && freePosition(game.positions.find(position => position.id === id), remaining))) return false;
    if (!matching(game.tiles.get(pair[0]), game.tiles.get(pair[1]))) return false;
    pair.forEach(id => remaining.delete(id));
  }
  return remaining.size === 0;
}

function validateConfiguration(layoutType, tileCount) {
  const currentGame = game;
  try {
    game = {
      layoutType,
      tileCount,
      positions: [],
      tiles: new Map(),
      removed: new Set(),
      solution: [],
    };
    const pairs = buildSolvableLayout(layoutType);
    pairs.forEach((pair, index) => {
      const face = faces[index % faces.length];
      game.solution.push(pair.map(position => position.id));
      pair.forEach(position => game.tiles.set(position.id, { ...face, pair: index }));
    });
    return {
      requestedLayout: layoutType,
      actualLayout: game.layoutType,
      tileCount,
      valid: game.positions.length === tileCount && game.solution.length * 2 === tileCount && verifyGeneratedSolution(),
    };
  } catch (error) {
    return { requestedLayout: layoutType, actualLayout: 'error', tileCount, valid: false, error: error.message };
  } finally {
    game = currentGame;
  }
}

function validateConfigurations() {
  const compactLayouts = Object.keys(layoutNames).filter(layout => layout !== 'guaranteed');
  return [
    ...compactLayouts.map(layout => validateConfiguration(layout, 72)),
    ...[144, 216, 288].map(tileCount => validateConfiguration('random', tileCount)),
  ];
}

window.MahjongTestAPI = Object.freeze({
  summary: () => ({
    layout: game.layoutType,
    tileCount: game.tileCount,
    difficulty: game.difficulty,
    solutionPairs: game.solution.length,
    generatedSolutionValid: verifyGeneratedSolution(),
  }),
  solveRemaining: () => solveRemaining()?.map(pair => pair.slice()) || null,
  validateConfigurations,
});

document.getElementById('newGame').onclick = newGame;
layoutSelect.onchange = newGame;
tileCountSelect.onchange = newGame;
difficultySelect.onchange = newGame;
hintButton.onclick = hint;
solveButton.onclick = solveStep;
undoButton.onclick = undo;
traceToggleButton.onclick = toggleTrace;
tracePreviousButton.onclick = previousTraceStep;
traceNextButton.onclick = nextTraceStep;
document.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft' && game.trace) { event.preventDefault(); previousTraceStep(); }
  if (event.key === 'ArrowRight') { event.preventDefault(); if (game.trace) nextTraceStep(); else startTrace(); }
  if (event.key === 'Escape') stopTrace();
});
if (!window.GameEffects) {
  const script = document.createElement('script');
  script.src = '../../shared/effects.js?v=1';
  document.head.appendChild(script);
}
localStorage.setItem('game-hub:last-game', 'mahjong');
autosave = window.GameRuntime?.createAutosave('partie', {
  capture: () => ({ ...game, tiles: [...game.tiles.entries()], removed: [...game.removed] }),
  validate: value => Array.isArray(value?.positions) && Array.isArray(value?.tiles) && Array.isArray(value?.removed),
  restore: value => { game = { ...value, tiles: new Map(value.tiles), removed: new Set(value.removed), trace: null }; render(); },
});
if (!autosave?.restore()) newGame();
