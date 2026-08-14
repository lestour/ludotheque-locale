'use strict';

const engine = window.LogicPuzzleEngine;
const modeSelect = document.getElementById('mode');
const sizeSelect = document.getElementById('size');
const difficultySelect = document.getElementById('difficulty');
const playArea = document.getElementById('playArea');
const statusElement = document.getElementById('status');
const titleElement = document.getElementById('title');
const rulesElement = document.getElementById('rules');
const legendElement = document.getElementById('legend');
const progressElement = document.getElementById('progress');
const progressText = document.getElementById('progressText');
const keypad = document.getElementById('keypad');
const traceControls = document.getElementById('traceControls');
const traceComment = document.getElementById('traceComment');
const traceSlider = document.getElementById('traceSlider');
const traceStepLabel = document.getElementById('traceStepLabel');
const storage = window.GameRuntime?.storage;
const numericModes = new Set(['futoshiki', 'kakuro', 'hidato']);
const binaryModes = new Set(['hitori', 'nurikabe', 'akari']);
const sessionSeed = new URLSearchParams(location.search).get('seed') || window.GameRuntime?.randomSeed?.() || Date.now();

let generation = 0;
let puzzle;
let state;
let trace = [];
let traceIndex = 0;

function storageKey() {
  return `${modeSelect.value}:${sizeSelect.value}:${difficultySelect.value}`;
}

function cloneState(source) {
  return {
    values: [...source.values],
    marked: [...source.marked],
    edges: [...source.edges],
    activeIndex: source.activeIndex,
    lastDigitAt: source.lastDigitAt || 0,
    complete: Boolean(source.complete)
  };
}

function initialState(source = puzzle) {
  const values = Array(source.size * source.size).fill(0);
  Object.entries(source.givens || {}).forEach(([index, value]) => { values[Number(index)] = value; });
  Object.entries(source.endpoints || {}).forEach(([index, value]) => { values[Number(index)] = value; });
  return { values, marked: Array(values.length).fill(0), edges: [], activeIndex: null, lastDigitAt: 0, complete: false };
}

function save() {
  storage?.save('logic-puzzles', storageKey(), { puzzle, state: cloneState(state) });
}

function loadOrGenerate(force = false) {
  updateSizeOptions(true);
  const saved = force ? null : storage?.load('logic-puzzles', storageKey());
  const compatibleSave = saved?.puzzle?.engineVersion === 2
    && saved.puzzle.mode === modeSelect.value
    && saved.puzzle.size === Number(sizeSelect.value)
    && (saved.puzzle.mode !== 'kakuro' || Array.isArray(saved.puzzle.mask));
  if (compatibleSave) {
    puzzle = saved.puzzle;
    state = saved.state;
    state.edges ||= [];
    state.marked ||= Array(puzzle.size * puzzle.size).fill(0);
    state.values ||= initialState(puzzle).values;
  } else {
    generation++;
    const random = window.GameRuntime?.createRandom(`${sessionSeed}:${modeSelect.value}:${sizeSelect.value}:${difficultySelect.value}:${generation}`) || Math.random;
    puzzle = engine.generate(modeSelect.value, Number(sizeSelect.value), difficultySelect.value, random);
    state = initialState();
    save();
  }
  closeTrace();
}

function updateSizeOptions(preserve = true) {
  const sizes = engine.metadata[modeSelect.value].sizes;
  const previous = Number(sizeSelect.value);
  sizeSelect.replaceChildren(...sizes.map(size => {
    const option = document.createElement('option');
    option.value = size;
    option.textContent = `${size} × ${size}`;
    return option;
  }));
  sizeSelect.value = preserve && sizes.includes(previous) ? previous : sizes[Math.min(1, sizes.length - 1)];
}

function createGrid(size, className = 'puzzle-grid') {
  const grid = document.createElement('div');
  grid.className = className;
  grid.style.gridTemplateColumns = `repeat(${size}, var(--cell))`;
  return grid;
}

function isGiven(index) {
  return puzzle.givens?.[index] !== undefined || puzzle.endpoints?.[index] !== undefined;
}

function isPlayableNumeric(index) {
  return numericModes.has(puzzle.mode) && !isGiven(index) && (puzzle.mode !== 'kakuro' || puzzle.mask[index]);
}

function numericMaximum() {
  if (puzzle.mode === 'futoshiki') return puzzle.size;
  if (puzzle.mode === 'hidato') return puzzle.size * puzzle.size;
  return 9;
}

function numericCell(index, className = 'puzzle-cell') {
  const cell = document.createElement('button');
  cell.type = 'button';
  cell.className = `${className}${isGiven(index) ? ' given' : ''}${state.activeIndex === index ? ' active' : ''}${trace[traceIndex]?.focus === index ? ' trace-focus' : ''}`;
  cell.textContent = state.values[index] || '';
  cell.disabled = isGiven(index);
  cell.dataset.index = index;
  cell.setAttribute('aria-label', `Case ${index + 1}, valeur de 1 à ${numericMaximum()}`);
  cell.onclick = () => {
    state.activeIndex = index;
    render();
  };
  return cell;
}

function renderFutoshiki() {
  const grid = createGrid(puzzle.size);
  range(puzzle.size * puzzle.size).forEach(index => grid.append(numericCell(index)));
  playArea.append(grid);
  requestAnimationFrame(() => {
    const gridBox = grid.getBoundingClientRect();
    puzzle.inequalities.forEach(([left, right, sign]) => {
      const first = grid.querySelector(`[data-index="${left}"]`);
      if (!first) return;
      const box = first.getBoundingClientRect();
      const vertical = right === left + puzzle.size;
      const marker = document.createElement('span');
      marker.className = `futoshiki-sign${vertical ? ' vertical' : ''}`;
      marker.textContent = vertical ? (sign === '<' ? '∧' : '∨') : sign;
      marker.setAttribute('aria-hidden', 'true');
      marker.style.width = vertical ? '28px' : '20px';
      marker.style.height = vertical ? '18px' : '28px';
      marker.style.left = `${box.left - gridBox.left + (vertical ? box.width / 2 - 14 : box.width - 9)}px`;
      marker.style.top = `${box.top - gridBox.top + (vertical ? box.height - 8 : box.height / 2 - 14)}px`;
      grid.append(marker);
    });
  });
}

function renderHidato() {
  const grid = createGrid(puzzle.size);
  range(puzzle.size * puzzle.size).forEach(index => grid.append(numericCell(index)));
  playArea.append(grid);
}

function renderKakuro() {
  const grid = createGrid(puzzle.size, 'kakuro-grid');
  const clues = new Map();
  puzzle.runs.forEach(run => {
    const clue = clues.get(run.clueIndex) || { down: null, right: null };
    clue[run.direction] = run.sum;
    clues.set(run.clueIndex, clue);
  });
  range(puzzle.size * puzzle.size).forEach(index => {
    if (puzzle.mask[index]) {
      grid.append(numericCell(index, 'kakuro-cell'));
      return;
    }
    const cell = document.createElement('div');
    cell.className = 'kakuro-clue';
    const clue = clues.get(index);
    if (clue?.down !== null) cell.insertAdjacentHTML('beforeend', `<span class="down">${clue.down} ↓</span>`);
    if (clue?.right !== null) cell.insertAdjacentHTML('beforeend', `<span class="right">→ ${clue.right}</span>`);
    grid.append(cell);
  });
  playArea.append(grid);
}

function renderHitori() {
  const grid = createGrid(puzzle.size);
  puzzle.values.forEach((value, index) => {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = `puzzle-cell${state.marked[index] ? ' shaded' : ''}${trace[traceIndex]?.focus === index ? ' trace-focus' : ''}`;
    cell.textContent = value;
    cell.onclick = () => toggleMark(index);
    grid.append(cell);
  });
  playArea.append(grid);
}

function renderNurikabe() {
  const grid = createGrid(puzzle.size);
  range(puzzle.size * puzzle.size).forEach(index => {
    const clue = puzzle.clues[index];
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = `puzzle-cell ${clue !== undefined ? 'given island' : state.marked[index] ? 'sea' : 'island'}${trace[traceIndex]?.focus === index ? ' trace-focus' : ''}`;
    cell.textContent = clue ?? '';
    cell.disabled = clue !== undefined;
    cell.onclick = () => toggleMark(index);
    grid.append(cell);
  });
  playArea.append(grid);
}

function renderAkari() {
  const grid = createGrid(puzzle.size);
  range(puzzle.size * puzzle.size).forEach(index => {
    const wall = puzzle.walls[index];
    const isWall = wall !== undefined;
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = `puzzle-cell${isWall ? ' clue' : state.marked[index] ? ' bulb light' : ' light'}${trace[traceIndex]?.focus === index ? ' trace-focus' : ''}`;
    cell.textContent = isWall && wall !== null ? wall : '';
    cell.disabled = isWall;
    cell.onclick = () => toggleMark(index);
    grid.append(cell);
  });
  playArea.append(grid);
}

function edgeId(orientation, row, col) {
  return orientation === 'h' ? `h${row * puzzle.size + col}` : `v${row * (puzzle.size + 1) + col}`;
}

function renderSlitherlink() {
  const unit = Math.max(42, Math.min(58, 310 / puzzle.size));
  const wrap = document.createElement('div');
  wrap.className = 'slither-wrap';
  wrap.style.width = `${puzzle.size * unit}px`;
  wrap.style.height = `${puzzle.size * unit}px`;
  puzzle.clues.forEach((clue, index) => {
    const cell = document.createElement('div');
    cell.className = 'slither-cell';
    cell.textContent = clue ?? '';
    cell.style.width = `${unit - 1}px`;
    cell.style.height = `${unit - 1}px`;
    cell.style.left = `${(index % puzzle.size) * unit}px`;
    cell.style.top = `${Math.floor(index / puzzle.size) * unit}px`;
    wrap.append(cell);
  });
  const addEdge = (id, orientation, left, top, width, height) => {
    const edge = document.createElement('button');
    edge.type = 'button';
    edge.className = `edge ${orientation}${state.edges.includes(id) ? ' active' : ''}${trace[traceIndex]?.focus === id ? ' trace-focus' : ''}`;
    edge.style.left = `${left}px`;
    edge.style.top = `${top}px`;
    edge.style.width = `${width}px`;
    edge.style.height = `${height}px`;
    edge.setAttribute('aria-label', `Segment ${orientation === 'h' ? 'horizontal' : 'vertical'} ${id.slice(1)}`);
    edge.onclick = () => {
      state.edges = state.edges.includes(id) ? state.edges.filter(edgeIdValue => edgeIdValue !== id) : [...state.edges, id];
      save();
      render();
    };
    wrap.append(edge);
  };
  for (let row = 0; row <= puzzle.size; row++) for (let col = 0; col < puzzle.size; col++) addEdge(edgeId('h', row, col), 'h', col * unit + 5, row * unit - 2, unit - 10, 5);
  for (let row = 0; row < puzzle.size; row++) for (let col = 0; col <= puzzle.size; col++) addEdge(edgeId('v', row, col), 'v', col * unit - 2, row * unit + 5, 5, unit - 10);
  playArea.append(wrap);
}

function renderNumberlink() {
  const grid = createGrid(puzzle.size);
  range(puzzle.size * puzzle.size).forEach(index => {
    const endpoint = puzzle.endpoints[index];
    const color = state.values[index] || endpoint || 0;
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = `puzzle-cell${color ? ` path-${'abcdefg'[color - 1]}` : ''}${endpoint ? ' given' : ''}`;
    cell.textContent = endpoint || '';
    cell.disabled = Boolean(endpoint);
    cell.onclick = () => {
      state.values[index] = (state.values[index] + 1) % (puzzle.colors + 1);
      save();
      render();
    };
    grid.append(cell);
  });
  playArea.append(grid);
}

function toggleMark(index) {
  state.marked[index] = state.marked[index] ? 0 : 1;
  save();
  render();
}

function render() {
  playArea.replaceChildren();
  titleElement.textContent = puzzle.title;
  rulesElement.textContent = puzzle.rules;
  legendElement.replaceChildren(...puzzle.legend.map(text => {
    const item = document.createElement('li');
    item.textContent = text;
    item.dataset.ruleKey = `${puzzle.mode}:${puzzle.legend.indexOf(text)}`;
    return item;
  }));
  keypad.hidden = !numericModes.has(puzzle.mode);
  if (puzzle.mode === 'futoshiki') renderFutoshiki();
  else if (puzzle.mode === 'kakuro') renderKakuro();
  else if (puzzle.mode === 'hidato') renderHidato();
  else if (puzzle.mode === 'hitori') renderHitori();
  else if (puzzle.mode === 'nurikabe') renderNurikabe();
  else if (puzzle.mode === 'akari') renderAkari();
  else if (puzzle.mode === 'slitherlink') renderSlitherlink();
  else renderNumberlink();
  updateProgress();
}

function range(length) {
  return Array.from({ length }, (_, index) => index);
}

function filledCount() {
  if (puzzle.mode === 'slitherlink') return state.edges.length;
  if (binaryModes.has(puzzle.mode)) return state.marked.filter(Boolean).length;
  if (puzzle.mode === 'kakuro') return puzzle.mask.filter((isWhite, index) => isWhite && state.values[index]).length;
  return state.values.filter(Boolean).length;
}

function targetCount() {
  if (puzzle.mode === 'slitherlink') return engine.helpers.allEdges(puzzle.size).length;
  if (puzzle.mode === 'kakuro') return puzzle.mask.filter(Boolean).length;
  return puzzle.size * puzzle.size;
}

function updateProgress() {
  const filled = filledCount();
  const total = targetCount();
  progressElement.style.width = `${Math.min(100, filled / total * 100)}%`;
  progressText.textContent = `${filled} action${filled > 1 ? 's' : ''} sur ${total}.`;
}

function applyNumericDigit(digit) {
  if (!isPlayableNumeric(state.activeIndex)) return;
  const maximum = numericMaximum();
  const now = performance.now();
  const previous = state.values[state.activeIndex] || 0;
  let next = digit;
  if (maximum > 9 && previous && now - state.lastDigitAt <= 700) {
    const combined = Number(`${previous}${digit}`);
    next = combined <= maximum ? combined : digit;
  }
  if (next < 1 || next > maximum) return;
  state.values[state.activeIndex] = next;
  state.lastDigitAt = now;
  save();
  render();
}

function clearNumericCell() {
  if (!isPlayableNumeric(state.activeIndex)) return;
  state.values[state.activeIndex] = 0;
  state.lastDigitAt = 0;
  save();
  render();
}

function moveSelection(key) {
  if (!numericModes.has(puzzle.mode)) return;
  const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -puzzle.size, ArrowDown: puzzle.size }[key];
  if (!offset) return;
  let next = state.activeIndex ?? 0;
  for (let attempts = 0; attempts < puzzle.size * puzzle.size; attempts++) {
    const candidate = next + offset;
    if (candidate < 0 || candidate >= puzzle.size * puzzle.size) break;
    if ((key === 'ArrowLeft' || key === 'ArrowRight') && Math.floor(candidate / puzzle.size) !== Math.floor(next / puzzle.size)) break;
    next = candidate;
    if (puzzle.mode !== 'kakuro' || puzzle.mask[next]) {
      state.activeIndex = next;
      render();
      playArea.querySelector(`[data-index="${next}"]`)?.focus({ preventScroll: true });
      return;
    }
  }
}

function validate() {
  const correct = engine.validate(puzzle, state);
  statusElement.textContent = correct ? `Bravo : ${puzzle.title} résolu en respectant toutes les règles.` : 'La grille est incomplète ou enfreint encore au moins une règle.';
  if (correct && !state.complete) {
    state.complete = true;
    save();
    window.GameRecords?.finish({ score: 100, scoreLabel: `${puzzle.title} résolu`, won: true });
  }
  return correct;
}

function buildTrace() {
  statusElement.textContent = 'Construction des déductions et vérification des branches…';
  trace = engine.traceFromSolution(puzzle, state).map(step => ({ ...step, state: cloneState(step.state) }));
  if (!trace.length) {
    statusElement.textContent = 'Aucune solution compatible : corrigez une entrée ou générez une nouvelle grille.';
    return false;
  }
  traceIndex = 0;
  traceControls.hidden = false;
  traceComment.hidden = false;
  traceSlider.max = Math.max(0, trace.length - 1);
  traceSlider.value = 0;
  showTraceStep();
  statusElement.textContent = `Mode trace actif : ${trace.length - 1} déduction${trace.length > 2 ? 's' : ''}. Utilisez ←, → ou le curseur.`;
  return true;
}

function showTraceStep() {
  if (!trace.length) return;
  state = cloneState(trace[traceIndex].state);
  traceComment.textContent = `Étape ${traceIndex}/${trace.length - 1} — ${trace[traceIndex].comment}`;
  traceSlider.value = traceIndex;
  traceStepLabel.textContent = `${traceIndex} / ${trace.length - 1}`;
  save();
  render();
}

function closeTrace() {
  trace = [];
  traceIndex = 0;
  traceControls.hidden = true;
  traceComment.hidden = true;
  traceSlider.max = 0;
  traceSlider.value = 0;
  traceStepLabel.textContent = '0 / 0';
}

function revealHint() {
  if (!buildTrace()) return;
  if (trace.length > 1) {
    traceIndex = 1;
    showTraceStep();
    statusElement.textContent = 'Une déduction contrainte a été appliquée. La trace reste consultable.';
  } else validate();
}

function buildKeypad() {
  keypad.replaceChildren();
  for (let digit = 1; digit <= 9; digit++) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = digit;
    button.onclick = () => applyNumericDigit(digit);
    keypad.append(button);
  }
  const erase = document.createElement('button');
  erase.type = 'button';
  erase.className = 'erase';
  erase.textContent = 'Effacer';
  erase.onclick = clearNumericCell;
  keypad.append(erase);
}

document.getElementById('newGame').onclick = () => {
  loadOrGenerate(true);
  window.GameRecords?.reset();
  statusElement.textContent = 'Nouvelle grille générée et contrôlée.';
  render();
};
document.getElementById('reset').onclick = () => {
  state = initialState();
  closeTrace();
  save();
  window.GameRecords?.reset();
  statusElement.textContent = 'Toutes les entrées du joueur ont été effacées.';
  render();
};
document.getElementById('check').onclick = validate;
document.getElementById('hint').onclick = revealHint;
document.getElementById('solveAll').onclick = buildTrace;
document.getElementById('previousStep').onclick = () => { if (traceIndex > 0) { traceIndex--; showTraceStep(); } };
document.getElementById('nextStep').onclick = () => { if (traceIndex < trace.length - 1) { traceIndex++; showTraceStep(); if (traceIndex === trace.length - 1) validate(); } };
traceSlider.oninput = () => { traceIndex = Number(traceSlider.value); showTraceStep(); if (traceIndex === trace.length - 1) validate(); };
document.getElementById('closeTrace').onclick = closeTrace;
document.getElementById('abandon').onclick = () => {
  window.GameRecords?.finish({ score: 0, scoreLabel: 'Partie abandonnée', won: false });
  statusElement.textContent = 'Partie abandonnée. La grille reste visible.';
};
modeSelect.onchange = () => {
  updateSizeOptions(false);
  loadOrGenerate();
  statusElement.textContent = `${puzzle.title} chargé.`;
  render();
};
sizeSelect.onchange = () => { loadOrGenerate(); render(); };
difficultySelect.onchange = () => { loadOrGenerate(); render(); };
document.addEventListener('keydown', event => {
  if (event.target.matches('select,a,input,textarea')) return;
  if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && !traceControls.hidden && trace.length) {
    event.preventDefault();
    document.getElementById(event.key === 'ArrowLeft' ? 'previousStep' : 'nextStep').click();
    return;
  }
  if (event.key.startsWith('Arrow')) {
    event.preventDefault();
    moveSelection(event.key);
    return;
  }
  if (/^[1-9]$/.test(event.key)) {
    event.preventDefault();
    applyNumericDigit(Number(event.key));
  } else if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') {
    event.preventDefault();
    clearNumericCell();
  }
});

buildKeypad();
updateSizeOptions(false);
loadOrGenerate();
render();
window.GameRuleExamples = element => {
  const key = element.dataset.ruleKey || `${puzzle.mode}:0`;
  const [mode, indexText] = key.split(':');
  const index = Number(indexText);
  const examples = {
    futoshiki: [
      { html: '<div class="rule-example-grid" style="--example-columns:3"><div class="rule-example-cell highlight">1</div><div class="rule-example-cell">2</div><div class="rule-example-cell">3</div><div class="rule-example-cell">2</div><div class="rule-example-cell">3</div><div class="rule-example-cell">1</div></div>', explanation: 'Chaque ligne et colonne contient 1, 2 et 3 une seule fois.' },
      { html: '<div style="display:grid;grid-template-columns:52px 34px 52px;align-items:center"><div class="rule-example-cell highlight">2</div><div class="rule-example-sign">&lt;</div><div class="rule-example-cell highlight">4</div></div>', explanation: '2 < 4 : la pointe du signe est tournée vers la plus petite valeur.' },
      { html: '<div class="rule-example-grid" style="--example-columns:3"><div class="rule-example-cell bad">3</div><div class="rule-example-cell">1</div><div class="rule-example-cell bad">3</div></div>', explanation: 'Deux 3 dans la même ligne sont interdits.' }
    ],
    kakuro: [
      { html: '<div style="display:grid;grid-template-columns:58px repeat(2,52px);gap:3px"><div class="rule-example-cell" style="background:#26394f;color:white;font-size:14px">→ 7</div><div class="rule-example-cell highlight">3</div><div class="rule-example-cell highlight">4</div></div>', explanation: 'La série vers la droite vaut 3 + 4 = 7.' },
      { html: '<div style="display:grid;grid-template-columns:repeat(3,52px);gap:3px"><div class="rule-example-cell highlight">1</div><div class="rule-example-cell">3</div><div class="rule-example-cell highlight">5</div></div>', explanation: 'Les chiffres d’une même série sont tous différents.' }
    ],
    hidato: [{ html: '<div class="rule-example-grid" style="--example-columns:3"><div class="rule-example-cell highlight">7</div><div class="rule-example-cell highlight">8</div><div class="rule-example-cell">12</div><div class="rule-example-cell">6</div><div class="rule-example-cell highlight">9</div><div class="rule-example-cell">10</div></div>', explanation: '7 touche 8 et 8 touche 9 ; un contact diagonal est autorisé.' }],
    hitori: [{ html: '<div class="rule-example-grid"><div class="rule-example-cell bad">2</div><div class="rule-example-cell">1</div><div class="rule-example-cell highlight">2</div></div>', explanation: 'L’un des deux 2 doit être noirci pour supprimer la répétition.' }],
    nurikabe: [{ html: '<div class="rule-example-grid"><div class="rule-example-cell highlight">3</div><div class="rule-example-cell highlight"></div><div class="rule-example-cell" style="background:#75b9ee"></div><div class="rule-example-cell highlight"></div><div class="rule-example-cell" style="background:#75b9ee"></div><div class="rule-example-cell" style="background:#75b9ee"></div></div>', explanation: 'L’île indicée 3 contient exactement trois cases claires.' }],
    akari: [{ html: '<div class="rule-example-grid"><div class="rule-example-cell" style="background:#fff7bf">💡</div><div class="rule-example-cell highlight"></div><div class="rule-example-cell" style="background:#26394f;color:white">1</div></div>', explanation: 'L’ampoule éclaire jusqu’au mur ; le mur 1 touche exactement une ampoule.' }],
    slitherlink: [{ html: '<div style="font-size:70px;color:#1d4ed8;line-height:1">□ <strong style="font-size:28px;color:#17243a">2</strong></div>', explanation: 'Deux des quatre côtés de la case indicée 2 appartiennent à la boucle.' }],
    numberlink: [{ html: '<div class="rule-example-grid"><div class="rule-example-cell path-a">1</div><div class="rule-example-cell path-a"></div><div class="rule-example-cell path-a">1</div></div>', explanation: 'Une couleur forme un chemin orthogonal continu entre ses deux extrémités.' }]
  };
  const example = examples[mode]?.[index] || examples[mode]?.[0];
  return example ? { title: `Exemple · ${engine.metadata[mode].title}`, text: element.textContent.trim(), ...example } : null;
};
window.LogicPuzzlesTestAPI = {
  diagnostics() {
    const blank = initialState(puzzle);
    const generatedValid = engine.validate(puzzle, {
      ...blank,
      values: puzzle.solution ? [...puzzle.solution] : blank.values,
      marked: binaryModes.has(puzzle.mode) ? [...puzzle.solution] : blank.marked,
      edges: puzzle.mode === 'slitherlink' ? [...puzzle.solution] : blank.edges
    });
    return {
      modes: Object.keys(engine.metadata),
      active: modeSelect.value,
      rendered: Boolean(playArea.children.length),
      controls: ['check', 'hint', 'reset', 'abandon', 'previousStep', 'nextStep'].every(id => Boolean(document.getElementById(id))),
      generatedValid,
      sizes: engine.metadata[modeSelect.value].sizes.length,
      textualInputs: playArea.querySelectorAll('input').length
    };
  },
  validateGenerators() {
    return Object.keys(engine.metadata).map((mode, modeIndex) => {
      const size = engine.metadata[mode].sizes[0];
      const random = window.GameRuntime?.createRandom(`logic-diagnostic:${modeIndex}`) || Math.random;
      const generated = engine.generate(mode, size, 'easy', random);
      const blank = { values: Array(size * size).fill(0), marked: Array(size * size).fill(0), edges: [] };
      Object.entries(generated.givens || {}).forEach(([index, value]) => { blank.values[Number(index)] = value; });
      Object.entries(generated.endpoints || {}).forEach(([index, value]) => { blank.values[Number(index)] = value; });
      const solvedState = {
        ...blank,
        values: generated.solution && !binaryModes.has(mode) && mode !== 'slitherlink' ? [...generated.solution] : blank.values,
        marked: binaryModes.has(mode) ? [...generated.solution] : blank.marked,
        edges: mode === 'slitherlink' ? [...generated.solution] : blank.edges
      };
      return { mode, size, valid: engine.validate(generated, solvedState) };
    });
  },
  validateSolvers() {
    return Object.keys(engine.metadata).map((mode, modeIndex) => {
      const size = engine.metadata[mode].sizes[0];
      const random = window.GameRuntime?.createRandom(`logic-solver-diagnostic:${modeIndex}`) || Math.random;
      const generated = engine.generate(mode, size, 'easy', random);
      const blank = { values: Array(size * size).fill(0), marked: Array(size * size).fill(0), edges: [] };
      Object.entries(generated.givens || {}).forEach(([index, value]) => { blank.values[Number(index)] = value; });
      Object.entries(generated.endpoints || {}).forEach(([index, value]) => { blank.values[Number(index)] = value; });
      const startedAt = performance.now();
      const answer = engine.solve(generated, blank, 1)[0];
      const solvedState = answer ? {
        ...blank,
        values: !binaryModes.has(mode) && mode !== 'slitherlink' ? [...answer] : blank.values,
        marked: binaryModes.has(mode) ? [...answer] : blank.marked,
        edges: mode === 'slitherlink' ? [...answer] : blank.edges
      } : blank;
      return { mode, solved: Boolean(answer) && engine.validate(generated, solvedState), milliseconds: Math.round(performance.now() - startedAt) };
    });
  }
};
try { localStorage.setItem('game-hub:last-game', 'logic-puzzles'); } catch {}
