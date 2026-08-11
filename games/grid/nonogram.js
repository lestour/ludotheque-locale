const board = document.getElementById('nonogram');
const sizeSelect = document.getElementById('size');
const generateButton = document.getElementById('generate');
const resetButton = document.getElementById('reset');
const solveStepButton = document.getElementById('solveStep');
const solveAllButton = document.getElementById('solveAll');
const showErrors = document.getElementById('showErrors');
const status = document.getElementById('status');
const errorCount = document.getElementById('errorCount');
const traceModeToggle = document.getElementById('traceModeToggle');
const previousTrace = document.getElementById('previousTrace');
const nextTrace = document.getElementById('nextTrace');
const traceSlider = document.getElementById('traceSlider');
const traceLabel = document.getElementById('traceLabel');
const modeSelect = document.getElementById('mode');
const imageInput = document.getElementById('imageInput');
const paletteElement = document.getElementById('palette');
const paletteSizeSelect = document.getElementById('paletteSize');
const paletteSizeLabel = document.getElementById('paletteSizeLabel');
const imageTools = document.createElement('div');
imageTools.className = 'toolbar';
paletteElement.after(imageTools);
const imageOverview = document.createElement('div');
imageOverview.id = 'imageOverview';
imageOverview.hidden = true;
board.parentNode.insertBefore(imageOverview, board);

let size = Number(sizeSelect.value);
let solution = [];
let player = [];
let paintValue = 0;
let paintMode = '';
let isPainting = false;
let solverMessage = '';
let solverTrace = [];
let traceMessages = [];
let traceIndex = 0;
let isViewingTrace = false;
let isColorMode = false;
let colorSolution = [];
let colorPlayer = [];
let paletteColors = ['#e53e3e', '#dd8b16', '#e5c823', '#38a169', '#3182ce', '#805ad5', '#d53f8c', '#319795'];
let selectedColor = paletteColors[0];
let importedImage = null;
let importedCrop = null;
let imageBlocks = new Map();
let imageGrid = { columns: 3, rows: 3 };
let imageSuggestedSizes = new Map();
let traceIsColor = false;
let paletteLimit = Number(paletteSizeSelect.value);

function resizeBoardContainer(columns, rows) {
  const requiredWidth = Math.max(1180, columns * 30 + 74);
  document.querySelector('main').style.maxWidth = `${requiredWidth}px`;
  document.querySelector('.panel').style.minWidth = `${Math.min(requiredWidth, 1720)}px`;
}

function renderImageTools() {
  imageTools.hidden = !importedImage;
  if (!importedImage) return;
  const formats = imageSubdivisionFormats(importedImage);
  const currentKey = imageGridKey(imageGrid);
  imageTools.innerHTML = `<span class="muted">Image ${importedImage.naturalWidth || importedImage.width} × ${importedImage.naturalHeight || importedImage.height} · ${paletteLimit} couleurs</span><strong id="imageCompletion">Progression : ${imageCompletionPercent()} %</strong><label class="muted">Découpage <select id="imageGridFormat">${formats.map(format => `<option value="${imageGridKey(format)}"${imageGridKey(format) === currentKey ? ' selected' : ''}>${format.columns} × ${format.rows}${format.recommended ? ' · recommandé' : ''} · ${format.columns * format.rows} blocs</option>`).join('')}</select></label><button id="showImageOverview">Image entière</button><button id="removeImage">Supprimer l’image</button>`;
  document.getElementById('removeImage').onclick = removeImportedImage;
  document.getElementById('imageGridFormat').onchange = event => {
    const [columns, rows] = event.target.value.split('x').map(Number);
    showImageSubgrids({ columns, rows });
  };
  document.getElementById('showImageOverview').onclick = () => showImageOverview(imageGrid);
}

function imageGridKey(format) { return `${format.columns}x${format.rows}`; }

function imageSubdivisionFormats(image) {
  const ratio = Math.max(.1, (image.naturalWidth || image.width) / Math.max(1, image.naturalHeight || image.height));
  const candidates = new Map();
  const add = (columns, rows) => {
    columns = Math.max(1, Math.min(24, Math.round(columns)));
    rows = Math.max(1, Math.min(18, Math.round(rows)));
    candidates.set(`${columns}x${rows}`, { columns, rows });
  };
  [[1,1],[2,1],[2,2],[3,2],[3,3],[4,2],[4,3],[4,4],[5,3],[5,4],[5,5],[6,3],[6,4],[6,5],[6,6],[8,4],[8,5],[8,6],[8,8],[10,5],[10,6],[10,8],[10,10],[12,6],[12,7],[12,8],[12,9],[12,12],[16,9],[16,10],[16,12],[16,16],[20,10],[20,12],[20,15],[24,12],[24,14],[24,16],[24,18]].forEach(([columns, rows]) => add(columns, rows));
  for (let columns = 2; columns <= 24; columns += 1) {
    const idealRows = columns / ratio;
    add(columns, Math.floor(idealRows));
    add(columns, Math.round(idealRows));
    add(columns, Math.ceil(idealRows));
  }
  const formats = [...candidates.values()];
  const recommended = formats.reduce((best, format) => {
    const ratioError = Math.abs(Math.log((format.columns / format.rows) / ratio));
    const blockPenalty = Math.abs(format.columns * format.rows - 12) * .018;
    const score = ratioError + blockPenalty;
    return !best || score < best.score ? { format, score } : best;
  }, null).format;
  formats.forEach(format => { format.recommended = imageGridKey(format) === imageGridKey(recommended); });
  return formats.sort((left, right) => Number(right.recommended) - Number(left.recommended) || left.columns * left.rows - right.columns * right.rows || left.columns - right.columns || left.rows - right.rows);
}

function recommendedImageGrid(image) {
  return imageSubdivisionFormats(image).find(format => format.recommended) || { columns: 3, rows: 3 };
}

function removeImportedImage() {
  importedImage = null;
  importedCrop = null;
  imageBlocks = new Map();
  imageSuggestedSizes = new Map();
  imageOverview.hidden = true;
  board.hidden = false;
  imageInput.value = '';
  imageTools.hidden = true;
  isColorMode = false;
  modeSelect.value = 'mono';
  paletteSizeLabel.hidden = true;
  paletteColors = generatedPalette(paletteLimit);
  createSolution();
  clearTrace();
  render();
}

function cropKey(crop = importedCrop) {
  return crop ? `${crop.columns}x${crop.rows}:${crop.row}:${crop.column}` : 'full';
}

function saveCurrentImageBlock() {
  if (!importedImage || !isColorMode || !importedCrop) return;
  imageBlocks.set(cropKey(), { size, palette: paletteColors.slice(), solution: colorSolution.slice(), player: colorPlayer.slice() });
}

function currentImageBlockState() {
  return importedCrop && isColorMode
    ? { size, palette: paletteColors, solution: colorSolution, player: colorPlayer }
    : null;
}

function blockCompletion(state) {
  if (!state?.solution?.length || !state?.player?.length) return { completed: 0, total: state?.size ? state.size * state.size : 0 };
  const completed = state.solution.reduce((total, expected, index) => {
    const actual = state.player[index];
    return total + Number(expected ? actual === expected : actual === -1);
  }, 0);
  return { completed, total: state.solution.length };
}

function imageCompletionPercent(format = imageGrid) {
  if (!importedImage) return 0;
  let completed = 0;
  let total = 0;
  for (let row = 0; row < format.rows; row += 1) for (let column = 0; column < format.columns; column += 1) {
    const crop = { row, column, columns: format.columns, rows: format.rows };
    const key = cropKey(crop);
    const state = importedCrop && key === cropKey(importedCrop) ? currentImageBlockState() : imageBlocks.get(key);
    const progress = blockCompletion(state);
    completed += progress.completed;
    total += progress.total || suggestedSizeForCrop(row, column, format.columns, format.rows) ** 2;
  }
  return total ? Math.round(completed * 1000 / total) / 10 : 0;
}

function updateImageProgressDisplays() {
  const progress = imageCompletionPercent();
  const toolbarProgress = document.getElementById('imageCompletion');
  const overviewProgress = document.getElementById('overviewCompletion');
  if (toolbarProgress) toolbarProgress.textContent = `Progression : ${progress} %`;
  if (overviewProgress) overviewProgress.textContent = `Progression : ${progress} %`;
}

function paintOverviewCanvas(canvas, state, crop) {
  const context = canvas.getContext('2d');
  const resolution = state?.size || suggestedSizeForCrop(crop.row, crop.column, crop.columns, crop.rows);
  context.fillStyle = '#f8fafc';
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (let row = 0; row < resolution; row += 1) for (let column = 0; column < resolution; column += 1) {
    const value = state?.player?.[row * resolution + column];
    context.fillStyle = value && value !== -1 ? value : '#ffffff';
    const left = Math.floor(column * canvas.width / resolution);
    const top = Math.floor(row * canvas.height / resolution);
    const right = Math.ceil((column + 1) * canvas.width / resolution);
    const bottom = Math.ceil((row + 1) * canvas.height / resolution);
    context.fillRect(left, top, right - left, bottom - top);
  }
}

function showImageOverview(format = imageGrid) {
  saveCurrentImageBlock();
  imageGrid = { columns: format.columns, rows: format.rows };
  importedCrop = null;
  board.hidden = true;
  imageOverview.hidden = false;
  imageOverview.innerHTML = `<div class="overview-title"><strong>Image entière · ${imageGrid.columns} × ${imageGrid.rows} · ${imageGrid.columns * imageGrid.rows} blocs</strong><strong id="overviewCompletion">Progression : ${imageCompletionPercent()} %</strong><span class="muted">Survolez puis cliquez sur une zone pour continuer sa grille.</span></div><div class="image-mosaic" style="--columns:${imageGrid.columns}"></div>`;
  const mosaic = imageOverview.querySelector('.image-mosaic');
  for (let row = 0; row < imageGrid.rows; row += 1) for (let column = 0; column < imageGrid.columns; column += 1) {
    const crop = { row, column, columns: imageGrid.columns, rows: imageGrid.rows };
    const button = document.createElement('button');
    button.className = 'image-block';
    button.title = `Ouvrir le bloc ${row + 1}, ${column + 1}`;
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = Math.max(60, Math.round(240 * ((importedImage.height / imageGrid.rows) / (importedImage.width / imageGrid.columns))));
    paintOverviewCanvas(canvas, imageBlocks.get(cropKey(crop)), crop);
    button.append(canvas);
    button.onclick = () => openImageCrop(crop);
    mosaic.append(button);
  }
}

function openImageCrop(crop) {
  saveCurrentImageBlock();
  importedCrop = crop;
  const saved = imageBlocks.get(cropKey(crop));
  board.hidden = false;
  imageOverview.hidden = true;
  if (saved) {
    size = saved.size;
    sizeSelect.value = String(size);
    paletteColors = saved.palette.slice();
    colorSolution = saved.solution.slice();
    colorPlayer = saved.player.slice();
    selectedColor = paletteColors[0] || null;
    clearTrace();
    renderColor();
    return;
  }
  const recommended = suggestedSizeForCrop(crop.row, crop.column, crop.columns, crop.rows);
  size = recommended;
  sizeSelect.value = String(recommended);
  quantizeImage(importedImage, crop);
}

function suggestedSizeForCrop(row, column, columns, rows) {
  const key = `${columns}x${rows}:${row}:${column}`;
  if (imageSuggestedSizes.has(key)) return imageSuggestedSizes.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 20;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const width = importedImage.width / columns;
  const height = importedImage.height / rows;
  context.drawImage(importedImage, column * width, row * height, width, height, 0, 0, 20, 20);
  const data = context.getImageData(0, 0, 20, 20).data;
  let variation = 0;
  for (let index = 4; index < data.length; index += 4) variation += Math.abs(data[index] - data[index - 4]) + Math.abs(data[index + 1] - data[index - 3]) + Math.abs(data[index + 2] - data[index - 2]);
  const suggested = variation > 52000 ? 40 : variation > 39000 ? 35 : variation > 29000 ? 30 : variation > 20000 ? 25 : variation > 13000 ? 20 : variation > 7000 ? 15 : 10;
  imageSuggestedSizes.set(key, suggested);
  return suggested;
}

function showImageSubgrids(format) {
  showImageOverview(format || imageGrid);
}

function updateTraceControls() {
  const hasTrace = solverTrace.length > 1;
  const lastIndex = Math.max(0, solverTrace.length - 1);
  previousTrace.disabled = !hasTrace || traceIndex === 0;
  nextTrace.disabled = !hasTrace || traceIndex === lastIndex;
  traceSlider.disabled = !hasTrace;
  traceModeToggle.disabled = false;
  traceModeToggle.textContent = !hasTrace ? 'Préparer la trace' : (isViewingTrace ? 'Revenir au résultat' : 'Voir la trace');
  traceSlider.max = lastIndex;
  traceSlider.value = traceIndex;
  traceLabel.textContent = hasTrace ? `Étape ${traceIndex} / ${lastIndex}` : 'Prépare une trace à partir de la grille actuelle.';
}

function clearTrace() {
  solverTrace = [];
  traceMessages = [];
  traceIndex = 0;
  isViewingTrace = false;
  traceIsColor = false;
  updateTraceControls();
}

function showTrace(index) {
  if (!solverTrace.length) return;
  traceIndex = Math.max(0, Math.min(index, solverTrace.length - 1));
  if (traceIsColor) colorPlayer = solverTrace[traceIndex].slice();
  else player = solverTrace[traceIndex].slice();
  isViewingTrace = true;
  solverMessage = traceMessages[traceIndex] || `Trace de résolution : étape ${traceIndex} sur ${solverTrace.length - 1}.`;
  updateTraceControls();
  if (traceIsColor) renderColor(); else render();
}

function toggleTraceMode() {
  if (solverTrace.length < 2) {
    prepareTrace();
    showTrace(0);
    return;
  }
  if (isViewingTrace) {
    traceIndex = solverTrace.length - 1;
    if (traceIsColor) colorPlayer = solverTrace[traceIndex].slice();
    else player = solverTrace[traceIndex].slice();
    isViewingTrace = false;
    solverMessage = 'Résultat de la résolution automatique.';
    updateTraceControls();
    if (traceIsColor) renderColor(); else render();
    return;
  }
  showTrace(0);
}

function indexOf(row, col) {
  return row * size + col;
}

function cluesFor(values) {
  const clues = [];
  let run = 0;
  values.forEach(value => {
    if (value) run += 1;
    else if (run) { clues.push(run); run = 0; }
  });
  if (run) clues.push(run);
  return clues.length ? clues : [0];
}

function runsFor(values) {
  const runs = [];
  let start = -1;
  values.forEach((value, index) => {
    if (value && start === -1) start = index;
    if (!value && start !== -1) {
      runs.push({ start, end: index - 1, length: index - start });
      start = -1;
    }
  });
  if (start !== -1) runs.push({ start, end: values.length - 1, length: values.length - start });
  return runs;
}

function normalizedClues(clues) {
  return clues.length === 1 && clues[0] === 0 ? [] : clues;
}

function completedClueStates(clues, values) {
  const targets = normalizedClues(clues);
  const runs = runsFor(values.map(value => value === 1));
  if (!targets.length) return [values.every(value => value !== 1)];
  return targets.map((target, index) => {
    const run = runs[index];
    if (!run || run.length !== target) return false;
    const beforeClear = run.start === 0 || values[run.start - 1] !== 1;
    const afterClear = run.end === values.length - 1 || values[run.end + 1] !== 1;
    return beforeClear && afterClear;
  });
}

function rowLine(row) {
  return Array.from({ length: size }, (_, col) => indexOf(row, col));
}

function columnLine(col) {
  return Array.from({ length: size }, (_, row) => indexOf(row, col));
}

function lineState(indexes) {
  return indexes.map(index => solution[index]);
}

function playerLine(indexes) {
  return indexes.map(index => player[index]);
}

function applyAutomaticCrosses() {
  let changes = 0;
  const lines = [...Array.from({ length: size }, (_, row) => rowLine(row)), ...Array.from({ length: size }, (_, col) => columnLine(col))];
  lines.forEach(indexes => {
    const values = playerLine(indexes);
    const clues = cluesFor(lineState(indexes));
    const completed = completedClueStates(clues, values);
    if (!completed.every(Boolean)) return;
    indexes.forEach(index => {
      if (player[index] === 0) {
        player[index] = -1;
        changes += 1;
      }
    });
  });
  return changes;
}

const EMPTY_CELL = -1;
const MONO_COLOR = '__mono__';
const lineAutomatonCache = new Map();

function lineAutomaton(clues) {
  const key = clues.map(clue => `${clue.color}:${clue.length}`).join('|');
  if (lineAutomatonCache.has(key)) return lineAutomatonCache.get(key);
  const states = [];
  const transitions = [];
  const ids = new Map();
  const stateId = (type, run = 0, progress = 0) => {
    const stateKey = `${type}:${run}:${progress}`;
    if (!ids.has(stateKey)) {
      ids.set(stateKey, states.length);
      states.push({ type, run, progress });
      transitions.push([]);
    }
    return ids.get(stateKey);
  };
  const waiting = run => stateId('waiting', run);
  const afterRun = run => {
    const nextRun = run + 1;
    if (nextRun >= clues.length) return waiting(clues.length);
    return clues[nextRun].color === clues[run].color ? stateId('separator', nextRun) : waiting(nextRun);
  };
  const start = waiting(0);
  for (let id = 0; id < states.length; id += 1) {
    const state = states[id];
    if (state.type === 'waiting') {
      transitions[id].push({ value: EMPTY_CELL, next: id });
      if (state.run < clues.length) {
        const run = clues[state.run];
        transitions[id].push({ value: run.color, next: run.length === 1 ? afterRun(state.run) : stateId('run', state.run, 1) });
      }
    } else if (state.type === 'separator') {
      transitions[id].push({ value: EMPTY_CELL, next: waiting(state.run) });
    } else {
      const run = clues[state.run];
      const progress = state.progress + 1;
      transitions[id].push({ value: run.color, next: progress === run.length ? afterRun(state.run) : stateId('run', state.run, progress) });
    }
  }
  const automaton = { start, accept: waiting(clues.length), transitions };
  lineAutomatonCache.set(key, automaton);
  return automaton;
}

function analyzeLineConstraints(clues, known) {
  const automaton = lineAutomaton(clues);
  const allows = (cell, value) => cell === null || cell === value;
  const forward = Array.from({ length: known.length + 1 }, () => new Set());
  forward[0].add(automaton.start);
  for (let position = 0; position < known.length; position += 1) {
    forward[position].forEach(state => automaton.transitions[state].forEach(transition => {
      if (allows(known[position], transition.value)) forward[position + 1].add(transition.next);
    }));
  }
  if (!forward[known.length].has(automaton.accept)) return { contradiction: true, possibleValues: known.map(() => new Set()) };
  const backward = Array.from({ length: known.length + 1 }, () => new Set());
  backward[known.length].add(automaton.accept);
  for (let position = known.length - 1; position >= 0; position -= 1) {
    forward[position].forEach(state => {
      if (automaton.transitions[state].some(transition => allows(known[position], transition.value) && backward[position + 1].has(transition.next))) backward[position].add(state);
    });
  }
  const possibleValues = known.map(() => new Set());
  known.forEach((cell, position) => {
    forward[position].forEach(state => automaton.transitions[state].forEach(transition => {
      if (allows(cell, transition.value) && backward[position + 1].has(transition.next)) possibleValues[position].add(transition.value);
    }));
  });
  return { contradiction: false, possibleValues };
}

function intersectValues(first, second) {
  return new Set([...first].filter(value => second.has(value)));
}

function propagateConstraintState(initialState, rowClues, columnClues) {
  const state = initialState.slice();
  const analyses = Array(size * 2);
  const queued = Array(size * 2).fill(true);
  const queue = Array.from({ length: size * 2 }, (_, index) => index);
  let cursor = 0;
  let changes = 0;
  const enqueue = line => {
    if (queued[line]) return;
    queued[line] = true;
    queue.push(line);
  };
  while (true) {
    while (cursor < queue.length) {
      const line = queue[cursor++];
      queued[line] = false;
      const isRow = line < size;
      const lineIndex = isRow ? line : line - size;
      const indexes = isRow ? rowLine(lineIndex) : columnLine(lineIndex);
      const clues = isRow ? rowClues[lineIndex] : columnClues[lineIndex];
      const analysis = analyzeLineConstraints(clues, indexes.map(index => state[index]));
      analyses[line] = analysis;
      if (analysis.contradiction) return { state, analyses, contradiction: true, changes, candidates: [] };
      indexes.forEach((index, position) => {
        if (state[index] !== null || analysis.possibleValues[position].size !== 1) return;
        state[index] = analysis.possibleValues[position].values().next().value;
        changes += 1;
        const row = Math.floor(index / size);
        const column = index % size;
        enqueue(row);
        enqueue(size + column);
      });
    }
    const candidates = Array(size * size).fill(null);
    let intersectionChanges = 0;
    for (let index = 0; index < state.length; index += 1) {
      if (state[index] !== null) continue;
      const row = Math.floor(index / size);
      const column = index % size;
      const possible = intersectValues(analyses[row].possibleValues[column], analyses[size + column].possibleValues[row]);
      candidates[index] = possible;
      if (!possible.size) return { state, analyses, contradiction: true, changes, candidates };
      if (possible.size !== 1) continue;
      state[index] = possible.values().next().value;
      changes += 1;
      intersectionChanges += 1;
      enqueue(row);
      enqueue(size + column);
    }
    if (!intersectionChanges) return { state, analyses, contradiction: false, changes, candidates };
  }
}

function searchConstraintSolution(initialState, rowClues, columnClues) {
  const started = performance.now();
  const deadline = started + Math.max(3000, Math.min(9000, size * 150));
  const maximumNodes = Math.max(40000, Math.min(180000, size * size * 70));
  let nodes = 0;
  let cutoff = false;
  const visit = state => {
    nodes += 1;
    if (nodes > maximumNodes || performance.now() > deadline) { cutoff = true; return null; }
    const propagated = propagateConstraintState(state, rowClues, columnClues);
    if (propagated.contradiction) return null;
    let bestIndex = -1;
    let bestValues = null;
    propagated.candidates.forEach((possible, index) => {
      if (!possible || possible.size < 2 || (bestValues && possible.size >= bestValues.size)) return;
      bestIndex = index;
      bestValues = possible;
    });
    if (bestIndex === -1) return propagated.state;
    const orderedValues = [...bestValues].sort((left, right) => Number(left === EMPTY_CELL) - Number(right === EMPTY_CELL));
    for (const value of orderedValues) {
      const branch = propagated.state.slice();
      branch[bestIndex] = value;
      const result = visit(branch);
      if (result) return result;
      if (cutoff) break;
    }
    return null;
  };
  return { solution: visit(initialState.slice()), nodes, cutoff, elapsed: performance.now() - started };
}

function monoConstraintClues() {
  const convert = indexes => normalizedClues(cluesFor(lineState(indexes))).map(length => ({ color: MONO_COLOR, length }));
  return {
    rows: Array.from({ length: size }, (_, row) => convert(rowLine(row))),
    columns: Array.from({ length: size }, (_, column) => convert(columnLine(column)))
  };
}

function colorConstraintClues() {
  return {
    rows: Array.from({ length: size }, (_, row) => colorRuns(colorLine(row, null))),
    columns: Array.from({ length: size }, (_, column) => colorRuns(colorLine(null, column)))
  };
}

function solveLine(indexes) {
  const clues = normalizedClues(cluesFor(lineState(indexes))).map(length => ({ color: MONO_COLOR, length }));
  const known = playerLine(indexes).map(value => value === 0 ? null : (value === 1 ? MONO_COLOR : EMPTY_CELL));
  const analysis = analyzeLineConstraints(clues, known);
  if (analysis.contradiction) return { changes: 0, contradiction: true };
  let changes = 0;
  indexes.forEach((index, position) => {
    const possible = analysis.possibleValues[position];
    const fixed = possible.size === 1 ? possible.values().next().value : null;
    const value = fixed === MONO_COLOR ? 1 : (fixed === EMPTY_CELL ? -1 : 0);
    if (value && player[index] !== value) {
      player[index] = value;
      changes += 1;
    }
  });
  return { changes, contradiction: false };
}

function solveLogicalStep() {
  let changes = 0;
  let contradictions = 0;
  const lines = [...Array.from({ length: size }, (_, row) => rowLine(row)), ...Array.from({ length: size }, (_, col) => columnLine(col))];
  lines.forEach(indexes => {
    const result = solveLine(indexes);
    changes += result.changes;
    contradictions += result.contradiction ? 1 : 0;
  });
  changes += applyAutomaticCrosses();
  return { changes, contradictions };
}

function isLogicallySolvable() {
  const savedPlayer = player;
  player = Array(size * size).fill(0);
  let contradiction = false;
  for (let iteration = 0; iteration < size * size * 2; iteration += 1) {
    const result = solveLogicalStep();
    contradiction ||= result.contradictions > 0;
    if (!result.changes) break;
  }
  const solved = !contradiction && player.every((value, index) => (value === 1) === solution[index]);
  player = savedPlayer;
  return solved;
}

function buildLogicalTrace(startState) {
  const savedPlayer = player;
  player = startState.slice();
  const snapshots = [player.slice()];
  const messages = ['État de départ.'];
  let totalChanges = 0;
  let contradictions = 0;
  let usedSearch = false;
  let searchCutoff = false;
  let progress = true;
  while (progress) {
    progress = false;
    for (let row = 0; row < size; row += 1) {
      const result = solveLine(rowLine(row));
      contradictions += Number(result.contradiction);
      if (!result.changes) continue;
      totalChanges += result.changes;
      progress = true;
      snapshots.push(player.slice());
      messages.push(`Ligne ${row + 1} : ${result.changes} déduction${result.changes > 1 ? 's' : ''}.`);
    }
    for (let col = 0; col < size; col += 1) {
      const result = solveLine(columnLine(col));
      contradictions += Number(result.contradiction);
      if (!result.changes) continue;
      totalChanges += result.changes;
      progress = true;
      snapshots.push(player.slice());
      messages.push(`Colonne ${col + 1} : ${result.changes} déduction${result.changes > 1 ? 's' : ''}.`);
    }
    const crosses = applyAutomaticCrosses();
    if (crosses) {
      totalChanges += crosses;
      progress = true;
      snapshots.push(player.slice());
      messages.push(`${crosses} croix ajoutée${crosses > 1 ? 's' : ''} sur des lignes ou colonnes terminées.`);
    }
  }
  if (!contradictions && player.some(value => value === 0)) {
    const clues = monoConstraintClues();
    const genericState = player.map(value => value === 0 ? null : (value === 1 ? MONO_COLOR : EMPTY_CELL));
    const search = searchConstraintSolution(genericState, clues.rows, clues.columns);
    searchCutoff = search.cutoff;
    if (search.solution) {
      usedSearch = true;
      for (let row = 0; row < size; row += 1) {
        let rowChanges = 0;
        rowLine(row).forEach(index => {
          const value = search.solution[index] === MONO_COLOR ? 1 : -1;
          if (player[index] === value) return;
          player[index] = value;
          rowChanges += 1;
        });
        if (!rowChanges) continue;
        totalChanges += rowChanges;
        snapshots.push(player.slice());
        messages.push(`Hypothèses et contradictions · ligne ${row + 1} : ${rowChanges} case${rowChanges > 1 ? 's' : ''} déterminée${rowChanges > 1 ? 's' : ''}.`);
      }
    }
  }
  const finalState = player.slice();
  player = savedPlayer;
  return { snapshots, messages, finalState, totalChanges, contradictions, usedSearch, searchCutoff };
}

function prepareTrace() {
  const result = isColorMode ? buildColorTrace(colorPlayer) : buildLogicalTrace(player);
  traceIsColor = isColorMode;
  solverTrace = result.snapshots;
  traceMessages = result.messages;
  traceIndex = 0;
  isViewingTrace = false;
  solverMessage = result.snapshots.length > 1 ? 'Trace prête : utilisez les flèches pour suivre chaque ligne et colonne.' : 'Aucune déduction logique supplémentaire.';
  updateTraceControls();
}

function solveLogically() {
  const result = buildLogicalTrace(player);
  solverTrace = result.snapshots;
  traceMessages = result.messages;
  player = result.finalState;
  traceIndex = Math.max(0, solverTrace.length - 1);
  isViewingTrace = false;
  solverMessage = result.contradictions
    ? 'Contradiction détectée : vérifie les cases déjà posées.'
    : result.usedSearch
      ? `${result.totalChanges} déductions appliquées, avec recherche par hypothèses et contradictions.`
      : result.searchCutoff
        ? 'Les déductions simples sont terminées ; la recherche avancée a atteint sa limite de calcul.'
        : (result.totalChanges ? `${result.totalChanges} déduction${result.totalChanges > 1 ? 's' : ''} logique${result.totalChanges > 1 ? 's' : ''} appliquée${result.totalChanges > 1 ? 's' : ''}.` : 'Aucune déduction logique supplémentaire.');
  updateTraceControls();
  render();
}

function createRandomSolution() {
  solution = Array(size * size).fill(false);
  const seedCount = Math.max(5, Math.floor(size * 0.7));
  for (let seed = 0; seed < seedCount; seed += 1) {
    const centerRow = Math.floor(Math.random() * size);
    const centerCol = Math.floor(Math.random() * size);
    const radius = 1 + Math.floor(Math.random() * Math.max(2, size / 5));
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (Math.abs(row - centerRow) + Math.abs(col - centerCol) <= radius && Math.random() > .18) solution[indexOf(row, col)] = true;
      }
    }
  }
}

function createSolution() {
  const attempts = size > 20 ? 8 : 24;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    createRandomSolution();
    player = Array(size * size).fill(0);
    if (isLogicallySolvable()) return;
  }
  player = Array(size * size).fill(0);
  solverMessage = 'Cette grille peut nécessiter une déduction avancée ou une supposition.';
}

function render() {
  if (isColorMode) {
    renderColor();
    return;
  }
  if (!isViewingTrace) applyAutomaticCrosses();
  const rowIndexes = Array.from({ length: size }, (_, row) => rowLine(row));
  const columnIndexes = Array.from({ length: size }, (_, col) => columnLine(col));
  const rowClues = rowIndexes.map(indexes => cluesFor(lineState(indexes)));
  const columnClues = columnIndexes.map(indexes => cluesFor(lineState(indexes)));
  const rowStates = rowIndexes.map((indexes, row) => completedClueStates(rowClues[row], playerLine(indexes)));
  const columnStates = columnIndexes.map((indexes, col) => completedClueStates(columnClues[col], playerLine(indexes)));
  const maxRowClues = Math.max(...rowClues.map(clues => clues.length));
  const maxColumnClues = Math.max(...columnClues.map(clues => clues.length));
  board.style.gridTemplateColumns = `repeat(${maxRowClues}, 29px) repeat(${size}, 29px)`;
  board.style.gridTemplateRows = `repeat(${maxColumnClues}, 29px) repeat(${size}, 29px)`;
  board.innerHTML = '';
  for (let row = 0; row < maxColumnClues + size; row += 1) {
    for (let col = 0; col < maxRowClues + size; col += 1) {
      const element = document.createElement('div');
      if (row < maxColumnClues && col < maxRowClues) element.className = 'corner';
      else if (row < maxColumnClues) {
        const clueColumn = col - maxRowClues;
        const clues = columnClues[clueColumn];
        const clueIndex = row - (maxColumnClues - clues.length);
        element.className = 'clue top-clue';
        if ((clueColumn + 1) % 5 === 0) element.classList.add('major-right');
        const clue = clues[clueIndex];
        if (clue && columnStates[clueColumn][clueIndex]) element.classList.add('done');
        element.textContent = clue || '';
      } else if (col < maxRowClues) {
        const clueRow = row - maxColumnClues;
        const clues = rowClues[clueRow];
        const clueIndex = col - (maxRowClues - clues.length);
        element.className = 'clue';
        if ((clueRow + 1) % 5 === 0) element.classList.add('major-bottom');
        const clue = clues[clueIndex];
        if (clue && rowStates[clueRow][clueIndex]) element.classList.add('done');
        element.textContent = clue || '';
      } else {
        const gridRow = row - maxColumnClues;
        const gridCol = col - maxRowClues;
        const cellIndex = indexOf(gridRow, gridCol);
        const error = showErrors.checked && ((player[cellIndex] === 1 && !solution[cellIndex]) || (player[cellIndex] === -1 && solution[cellIndex]));
        element.className = `cell${player[cellIndex] === 1 ? ' filled' : (player[cellIndex] === -1 ? ' marked' : '')}${error ? ' error' : ''}`;
        if ((gridCol + 1) % 5 === 0) element.classList.add('major-right');
        if ((gridRow + 1) % 5 === 0) element.classList.add('major-bottom');
        element.dataset.index = cellIndex;
        element.addEventListener('pointerdown', event => {
          if (event.button !== 0 && event.button !== 2) return;
          event.preventDefault();
          const currentValue = player[cellIndex];
          if (event.button === 0) {
            paintMode = currentValue === 1 ? 'erase-filled' : 'fill-empty';
            paintValue = currentValue === 1 ? 0 : 1;
          } else {
            if (currentValue === 1) return;
            paintMode = currentValue === -1 ? 'erase-marked' : 'mark-empty';
            paintValue = currentValue === -1 ? 0 : -1;
          }
          isPainting = true;
          clearTrace();
          solverMessage = '';
          player[cellIndex] = paintValue;
          render();
        });
        element.addEventListener('pointerenter', event => {
          if (!isPainting || (event.buttons & 3) === 0) return;
          const currentValue = player[cellIndex];
          if ((paintMode === 'fill-empty' || paintMode === 'mark-empty') && currentValue !== 0) return;
          if (paintMode === 'erase-filled' && currentValue !== 1) return;
          if (paintMode === 'erase-marked' && currentValue !== -1) return;
          player[cellIndex] = paintValue;
          render();
        });
        element.addEventListener('contextmenu', event => event.preventDefault());
      }
      if (row === maxColumnClues - 1) element.classList.add('grid-divider-bottom');
      if (col === maxRowClues - 1) element.classList.add('grid-divider-right');
      board.appendChild(element);
    }
  }
  const totalColumns = maxRowClues + size;
  const totalRows = maxColumnClues + size;
  const addSeparator = (orientation, position) => {
    const separator = document.createElement('div');
    separator.className = `separator ${orientation}`;
    if (orientation === 'vertical') {
      separator.style.left = `${position * 30 - 1}px`;
      separator.style.height = `${totalRows * 30 - 1}px`;
    } else {
      separator.style.top = `${position * 30 - 1}px`;
      separator.style.width = `${totalColumns * 30 - 1}px`;
    }
    board.appendChild(separator);
  };
  new Set([maxRowClues, ...Array.from({ length: Math.floor((size - 1) / 5) }, (_, index) => maxRowClues + (index + 1) * 5)]).forEach(position => addSeparator('vertical', position));
  new Set([maxColumnClues, ...Array.from({ length: Math.floor((size - 1) / 5) }, (_, index) => maxColumnClues + (index + 1) * 5)]).forEach(position => addSeparator('horizontal', position));
  const complete = player.every((value, index) => (value === 1) === solution[index]);
  const mistakes = player.reduce((total, value, index) => total + Number((value === 1 && !solution[index]) || (value === -1 && solution[index])), 0);
  errorCount.textContent = `Erreurs : ${mistakes}`;
  status.textContent = complete ? 'Grille terminée !' : (solverMessage || 'Complète les groupes indiqués par les nombres de chaque ligne et colonne.');
}

function colorRuns(values) {
  const runs = [];
  let color = null;
  let length = 0;
  values.forEach(value => {
    if (value && value !== -1 && value === color) length += 1;
    else {
      if (color) runs.push({ color, length });
      color = value && value !== -1 ? value : null;
      length = color ? 1 : 0;
    }
  });
  if (color) runs.push({ color, length });
  return runs;
}

function colorClueStates(clues, values) {
  const runs = colorRuns(values);
  return clues.map((clue, index) => Boolean(runs[index] && runs[index].color === clue.color && runs[index].length === clue.length));
}

function colorLine(row, column) {
  return row === null
    ? Array.from({ length: size }, (_, currentRow) => colorSolution[indexOf(currentRow, column)])
    : Array.from({ length: size }, (_, currentColumn) => colorSolution[indexOf(row, currentColumn)]);
}

function colorPlayerLine(row, column) {
  return row === null
    ? Array.from({ length: size }, (_, currentRow) => colorPlayer[indexOf(currentRow, column)])
    : Array.from({ length: size }, (_, currentColumn) => colorPlayer[indexOf(row, currentColumn)]);
}

function renderPalette() {
  paletteElement.hidden = !isColorMode;
  if (!isColorMode) return;
  paletteElement.innerHTML = `<span class="muted">Couleur :</span>${paletteColors.map(color => `<button class="palette-color${selectedColor === color ? ' selected' : ''}" data-color="${color}" style="background:${color}" title="Choisir ${color}"></button>`).join('')}<button class="palette-color erase${selectedColor === null ? ' selected' : ''}" data-color="erase">Gomme</button>`;
  paletteElement.querySelectorAll('[data-color]').forEach(button => button.addEventListener('click', () => {
    selectedColor = button.dataset.color === 'erase' ? null : button.dataset.color;
    renderPalette();
  }));
}

function generatedPalette(count) {
  const base = ['#e53e3e', '#dd8b16', '#d4b814', '#38a169', '#319795', '#3182ce', '#805ad5', '#d53f8c'];
  if (count <= base.length) return base.slice(0, count);
  const colors = base.slice();
  const hslToHex = (hue, saturation, lightness) => {
    saturation /= 100;
    lightness /= 100;
    const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
    const part = hue / 60;
    const second = chroma * (1 - Math.abs(part % 2 - 1));
    const [red, green, blue] = part < 1 ? [chroma, second, 0] : part < 2 ? [second, chroma, 0] : part < 3 ? [0, chroma, second] : part < 4 ? [0, second, chroma] : part < 5 ? [second, 0, chroma] : [chroma, 0, second];
    const match = lightness - chroma / 2;
    return `#${[red, green, blue].map(channel => Math.round((channel + match) * 255).toString(16).padStart(2, '0')).join('')}`;
  };
  while (colors.length < count) {
    const index = colors.length - base.length;
    colors.push(hslToHex((index * 137.508 + 18) % 360, index % 3 === 0 ? 78 : 66, index % 2 === 0 ? 42 : 58));
  }
  return colors;
}

function addColorSeparators(maxRowClues, maxColumnClues) {
  const totalColumns = maxRowClues + size;
  const totalRows = maxColumnClues + size;
  const addSeparator = (orientation, position) => {
    const separator = document.createElement('div');
    separator.className = `separator ${orientation}`;
    if (orientation === 'vertical') {
      separator.style.left = `${position * 30 - 1}px`;
      separator.style.height = `${totalRows * 30 - 1}px`;
    } else {
      separator.style.top = `${position * 30 - 1}px`;
      separator.style.width = `${totalColumns * 30 - 1}px`;
    }
    board.appendChild(separator);
  };
  new Set([maxRowClues, ...Array.from({ length: Math.floor((size - 1) / 5) }, (_, index) => maxRowClues + (index + 1) * 5)]).forEach(position => addSeparator('vertical', position));
  new Set([maxColumnClues, ...Array.from({ length: Math.floor((size - 1) / 5) }, (_, index) => maxColumnClues + (index + 1) * 5)]).forEach(position => addSeparator('horizontal', position));
}

function colorClueMarkup(clue) {
  return clue ? `<span class="color-clue"><i style="background:${clue.color}"></i>${clue.length}</span>` : '';
}

function renderColor() {
  renderPalette();
  const rowClues = Array.from({ length: size }, (_, row) => colorRuns(colorLine(row, null)));
  const columnClues = Array.from({ length: size }, (_, column) => colorRuns(colorLine(null, column)));
  const rowStates = rowClues.map((clues, row) => colorClueStates(clues, colorPlayerLine(row, null)));
  const columnStates = columnClues.map((clues, column) => colorClueStates(clues, colorPlayerLine(null, column)));
  const maxRowClues = Math.max(1, ...rowClues.map(clues => clues.length));
  const maxColumnClues = Math.max(1, ...columnClues.map(clues => clues.length));
  resizeBoardContainer(maxRowClues + size, maxColumnClues + size);
  board.style.gridTemplateColumns = `repeat(${maxRowClues}, 29px) repeat(${size}, 29px)`;
  board.style.gridTemplateRows = `repeat(${maxColumnClues}, 29px) repeat(${size}, 29px)`;
  board.innerHTML = '';
  for (let row = 0; row < maxColumnClues + size; row += 1) {
    for (let column = 0; column < maxRowClues + size; column += 1) {
      const element = document.createElement('div');
      if (row < maxColumnClues && column < maxRowClues) element.className = 'corner';
      else if (row < maxColumnClues) {
        const clueColumn = column - maxRowClues;
        const clues = columnClues[clueColumn];
        const clueIndex = row - (maxColumnClues - clues.length);
        const clue = clues[clueIndex];
        element.className = 'clue top-clue';
        if (clue && columnStates[clueColumn][clueIndex]) element.classList.add('done');
        element.innerHTML = colorClueMarkup(clue);
      } else if (column < maxRowClues) {
        const clueRow = row - maxColumnClues;
        const clues = rowClues[clueRow];
        const clueIndex = column - (maxRowClues - clues.length);
        const clue = clues[clueIndex];
        element.className = 'clue';
        if (clue && rowStates[clueRow][clueIndex]) element.classList.add('done');
        element.innerHTML = colorClueMarkup(clue);
      } else {
        const gridRow = row - maxColumnClues;
        const gridColumn = column - maxRowClues;
        const cellIndex = indexOf(gridRow, gridColumn);
        const value = colorPlayer[cellIndex];
        const error = showErrors.checked && ((value && value !== -1 && value !== colorSolution[cellIndex]) || (value === -1 && colorSolution[cellIndex]));
        element.className = `cell${value && value !== -1 ? ' color-filled' : (value === -1 ? ' marked' : '')}${error ? ' error' : ''}`;
        if (value && value !== -1) element.style.background = value;
        if (error) element.title = value === -1 ? 'Cette case doit être colorée.' : 'Cette couleur est incorrecte.';
        element.dataset.index = cellIndex;
        element.addEventListener('pointerdown', event => {
          if (event.button !== 0 && event.button !== 2) return;
          event.preventDefault();
          const target = event.button === 2 ? -1 : selectedColor;
          paintValue = colorPlayer[cellIndex] === target ? null : target;
          paintMode = colorPlayer[cellIndex] === target ? 'erase-color' : 'set-color';
          isPainting = true;
          clearTrace();
          solverMessage = '';
          colorPlayer[cellIndex] = paintValue;
          renderColor();
        });
        element.addEventListener('pointerenter', event => {
          if (!isPainting || (event.buttons & 3) === 0) return;
          if ((paintMode === 'set-color' && colorPlayer[cellIndex] === paintValue) || (paintMode === 'erase-color' && colorPlayer[cellIndex] !== paintValue)) return;
          colorPlayer[cellIndex] = paintValue;
          renderColor();
        });
        element.addEventListener('contextmenu', event => event.preventDefault());
      }
      if (row === maxColumnClues - 1) element.classList.add('grid-divider-bottom');
      if (column === maxRowClues - 1) element.classList.add('grid-divider-right');
      board.appendChild(element);
    }
  }
  addColorSeparators(maxRowClues, maxColumnClues);
  const complete = colorPlayer.every((value, index) => value === colorSolution[index] || (!colorSolution[index] && (value === null || value === -1)));
  const mistakes = colorPlayer.reduce((total, value, index) => total + Number((value && value !== -1 && value !== colorSolution[index]) || (value === -1 && colorSolution[index])), 0);
  errorCount.textContent = `Erreurs : ${mistakes}`;
  status.textContent = complete ? 'Nonogram couleur terminé !' : (solverMessage || 'Choisis une couleur dans la palette, puis remplis les indices colorés.');
  updateImageProgressDisplays();
}

function createColorPuzzle() {
  paletteColors = generatedPalette(paletteLimit);
  createRandomSolution();
  colorSolution = solution.map(value => value ? paletteColors[Math.floor(Math.random() * paletteColors.length)] : null);
  colorPlayer = Array(size * size).fill(null);
  selectedColor = paletteColors[0];
}

function quantizeImage(image, crop = importedCrop) {
  paletteSizeLabel.hidden = false;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (crop) {
    const cropWidth = image.width / crop.columns;
    const cropHeight = image.height / crop.rows;
    context.drawImage(image, crop.column * cropWidth, crop.row * cropHeight, cropWidth, cropHeight, 0, 0, size, size);
  } else context.drawImage(image, 0, 0, size, size);
  const pixels = context.getImageData(0, 0, size, size).data;
  const buckets = new Map();
  for (let index = 0; index < pixels.length; index += 4) {
    const [red, green, blue, alpha] = pixels.slice(index, index + 4);
    if (alpha < 100 || (red > 242 && green > 242 && blue > 242)) continue;
    const color = `#${[red, green, blue].map(value => Math.min(255, Math.round(value / 51) * 51).toString(16).padStart(2, '0')).join('')}`;
    buckets.set(color, (buckets.get(color) || 0) + 1);
  }
  paletteColors = [...buckets.entries()].sort((first, second) => second[1] - first[1]).slice(0, paletteLimit).map(([color]) => color);
  if (!paletteColors.length) paletteColors = ['#334155'];
  const nearest = (red, green, blue) => paletteColors.reduce((best, color) => {
    const rgb = color.match(/[a-f0-9]{2}/gi).map(value => parseInt(value, 16));
    const distance = (rgb[0] - red) ** 2 + (rgb[1] - green) ** 2 + (rgb[2] - blue) ** 2;
    return distance < best.distance ? { color, distance } : best;
  }, { color: paletteColors[0], distance: Infinity }).color;
  colorSolution = Array.from({ length: size * size }, (_, pixel) => {
    const offset = pixel * 4;
    const [red, green, blue, alpha] = pixels.slice(offset, offset + 4);
    return alpha < 100 || (red > 242 && green > 242 && blue > 242) ? null : nearest(red, green, blue);
  });
  solution = colorSolution.map(Boolean);
  colorPlayer = Array(size * size).fill(null);
  selectedColor = paletteColors[0];
  solverMessage = '';
  clearTrace();
  board.hidden = false;
  imageOverview.hidden = true;
  renderImageTools();
  renderColor();
}

function importImage(file) {
  if (!file) return;
  const image = new Image();
  image.addEventListener('load', () => {
    isColorMode = true;
    modeSelect.value = 'color';
    paletteSizeLabel.hidden = false;
    importedImage = image;
    importedCrop = null;
    imageBlocks = new Map();
    imageSuggestedSizes = new Map();
    imageGrid = recommendedImageGrid(image);
    renderImageTools();
    showImageOverview(imageGrid);
  });
  image.src = URL.createObjectURL(file);
}

function solveColorLine(indexes) {
  const clues = colorRuns(indexes.map(index => colorSolution[index]));
  const known = indexes.map(index => colorPlayer[index]);
  const analysis = analyzeLineConstraints(clues, known);
  if (analysis.contradiction) return { changes: 0, contradiction: true };
  let changes = 0;
  indexes.forEach((index, position) => {
    const possible = analysis.possibleValues[position];
    if (possible.size !== 1) return;
    const next = possible.values().next().value;
    if (colorPlayer[index] !== next) { colorPlayer[index] = next; changes += 1; }
  });
  return { changes, contradiction: false };
}

function solveColorLogicalStep() {
  let changes = 0;
  let contradictions = 0;
  const lines = [...Array.from({ length: size }, (_, row) => rowLine(row)), ...Array.from({ length: size }, (_, column) => columnLine(column))];
  lines.forEach(indexes => { const result = solveColorLine(indexes); changes += result.changes; contradictions += Number(result.contradiction); });
  return { changes, contradictions };
}

function solveColorLogically(all = false) {
  let total = 0;
  let contradictions = 0;
  const limit = all ? size * size * 3 : 1;
  for (let iteration = 0; iteration < limit; iteration += 1) { const result = solveColorLogicalStep(); total += result.changes; contradictions += result.contradictions; if (!result.changes || result.contradictions) break; }
  solverMessage = contradictions ? 'Contradiction détectée : une couleur ou une croix est incompatible avec les indices.' : total ? `${total} déduction${total > 1 ? 's' : ''} colorée${total > 1 ? 's' : ''} appliquée${total > 1 ? 's' : ''}.` : 'Aucune déduction colorée supplémentaire.';
  renderColor();
}

function buildColorTrace(startState) {
  const saved = colorPlayer;
  colorPlayer = startState.slice();
  const snapshots = [colorPlayer.slice()];
  const messages = ['État de départ.'];
  let totalChanges = 0;
  let contradictions = 0;
  let usedSearch = false;
  let searchCutoff = false;
  let progress = true;
  while (progress) {
    progress = false;
    for (let row = 0; row < size; row += 1) {
      const result = solveColorLine(rowLine(row));
      contradictions += Number(result.contradiction);
      if (!result.changes) continue;
      totalChanges += result.changes;
      progress = true;
      snapshots.push(colorPlayer.slice());
      messages.push(`Ligne ${row + 1} : ${result.changes} déduction${result.changes > 1 ? 's' : ''} colorée${result.changes > 1 ? 's' : ''}.`);
    }
    for (let column = 0; column < size; column += 1) {
      const result = solveColorLine(columnLine(column));
      contradictions += Number(result.contradiction);
      if (!result.changes) continue;
      totalChanges += result.changes;
      progress = true;
      snapshots.push(colorPlayer.slice());
      messages.push(`Colonne ${column + 1} : ${result.changes} déduction${result.changes > 1 ? 's' : ''} colorée${result.changes > 1 ? 's' : ''}.`);
    }
    if (contradictions) break;
  }
  if (!contradictions && colorPlayer.some(value => value === null)) {
    const clues = colorConstraintClues();
    const search = searchConstraintSolution(colorPlayer, clues.rows, clues.columns);
    searchCutoff = search.cutoff;
    if (search.solution) {
      usedSearch = true;
      for (let row = 0; row < size; row += 1) {
        let rowChanges = 0;
        rowLine(row).forEach(index => {
          if (colorPlayer[index] === search.solution[index]) return;
          colorPlayer[index] = search.solution[index];
          rowChanges += 1;
        });
        if (!rowChanges) continue;
        totalChanges += rowChanges;
        snapshots.push(colorPlayer.slice());
        messages.push(`Hypothèses colorées et contradictions · ligne ${row + 1} : ${rowChanges} case${rowChanges > 1 ? 's' : ''} déterminée${rowChanges > 1 ? 's' : ''}.`);
      }
    }
  }
  const finalState = colorPlayer.slice();
  colorPlayer = saved;
  return { snapshots, messages, finalState, totalChanges, contradictions, usedSearch, searchCutoff };
}

document.addEventListener('pointerup', () => { isPainting = false; });
generateButton.addEventListener('click', () => { size = Number(sizeSelect.value); solverMessage = ''; clearTrace(); if (importedImage && isColorMode && colorPlayer.every(value => value === null || value === -1)) quantizeImage(importedImage); else if (isColorMode) createColorPuzzle(); else createSolution(); render(); });
resetButton.addEventListener('click', () => { solverMessage = ''; if (isColorMode) colorPlayer = Array(size * size).fill(null); else player = Array(size * size).fill(0); clearTrace(); render(); });
solveStepButton.addEventListener('click', () => {
  const result = isColorMode ? buildColorTrace(colorPlayer) : buildLogicalTrace(player);
  traceIsColor = isColorMode;
  solverTrace = result.snapshots.slice(0, 2);
  traceMessages = result.messages.slice(0, 2);
  if (solverTrace.length > 1) {
    if (traceIsColor) colorPlayer = solverTrace[1].slice();
    else player = solverTrace[1].slice();
  }
  traceIndex = Math.max(0, solverTrace.length - 1);
  isViewingTrace = false;
  solverMessage = result.contradictions
    ? 'Contradiction détectée : vérifie les cases déjà posées.'
    : (solverTrace.length > 1 ? traceMessages[1] : 'Aucune déduction sur cette étape.');
  updateTraceControls();
  if (traceIsColor) renderColor(); else render();
});
solveAllButton.addEventListener('click', () => {
  if (!isColorMode) { solveLogically(); return; }
  const result = buildColorTrace(colorPlayer);
  traceIsColor = true;
  solverTrace = result.snapshots;
  traceMessages = result.messages;
  colorPlayer = result.finalState;
  traceIndex = Math.max(0, solverTrace.length - 1);
  isViewingTrace = false;
  solverMessage = result.contradictions
    ? 'Contradiction détectée : vérifie les couleurs déjà posées.'
    : result.usedSearch
      ? `${result.totalChanges} déductions colorées appliquées, avec recherche par hypothèses et contradictions.`
      : result.searchCutoff
        ? 'Les déductions colorées sont terminées ; la recherche avancée a atteint sa limite de calcul.'
        : (result.totalChanges ? `${result.totalChanges} déduction${result.totalChanges > 1 ? 's' : ''} colorée${result.totalChanges > 1 ? 's' : ''} appliquée${result.totalChanges > 1 ? 's' : ''}.` : 'Aucune déduction colorée supplémentaire.');
  updateTraceControls();
  renderColor();
});
showErrors.addEventListener('change', () => { if (isColorMode) renderColor(); else render(); });
traceModeToggle.addEventListener('click', toggleTraceMode);
previousTrace.addEventListener('click', () => showTrace(traceIndex - 1));
nextTrace.addEventListener('click', () => showTrace(traceIndex + 1));
traceSlider.addEventListener('input', () => showTrace(Number(traceSlider.value)));
modeSelect.addEventListener('change', () => {
  isColorMode = modeSelect.value === 'color';
  paletteSizeLabel.hidden = !isColorMode;
  solverMessage = '';
  clearTrace();
  if (isColorMode) createColorPuzzle(); else { createSolution(); paletteElement.hidden = true; }
  render();
});
paletteSizeSelect.addEventListener('change', () => {
  paletteLimit = Number(paletteSizeSelect.value);
  imageBlocks = new Map();
  solverMessage = '';
  clearTrace();
  if (importedImage) {
    if (importedCrop) quantizeImage(importedImage, importedCrop);
    else { renderImageTools(); showImageOverview(imageGrid); }
    return;
  }
  if (isColorMode) { createColorPuzzle(); renderColor(); }
});
imageInput.addEventListener('change', () => importImage(imageInput.files[0]));
sizeSelect.addEventListener('change', () => { if (!importedImage || !isColorMode || !importedCrop || colorPlayer.some(value => value !== null && value !== -1)) return; size = Number(sizeSelect.value); quantizeImage(importedImage, importedCrop); });
localStorage.setItem('game-hub:last-game', 'nonogram');
createSolution();
updateTraceControls();
render();

function runNonogramDiagnostics() {
  const checks = [];
  const differentColors = analyzeLineConstraints([{ color: '#f00', length: 1 }, { color: '#00f', length: 1 }], [null, null]);
  checks.push(!differentColors.contradiction && differentColors.possibleValues[0].has('#f00') && differentColors.possibleValues[1].has('#00f'));
  const sameColor = analyzeLineConstraints([{ color: '#f00', length: 1 }, { color: '#f00', length: 1 }], [null, null, null]);
  checks.push(!sameColor.contradiction && sameColor.possibleValues[1].size === 1 && sameColor.possibleValues[1].has(EMPTY_CELL));
  checks.push(analyzeLineConstraints([{ color: '#f00', length: 2 }], ['#00f', null]).contradiction);
  const largeLine = analyzeLineConstraints([{ color: '#0a0', length: 50 }], Array(60).fill(null));
  checks.push(!largeLine.contradiction && largeLine.possibleValues.slice(10, 50).every(values => values.size === 1 && values.has('#0a0')));
  const previousSize = size;
  size = 5;
  const target = [
    '#f00', '#00f', EMPTY_CELL, '#0a0', '#0a0',
    '#f00', EMPTY_CELL, '#00f', '#0a0', EMPTY_CELL,
    EMPTY_CELL, '#f00', '#00f', EMPTY_CELL, '#0a0',
    '#ff0', '#ff0', EMPTY_CELL, '#00f', '#0a0',
    EMPTY_CELL, '#ff0', '#f00', '#f00', EMPTY_CELL
  ];
  const rows = Array.from({ length: size }, (_, row) => colorRuns(target.slice(row * size, (row + 1) * size)));
  const columns = Array.from({ length: size }, (_, column) => colorRuns(Array.from({ length: size }, (_, row) => target[row * size + column])));
  const searched = searchConstraintSolution(Array(size * size).fill(null), rows, columns);
  const valid = searched.solution && rows.every((clues, row) => JSON.stringify(colorRuns(searched.solution.slice(row * size, (row + 1) * size))) === JSON.stringify(clues)) && columns.every((clues, column) => JSON.stringify(colorRuns(Array.from({ length: size }, (_, row) => searched.solution[row * size + column]))) === JSON.stringify(clues));
  checks.push(Boolean(valid));
  const permutationClues = Array.from({ length: size }, () => [{ color: '#f00', length: 1 }]);
  const permutation = searchConstraintSolution(Array(size * size).fill(null), permutationClues, permutationClues);
  checks.push(Boolean(permutation.solution) && permutation.nodes > 1);
  size = previousSize;
  const previousBoardHidden = board.hidden;
  const previousOverviewHidden = imageOverview.hidden;
  board.hidden = true;
  imageOverview.hidden = false;
  checks.push(getComputedStyle(board).display === 'none' && getComputedStyle(imageOverview).display !== 'none');
  board.hidden = previousBoardHidden;
  imageOverview.hidden = previousOverviewHidden;
  checks.push([...sizeSelect.options].some(option => option.value === '60') && [...paletteSizeSelect.options].some(option => option.value === '32'));
  document.title = `NONOGRAM TEST · ${checks.filter(Boolean).length}/${checks.length}`;
}

if (new URLSearchParams(location.search).has('nonogramTest')) runNonogramDiagnostics();
