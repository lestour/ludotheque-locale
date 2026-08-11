if (!window.GameEffects) { const script = document.createElement('script'); script.src = '../../shared/effects.js?v=1'; document.head.appendChild(script); }
const SIZE = 9;
const BOX_HEIGHT = 3;
const BOX_WIDTH = 3;
const ALL_DIGITS = Array.from({ length: SIZE }, (_, index) => index + 1);

const board = document.getElementById('board');
const previousStep = document.getElementById('previousStep');
const nextStep = document.getElementById('nextStep');
const stepSlider = document.getElementById('stepSlider');
const stepLabel = document.getElementById('stepLabel');
const traceTitle = document.getElementById('traceTitle');
const eventTitle = document.getElementById('eventTitle');
const eventDetail = document.getElementById('eventDetail');
const eventChanges = document.getElementById('eventChanges');
const selectedCageInfo = document.getElementById('selectedCageInfo');
const manualToggle = document.getElementById('manualToggle');
const entryToggle = document.getElementById('entryToggle');
const manualReset = document.getElementById('manualReset');
const manualUndo = document.getElementById('manualUndo');
const manualRedo = document.getElementById('manualRedo');
const autoCandidates = document.getElementById('autoCandidates');
const showErrors = document.getElementById('showErrors');
const constraintCombinations = document.getElementById('constraintCombinations');
const errorCount = document.getElementById('errorCount');
const keypad = document.getElementById('keypad');
const hintButton = document.getElementById('hintButton');
const typeSudoku = document.getElementById('typeSudoku');
const typeKiller = document.getElementById('typeKiller');
const typeThermometer = document.getElementById('typeThermometer');
const typeDiagonal = document.getElementById('typeDiagonal');
const typeKropki = document.getElementById('typeKropki');
const typeXV = document.getElementById('typeXV');
const typeKnight = document.getElementById('typeKnight');
const typeKing = document.getElementById('typeKing');
const typeNonConsecutive = document.getElementById('typeNonConsecutive');
const typeHyper = document.getElementById('typeHyper');
const typeDisjoint = document.getElementById('typeDisjoint');
const typePalindrome = document.getElementById('typePalindrome');
const typeArrow = document.getElementById('typeArrow');
const typeParity = document.getElementById('typeParity');
const typeWhisper = document.getElementById('typeWhisper');
const typeRenban = document.getElementById('typeRenban');
const typeSandwich = document.getElementById('typeSandwich');
const typeEntropic = document.getElementById('typeEntropic');
const typeModular = document.getElementById('typeModular');
const typeQuadruple = document.getElementById('typeQuadruple');
const variantChoice = document.getElementById('variantChoice');
const difficulty = document.getElementById('difficulty');
const generateButton = document.getElementById('generate');
const randomVariantsButton = document.getElementById('randomVariants');
const generationStatus = document.getElementById('generationStatus');

const VARIANT_DEFINITIONS = Object.freeze({
  killer: { button: typeKiller, label: 'Killer', choice: 'cages Killer' },
  thermometer: { button: typeThermometer, label: 'Thermometer', choice: 'thermomètres' },
  diagonal: { button: typeDiagonal, label: 'Diagonal', choice: 'diagonales' },
  kropki: { button: typeKropki, label: 'Kropki', choice: 'points Kropki' },
  xv: { button: typeXV, label: 'XV', choice: 'marqueurs XV' },
  knight: { button: typeKnight, label: 'Anti-cavalier', choice: 'anti-cavalier' },
  king: { button: typeKing, label: 'Anti-roi', choice: 'anti-roi' },
  nonconsecutive: { button: typeNonConsecutive, label: 'Non-consécutif', choice: 'non-consécutif' },
  hyper: { button: typeHyper, label: 'Hyper', choice: 'régions Hyper' },
  disjoint: { button: typeDisjoint, label: 'Groupes disjoints', choice: 'groupes disjoints' },
  palindrome: { button: typePalindrome, label: 'Palindrome', choice: 'palindromes' },
  arrow: { button: typeArrow, label: 'Arrow', choice: 'flèches' },
  parity: { button: typeParity, label: 'Pair/Impair', choice: 'pair/impair' },
  whisper: { button: typeWhisper, label: 'German Whispers', choice: 'German Whispers' },
  renban: { button: typeRenban, label: 'Renban', choice: 'Renban' },
  sandwich: { button: typeSandwich, label: 'Sandwich', choice: 'Sandwich' },
  entropic: { button: typeEntropic, label: 'Entropique', choice: 'lignes entropiques' },
  modular: { button: typeModular, label: 'Modulaire', choice: 'lignes modulaires' },
  quadruple: { button: typeQuadruple, label: 'Quadruple', choice: 'quadruples' }
});
const VARIANT_KEYS = Object.keys(VARIANT_DEFINITIONS);
let selectedVariants = new Set((new URLSearchParams(window.location.search).get('variants') || '').split(',').filter(variant => VARIANT_KEYS.includes(variant)));
let selectedGame = 'sudoku';
let traceData = null;
let manualMode = false;
let pencilMode = false;
let activeCell = null;
let selectedCells = new Set();
let selectionAnchor = null;
let isDraggingSelection = false;
let capsLockActive = false;
const lockedHighlightDigits = new Set();
let manualSnapshot = null;
let manualHistory = [];
let manualHistoryIndex = 0;
let manualHint = null;

function shuffled(values) {
  const result = values.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function cellIndex(row, col) {
  return row * SIZE + col;
}

function rowOf(index) {
  return Math.floor(index / SIZE);
}

function colOf(index) {
  return index % SIZE;
}

function singleCandidate(value) {
  return ALL_DIGITS.map(digit => digit === value);
}

function createSnapshot(values, fixed = values.map(value => value !== 0)) {
  return {
    size: SIZE,
    boxHeight: BOX_HEIGHT,
    boxWidth: BOX_WIDTH,
    cells: values.map((value, index) => ({
      value,
      isFixed: Boolean(fixed[index]),
      isUserEntered: false,
      candidates: value ? singleCandidate(value) : Array(SIZE).fill(true),
      manualNotes: Array(SIZE).fill(false),
      hiddenCandidates: Array(SIZE).fill(false)
    }))
  };
}

function allHouses() {
  const houses = [];
  for (let row = 0; row < SIZE; row += 1) houses.push(ALL_DIGITS.map((_, col) => cellIndex(row, col)));
  for (let col = 0; col < SIZE; col += 1) houses.push(ALL_DIGITS.map((_, row) => cellIndex(row, col)));
  for (let boxRow = 0; boxRow < SIZE; boxRow += BOX_HEIGHT) {
    for (let boxCol = 0; boxCol < SIZE; boxCol += BOX_WIDTH) {
      const house = [];
      for (let row = 0; row < BOX_HEIGHT; row += 1) {
        for (let col = 0; col < BOX_WIDTH; col += 1) house.push(cellIndex(boxRow + row, boxCol + col));
      }
      houses.push(house);
    }
  }
  return houses;
}

const HOUSES = allHouses();
const HYPER_HOUSES = [[1, 1], [1, 5], [5, 1], [5, 5]].map(([startRow, startCol]) =>
  Array.from({ length: 3 }, (_, row) => Array.from({ length: 3 }, (_, col) => cellIndex(startRow + row, startCol + col))).flat()
);
const DIAGONAL_HOUSES = [ALL_DIGITS.map((_, position) => cellIndex(position, position)), ALL_DIGITS.map((_, position) => cellIndex(position, SIZE - 1 - position))];
const DISJOINT_HOUSES = Array.from({ length: SIZE }, (_, offset) => Array.from({ length: SIZE }, (_, box) =>
  cellIndex(Math.floor(box / 3) * 3 + Math.floor(offset / 3), (box % 3) * 3 + offset % 3)
));
const DIGIT_COLORS = ['#b83280', '#007f5f', '#4a44b8', '#bf5b00', '#0077b6', '#a23e48', '#5b6c00', '#7c3aed', '#a14b00'];
const FULL_CANDIDATE_MASK = (1 << SIZE) - 1;
const SUPPORT_CACHE = new Map();

function peersFor(index) {
  const peers = new Set();
  const row = rowOf(index);
  const col = colOf(index);
  for (let position = 0; position < SIZE; position += 1) {
    peers.add(cellIndex(row, position));
    peers.add(cellIndex(position, col));
  }
  const boxRow = Math.floor(row / BOX_HEIGHT) * BOX_HEIGHT;
  const boxCol = Math.floor(col / BOX_WIDTH) * BOX_WIDTH;
  for (let offsetRow = 0; offsetRow < BOX_HEIGHT; offsetRow += 1) {
    for (let offsetCol = 0; offsetCol < BOX_WIDTH; offsetCol += 1) peers.add(cellIndex(boxRow + offsetRow, boxCol + offsetCol));
  }
  peers.delete(index);
  return peers;
}

const BASE_PEERS = Array.from({ length: SIZE * SIZE }, (_, index) => peersFor(index));
const STRUCTURAL_CONTEXTS = new Map();

function structuralContext(constraints) {
  const key = [constraints.diagonal, constraints.antiKnight, constraints.antiKing, constraints.hyper, constraints.disjoint].map(Boolean).map(Number).join('');
  if (STRUCTURAL_CONTEXTS.has(key)) return STRUCTURAL_CONTEXTS.get(key);
  const peers = Array.from({ length: SIZE * SIZE }, (_, index) => {
    const result = new Set(BASE_PEERS[index]);
    const row = rowOf(index);
    const col = colOf(index);
    if (constraints.diagonal) {
      if (row === col) DIAGONAL_HOUSES[0].forEach(peer => result.add(peer));
      if (row + col === SIZE - 1) DIAGONAL_HOUSES[1].forEach(peer => result.add(peer));
    }
    if (constraints.antiKnight) [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([deltaRow, deltaCol]) => {
      const nextRow = row + deltaRow; const nextCol = col + deltaCol;
      if (nextRow >= 0 && nextRow < SIZE && nextCol >= 0 && nextCol < SIZE) result.add(cellIndex(nextRow, nextCol));
    });
    if (constraints.antiKing) [-1, 0, 1].forEach(deltaRow => [-1, 0, 1].forEach(deltaCol => {
      const nextRow = row + deltaRow; const nextCol = col + deltaCol;
      if ((deltaRow || deltaCol) && nextRow >= 0 && nextRow < SIZE && nextCol >= 0 && nextCol < SIZE) result.add(cellIndex(nextRow, nextCol));
    }));
    if (constraints.hyper) HYPER_HOUSES.forEach(house => { if (house.includes(index)) house.forEach(peer => result.add(peer)); });
    if (constraints.disjoint) DISJOINT_HOUSES.forEach(house => { if (house.includes(index)) house.forEach(peer => result.add(peer)); });
    result.delete(index);
    return [...result];
  });
  const houses = [...HOUSES, ...(constraints.diagonal ? DIAGONAL_HOUSES : []), ...(constraints.hyper ? HYPER_HOUSES : []), ...(constraints.disjoint ? DISJOINT_HOUSES : [])];
  const context = { peers, houses };
  STRUCTURAL_CONTEXTS.set(key, context);
  return context;
}

function candidateDigits(cell) {
  return cell.candidates.reduce((digits, candidate, index) => {
    if (candidate) digits.push(index + 1);
    return digits;
  }, []);
}

function candidateMask(cell) {
  return cell.candidates.reduce((mask, candidate, index) => candidate ? mask | (1 << index) : mask, 0);
}

function countMask(mask) {
  let count = 0;
  for (let value = mask; value; value &= value - 1) count += 1;
  return count;
}

function scopeSignature(snapshot, indexes) {
  return indexes.map(index => `${snapshot.cells[index].value}:${candidateMask(snapshot.cells[index])}`).join(',');
}

function memoizedSupport(type, key, calculate) {
  const cacheKey = `${type}|${key}`;
  if (SUPPORT_CACHE.has(cacheKey)) return SUPPORT_CACHE.get(cacheKey);
  const result = calculate();
  if (SUPPORT_CACHE.size > 12000) SUPPORT_CACHE.clear();
  SUPPORT_CACHE.set(cacheKey, result);
  return result;
}

function cloneSnapshot(snapshot) {
  return {
    size: snapshot.size,
    boxHeight: snapshot.boxHeight,
    boxWidth: snapshot.boxWidth,
    cells: snapshot.cells.map(cell => ({
      ...cell,
      candidates: cell.candidates.slice(),
      manualNotes: cell.manualNotes.slice(),
      hiddenCandidates: cell.hiddenCandidates.slice()
    }))
  };
}

function cageSupport(snapshot, cage) {
  const solved = new Set();
  let solvedSum = 0;
  const unresolved = [];
  for (const index of cage.cells) {
    const value = snapshot.cells[index].value;
    if (value) {
      if (solved.has(value)) return null;
      solved.add(value);
      solvedSum += value;
    } else {
      unresolved.push(index);
    }
  }
  if (solvedSum > cage.sum) return null;
  if (!unresolved.length) return solvedSum === cage.sum ? [] : null;

  const supported = unresolved.map(() => Array(SIZE).fill(false));
  const memo = new Map();
  const initialMask = [...solved].reduce((mask, digit) => mask | (1 << (digit - 1)), 0);
  function feasible(position, remaining, usedMask) {
    if (position === unresolved.length) return remaining === 0;
    const key = `${position}:${remaining}:${usedMask}`;
    if (memo.has(key)) return memo.get(key);
    const candidates = snapshot.cells[unresolved[position]].candidates;
    let found = false;
    for (let digit = 1; digit <= SIZE && !found; digit += 1) {
      const bit = 1 << (digit - 1);
      if (!candidates[digit - 1] || (usedMask & bit) || digit > remaining) continue;
      found = feasible(position + 1, remaining - digit, usedMask | bit);
    }
    memo.set(key, found);
    return found;
  }
  function collect(position, remaining, usedMask) {
    if (position === unresolved.length) return;
    const candidates = snapshot.cells[unresolved[position]].candidates;
    for (let digit = 1; digit <= SIZE; digit += 1) {
      const bit = 1 << (digit - 1);
      if (!candidates[digit - 1] || (usedMask & bit) || digit > remaining || !feasible(position + 1, remaining - digit, usedMask | bit)) continue;
      supported[position][digit - 1] = true;
      collect(position + 1, remaining - digit, usedMask | bit);
    }
  }
  const remaining = cage.sum - solvedSum;
  if (!feasible(0, remaining, initialMask)) return null;
  collect(0, remaining, initialMask);
  return { unresolved, supported };
}

function thermometerSupport(snapshot, branch) {
  const supported = branch.map(() => Array(SIZE).fill(false));
  const memo = new Map();
  function feasible(position, previousValue) {
    if (position === branch.length) return true;
    const key = `${position}:${previousValue}`;
    if (memo.has(key)) return memo.get(key);
    const candidates = snapshot.cells[branch[position]].candidates;
    let found = false;
    for (let digit = previousValue + 1; digit <= SIZE && !found; digit += 1) {
      if (!candidates[digit - 1]) continue;
      found = feasible(position + 1, digit);
    }
    memo.set(key, found);
    return found;
  }
  function collect(position, previousValue) {
    if (position === branch.length) return;
    const candidates = snapshot.cells[branch[position]].candidates;
    for (let digit = previousValue + 1; digit <= SIZE; digit += 1) {
      if (!candidates[digit - 1] || !feasible(position + 1, digit)) continue;
      supported[position][digit - 1] = true;
      collect(position + 1, digit);
    }
  }
  if (!feasible(0, 0)) return null;
  collect(0, 0);
  return supported;
}

function constraintsOf(constraints) {
  return {
    cages: Array.isArray(constraints) ? constraints : (constraints.cages || []),
    thermometers: Array.isArray(constraints) ? [] : (constraints.thermometers || []),
    pairs: Array.isArray(constraints) ? [] : (constraints.pairs || []),
    palindromes: Array.isArray(constraints) ? [] : (constraints.palindromes || []),
    arrows: Array.isArray(constraints) ? [] : (constraints.arrows || []),
    parityCells: Array.isArray(constraints) ? [] : (constraints.parityCells || []),
    whispers: Array.isArray(constraints) ? [] : (constraints.whispers || []),
    renbans: Array.isArray(constraints) ? [] : (constraints.renbans || []),
    entropicLines: Array.isArray(constraints) ? [] : (constraints.entropicLines || []),
    modularLines: Array.isArray(constraints) ? [] : (constraints.modularLines || []),
    quadruples: Array.isArray(constraints) ? [] : (constraints.quadruples || []),
    sandwich: Array.isArray(constraints) ? null : (constraints.sandwich || null),
    diagonal: !Array.isArray(constraints) && Boolean(constraints.diagonal),
    antiKnight: !Array.isArray(constraints) && Boolean(constraints.antiKnight),
    antiKing: !Array.isArray(constraints) && Boolean(constraints.antiKing),
    nonConsecutive: !Array.isArray(constraints) && Boolean(constraints.nonConsecutive),
    hyper: !Array.isArray(constraints) && Boolean(constraints.hyper),
    disjoint: !Array.isArray(constraints) && Boolean(constraints.disjoint)
  };
}

function sandwichHouseSupport(snapshot, house, target) {
  const supported = house.map(() => Array(SIZE).fill(false));
  let found = false;
  for (let onePosition = 0; onePosition < SIZE; onePosition += 1) {
    if (!snapshot.cells[house[onePosition]].candidates[0]) continue;
    for (let ninePosition = 0; ninePosition < SIZE; ninePosition += 1) {
      if (onePosition === ninePosition || !snapshot.cells[house[ninePosition]].candidates[8]) continue;
      const start = Math.min(onePosition, ninePosition) + 1;
      const end = Math.max(onePosition, ninePosition);
      const inside = Array.from({ length: end - start }, (_, offset) => start + offset);
      const memo = new Map();
      function feasible(position, remaining, usedMask) {
        if (position === inside.length) return remaining === 0;
        const key = `${position}:${remaining}:${usedMask}`;
        if (memo.has(key)) return memo.get(key);
        let possible = false;
        for (const digit of candidateDigits(snapshot.cells[house[inside[position]]])) {
          const bit = 1 << (digit - 1);
          if (digit === 1 || digit === 9 || digit > remaining || (usedMask & bit)) continue;
          if (feasible(position + 1, remaining - digit, usedMask | bit)) { possible = true; break; }
        }
        memo.set(key, possible);
        return possible;
      }
      if (!feasible(0, target, 0)) continue;
      found = true; supported[onePosition][0] = true; supported[ninePosition][8] = true;
      function collect(position, remaining, usedMask) {
        if (position === inside.length) return;
        for (const digit of candidateDigits(snapshot.cells[house[inside[position]]])) {
          const bit = 1 << (digit - 1);
          if (digit === 1 || digit === 9 || digit > remaining || (usedMask & bit) || !feasible(position + 1, remaining - digit, usedMask | bit)) continue;
          supported[inside[position]][digit - 1] = true;
          collect(position + 1, remaining - digit, usedMask | bit);
        }
      }
      collect(0, target, 0);
      house.forEach((_, housePosition) => {
        if (housePosition === onePosition || housePosition === ninePosition || inside.includes(housePosition)) return;
        snapshot.cells[house[housePosition]].candidates.forEach((candidate, digit) => { if (candidate && digit !== 0 && digit !== 8) supported[housePosition][digit] = true; });
      });
    }
  }
  return found ? supported : null;
}

function renbanSupport(snapshot, line) {
  const supported = line.map(() => Array(SIZE).fill(false));
  const values = Array(line.length).fill(0);
  let found = false;
  function visit(position, used) {
    if (position === line.length) {
      if (Math.max(...values) - Math.min(...values) !== line.length - 1) return;
      values.forEach((value, index) => { supported[index][value - 1] = true; }); found = true; return;
    }
    for (const digit of candidateDigits(snapshot.cells[line[position]])) {
      if (used.has(digit)) continue;
      values[position] = digit;
      const partial = values.slice(0, position + 1);
      if (Math.max(...partial) - Math.min(...partial) >= line.length) continue;
      const nextUsed = new Set(used); nextUsed.add(digit); visit(position + 1, nextUsed);
    }
  }
  visit(0, new Set());
  return found ? supported : null;
}

function arrowSupport(snapshot, arrow) {
  const indexes = [arrow.bulb, ...arrow.path];
  const supported = indexes.map(() => Array(SIZE).fill(false));
  let found = false;
  for (const bulbDigit of candidateDigits(snapshot.cells[arrow.bulb])) {
    const memo = new Map();
    function feasible(position, remaining) {
      if (position === arrow.path.length) return remaining === 0;
      const key = `${position}:${remaining}`;
      if (memo.has(key)) return memo.get(key);
      let possible = false;
      for (const digit of candidateDigits(snapshot.cells[arrow.path[position]])) {
        if (digit > remaining || (position + 1 < arrow.path.length && digit === remaining)) continue;
        if (feasible(position + 1, remaining - digit)) { possible = true; break; }
      }
      memo.set(key, possible);
      return possible;
    }
    if (!feasible(0, bulbDigit)) continue;
    found = true;
    supported[0][bulbDigit - 1] = true;
    function collect(position, remaining) {
      if (position === arrow.path.length) return;
      for (const digit of candidateDigits(snapshot.cells[arrow.path[position]])) {
        if (digit > remaining || !feasible(position + 1, remaining - digit)) continue;
        supported[position + 1][digit - 1] = true;
        collect(position + 1, remaining - digit);
      }
    }
    collect(0, bulbDigit);
  }
  return found ? { indexes, supported } : null;
}

function categoryLineSupport(snapshot, line, categoryOf) {
  const supported = line.map(() => Array(SIZE).fill(false));
  const values = Array(line.length).fill(0);
  let found = false;
  function visit(position) {
    if (position === line.length) {
      values.forEach((value, index) => { supported[index][value - 1] = true; });
      found = true;
      return;
    }
    for (const digit of candidateDigits(snapshot.cells[line[position]])) {
      values[position] = digit;
      if (position >= 2) {
        const categories = [categoryOf(values[position - 2]), categoryOf(values[position - 1]), categoryOf(digit)];
        if (new Set(categories).size !== 3) continue;
      }
      visit(position + 1);
    }
  }
  visit(0);
  return found ? supported : null;
}

function quadrupleSupport(snapshot, quadruple) {
  const supported = quadruple.cells.map(() => Array(SIZE).fill(false));
  const values = Array(quadruple.cells.length).fill(0);
  const requiredCounts = new Map();
  quadruple.digits.forEach(digit => requiredCounts.set(digit, (requiredCounts.get(digit) || 0) + 1));
  let found = false;
  function visit(position) {
    if (position === quadruple.cells.length) {
      const counts = new Map();
      values.forEach(value => counts.set(value, (counts.get(value) || 0) + 1));
      if ([...requiredCounts].some(([digit, count]) => (counts.get(digit) || 0) < count)) return;
      values.forEach((value, index) => { supported[index][value - 1] = true; });
      found = true;
      return;
    }
    for (const digit of candidateDigits(snapshot.cells[quadruple.cells[position]])) {
      values[position] = digit;
      visit(position + 1);
    }
  }
  visit(0);
  return found ? supported : null;
}

function applySupport(snapshot, indexes, supported) {
  const changedIndexes = [];
  for (let position = 0; position < indexes.length; position += 1) {
    const cell = snapshot.cells[indexes[position]];
    if (cell.value) {
      if (!supported[position][cell.value - 1]) return null;
      continue;
    }
    let changed = false;
    cell.candidates = cell.candidates.map((candidate, digit) => {
      const next = candidate && supported[position][digit];
      if (candidate !== next) changed = true;
      return next;
    });
    if (!cell.candidates.some(Boolean)) return null;
    if (changed) changedIndexes.push(indexes[position]);
  }
  return changedIndexes;
}

function reviseHouse(snapshot, house) {
  const solved = new Set();
  for (const index of house) {
    const value = snapshot.cells[index].value;
    if (!value) continue;
    if (solved.has(value)) return null;
    solved.add(value);
  }
  for (const digit of ALL_DIGITS) {
    if (solved.has(digit)) continue;
    if (!house.some(index => !snapshot.cells[index].value && snapshot.cells[index].candidates[digit - 1])) return null;
  }
  const unresolved = house.filter(index => !snapshot.cells[index].value);
  const changed = new Set();
  const eligible = unresolved.filter(index => countMask(candidateMask(snapshot.cells[index])) <= 4);
  const subsetCount = 1 << eligible.length;
  for (let subset = 0; subset < subsetCount; subset += 1) {
    const size = countMask(subset);
    if (size < 2 || size > 4) continue;
    let union = 0;
    for (let position = 0; position < eligible.length; position += 1) {
      if (subset & (1 << position)) union |= candidateMask(snapshot.cells[eligible[position]]);
    }
    const unionSize = countMask(union);
    if (unionSize < size) return null;
    if (unionSize !== size) continue;
    for (const index of unresolved) {
      if (eligible.some((eligibleIndex, position) => eligibleIndex === index && (subset & (1 << position)))) continue;
      const cell = snapshot.cells[index];
      const nextMask = candidateMask(cell) & (FULL_CANDIDATE_MASK & ~union);
      if (!nextMask) return null;
      if (nextMask === candidateMask(cell)) continue;
      cell.candidates = ALL_DIGITS.map((_, digit) => Boolean(nextMask & (1 << digit)));
      changed.add(index);
    }
  }
  return [...changed];
}

function constraintHouses(constraints) {
  const normalized = constraintsOf(constraints);
  return structuralContext(normalized).houses;
}

function peersForConstraints(index, constraints) {
  return new Set(structuralContext(constraintsOf(constraints)).peers[index]);
}

function calculateCandidates(snapshot, constraints = {}) {
  const normalizedConstraints = constraintsOf(constraints);
  const { cages, thermometers } = normalizedConstraints;
  const context = structuralContext(normalizedConstraints);
  const parityByCell = new Map(normalizedConstraints.parityCells.map(marker => [marker.index, marker.parity]));
  const sandwichHouses = normalizedConstraints.sandwich ? [
    ...normalizedConstraints.sandwich.rows.map((target, row) => ({ target, house: ALL_DIGITS.map((_, col) => cellIndex(row, col)) })),
    ...normalizedConstraints.sandwich.cols.map((target, col) => ({ target, house: ALL_DIGITS.map((_, row) => cellIndex(row, col)) }))
  ].filter(entry => entry.target !== null && entry.target !== undefined) : [];
  for (let index = 0; index < snapshot.cells.length; index += 1) {
    const cell = snapshot.cells[index];
    if (cell.value) {
      cell.candidates = singleCandidate(cell.value);
      continue;
    }
    const forbidden = new Set();
    for (const peer of context.peers[index]) {
      const value = snapshot.cells[peer].value;
      if (value) forbidden.add(value);
    }
    cell.candidates = ALL_DIGITS.map(digit => !forbidden.has(digit));
    if (parityByCell.has(index)) cell.candidates = cell.candidates.map((candidate, digit) => candidate && ((digit + 1) % 2 === parityByCell.get(index)));
    if (normalizedConstraints.nonConsecutive) {
      const adjacentValues = neighbours(index).map(peer => snapshot.cells[peer].value).filter(Boolean);
      cell.candidates = cell.candidates.map((candidate, digit) => candidate && adjacentValues.every(value => Math.abs(digit + 1 - value) !== 1));
    }
    if (!cell.candidates.some(Boolean)) return false;
  }
  let changed = false;
  do {
    changed = false;
    for (const house of context.houses) {
      const revised = reviseHouse(snapshot, house);
      if (revised === null) return false;
      if (revised.length) changed = true;
    }
    for (const cage of cages) {
      const support = memoizedSupport('cage', `${cage.sum}|${scopeSignature(snapshot, cage.cells)}`, () => cageSupport(snapshot, cage));
      if (support === null) return false;
      if (Array.isArray(support)) continue;
      support.unresolved.forEach((index, position) => {
        const cell = snapshot.cells[index];
        const nextCandidates = cell.candidates.map((candidate, digit) => candidate && support.supported[position][digit]);
        if (nextCandidates.some((candidate, digit) => candidate !== cell.candidates[digit])) changed = true;
        cell.candidates = nextCandidates;
        if (!cell.candidates.some(Boolean)) return false;
      });
    }
    for (const thermometer of thermometers) {
      for (const branch of thermometer.branches) {
        const support = memoizedSupport('thermometer', scopeSignature(snapshot, branch), () => thermometerSupport(snapshot, branch));
        if (support === null) return false;
        branch.forEach((index, position) => {
          const cell = snapshot.cells[index];
          const nextCandidates = cell.candidates.map((candidate, digit) => candidate && support[position][digit]);
          if (nextCandidates.some((candidate, digit) => candidate !== cell.candidates[digit])) changed = true;
          cell.candidates = nextCandidates;
          if (!cell.candidates.some(Boolean)) return false;
        });
      }
    }
    for (const pair of normalizedConstraints.pairs) {
      const valid = (left, right) => pair.type === 'white' ? Math.abs(left - right) === 1
        : (pair.type === 'black' ? left === right * 2 || right === left * 2 : left + right === pair.sum);
      for (const [index, peer] of [[pair.a, pair.b], [pair.b, pair.a]]) {
        const cell = snapshot.cells[index];
        const other = snapshot.cells[peer];
        const nextCandidates = cell.candidates.map((candidate, digit) => candidate && candidateDigits(other).some(value => valid(digit + 1, value)));
        if (nextCandidates.some((candidate, digit) => candidate !== cell.candidates[digit])) changed = true;
        cell.candidates = nextCandidates;
        if (!cell.candidates.some(Boolean)) return false;
      }
    }
    for (const line of normalizedConstraints.palindromes) {
      for (let position = 0; position < Math.floor(line.length / 2); position += 1) {
        const leftIndex = line[position];
        const rightIndex = line[line.length - 1 - position];
        for (const [index, peer] of [[leftIndex, rightIndex], [rightIndex, leftIndex]]) {
          const cell = snapshot.cells[index];
          const other = snapshot.cells[peer];
          const nextCandidates = cell.candidates.map((candidate, digit) => candidate && candidateDigits(other).includes(digit + 1));
          if (nextCandidates.some((candidate, digit) => candidate !== cell.candidates[digit])) changed = true;
          cell.candidates = nextCandidates;
          if (!cell.candidates.some(Boolean)) return false;
        }
      }
    }
    for (const arrow of normalizedConstraints.arrows) {
      const indexes = [arrow.bulb, ...arrow.path];
      const support = memoizedSupport('arrow', scopeSignature(snapshot, indexes), () => arrowSupport(snapshot, arrow));
      if (!support) return false;
      support.indexes.forEach((index, position) => {
        const cell = snapshot.cells[index];
        const nextCandidates = cell.candidates.map((candidate, digit) => candidate && support.supported[position][digit]);
        if (nextCandidates.some((candidate, digit) => candidate !== cell.candidates[digit])) changed = true;
        cell.candidates = nextCandidates;
        if (!cell.candidates.some(Boolean)) return false;
      });
    }
    for (const line of normalizedConstraints.whispers) {
      for (let position = 0; position + 1 < line.length; position += 1) {
        for (const [index, peer] of [[line[position], line[position + 1]], [line[position + 1], line[position]]]) {
          const cell = snapshot.cells[index]; const other = snapshot.cells[peer];
          const nextCandidates = cell.candidates.map((candidate, digit) => candidate && candidateDigits(other).some(value => Math.abs(digit + 1 - value) >= 5));
          if (nextCandidates.some((candidate, digit) => candidate !== cell.candidates[digit])) changed = true;
          cell.candidates = nextCandidates;
          if (!cell.candidates.some(Boolean)) return false;
        }
      }
    }
    for (const line of normalizedConstraints.renbans) {
      const support = memoizedSupport('renban', scopeSignature(snapshot, line), () => renbanSupport(snapshot, line));
      if (!support) return false;
      line.forEach((index, position) => {
        const cell = snapshot.cells[index];
        const nextCandidates = cell.candidates.map((candidate, digit) => candidate && support[position][digit]);
        if (nextCandidates.some((candidate, digit) => candidate !== cell.candidates[digit])) changed = true;
        cell.candidates = nextCandidates;
        if (!cell.candidates.some(Boolean)) return false;
      });
    }
    if (normalizedConstraints.sandwich) {
      for (const { target, house } of sandwichHouses) {
        const support = memoizedSupport('sandwich', `${target}|${scopeSignature(snapshot, house)}`, () => sandwichHouseSupport(snapshot, house, target));
        if (!support) return false;
        house.forEach((index, position) => {
          const cell = snapshot.cells[index];
          const nextCandidates = cell.candidates.map((candidate, digit) => candidate && support[position][digit]);
          if (nextCandidates.some((candidate, digit) => candidate !== cell.candidates[digit])) changed = true;
          cell.candidates = nextCandidates;
          if (!cell.candidates.some(Boolean)) return false;
        });
      }
    }
    for (const [type, lines, categoryOf] of [
      ['entropic', normalizedConstraints.entropicLines, digit => Math.floor((digit - 1) / 3)],
      ['modular', normalizedConstraints.modularLines, digit => (digit - 1) % 3]
    ]) {
      for (const line of lines) {
        const support = memoizedSupport(type, scopeSignature(snapshot, line), () => categoryLineSupport(snapshot, line, categoryOf));
        if (!support) return false;
        const revised = applySupport(snapshot, line, support);
        if (revised === null) return false;
        if (revised.length) changed = true;
      }
    }
    for (const quadruple of normalizedConstraints.quadruples) {
      const support = memoizedSupport('quadruple', `${quadruple.digits.join(',')}|${scopeSignature(snapshot, quadruple.cells)}`, () => quadrupleSupport(snapshot, quadruple));
      if (!support) return false;
      const revised = applySupport(snapshot, quadruple.cells, support);
      if (revised === null) return false;
      if (revised.length) changed = true;
    }
  } while (changed);
  return true;
}

function isSolved(snapshot) {
  return snapshot.cells.every(cell => cell.value !== 0);
}

function chooseCell(snapshot, constraints = {}) {
  let choice = -1;
  let count = SIZE + 1;
  let degree = -1;
  const peers = structuralContext(constraintsOf(constraints)).peers;
  snapshot.cells.forEach((cell, index) => {
    if (cell.value) return;
    const candidateCount = candidateDigits(cell).length;
    const unresolvedDegree = peers[index].reduce((total, peer) => total + (snapshot.cells[peer].value ? 0 : 1), 0);
    if (candidateCount < count || (candidateCount === count && unresolvedDegree > degree)) {
      choice = index;
      count = candidateCount;
      degree = unresolvedDegree;
    }
  });
  return choice;
}

function countSolutions(source, constraints = {}, limit = 2) {
  const memo = new Map();
  const searchContext = structuralContext(constraintsOf(constraints));
  function search(snapshot, remainingLimit) {
    const key = `${remainingLimit}|${snapshot.cells.map(cell => cell.value || '.').join('')}`;
    if (memo.has(key)) return Math.min(remainingLimit, memo.get(key));
    if (!calculateCandidates(snapshot, constraints)) return 0;
    if (isSolved(snapshot)) return 1;
    const index = chooseCell(snapshot, constraints);
    let count = 0;
    const digits = candidateDigits(snapshot.cells[index]).sort((left, right) => {
      const leftImpact = searchContext.peers[index].filter(peer => !snapshot.cells[peer].value && snapshot.cells[peer].candidates[left - 1]).length;
      const rightImpact = searchContext.peers[index].filter(peer => !snapshot.cells[peer].value && snapshot.cells[peer].candidates[right - 1]).length;
      return leftImpact - rightImpact;
    });
    for (const digit of digits) {
      const branch = cloneSnapshot(snapshot);
      branch.cells[index].value = digit;
      branch.cells[index].candidates = singleCandidate(digit);
      count += search(branch, remainingLimit - count);
      if (count >= remainingLimit) break;
    }
    memo.set(key, count);
    return count;
  }
  return search(cloneSnapshot(source), limit);
}

function findForcedMove(snapshot, constraints = {}) {
  for (let index = 0; index < snapshot.cells.length; index += 1) {
    const cell = snapshot.cells[index];
    const candidates = candidateDigits(cell);
    if (!cell.value && candidates.length === 1) {
      return { index, digit: candidates[0], title: 'Possibilité unique', detail: `r${rowOf(index) + 1}c${colOf(index) + 1} ne peut contenir que ${candidates[0]}.` };
    }
  }
  const houses = constraintHouses(constraints);
  for (const house of houses) {
    for (const digit of ALL_DIGITS) {
      const positions = house.filter(index => !snapshot.cells[index].value && snapshot.cells[index].candidates[digit - 1]);
      if (positions.length === 1) {
        const index = positions[0];
        return { index, digit, title: 'Possibilité unique dans une unité', detail: `Le ${digit} n'a qu'une position possible : r${rowOf(index) + 1}c${colOf(index) + 1}.` };
      }
    }
  }
  return null;
}

function candidateRemovals(before, after) {
  const removals = [];
  before.cells.forEach((cell, index) => {
    if (cell.value) return;
    cell.candidates.forEach((candidate, digit) => {
      if (candidate && !after.cells[index].candidates[digit]) removals.push({ index, digit: digit + 1 });
    });
  });
  return removals;
}

function solveWithTrace(initialSnapshot, constraints = {}) {
  const events = [];
  function addEvent(title, detail, snapshot, removals = [], assignments = []) {
    events.push({ title, detail, snapshot: cloneSnapshot(snapshot), removals, assignments });
  }
  function solve(snapshot) {
    const before = cloneSnapshot(snapshot);
    if (!calculateCandidates(snapshot, constraints)) return null;
    const removals = candidateRemovals(before, snapshot);
    if (removals.length) addEvent('Filtrage des possibilités', 'Les contraintes de lignes, colonnes, boîtes et cages retirent les valeurs impossibles.', snapshot, removals);
    if (isSolved(snapshot)) return snapshot;

    const forced = findForcedMove(snapshot, constraints);
    if (forced) {
      const next = cloneSnapshot(snapshot);
      next.cells[forced.index].value = forced.digit;
      next.cells[forced.index].candidates = singleCandidate(forced.digit);
      addEvent(forced.title, forced.detail, next, [], [{ index: forced.index, value: forced.digit }]);
      return solve(next);
    }

    const index = chooseCell(snapshot, constraints);
    for (const digit of shuffled(candidateDigits(snapshot.cells[index]))) {
      const checkpoint = events.length;
      const next = cloneSnapshot(snapshot);
      next.cells[index].value = digit;
      next.cells[index].candidates = singleCandidate(digit);
      addEvent('Hypothèse contrôlée', `Essai de ${digit} dans r${rowOf(index) + 1}c${colOf(index) + 1}.`, next, [], [{ index, value: digit }]);
      const solved = solve(next);
      if (solved) return solved;
      events.length = checkpoint;
    }
    return null;
  }
  const solved = solve(cloneSnapshot(initialSnapshot));
  if (!solved) throw new Error('La grille générée ne peut pas être résolue.');
  return { solved, events };
}

function createSolvedValues() {
  const digits = shuffled(ALL_DIGITS);
  const bands = shuffled([0, 1, 2]);
  const stacks = shuffled([0, 1, 2]);
  const rows = bands.flatMap(band => shuffled([0, 1, 2]).map(offset => band * 3 + offset));
  const cols = stacks.flatMap(stack => shuffled([0, 1, 2]).map(offset => stack * 3 + offset));
  return rows.flatMap(row => cols.map(col => digits[(row * 3 + Math.floor(row / 3) + col) % SIZE]));
}

function carvePuzzle(solution, constraints, targetClues) {
  const units = shuffled(Array.from({ length: Math.ceil(solution.length / 2) }, (_, index) => {
    const opposite = solution.length - 1 - index;
    return index === opposite ? [index] : [index, opposite];
  }));
  const normalized = constraintsOf(constraints);
  const familyCount = [normalized.diagonal, normalized.antiKnight, normalized.antiKing, normalized.nonConsecutive, normalized.hyper, normalized.disjoint, normalized.sandwich]
    .filter(Boolean).length
    + ['cages', 'thermometers', 'pairs', 'palindromes', 'arrows', 'parityCells', 'whispers', 'renbans', 'entropicLines', 'modularLines', 'quadruples']
      .reduce((total, key) => total + (normalized[key]?.length ? 1 : 0), 0);
  if (familyCount >= 3) {
    const direct = Array(solution.length).fill(0);
    let directClues = 0;
    for (const unit of units) {
      if (directClues >= targetClues) break;
      unit.forEach(index => { direct[index] = solution[index]; });
      directClues += unit.length;
    }
    if (countSolutions(createSnapshot(direct), constraints, 2) === 1) return direct;
  }
  const values = solution.slice();
  let clueCount = values.length;
  for (const unit of units) {
    if (clueCount - unit.length < targetClues) continue;
    const saved = unit.map(index => values[index]);
    unit.forEach(index => { values[index] = 0; });
    if (countSolutions(createSnapshot(values), constraints, 2) === 1) clueCount -= unit.length;
    else unit.forEach((index, position) => { values[index] = saved[position]; });
  }
  return values;
}

function generateSudoku(difficultyName) {
  const targetClues = difficultyName === 'facile' ? 42 : (difficultyName === 'moyen' ? 31 : (difficultyName === 'difficile' ? 21 : 17));
  const solution = createSolvedValues();
  const values = carvePuzzle(solution, {}, targetClues);
  return { values, cages: [], unique: true };
}

function createSolvedWithConstraints(constraints) {
  function visit(snapshot) {
    if (!calculateCandidates(snapshot, constraints)) return null;
    const index = chooseCell(snapshot, constraints);
    if (index < 0) return snapshot;
    for (const digit of shuffled(candidateDigits(snapshot.cells[index]))) {
      const next = cloneSnapshot(snapshot);
      next.cells[index].value = digit;
      next.cells[index].candidates = singleCandidate(digit);
      const solved = visit(next);
      if (solved) return solved;
    }
    return null;
  }
  const solved = visit(createSnapshot(Array(SIZE * SIZE).fill(0), Array(SIZE * SIZE).fill(false)));
  if (!solved) throw new Error('Aucune solution ne respecte ces contraintes.');
  return solved.cells.map(cell => cell.value);
}

function generateDiagonal(difficultyName) {
  const targetClues = difficultyName === 'facile' ? 38 : (difficultyName === 'moyen' ? 30 : (difficultyName === 'difficile' ? 23 : 18));
  const constraints = { diagonal: true, cages: [], thermometers: [] };
  const solution = createSolvedWithConstraints(constraints);
  const values = carvePuzzle(solution, constraints, targetClues);
  return { values, cages: [], thermometers: [], diagonal: true, unique: true };
}

function neighbours(index) {
  const result = [];
  const row = rowOf(index);
  const col = colOf(index);
  if (row > 0) result.push(cellIndex(row - 1, col));
  if (row + 1 < SIZE) result.push(cellIndex(row + 1, col));
  if (col > 0) result.push(cellIndex(row, col - 1));
  if (col + 1 < SIZE) result.push(cellIndex(row, col + 1));
  return result;
}

function createKillerCages(solution, maximumSize) {
  const unassigned = new Set(Array.from({ length: SIZE * SIZE }, (_, index) => index));
  const cages = [];
  while (unassigned.size) {
    const start = shuffled([...unassigned])[0];
    const targetSize = 1 + Math.floor(Math.random() * maximumSize);
    const cells = [start];
    const digits = new Set([solution[start]]);
    unassigned.delete(start);
    while (cells.length < targetSize) {
      const candidates = shuffled(cells.flatMap(neighbours).filter(index => unassigned.has(index) && !digits.has(solution[index])));
      if (!candidates.length) break;
      const next = candidates[0];
      cells.push(next);
      digits.add(solution[next]);
      unassigned.delete(next);
    }
    cages.push({ cells, sum: cells.reduce((total, index) => total + solution[index], 0) });
  }
  return cages;
}

function generateKiller(difficultyName) {
  const maximumSize = difficultyName === 'facile' ? 3 : (difficultyName === 'moyen' ? 4 : (difficultyName === 'difficile' ? 5 : 6));
  const clueCount = difficultyName === 'facile' ? 12 : (difficultyName === 'moyen' ? 7 : (difficultyName === 'difficile' ? 3 : 0));
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const solution = createSolvedValues();
    const cages = createKillerCages(solution, maximumSize);
    const empty = createSnapshot(Array(SIZE * SIZE).fill(0), Array(SIZE * SIZE).fill(false));
    if (countSolutions(empty, cages, 2) !== 1) continue;
    const values = Array(SIZE * SIZE).fill(0);
    shuffled(Array.from({ length: SIZE * SIZE }, (_, index) => index)).slice(0, clueCount).forEach(index => { values[index] = solution[index]; });
    return { values, cages, unique: true };
  }
  throw new Error('Impossible de créer rapidement une grille Killer unique. Réessayez.');
}

function growThermometerBranch(solution, bulb, maximumLength, unavailable) {
  const branch = [bulb];
  while (branch.length < maximumLength) {
    const current = branch[branch.length - 1];
    const options = shuffled(neighbours(current).filter(index => !unavailable.has(index) && solution[index] > solution[current]));
    if (!options.length) break;
    const next = options[0];
    branch.push(next);
    unavailable.add(next);
  }
  return branch.length >= 2 ? branch : null;
}

function createThermometers(solution, difficultyName) {
  const configuration = difficultyName === 'facile'
    ? { count: 5, maximumLength: 4 }
    : (difficultyName === 'moyen' ? { count: 7, maximumLength: 5 } : (difficultyName === 'difficile' ? { count: 9, maximumLength: 7 } : { count: 11, maximumLength: 8 }));
  const thermometers = [];
  const unavailable = new Set();
  for (let attempt = 0; attempt < 180 && thermometers.length < configuration.count; attempt += 1) {
    const bulbs = shuffled(Array.from({ length: SIZE * SIZE }, (_, index) => index).filter(index => !unavailable.has(index) && solution[index] < SIZE));
    if (!bulbs.length) break;
    const bulb = bulbs[0];
    const localUnavailable = new Set(unavailable);
    localUnavailable.add(bulb);
    const branches = [];
    const branchCount = Math.random() < .35 ? 2 : 1;
    for (let branchIndex = 0; branchIndex < branchCount; branchIndex += 1) {
      const branch = growThermometerBranch(solution, bulb, configuration.maximumLength, localUnavailable);
      if (branch) branches.push(branch);
    }
    if (!branches.length) continue;
    branches.forEach(branch => branch.forEach(index => unavailable.add(index)));
    thermometers.push({ bulb, branches });
  }
  return thermometers;
}

function createPalindromeLines(count) {
  const lines = [];
  const occupied = new Set();
  for (let attempt = 0; attempt < 500 && lines.length < count; attempt += 1) {
    const length = Math.random() < .7 ? 3 : 5;
    const line = [Math.floor(Math.random() * SIZE * SIZE)];
    while (line.length < length) {
      const options = shuffled(neighbours(line[line.length - 1]).filter(index => !line.includes(index) && !occupied.has(index)));
      if (!options.length) break;
      line.push(options[0]);
    }
    if (line.length !== length) continue;
    const valid = Array.from({ length: Math.floor(length / 2) }, (_, position) =>
      !peersFor(line[position]).has(line[length - 1 - position])
    ).every(Boolean);
    if (!valid) continue;
    line.forEach(index => occupied.add(index));
    lines.push(line);
  }
  return lines;
}

function createArrows(solution, count) {
  const arrows = [];
  const occupied = new Set();
  for (let attempt = 0; attempt < 1000 && arrows.length < count; attempt += 1) {
    const bulb = Math.floor(Math.random() * SIZE * SIZE);
    if (occupied.has(bulb) || solution[bulb] < 3) continue;
    const length = Math.random() < .8 ? 2 : 3;
    const path = [];
    let current = bulb;
    while (path.length < length) {
      const options = shuffled(neighbours(current).filter(index => index !== bulb && !path.includes(index) && !occupied.has(index)));
      if (!options.length) break;
      current = options[0]; path.push(current);
    }
    if (path.length !== length || path.reduce((sum, index) => sum + solution[index], 0) !== solution[bulb]) continue;
    occupied.add(bulb); path.forEach(index => occupied.add(index));
    arrows.push({ bulb, path });
  }
  return arrows;
}

function createParityCells(solution, difficultyName) {
  const count = difficultyName === 'facile' ? 22 : (difficultyName === 'moyen' ? 18 : (difficultyName === 'difficile' ? 14 : 10));
  return shuffled(Array.from({ length: SIZE * SIZE }, (_, index) => index)).slice(0, count).map(index => ({ index, parity: solution[index] % 2 }));
}

function createWhispers(solution, count) {
  const lines = [];
  const occupied = new Set();
  for (let attempt = 0; attempt < 600 && lines.length < count; attempt += 1) {
    const start = Math.floor(Math.random() * SIZE * SIZE);
    if (occupied.has(start)) continue;
    const targetLength = 3 + Math.floor(Math.random() * 4);
    const line = [start];
    while (line.length < targetLength) {
      const current = line[line.length - 1];
      const options = shuffled(neighbours(current).filter(index => !occupied.has(index) && !line.includes(index) && Math.abs(solution[index] - solution[current]) >= 5));
      if (!options.length) break;
      line.push(options[0]);
    }
    if (line.length < 3) continue;
    line.forEach(index => occupied.add(index)); lines.push(line);
  }
  return lines;
}

function createRenbans(solution, count) {
  const lines = [];
  const occupied = new Set();
  for (let attempt = 0; attempt < 1400 && lines.length < count; attempt += 1) {
    const length = 3 + Math.floor(Math.random() * 3);
    const line = [Math.floor(Math.random() * SIZE * SIZE)];
    while (line.length < length) {
      const options = shuffled(neighbours(line[line.length - 1]).filter(index => !line.includes(index) && !occupied.has(index)));
      if (!options.length) break;
      line.push(options[0]);
    }
    const values = line.map(index => solution[index]);
    if (line.length !== length || new Set(values).size !== length || Math.max(...values) - Math.min(...values) !== length - 1) continue;
    line.forEach(index => occupied.add(index)); lines.push(line);
  }
  return lines;
}

function createSandwichClues(solution, difficultyName) {
  const sumBetween = values => {
    const one = values.indexOf(1); const nine = values.indexOf(9);
    return values.slice(Math.min(one, nine) + 1, Math.max(one, nine)).reduce((sum, value) => sum + value, 0);
  };
  const clues = [
    ...ALL_DIGITS.map((_, row) => ({ axis: 'rows', index: row, value: sumBetween(ALL_DIGITS.map((__, col) => solution[cellIndex(row, col)])) })),
    ...ALL_DIGITS.map((_, col) => ({ axis: 'cols', index: col, value: sumBetween(ALL_DIGITS.map((__, row) => solution[cellIndex(row, col)])) }))
  ];
  const clueCount = difficultyName === 'facile' ? 10 : (difficultyName === 'moyen' ? 8 : (difficultyName === 'difficile' ? 6 : 4));
  const result = { rows: Array(SIZE).fill(null), cols: Array(SIZE).fill(null) };
  shuffled(clues).slice(0, clueCount).forEach(clue => { result[clue.axis][clue.index] = clue.value; });
  return result;
}

function createCategoryLines(solution, type, count) {
  const categoryOf = type === 'entropic' ? digit => Math.floor((digit - 1) / 3) : digit => (digit - 1) % 3;
  const lines = [];
  const occupied = new Set();
  for (let attempt = 0; attempt < 1800 && lines.length < count; attempt += 1) {
    const available = shuffled(Array.from({ length: SIZE * SIZE }, (_, index) => index).filter(index => !occupied.has(index)));
    if (!available.length) break;
    const targetLength = 3 + Math.floor(Math.random() * 4);
    const line = [available[0]];
    while (line.length < targetLength) {
      const current = line[line.length - 1];
      const options = shuffled(neighbours(current).filter(index => {
        if (occupied.has(index) || line.includes(index)) return false;
        if (line.length < 2) return true;
        const categories = [solution[line[line.length - 2]], solution[current], solution[index]].map(categoryOf);
        return new Set(categories).size === 3;
      }));
      if (!options.length) break;
      line.push(options[0]);
    }
    if (line.length < 3) continue;
    line.forEach(index => occupied.add(index));
    lines.push(line);
  }
  return lines;
}

function createQuadruples(solution, count) {
  const intersections = shuffled(Array.from({ length: 64 }, (_, index) => ({ row: 1 + Math.floor(index / 8), col: 1 + index % 8 })));
  const quadruples = [];
  for (const intersection of intersections) {
    const cells = [
      cellIndex(intersection.row - 1, intersection.col - 1), cellIndex(intersection.row - 1, intersection.col),
      cellIndex(intersection.row, intersection.col - 1), cellIndex(intersection.row, intersection.col)
    ];
    const values = [...new Set(cells.map(index => solution[index]))];
    if (values.length < 2) continue;
    const clueSize = Math.min(values.length, Math.random() < .65 ? 3 : 4);
    quadruples.push({ ...intersection, cells, digits: shuffled(values).slice(0, clueSize).sort((left, right) => left - right) });
    if (quadruples.length >= count) break;
  }
  return quadruples;
}

function generateThermometer(difficultyName) {
  const targetClues = difficultyName === 'facile' ? 34 : (difficultyName === 'moyen' ? 27 : (difficultyName === 'difficile' ? 21 : 17));
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const solution = createSolvedValues();
    const thermometers = createThermometers(solution, difficultyName);
    if (thermometers.length < 4) continue;
    const constraints = { cages: [], thermometers };
    const values = carvePuzzle(solution, constraints, targetClues);
    if (countSolutions(createSnapshot(values), constraints, 2) === 1) return { values, cages: [], thermometers, unique: true };
  }
  throw new Error('Impossible de créer rapidement une grille Thermometer unique. Réessayez.');
}

function killerClueCount(difficultyName) {
  return difficultyName === 'facile' ? 12 : (difficultyName === 'moyen' ? 7 : (difficultyName === 'difficile' ? 3 : 0));
}

function createPairConstraints(solution, type, count) {
  const pairs = [];
  const used = new Set();
  for (const index of shuffled(Array.from({ length: SIZE * SIZE }, (_, position) => position))) {
    const candidates = shuffled(neighbours(index).filter(peer => {
      const key = [Math.min(index, peer), Math.max(index, peer)].join(':');
      if (used.has(key)) return false;
      const left = solution[index]; const right = solution[peer];
      return type === 'kropki' ? (Math.abs(left - right) === 1 || left === right * 2 || right === left * 2) : (left + right === 5 || left + right === 10);
    }));
    if (!candidates.length) continue;
    const peer = candidates[0]; const left = solution[index]; const right = solution[peer];
    const pairType = type === 'kropki' ? ((left === right * 2 || right === left * 2) ? 'black' : 'white') : 'xv';
    pairs.push({ a: index, b: peer, type: pairType, sum: pairType === 'xv' ? left + right : 0 });
    used.add([Math.min(index, peer), Math.max(index, peer)].join(':'));
    if (pairs.length >= count) break;
  }
  return pairs;
}

function generatePairVariant(variants, difficultyName) {
  const targetClues = difficultyName === 'facile' ? 38 : (difficultyName === 'moyen' ? 29 : (difficultyName === 'difficile' ? 22 : 17));
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const solution = createSolvedValues();
    const pairs = [
      ...(variants.includes('kropki') ? createPairConstraints(solution, 'kropki', 18) : []),
      ...(variants.includes('xv') ? createPairConstraints(solution, 'xv', 15) : [])
    ];
    if (!pairs.length) continue;
    const constraints = { cages: [], thermometers: [], pairs };
    const values = carvePuzzle(solution, constraints, targetClues);
    if (countSolutions(createSnapshot(values), constraints, 2) === 1) return { values, cages: [], thermometers: [], pairs, unique: true };
  }
  throw new Error('Impossible de générer rapidement une grille de paires unique.');
}

function generateCombinedVariants(variants, difficultyName) {
  const hasKiller = variants.includes('killer');
  const hasThermometer = variants.includes('thermometer');
  const hasDiagonal = variants.includes('diagonal');
  const hasPairs = variants.includes('kropki') || variants.includes('xv');
  const hasAntiKnight = variants.includes('knight');
  const hasAntiKing = variants.includes('king');
  const hasNonConsecutive = variants.includes('nonconsecutive');
  const hasHyper = variants.includes('hyper');
  const hasDisjoint = variants.includes('disjoint');
  const hasPalindrome = variants.includes('palindrome');
  const hasArrow = variants.includes('arrow');
  const hasParity = variants.includes('parity');
  const hasWhisper = variants.includes('whisper');
  const hasRenban = variants.includes('renban');
  const hasSandwich = variants.includes('sandwich');
  const hasEntropic = variants.includes('entropic');
  const hasModular = variants.includes('modular');
  const hasQuadruple = variants.includes('quadruple');
  const hasExtraConstraint = hasAntiKnight || hasAntiKing || hasNonConsecutive || hasHyper || hasDisjoint || hasPalindrome || hasArrow || hasParity || hasWhisper || hasRenban || hasSandwich || hasEntropic || hasModular || hasQuadruple;
  if (!hasKiller && !hasThermometer && !hasDiagonal && !hasPairs && !hasExtraConstraint) return generateSudoku(difficultyName);
  if (hasKiller && !hasThermometer && !hasDiagonal && !hasPairs && !hasExtraConstraint) return generateKiller(difficultyName);
  if (!hasKiller && hasThermometer && !hasDiagonal && !hasPairs && !hasExtraConstraint) return generateThermometer(difficultyName);
  const maximumSize = difficultyName === 'facile' ? 3 : (difficultyName === 'moyen' ? 4 : (difficultyName === 'difficile' ? 5 : 6));
  const baseTargetClues = hasKiller ? killerClueCount(difficultyName) : (difficultyName === 'facile' ? 36 : (difficultyName === 'moyen' ? 28 : (difficultyName === 'difficile' ? 21 : 16)));
  const targetClues = hasKiller ? baseTargetClues : Math.max(difficultyName === 'expert' ? 8 : 12, baseTargetClues - Math.min(10, Math.max(0, variants.length - 1) * 2));
  for (let attempt = 0; attempt < 42; attempt += 1) {
    const palindromes = hasPalindrome ? createPalindromeLines(difficultyName === 'facile' ? 4 : (difficultyName === 'moyen' ? 6 : 8)) : [];
    if (hasPalindrome && palindromes.length < 4) continue;
    const base = { diagonal: hasDiagonal, antiKnight: hasAntiKnight, antiKing: hasAntiKing, nonConsecutive: hasNonConsecutive, hyper: hasHyper, disjoint: hasDisjoint, cages: [], thermometers: [], pairs: [], palindromes, arrows: [], parityCells: [] };
    let solution;
    try {
      solution = hasDiagonal || hasAntiKnight || hasAntiKing || hasNonConsecutive || hasHyper || hasDisjoint || hasPalindrome ? createSolvedWithConstraints(base) : createSolvedValues();
    } catch (error) {
      const structural = variants.filter(variant => ['diagonal', 'knight', 'king', 'nonconsecutive', 'hyper', 'disjoint', 'palindrome'].includes(variant));
      throw new Error(`Combinaison structurelle incompatible : ${structural.map(variant => VARIANT_DEFINITIONS[variant].label).join(' + ')}. Retirez au moins une de ces règles.`);
    }
    const arrows = hasArrow ? createArrows(solution, difficultyName === 'facile' ? 4 : (difficultyName === 'moyen' ? 6 : 8)) : [];
    if (hasArrow && arrows.length < 3) continue;
    const parityCells = hasParity ? createParityCells(solution, difficultyName) : [];
    const whispers = hasWhisper ? createWhispers(solution, difficultyName === 'facile' ? 4 : (difficultyName === 'moyen' ? 6 : 8)) : [];
    if (hasWhisper && whispers.length < 3) continue;
    const renbans = hasRenban ? createRenbans(solution, difficultyName === 'facile' ? 4 : (difficultyName === 'moyen' ? 6 : 8)) : [];
    if (hasRenban && renbans.length < 3) continue;
    const sandwich = hasSandwich ? createSandwichClues(solution, difficultyName) : null;
    const cages = hasKiller ? createKillerCages(solution, maximumSize) : [];
    const thermometers = hasThermometer ? createThermometers(solution, difficultyName) : [];
    if (hasThermometer && thermometers.length < 4) continue;
    const pairs = [
      ...(variants.includes('kropki') ? createPairConstraints(solution, 'kropki', 18) : []),
      ...(variants.includes('xv') ? createPairConstraints(solution, 'xv', 15) : [])
    ];
    const lineCount = difficultyName === 'facile' ? 6 : (difficultyName === 'moyen' ? 5 : 4);
    const entropicLines = hasEntropic ? createCategoryLines(solution, 'entropic', lineCount) : [];
    const modularLines = hasModular ? createCategoryLines(solution, 'modular', lineCount) : [];
    const quadruples = hasQuadruple ? createQuadruples(solution, difficultyName === 'facile' ? 12 : (difficultyName === 'moyen' ? 10 : (difficultyName === 'difficile' ? 8 : 6))) : [];
    if ((hasEntropic && entropicLines.length < 3) || (hasModular && modularLines.length < 3) || (hasQuadruple && quadruples.length < 6)) continue;
    const constraints = { diagonal: hasDiagonal, antiKnight: hasAntiKnight, antiKing: hasAntiKing, nonConsecutive: hasNonConsecutive, hyper: hasHyper, disjoint: hasDisjoint, cages, thermometers, pairs, palindromes, arrows, parityCells, whispers, renbans, sandwich, entropicLines, modularLines, quadruples };
    const values = carvePuzzle(solution, constraints, targetClues);
    if (countSolutions(createSnapshot(values), constraints, 2) === 1) return { values, cages, thermometers, pairs, palindromes, arrows, parityCells, whispers, renbans, sandwich, entropicLines, modularLines, quadruples, diagonal: hasDiagonal, antiKnight: hasAntiKnight, antiKing: hasAntiKing, nonConsecutive: hasNonConsecutive, hyper: hasHyper, disjoint: hasDisjoint, unique: true };
  }
  throw new Error('Impossible de créer rapidement cette combinaison de contraintes unique. Réessayez.');
}

function createSudokuTraceData(variantSelection, difficultyName) {
  const variants = (variantSelection instanceof Set
    ? [...variantSelection]
    : (Array.isArray(variantSelection) ? variantSelection : (variantSelection === 'sudoku' ? [] : [variantSelection])))
    .filter(Boolean)
    .sort();
  const puzzle = generateCombinedVariants(variants, difficultyName);
  const variantLabel = variants.length ? variants.map(variant => VARIANT_DEFINITIONS[variant].label).join(' + ') : 'classique';
  const detail = [
    variants.includes('killer') ? 'Les cages pointillées affichent leur somme.' : '',
    variants.includes('thermometer') ? 'Chaque branche grise augmente strictement du bulbe vers son extrémité.' : '',
    variants.includes('diagonal') ? 'Les deux diagonales contiennent chacune les chiffres de 1 à 9 une seule fois.' : '',
    variants.includes('kropki') ? 'Les points blancs indiquent deux chiffres consécutifs, les noirs un rapport de deux.' : '',
    variants.includes('xv') ? 'Les marqueurs X et V indiquent une somme de 10 ou de 5.' : '',
    variants.includes('knight') ? 'Deux cases reliées par un déplacement de cavalier ne peuvent pas contenir le même chiffre.' : '',
    variants.includes('king') ? 'Deux cases voisines, diagonales comprises, ne peuvent pas contenir le même chiffre.' : '',
    variants.includes('nonconsecutive') ? 'Deux cases orthogonalement voisines ne peuvent pas contenir des chiffres consécutifs.' : '',
    variants.includes('hyper') ? 'Chacune des quatre régions colorées contient les chiffres de 1 à 9 une seule fois.' : '',
    variants.includes('disjoint') ? 'Les neuf cases occupant la même position dans leur boîte contiennent chacune un chiffre différent.' : '',
    variants.includes('palindrome') ? 'Les chiffres d’une ligne grise se lisent de la même façon dans les deux sens.' : '',
    variants.includes('arrow') ? 'Le chiffre du cercle est égal à la somme des chiffres placés sur sa flèche.' : '',
    variants.includes('parity') ? 'Un carré marque une valeur paire et un cercle une valeur impaire.' : '',
    variants.includes('whisper') ? 'Deux cases consécutives d’une ligne verte diffèrent d’au moins 5.' : '',
    variants.includes('renban') ? 'Une ligne violette contient une suite de chiffres consécutifs dans un ordre quelconque.' : '',
    variants.includes('sandwich') ? 'Les indices extérieurs donnent la somme des chiffres situés entre le 1 et le 9.' : '',
    variants.includes('entropic') ? 'Chaque groupe de trois cases d’une ligne orange contient un chiffre bas, un moyen et un haut.' : '',
    variants.includes('modular') ? 'Chaque groupe de trois cases d’une ligne turquoise contient les trois résidus modulo 3.' : '',
    variants.includes('quadruple') ? 'Les chiffres d’un cercle doivent apparaître dans les quatre cases qui l’entourent.' : '',
    !variants.length ? 'Les possibilités sont filtrées par les lignes, colonnes et boîtes.' : ''
  ].filter(Boolean).join(' ');
  const initialSnapshot = createSnapshot(puzzle.values);
  const constraints = { cages: puzzle.cages, thermometers: puzzle.thermometers || [], pairs: puzzle.pairs || [], palindromes: puzzle.palindromes || [], arrows: puzzle.arrows || [], parityCells: puzzle.parityCells || [], whispers: puzzle.whispers || [], renbans: puzzle.renbans || [], sandwich: puzzle.sandwich || null, entropicLines: puzzle.entropicLines || [], modularLines: puzzle.modularLines || [], quadruples: puzzle.quadruples || [], diagonal: Boolean(puzzle.diagonal), antiKnight: Boolean(puzzle.antiKnight), antiKing: Boolean(puzzle.antiKing), nonConsecutive: Boolean(puzzle.nonConsecutive), hyper: Boolean(puzzle.hyper), disjoint: Boolean(puzzle.disjoint) };
  const result = solveWithTrace(initialSnapshot, constraints);
  return {
    game: 'sudoku',
    puzzleType: variants.join('-') || 'sudoku',
    title: `Résolution d’un Sudoku ${variantLabel}`,
    initialTitle: `Grille Sudoku ${variantLabel} générée`,
    initialDetail: detail,
    initialSnapshot,
    cages: puzzle.cages,
    thermometers: puzzle.thermometers || [],
    pairs: puzzle.pairs || [],
    palindromes: puzzle.palindromes || [],
    arrows: puzzle.arrows || [],
    parityCells: puzzle.parityCells || [],
    whispers: puzzle.whispers || [],
    renbans: puzzle.renbans || [],
    sandwich: puzzle.sandwich || null,
    entropicLines: puzzle.entropicLines || [],
    modularLines: puzzle.modularLines || [],
    quadruples: puzzle.quadruples || [],
    diagonal: Boolean(puzzle.diagonal),
    antiKnight: Boolean(puzzle.antiKnight),
    antiKing: Boolean(puzzle.antiKing),
    nonConsecutive: Boolean(puzzle.nonConsecutive),
    hyper: Boolean(puzzle.hyper),
    disjoint: Boolean(puzzle.disjoint),
    steps: result.events,
    unique: puzzle.unique
  };
}

function currentState(step) {
  if (step === 0) {
    return { title: traceData.initialTitle, detail: traceData.initialDetail, snapshot: traceData.initialSnapshot, removals: [], assignments: [] };
  }
  return traceData.steps[step - 1];
}

function forcedCandidateKeys(snapshot) {
  const forced = new Set();
  snapshot.cells.forEach((cell, index) => {
    if (!cell.value && candidateDigits(cell).length === 1) forced.add(`${index}:${candidateDigits(cell)[0]}`);
  });
  const houses = constraintHouses(traceData);
  houses.forEach(house => {
    ALL_DIGITS.forEach(digit => {
      const positions = house.filter(index => !snapshot.cells[index].value && snapshot.cells[index].candidates[digit - 1]);
      if (positions.length === 1) forced.add(`${positions[0]}:${digit}`);
    });
  });
  return forced;
}

function errorCellIndexes(snapshot) {
  const errors = new Set();
  function inspect(indexes) {
    const byValue = new Map();
    indexes.forEach(index => {
      const value = snapshot.cells[index].value;
      if (!value) return;
      if (!byValue.has(value)) byValue.set(value, []);
      byValue.get(value).push(index);
    });
    byValue.forEach(indexesWithValue => {
      if (indexesWithValue.length > 1) indexesWithValue.forEach(index => {
        if (snapshot.cells[index].isUserEntered) errors.add(index);
      });
    });
  }
  HOUSES.forEach(inspect);
  if (traceData.diagonal) DIAGONAL_HOUSES.forEach(inspect);
  if (traceData.hyper) HYPER_HOUSES.forEach(inspect);
  if (traceData.disjoint) DISJOINT_HOUSES.forEach(inspect);
  if (traceData.antiKnight || traceData.antiKing) snapshot.cells.forEach((cell, index) => {
    if (!cell.value || !cell.isUserEntered) return;
    const hasConflict = [...peersForConstraints(index, traceData)].some(peer => snapshot.cells[peer].value === cell.value);
    if (hasConflict) errors.add(index);
  });
  if (traceData.nonConsecutive) snapshot.cells.forEach((cell, index) => {
    if (!cell.value || !cell.isUserEntered) return;
    if (neighbours(index).some(peer => Math.abs(snapshot.cells[peer].value - cell.value) === 1)) errors.add(index);
  });
  (traceData.thermometers || []).forEach(thermometer => thermometer.branches.forEach(branch => {
    for (let position = 0; position + 1 < branch.length; position += 1) {
      const left = branch[position]; const right = branch[position + 1];
      const leftValue = snapshot.cells[left].value; const rightValue = snapshot.cells[right].value;
      if (!leftValue || !rightValue || leftValue < rightValue) continue;
      if (snapshot.cells[left].isUserEntered) errors.add(left);
      if (snapshot.cells[right].isUserEntered) errors.add(right);
    }
  }));
  (traceData.pairs || []).forEach(pair => {
    const leftValue = snapshot.cells[pair.a].value; const rightValue = snapshot.cells[pair.b].value;
    if (!leftValue || !rightValue) return;
    const valid = pair.type === 'white' ? Math.abs(leftValue - rightValue) === 1
      : pair.type === 'black' ? leftValue === rightValue * 2 || rightValue === leftValue * 2
        : leftValue + rightValue === pair.sum;
    if (valid) return;
    if (snapshot.cells[pair.a].isUserEntered) errors.add(pair.a);
    if (snapshot.cells[pair.b].isUserEntered) errors.add(pair.b);
  });
  (traceData.palindromes || []).forEach(line => {
    for (let position = 0; position < Math.floor(line.length / 2); position += 1) {
      const left = line[position]; const right = line[line.length - 1 - position];
      if (!snapshot.cells[left].value || !snapshot.cells[right].value || snapshot.cells[left].value === snapshot.cells[right].value) continue;
      if (snapshot.cells[left].isUserEntered) errors.add(left);
      if (snapshot.cells[right].isUserEntered) errors.add(right);
    }
  });
  (traceData.arrows || []).forEach(arrow => {
    const indexes = [arrow.bulb, ...arrow.path];
    if (!indexes.every(index => snapshot.cells[index].value)) return;
    if (snapshot.cells[arrow.bulb].value === arrow.path.reduce((sum, index) => sum + snapshot.cells[index].value, 0)) return;
    indexes.forEach(index => { if (snapshot.cells[index].isUserEntered) errors.add(index); });
  });
  (traceData.parityCells || []).forEach(marker => {
    const value = snapshot.cells[marker.index].value;
    if (value && value % 2 !== marker.parity && snapshot.cells[marker.index].isUserEntered) errors.add(marker.index);
  });
  (traceData.whispers || []).forEach(line => {
    for (let position = 0; position + 1 < line.length; position += 1) {
      const left = line[position]; const right = line[position + 1];
      const leftValue = snapshot.cells[left].value; const rightValue = snapshot.cells[right].value;
      if (!leftValue || !rightValue || Math.abs(leftValue - rightValue) >= 5) continue;
      if (snapshot.cells[left].isUserEntered) errors.add(left);
      if (snapshot.cells[right].isUserEntered) errors.add(right);
    }
  });
  (traceData.renbans || []).forEach(line => {
    const values = line.map(index => snapshot.cells[index].value);
    if (values.some(value => !value)) return;
    if (new Set(values).size === values.length && Math.max(...values) - Math.min(...values) === values.length - 1) return;
    line.forEach(index => { if (snapshot.cells[index].isUserEntered) errors.add(index); });
  });
  for (const [lines, categoryOf] of [
    [traceData.entropicLines || [], digit => Math.floor((digit - 1) / 3)],
    [traceData.modularLines || [], digit => (digit - 1) % 3]
  ]) {
    lines.forEach(line => {
      for (let position = 0; position + 2 < line.length; position += 1) {
        const cells = line.slice(position, position + 3);
        const values = cells.map(index => snapshot.cells[index].value);
        if (values.some(value => !value) || new Set(values.map(categoryOf)).size === 3) continue;
        cells.forEach(index => { if (snapshot.cells[index].isUserEntered) errors.add(index); });
      }
    });
  }
  (traceData.quadruples || []).forEach(quadruple => {
    const values = quadruple.cells.map(index => snapshot.cells[index].value);
    if (values.some(value => !value)) return;
    const available = values.slice();
    const valid = quadruple.digits.every(digit => {
      const position = available.indexOf(digit);
      if (position < 0) return false;
      available.splice(position, 1);
      return true;
    });
    if (!valid) quadruple.cells.forEach(index => { if (snapshot.cells[index].isUserEntered) errors.add(index); });
  });
  if (traceData.sandwich) {
    const inspectSandwich = (house, target) => {
      const values = house.map(index => snapshot.cells[index].value);
      if (values.some(value => !value)) return;
      const one = values.indexOf(1); const nine = values.indexOf(9);
      const sum = values.slice(Math.min(one, nine) + 1, Math.max(one, nine)).reduce((total, value) => total + value, 0);
      if (sum !== target) house.forEach(index => { if (snapshot.cells[index].isUserEntered) errors.add(index); });
    };
    traceData.sandwich.rows.forEach((target, row) => { if (target !== null) inspectSandwich(ALL_DIGITS.map((_, col) => cellIndex(row, col)), target); });
    traceData.sandwich.cols.forEach((target, col) => { if (target !== null) inspectSandwich(ALL_DIGITS.map((_, row) => cellIndex(row, col)), target); });
  }
  traceData.cages.forEach(cage => {
    inspect(cage.cells);
    const solved = cage.cells.filter(index => snapshot.cells[index].value);
    const sum = solved.reduce((total, index) => total + snapshot.cells[index].value, 0);
    if (sum > cage.sum || (solved.length === cage.cells.length && sum !== cage.sum)) {
      solved.forEach(index => {
        if (snapshot.cells[index].isUserEntered) errors.add(index);
      });
    }
  });
  return errors;
}

function selectedIndexes() {
  return selectedCells.size ? selectedCells : (activeCell === null ? new Set() : new Set([activeCell]));
}

function selectOnly(index) {
  activeCell = index;
  selectionAnchor = index;
  selectedCells = new Set([index]);
}

function extendSelection(index) {
  if (selectionAnchor === null) selectionAnchor = activeCell === null ? index : activeCell;
  activeCell = index;
  selectedCells.add(index);
}

function impactedGroups() {
  const houses = new Set();
  const cageCells = new Set();
  const constraintCells = new Set();
  if (!manualMode || activeCell === null) return { houses, cageCells, constraintCells };
  const row = rowOf(activeCell);
  const col = colOf(activeCell);
  for (let index = 0; index < SIZE; index += 1) {
    houses.add(cellIndex(row, index));
    houses.add(cellIndex(index, col));
  }
  const boxRow = Math.floor(row / BOX_HEIGHT) * BOX_HEIGHT;
  const boxCol = Math.floor(col / BOX_WIDTH) * BOX_WIDTH;
  for (let offsetRow = 0; offsetRow < BOX_HEIGHT; offsetRow += 1) {
    for (let offsetCol = 0; offsetCol < BOX_WIDTH; offsetCol += 1) houses.add(cellIndex(boxRow + offsetRow, boxCol + offsetCol));
  }
  traceData.cages.forEach(cage => {
    if (cage.cells.includes(activeCell)) cage.cells.forEach(index => cageCells.add(index));
  });
  const standardPeers = peersFor(activeCell);
  peersForConstraints(activeCell, traceData).forEach(index => {
    if (!standardPeers.has(index)) constraintCells.add(index);
  });
  if (traceData.nonConsecutive) neighbours(activeCell).forEach(index => constraintCells.add(index));
  traceData.thermometers.forEach(thermometer => thermometer.branches.forEach(branch => {
    if (branch.includes(activeCell)) branch.forEach(index => constraintCells.add(index));
  }));
  (traceData.palindromes || []).forEach(line => {
    if (line.includes(activeCell)) line.forEach(index => constraintCells.add(index));
  });
  (traceData.arrows || []).forEach(arrow => {
    const cells = [arrow.bulb, ...arrow.path];
    if (cells.includes(activeCell)) cells.forEach(index => constraintCells.add(index));
  });
  (traceData.whispers || []).forEach(line => {
    if (line.includes(activeCell)) line.forEach(index => constraintCells.add(index));
  });
  (traceData.renbans || []).forEach(line => {
    if (line.includes(activeCell)) line.forEach(index => constraintCells.add(index));
  });
  (traceData.entropicLines || []).forEach(line => {
    if (line.includes(activeCell)) line.forEach(index => constraintCells.add(index));
  });
  (traceData.modularLines || []).forEach(line => {
    if (line.includes(activeCell)) line.forEach(index => constraintCells.add(index));
  });
  (traceData.quadruples || []).forEach(quadruple => {
    if (quadruple.cells.includes(activeCell)) quadruple.cells.forEach(index => constraintCells.add(index));
  });
  (traceData.pairs || []).forEach(pair => {
    if (pair.a === activeCell) constraintCells.add(pair.b);
    if (pair.b === activeCell) constraintCells.add(pair.a);
  });
  return { houses, cageCells, constraintCells };
}

function lockedDigitColor(digit) {
  return lockedHighlightDigits.has(digit) ? DIGIT_COLORS[digit - 1] : null;
}

function lockedGroupColors(snapshot) {
  const colorsByCell = new Map();
  const addColor = (index, color) => {
    if (!colorsByCell.has(index)) colorsByCell.set(index, new Set());
    colorsByCell.get(index).add(color);
  };
  snapshot.cells.forEach((cell, index) => {
    const color = lockedDigitColor(cell.value);
    if (!cell.value || !color) return;
    const row = rowOf(index);
    const col = colOf(index);
    for (let position = 0; position < SIZE; position += 1) {
      addColor(cellIndex(row, position), color);
      addColor(cellIndex(position, col), color);
    }
    const boxRow = Math.floor(row / BOX_HEIGHT) * BOX_HEIGHT;
    const boxCol = Math.floor(col / BOX_WIDTH) * BOX_WIDTH;
    for (let offsetRow = 0; offsetRow < BOX_HEIGHT; offsetRow += 1) {
      for (let offsetCol = 0; offsetCol < BOX_WIDTH; offsetCol += 1) addColor(cellIndex(boxRow + offsetRow, boxCol + offsetCol), color);
    }
  });
  return colorsByCell;
}

function drawSudokuBoard(state) {
  const snapshot = state.snapshot;
  const darkTheme = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const colors = darkTheme
    ? { cell: '#202a38', cellBorder: '#526277', value: '#f4f7fb', candidate: '#273344', candidateBorder: '#526277', candidateText: '#d9e3f0', grid: '#b8c7db' }
    : { cell: '#fff', cellBorder: '#d7d7d7', value: '#111', candidate: '#fff', candidateBorder: '#d8d8d8', candidateText: '#4d4d4d', grid: '#222' };
  const cellSize = 80;
  const margin = traceData.sandwich ? 54 : 24;
  const width = margin * 2 + cellSize * SIZE;
  const candidateCols = 3;
  const candidateRows = 3;
  const removed = new Set((state.removals || []).map(item => `${item.index}:${item.digit}`));
  const assigned = new Set((state.assignments || []).map(item => item.index));
  const errors = manualMode && showErrors.checked ? errorCellIndexes(snapshot) : new Set();
  const forced = manualMode && autoCandidates.checked ? forcedCandidateKeys(snapshot) : new Set();
  const selectedValue = manualMode && autoCandidates.checked && activeCell !== null ? snapshot.cells[activeCell].value : 0;
  const selected = selectedIndexes();
  const groups = impactedGroups();
  const lockedGroups = lockedGroupColors(snapshot);

  board.setAttribute('viewBox', `0 0 ${width} ${width}`);
  board.innerHTML = '';
  const svg = 'http://www.w3.org/2000/svg';
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const index = cellIndex(row, col);
      const cell = snapshot.cells[index];
      const x = margin + col * cellSize;
      const y = margin + row * cellSize;
      const isError = errors.has(index);
      const isActive = manualMode && activeCell === index;
      const isSelected = manualMode && selected.has(index);
      const isHinted = manualMode && manualHint && manualHint.index === index;
      const rect = document.createElementNS(svg, 'rect');
      rect.setAttribute('x', x); rect.setAttribute('y', y); rect.setAttribute('width', cellSize); rect.setAttribute('height', cellSize);
      rect.setAttribute('fill', isError ? '#ffe2e2' : (isHinted ? '#f3e8ff' : (assigned.has(index) ? '#e8fff0' : colors.cell)));
      rect.setAttribute('stroke', isError ? '#d11a2a' : colors.cellBorder);
      board.appendChild(rect);
      if (cell.value) {
        const text = document.createElementNS(svg, 'text');
        text.setAttribute('x', x + cellSize / 2); text.setAttribute('y', y + cellSize * .68); text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', 46); text.setAttribute('font-weight', '700'); text.setAttribute('font-family', 'Arial, sans-serif');
        text.setAttribute('fill', isError ? '#d11a2a' : (lockedDigitColor(cell.value) || (cell.isUserEntered ? '#5ca8ff' : colors.value)));
        text.textContent = cell.value;
        board.appendChild(text);
      } else {
        for (const digit of ALL_DIGITS) {
          const candidateIndex = digit - 1;
          const miniCol = candidateIndex % candidateCols;
          const miniRow = Math.floor(candidateIndex / candidateCols);
          const miniX = x + miniCol * (cellSize / candidateCols);
          const miniY = y + miniRow * (cellSize / candidateRows);
          const visible = manualMode
            ? (autoCandidates.checked ? (cell.candidates[candidateIndex] && !cell.hiddenCandidates[candidateIndex]) : cell.manualNotes[candidateIndex])
            : cell.candidates[candidateIndex];
          const isRemoved = removed.has(`${index}:${digit}`);
          const isForced = forced.has(`${index}:${digit}`) && visible;
          const sameValue = selectedValue === digit && visible;
          const highlightColor = (autoCandidates.checked ? visible : cell.manualNotes[candidateIndex]) ? lockedDigitColor(digit) : null;
          const mini = document.createElementNS(svg, 'rect');
          mini.setAttribute('x', miniX + 1); mini.setAttribute('y', miniY + 1); mini.setAttribute('width', cellSize / 3 - 2); mini.setAttribute('height', cellSize / 3 - 2);
          mini.setAttribute('fill', isRemoved ? '#ffdede' : (isForced ? '#dff6e9' : (sameValue ? '#f0e5ff' : colors.candidate)));
          mini.setAttribute('stroke', isRemoved ? '#d11a2a' : (isForced ? '#087b42' : (sameValue ? '#54238e' : (highlightColor || colors.candidateBorder))));
          board.appendChild(mini);
          if (visible) {
            const text = document.createElementNS(svg, 'text');
            text.setAttribute('x', miniX + cellSize / 6); text.setAttribute('y', miniY + cellSize / 6 + 4); text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-size', 11); text.setAttribute('font-family', 'Arial, sans-serif'); text.setAttribute('fill', isRemoved ? '#d11a2a' : (visible ? (highlightColor || (isForced ? '#087b42' : (sameValue ? '#54238e' : colors.candidateText))) : '#b8b8b8'));
            text.textContent = digit;
            board.appendChild(text);
          }
        }
      }
      if (!isError && (groups.houses.has(index) || groups.cageCells.has(index) || groups.constraintCells.has(index))) {
        const groupHighlight = document.createElementNS(svg, 'rect');
        groupHighlight.setAttribute('x', x); groupHighlight.setAttribute('y', y); groupHighlight.setAttribute('width', cellSize); groupHighlight.setAttribute('height', cellSize);
        groupHighlight.setAttribute('fill', groups.cageCells.has(index) ? '#f59e0b' : (groups.constraintCells.has(index) ? '#8b5cf6' : '#3b82f6'));
        groupHighlight.setAttribute('fill-opacity', groups.cageCells.has(index) ? '.20' : (groups.constraintCells.has(index) ? '.18' : '.16'));
        groupHighlight.style.pointerEvents = 'none';
        board.appendChild(groupHighlight);
      }
      if (!isError && lockedGroups.has(index)) {
        lockedGroups.get(index).forEach(color => {
          const lockedHighlight = document.createElementNS(svg, 'rect');
          lockedHighlight.setAttribute('x', x); lockedHighlight.setAttribute('y', y); lockedHighlight.setAttribute('width', cellSize); lockedHighlight.setAttribute('height', cellSize);
          lockedHighlight.setAttribute('fill', color); lockedHighlight.setAttribute('fill-opacity', '.10');
          lockedHighlight.style.pointerEvents = 'none';
          board.appendChild(lockedHighlight);
        });
      }
      if (isSelected) {
        const selection = document.createElementNS(svg, 'rect');
        selection.setAttribute('x', x + 2); selection.setAttribute('y', y + 2); selection.setAttribute('width', cellSize - 4); selection.setAttribute('height', cellSize - 4);
        selection.setAttribute('fill', pencilMode ? '#c084fc' : '#ffd54f'); selection.setAttribute('fill-opacity', '.28');
        selection.setAttribute('stroke', 'none');
        board.appendChild(selection);
      }
      if (manualMode) {
        const hit = document.createElementNS(svg, 'rect');
        hit.setAttribute('x', x); hit.setAttribute('y', y); hit.setAttribute('width', cellSize); hit.setAttribute('height', cellSize); hit.setAttribute('fill', 'transparent');
        hit.style.cursor = cell.isFixed ? 'not-allowed' : 'pointer';
        hit.addEventListener('pointerdown', event => {
          if (event.button !== 0) return;
          event.preventDefault();
          isDraggingSelection = true;
          if (event.shiftKey) extendSelection(index);
          else selectOnly(index);
          renderManual();
        });
        const extendDragSelection = event => {
          if (!isDraggingSelection || (event.buttons & 1) === 0) return;
          extendSelection(index);
          renderManual();
        };
        hit.addEventListener('pointerenter', extendDragSelection);
        hit.addEventListener('pointermove', extendDragSelection);
        board.appendChild(hit);
      }
    }
  }
  if (manualMode && selected.size) {
    const selectionColor = pencilMode ? '#7b3fc6' : '#d18a00';
    selected.forEach(index => {
      const row = rowOf(index);
      const col = colOf(index);
      const x = margin + col * cellSize;
      const y = margin + row * cellSize;
      const edges = [
        [-1, 0, x, y, x + cellSize, y],
        [0, 1, x + cellSize, y, x + cellSize, y + cellSize],
        [1, 0, x, y + cellSize, x + cellSize, y + cellSize],
        [0, -1, x, y, x, y + cellSize]
      ];
      edges.forEach(([deltaRow, deltaCol, x1, y1, x2, y2]) => {
        const neighbourRow = row + deltaRow;
        const neighbourCol = col + deltaCol;
        const neighbour = neighbourRow >= 0 && neighbourRow < SIZE && neighbourCol >= 0 && neighbourCol < SIZE
          ? cellIndex(neighbourRow, neighbourCol)
          : -1;
        if (selected.has(neighbour)) return;
        const border = document.createElementNS(svg, 'line');
        border.setAttribute('x1', x1); border.setAttribute('y1', y1); border.setAttribute('x2', x2); border.setAttribute('y2', y2);
        border.setAttribute('stroke', selectionColor); border.setAttribute('stroke-width', 3);
        border.style.pointerEvents = 'none';
        board.appendChild(border);
      });
    });
  }
  for (let position = 0; position <= SIZE; position += 1) {
    const horizontal = document.createElementNS(svg, 'line');
    horizontal.setAttribute('x1', margin); horizontal.setAttribute('x2', margin + cellSize * SIZE); horizontal.setAttribute('y1', margin + position * cellSize); horizontal.setAttribute('y2', margin + position * cellSize);
    horizontal.setAttribute('stroke', colors.grid); horizontal.setAttribute('stroke-width', position % BOX_HEIGHT === 0 ? 3 : 1); board.appendChild(horizontal);
    const vertical = document.createElementNS(svg, 'line');
    vertical.setAttribute('y1', margin); vertical.setAttribute('y2', margin + cellSize * SIZE); vertical.setAttribute('x1', margin + position * cellSize); vertical.setAttribute('x2', margin + position * cellSize);
    vertical.setAttribute('stroke', colors.grid); vertical.setAttribute('stroke-width', position % BOX_WIDTH === 0 ? 3 : 1); board.appendChild(vertical);
  }
  if (traceData.sandwich) {
    traceData.sandwich.rows.forEach((clue, row) => {
      if (clue === null) return;
      const label = document.createElementNS(svg, 'text');
      label.setAttribute('x', margin - 18); label.setAttribute('y', margin + row * cellSize + cellSize / 2 + 7); label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', 20); label.setAttribute('font-weight', '800'); label.setAttribute('fill', colors.value); label.textContent = clue; board.appendChild(label);
    });
    traceData.sandwich.cols.forEach((clue, col) => {
      if (clue === null) return;
      const label = document.createElementNS(svg, 'text');
      label.setAttribute('x', margin + col * cellSize + cellSize / 2); label.setAttribute('y', margin - 18); label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', 20); label.setAttribute('font-weight', '800'); label.setAttribute('fill', colors.value); label.textContent = clue; board.appendChild(label);
    });
  }
  if (traceData.diagonal) {
    [[0, 0, SIZE, SIZE], [SIZE, 0, 0, SIZE]].forEach(([x1, y1, x2, y2]) => {
      const line = document.createElementNS(svg, 'line');
      line.setAttribute('x1', margin + x1 * cellSize); line.setAttribute('y1', margin + y1 * cellSize);
      line.setAttribute('x2', margin + x2 * cellSize); line.setAttribute('y2', margin + y2 * cellSize);
      line.setAttribute('stroke', '#7c3aed'); line.setAttribute('stroke-width', 3); line.setAttribute('stroke-dasharray', '7 5'); line.setAttribute('opacity', '.7');
      board.appendChild(line);
    });
  }
  if (traceData.hyper) {
    [[1, 1], [1, 5], [5, 1], [5, 5]].forEach(([startRow, startCol]) => {
      const region = document.createElementNS(svg, 'rect');
      region.setAttribute('x', margin + startCol * cellSize + 2); region.setAttribute('y', margin + startRow * cellSize + 2);
      region.setAttribute('width', cellSize * 3 - 4); region.setAttribute('height', cellSize * 3 - 4);
      region.setAttribute('fill', '#14b8a6'); region.setAttribute('fill-opacity', '.07');
      region.setAttribute('stroke', '#0f766e'); region.setAttribute('stroke-width', 3); region.setAttribute('stroke-dasharray', '10 5');
      region.style.pointerEvents = 'none'; board.appendChild(region);
    });
  }
  (traceData.parityCells || []).forEach(marker => {
    const shape = document.createElementNS(svg, marker.parity ? 'circle' : 'rect');
    const centerX = margin + colOf(marker.index) * cellSize + cellSize / 2;
    const centerY = margin + rowOf(marker.index) * cellSize + cellSize / 2;
    if (marker.parity) {
      shape.setAttribute('cx', centerX); shape.setAttribute('cy', centerY); shape.setAttribute('r', 25);
    } else {
      shape.setAttribute('x', centerX - 24); shape.setAttribute('y', centerY - 24); shape.setAttribute('width', 48); shape.setAttribute('height', 48); shape.setAttribute('rx', 4);
    }
    shape.setAttribute('fill', 'none'); shape.setAttribute('stroke', '#db2777'); shape.setAttribute('stroke-width', 3); shape.setAttribute('opacity', '.55'); shape.style.pointerEvents = 'none'; board.appendChild(shape);
  });
  (traceData.palindromes || []).forEach(cells => {
    const line = document.createElementNS(svg, 'path');
    const points = cells.map(index => `${margin + colOf(index) * cellSize + cellSize / 2} ${margin + rowOf(index) * cellSize + cellSize / 2}`);
    line.setAttribute('d', `M ${points.join(' L ')}`); line.setAttribute('fill', 'none');
    line.setAttribute('stroke', '#64748b'); line.setAttribute('stroke-width', 9); line.setAttribute('stroke-linecap', 'round'); line.setAttribute('stroke-linejoin', 'round'); line.setAttribute('opacity', '.55');
    line.style.pointerEvents = 'none'; board.appendChild(line);
  });
  (traceData.arrows || []).forEach(arrow => {
    const cells = [arrow.bulb, ...arrow.path];
    const path = document.createElementNS(svg, 'path');
    const points = cells.map(index => `${margin + colOf(index) * cellSize + cellSize / 2} ${margin + rowOf(index) * cellSize + cellSize / 2}`);
    path.setAttribute('d', `M ${points.join(' L ')}`); path.setAttribute('fill', 'none'); path.setAttribute('stroke', '#2563eb'); path.setAttribute('stroke-width', 6); path.setAttribute('stroke-linecap', 'round'); path.setAttribute('opacity', '.55'); path.style.pointerEvents = 'none'; board.appendChild(path);
    const bulb = document.createElementNS(svg, 'circle');
    bulb.setAttribute('cx', margin + colOf(arrow.bulb) * cellSize + cellSize / 2); bulb.setAttribute('cy', margin + rowOf(arrow.bulb) * cellSize + cellSize / 2); bulb.setAttribute('r', 22); bulb.setAttribute('fill', 'none'); bulb.setAttribute('stroke', '#2563eb'); bulb.setAttribute('stroke-width', 5); bulb.setAttribute('opacity', '.7'); bulb.style.pointerEvents = 'none'; board.appendChild(bulb);
  });
  (traceData.whispers || []).forEach(cells => {
    const line = document.createElementNS(svg, 'path');
    const points = cells.map(index => `${margin + colOf(index) * cellSize + cellSize / 2} ${margin + rowOf(index) * cellSize + cellSize / 2}`);
    line.setAttribute('d', `M ${points.join(' L ')}`); line.setAttribute('fill', 'none'); line.setAttribute('stroke', '#16a34a'); line.setAttribute('stroke-width', 10); line.setAttribute('stroke-linecap', 'round'); line.setAttribute('stroke-linejoin', 'round'); line.setAttribute('opacity', '.5'); line.style.pointerEvents = 'none'; board.appendChild(line);
  });
  (traceData.renbans || []).forEach(cells => {
    const line = document.createElementNS(svg, 'path');
    const points = cells.map(index => `${margin + colOf(index) * cellSize + cellSize / 2} ${margin + rowOf(index) * cellSize + cellSize / 2}`);
    line.setAttribute('d', `M ${points.join(' L ')}`); line.setAttribute('fill', 'none'); line.setAttribute('stroke', '#9333ea'); line.setAttribute('stroke-width', 11); line.setAttribute('stroke-linecap', 'round'); line.setAttribute('stroke-linejoin', 'round'); line.setAttribute('opacity', '.45'); line.style.pointerEvents = 'none'; board.appendChild(line);
  });
  for (const [lines, color, dash] of [
    [traceData.entropicLines || [], '#f97316', ''],
    [traceData.modularLines || [], '#0891b2', '8 5']
  ]) {
    lines.forEach(cells => {
      const line = document.createElementNS(svg, 'path');
      const points = cells.map(index => `${margin + colOf(index) * cellSize + cellSize / 2} ${margin + rowOf(index) * cellSize + cellSize / 2}`);
      line.setAttribute('d', `M ${points.join(' L ')}`); line.setAttribute('fill', 'none'); line.setAttribute('stroke', color); line.setAttribute('stroke-width', 10);
      line.setAttribute('stroke-linecap', 'round'); line.setAttribute('stroke-linejoin', 'round'); line.setAttribute('opacity', '.5');
      if (dash) line.setAttribute('stroke-dasharray', dash);
      line.style.pointerEvents = 'none'; board.appendChild(line);
    });
  }
  const pairGroups = new Map();
  (traceData.pairs || []).forEach(pair => {
    const key = [Math.min(pair.a, pair.b), Math.max(pair.a, pair.b)].join(':');
    if (!pairGroups.has(key)) pairGroups.set(key, []);
    pairGroups.get(key).push(pair);
  });
  (traceData.pairs || []).forEach(pair => {
    const key = [Math.min(pair.a, pair.b), Math.max(pair.a, pair.b)].join(':');
    const group = pairGroups.get(key);
    const offset = (group.indexOf(pair) - (group.length - 1) / 2) * 17;
    const horizontal = rowOf(pair.a) === rowOf(pair.b);
    const x = margin + (colOf(pair.a) + colOf(pair.b) + 1) * cellSize / 2 + (horizontal ? 0 : offset);
    const y = margin + (rowOf(pair.a) + rowOf(pair.b) + 1) * cellSize / 2 + (horizontal ? offset : 0);
    const marker = document.createElementNS(svg, pair.type === 'xv' ? 'text' : 'circle');
    if (pair.type === 'xv') {
      marker.setAttribute('x', x); marker.setAttribute('y', y + 5); marker.setAttribute('text-anchor', 'middle'); marker.setAttribute('font-size', 17); marker.setAttribute('font-weight', '800'); marker.setAttribute('fill', '#155e75'); marker.textContent = pair.sum === 10 ? 'X' : 'V';
    } else {
      marker.setAttribute('cx', x); marker.setAttribute('cy', y); marker.setAttribute('r', pair.type === 'black' ? 7 : 6); marker.setAttribute('fill', pair.type === 'black' ? '#17243a' : '#fff'); marker.setAttribute('stroke', '#17243a'); marker.setAttribute('stroke-width', 2);
    }
    board.appendChild(marker);
  });
  (traceData.quadruples || []).forEach(quadruple => {
    const centerX = margin + quadruple.col * cellSize;
    const centerY = margin + quadruple.row * cellSize;
    const marker = document.createElementNS(svg, 'circle');
    marker.setAttribute('cx', centerX); marker.setAttribute('cy', centerY); marker.setAttribute('r', 17);
    marker.setAttribute('fill', colors.cell); marker.setAttribute('stroke', '#be123c'); marker.setAttribute('stroke-width', 2.5);
    marker.style.pointerEvents = 'none'; board.appendChild(marker);
    quadruple.digits.forEach((digit, position) => {
      const label = document.createElementNS(svg, 'text');
      label.setAttribute('x', centerX + (position % 2 ? 7 : -7));
      label.setAttribute('y', centerY + (position < 2 ? -2 : 11));
      label.setAttribute('text-anchor', 'middle'); label.setAttribute('font-size', 10); label.setAttribute('font-weight', '800');
      label.setAttribute('fill', '#be123c'); label.textContent = digit; label.style.pointerEvents = 'none'; board.appendChild(label);
    });
  });
  traceData.thermometers.forEach(thermometer => {
    thermometer.branches.forEach(branch => {
      const path = document.createElementNS(svg, 'path');
      const points = branch.map(index => `${margin + colOf(index) * cellSize + cellSize / 2} ${margin + rowOf(index) * cellSize + cellSize / 2}`);
      path.setAttribute('d', `M ${points.join(' L ')}`);
      path.setAttribute('fill', 'none'); path.setAttribute('stroke', '#7d7d7d'); path.setAttribute('stroke-width', 13); path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round'); path.setAttribute('opacity', '.42');
      board.appendChild(path);
    });
    const bulb = document.createElementNS(svg, 'circle');
    bulb.setAttribute('cx', margin + colOf(thermometer.bulb) * cellSize + cellSize / 2); bulb.setAttribute('cy', margin + rowOf(thermometer.bulb) * cellSize + cellSize / 2);
    bulb.setAttribute('r', 18); bulb.setAttribute('fill', '#7d7d7d'); bulb.setAttribute('opacity', '.42'); board.appendChild(bulb);
  });
  traceData.cages.forEach(cage => {
    const selected = manualMode && activeCell !== null && cage.cells.includes(activeCell);
    const inside = new Set(cage.cells);
    cage.cells.forEach(index => {
      const row = rowOf(index); const col = colOf(index); const x = margin + col * cellSize; const y = margin + row * cellSize;
      const edges = [
        [-1, 0, x + 5, y + 5, x + cellSize - 5, y + 5], [0, 1, x + cellSize - 5, y + 5, x + cellSize - 5, y + cellSize - 5],
        [1, 0, x + 5, y + cellSize - 5, x + cellSize - 5, y + cellSize - 5], [0, -1, x + 5, y + 5, x + 5, y + cellSize - 5]
      ];
      edges.forEach(([deltaRow, deltaCol, x1, y1, x2, y2]) => {
        const neighbour = row + deltaRow >= 0 && row + deltaRow < SIZE && col + deltaCol >= 0 && col + deltaCol < SIZE ? cellIndex(row + deltaRow, col + deltaCol) : -1;
        if (inside.has(neighbour)) return;
        const line = document.createElementNS(svg, 'line');
        line.setAttribute('x1', x1); line.setAttribute('y1', y1); line.setAttribute('x2', x2); line.setAttribute('y2', y2);
        line.setAttribute('stroke', selected ? (pencilMode ? '#7b3fc6' : '#d18a00') : '#1e5eff'); line.setAttribute('stroke-width', selected ? 4 : 2); line.setAttribute('stroke-dasharray', '6 4');
        board.appendChild(line);
      });
    });
    const anchor = cage.cells.slice().sort((left, right) => left - right)[0];
    const label = document.createElementNS(svg, 'text');
    label.setAttribute('x', margin + colOf(anchor) * cellSize + 8); label.setAttribute('y', margin + rowOf(anchor) * cellSize + 16);
    label.setAttribute('font-size', 13); label.setAttribute('font-family', 'Arial, sans-serif'); label.setAttribute('font-weight', '700');
    label.setAttribute('fill', selected ? (pencilMode ? '#7b3fc6' : '#d18a00') : '#74c7ff'); label.textContent = cage.sum; board.appendChild(label);
  });
}

function relatedCells(indexes) {
  const related = new Set();
  indexes.forEach(index => {
    related.add(index);
    peersForConstraints(index, traceData).forEach(peer => related.add(peer));
    traceData.cages.forEach(cage => { if (cage.cells.includes(index)) cage.cells.forEach(cell => related.add(cell)); });
    traceData.thermometers.forEach(thermometer => thermometer.branches.forEach(branch => {
      if (branch.includes(index)) branch.forEach(cell => related.add(cell));
    }));
    (traceData.palindromes || []).forEach(line => { if (line.includes(index)) line.forEach(cell => related.add(cell)); });
    (traceData.arrows || []).forEach(arrow => { const cells = [arrow.bulb, ...arrow.path]; if (cells.includes(index)) cells.forEach(cell => related.add(cell)); });
    (traceData.whispers || []).forEach(line => { if (line.includes(index)) line.forEach(cell => related.add(cell)); });
    (traceData.renbans || []).forEach(line => { if (line.includes(index)) line.forEach(cell => related.add(cell)); });
    (traceData.entropicLines || []).forEach(line => { if (line.includes(index)) line.forEach(cell => related.add(cell)); });
    (traceData.modularLines || []).forEach(line => { if (line.includes(index)) line.forEach(cell => related.add(cell)); });
    (traceData.quadruples || []).forEach(quadruple => { if (quadruple.cells.includes(index)) quadruple.cells.forEach(cell => related.add(cell)); });
    (traceData.pairs || []).forEach(pair => { if (pair.a === index) related.add(pair.b); if (pair.b === index) related.add(pair.a); });
  });
  return related;
}

function updateDirectCandidates(indexes) {
  relatedCells(indexes).forEach(index => {
    const cell = manualSnapshot.cells[index];
    if (cell.value) {
      cell.candidates = singleCandidate(cell.value);
      return;
    }
    const forbidden = new Set([...peersForConstraints(index, traceData)].map(peer => manualSnapshot.cells[peer].value).filter(Boolean));
    if (traceData.nonConsecutive) neighbours(index).forEach(peer => {
      const value = manualSnapshot.cells[peer].value;
      if (value > 1) forbidden.add(value - 1);
      if (value && value < SIZE) forbidden.add(value + 1);
    });
    traceData.cages.forEach(cage => {
      if (cage.cells.includes(index)) cage.cells.forEach(cellIndex => {
        const value = manualSnapshot.cells[cellIndex].value;
        if (value) forbidden.add(value);
      });
    });
    traceData.thermometers.forEach(thermometer => thermometer.branches.forEach(branch => {
      if (branch.includes(index)) branch.forEach(cellIndex => {
        const value = manualSnapshot.cells[cellIndex].value;
        if (value) forbidden.add(value);
      });
    }));
    cell.candidates = ALL_DIGITS.map(digit => !forbidden.has(digit));
    const parity = (traceData.parityCells || []).find(marker => marker.index === index);
    if (parity) cell.candidates = cell.candidates.map((candidate, digit) => candidate && ((digit + 1) % 2 === parity.parity));
    (traceData.palindromes || []).forEach(line => {
      const position = line.indexOf(index);
      if (position < 0) return;
      const peer = line[line.length - 1 - position];
      const value = manualSnapshot.cells[peer].value;
      if (value) cell.candidates = cell.candidates.map((candidate, digit) => candidate && digit + 1 === value);
    });
    (traceData.arrows || []).filter(arrow => arrow.bulb === index || arrow.path.includes(index)).forEach(arrow => {
      const support = arrowSupport(manualSnapshot, arrow);
      if (!support) { cell.candidates = Array(SIZE).fill(false); return; }
      const position = support.indexes.indexOf(index);
      cell.candidates = cell.candidates.map((candidate, digit) => candidate && support.supported[position][digit]);
    });
    (traceData.whispers || []).forEach(line => {
      const position = line.indexOf(index);
      if (position < 0) return;
      [position - 1, position + 1].filter(peerPosition => peerPosition >= 0 && peerPosition < line.length).forEach(peerPosition => {
        const value = manualSnapshot.cells[line[peerPosition]].value;
        if (value) cell.candidates = cell.candidates.map((candidate, digit) => candidate && Math.abs(digit + 1 - value) >= 5);
      });
    });
    (traceData.renbans || []).filter(line => line.includes(index)).forEach(line => {
      const support = renbanSupport(manualSnapshot, line);
      if (!support) { cell.candidates = Array(SIZE).fill(false); return; }
      const position = line.indexOf(index);
      cell.candidates = cell.candidates.map((candidate, digit) => candidate && support[position][digit]);
    });
    for (const [type, lines, categoryOf] of [
      ['entropic', traceData.entropicLines || [], digit => Math.floor((digit - 1) / 3)],
      ['modular', traceData.modularLines || [], digit => (digit - 1) % 3]
    ]) {
      lines.filter(line => line.includes(index)).forEach(line => {
        const support = memoizedSupport(type, scopeSignature(manualSnapshot, line), () => categoryLineSupport(manualSnapshot, line, categoryOf));
        if (!support) { cell.candidates = Array(SIZE).fill(false); return; }
        const position = line.indexOf(index);
        cell.candidates = cell.candidates.map((candidate, digit) => candidate && support[position][digit]);
      });
    }
    (traceData.quadruples || []).filter(quadruple => quadruple.cells.includes(index)).forEach(quadruple => {
      const support = memoizedSupport('quadruple', `${quadruple.digits.join(',')}|${scopeSignature(manualSnapshot, quadruple.cells)}`, () => quadrupleSupport(manualSnapshot, quadruple));
      if (!support) { cell.candidates = Array(SIZE).fill(false); return; }
      const position = quadruple.cells.indexOf(index);
      cell.candidates = cell.candidates.map((candidate, digit) => candidate && support[position][digit]);
    });
    if (traceData.sandwich) {
      const houses = [
        { house: ALL_DIGITS.map((_, col) => cellIndex(rowOf(index), col)), target: traceData.sandwich.rows[rowOf(index)] },
        { house: ALL_DIGITS.map((_, row) => cellIndex(row, colOf(index))), target: traceData.sandwich.cols[colOf(index)] }
      ].filter(entry => entry.target !== null && entry.target !== undefined);
      houses.forEach(({ house, target }) => {
        const support = sandwichHouseSupport(manualSnapshot, house, target);
        if (!support) { cell.candidates = Array(SIZE).fill(false); return; }
        const position = house.indexOf(index);
        cell.candidates = cell.candidates.map((candidate, digit) => candidate && support[position][digit]);
      });
    }
    (traceData.pairs || []).filter(pair => pair.a === index || pair.b === index).forEach(pair => {
      const peer = manualSnapshot.cells[pair.a === index ? pair.b : pair.a].value;
      if (!peer) return;
      cell.candidates = cell.candidates.map((candidate, position) => candidate && (pair.type === 'white' ? Math.abs(position + 1 - peer) === 1 : (pair.type === 'black' ? (position + 1 === peer * 2 || peer === (position + 1) * 2) : position + 1 + peer === pair.sum)));
    });
  });
}

function recalculateSudokuCandidates(changedIndexes = null) {
  if (!constraintCombinations.checked && Array.isArray(changedIndexes)) updateDirectCandidates(changedIndexes);
  else calculateCandidates(manualSnapshot, traceData);
  manualSnapshot.cells.forEach(cell => {
    if (!Array.isArray(cell.hiddenCandidates)) cell.hiddenCandidates = Array(SIZE).fill(false);
    if (cell.value) {
      cell.manualNotes = Array(SIZE).fill(false);
      cell.hiddenCandidates = Array(SIZE).fill(false);
    } else {
      cell.manualNotes = cell.manualNotes.map((note, index) => note && cell.candidates[index]);
      cell.hiddenCandidates = cell.hiddenCandidates.map((hidden, index) => hidden && cell.candidates[index]);
    }
  });
}

const GAME_REGISTRY = Object.freeze({
  sudoku: Object.freeze({
    label: 'Sudoku et variantes',
    generate: createSudokuTraceData,
    render: drawSudokuBoard,
    recalculateCandidates: recalculateSudokuCandidates
  })
});

function activeGame() {
  return GAME_REGISTRY[selectedGame];
}

function renderActiveGame(state) {
  activeGame().render(state);
}

function recalculateActiveCandidates(changedIndexes = null) {
  activeGame().recalculateCandidates(changedIndexes);
}

function updateHistoryButtons() {
  manualUndo.disabled = manualHistoryIndex <= 0;
  manualRedo.disabled = manualHistoryIndex >= manualHistory.length - 1;
}

function pushHistory() {
  manualHistory = manualHistory.slice(0, manualHistoryIndex + 1);
  manualHistory.push(clone(manualSnapshot));
  manualHistoryIndex = manualHistory.length - 1;
  updateHistoryButtons();
}

function restoreHistory(index) {
  if (index < 0 || index >= manualHistory.length) return;
  manualHistoryIndex = index;
  manualSnapshot = clone(manualHistory[index]);
  updateHistoryButtons();
  renderManual();
}

function applyDigit(digit) {
  if (!manualMode || selectedIndexes().size === 0) return;
  const indexes = [...selectedIndexes()];
  manualHint = null;
  if (pencilMode) {
    indexes.forEach(index => {
      const cell = manualSnapshot.cells[index];
      if (cell.isFixed || cell.value) return;
      if (autoCandidates.checked) cell.hiddenCandidates[digit - 1] = !cell.hiddenCandidates[digit - 1];
      else cell.manualNotes[digit - 1] = !cell.manualNotes[digit - 1];
    });
  } else {
    indexes.forEach(index => {
      const cell = manualSnapshot.cells[index];
      if (cell.isFixed) return;
      if (cell.value === digit) {
        cell.value = 0;
        cell.isUserEntered = false;
        cell.candidates = Array(SIZE).fill(true);
      } else {
        cell.value = digit;
        cell.isUserEntered = true;
        cell.candidates = singleCandidate(digit);
      }
      cell.manualNotes = Array(SIZE).fill(false);
      cell.hiddenCandidates = Array(SIZE).fill(false);
    });
    recalculateActiveCandidates(indexes);
  }
  window.GameEffects?.play(pencilMode ? 'click' : 'move');
  pushHistory();
  renderManual();
}

function clearActiveCell() {
  if (!manualMode || selectedIndexes().size === 0) return;
  manualHint = null;
  selectedIndexes().forEach(index => {
    const cell = manualSnapshot.cells[index];
    if (cell.isFixed) return;
    cell.value = 0;
    cell.isUserEntered = false;
    cell.candidates = Array(SIZE).fill(true);
    cell.manualNotes = Array(SIZE).fill(false);
    cell.hiddenCandidates = Array(SIZE).fill(false);
  });
  recalculateActiveCandidates([...selectedIndexes()]);
  pushHistory();
  renderManual();
}

function updateKeypadHighlight() {
  const selected = [...selectedIndexes()];
  const digits = new Set();
  if (selected.length === 1) {
    const cell = manualSnapshot.cells[selected[0]];
    if (pencilMode) cell.manualNotes.forEach((note, index) => { if (note) digits.add(index + 1); });
    else if (cell.value) digits.add(cell.value);
  }
  keypad.querySelectorAll('[data-digit]').forEach(button => button.classList.toggle('active-digit', digits.has(Number(button.dataset.digit))));
}

function showSudokuHint() {
  if (!manualMode) return;
  const candidateSource = cell => autoCandidates.checked
    ? cell.candidates.map((candidate, index) => candidate && !cell.hiddenCandidates[index])
    : cell.candidates;
  const index = manualSnapshot.cells.findIndex(cell => !cell.value && candidateSource(cell).filter(Boolean).length === 1);
  if (index === -1) {
    manualHint = null;
    renderManual();
    eventDetail.textContent = 'Aucune case à possibilité unique n’est disponible.';
    return;
  }
  const candidates = candidateSource(manualSnapshot.cells[index]);
  const digit = candidates.findIndex(Boolean) + 1;
  selectOnly(index);
  manualHint = { index, digit };
  renderManual();
  eventDetail.textContent = `Indice : r${rowOf(index) + 1}c${colOf(index) + 1} ne peut contenir que ${digit}.`;
  eventChanges.innerHTML = `<div>Indice violet : possibilité unique ${digit}.</div>`;
}

function renderManual() {
  stepLabel.textContent = pencilMode ? 'Possibilités' : 'Valeurs';
  eventTitle.textContent = 'Mode manuel';
  eventDetail.textContent = activeCell === null ? 'Cliquez une case, puis utilisez le clavier ou le pavé numérique.' : `Case sélectionnée : r${rowOf(activeCell) + 1}c${colOf(activeCell) + 1}.`;
  const cage = activeCell === null ? null : traceData.cages.find(item => item.cells.includes(activeCell));
  const thermometer = activeCell === null ? null : traceData.thermometers.find(item => item.branches.some(branch => branch.includes(activeCell)));
  const entropicLine = activeCell === null ? null : (traceData.entropicLines || []).find(line => line.includes(activeCell));
  const modularLine = activeCell === null ? null : (traceData.modularLines || []).find(line => line.includes(activeCell));
  const quadruple = activeCell === null ? null : (traceData.quadruples || []).find(item => item.cells.includes(activeCell));
  selectedCageInfo.textContent = cage
    ? `Cage sélectionnée : somme ${cage.sum}`
    : thermometer ? `Thermomètre sélectionné : ${thermometer.branches.length} branche${thermometer.branches.length > 1 ? 's' : ''}.`
      : entropicLine ? 'Ligne entropique sélectionnée.'
        : modularLine ? 'Ligne modulaire sélectionnée.'
          : quadruple ? `Quadruple sélectionné : ${quadruple.digits.join(', ')}.`
            : 'Aucune contrainte sélectionnée';
  const highlightedDigits = [...lockedHighlightDigits].sort((left, right) => left - right);
  errorCount.textContent = `Erreurs : ${errorCellIndexes(manualSnapshot).size}`;
  if (isSolved(manualSnapshot) && errorCellIndexes(manualSnapshot).size === 0) window.GameRecords?.finish({ won: true });
  eventChanges.innerHTML = `<div>${pencilMode ? 'Saisie de possibilités activée.' : 'Saisie de valeurs finales activée.'}</div><div>${capsLockActive ? `Verr. Maj. actif${highlightedDigits.length ? ` : ${highlightedDigits.join(', ')}` : ''}.` : 'Verr. Maj. inactif.'}</div>`;
  updateKeypadHighlight();
  renderActiveGame({ snapshot: manualSnapshot, removals: [], assignments: [] });
}

function renderTrace(step) {
  const state = currentState(step);
  stepLabel.textContent = `Étape ${step}/${traceData.steps.length}`;
  eventTitle.textContent = state.title;
  eventDetail.textContent = state.detail;
  selectedCageInfo.textContent = '';
  errorCount.textContent = 'Erreurs : 0';
  eventChanges.innerHTML = '';
  state.assignments.forEach(item => { eventChanges.innerHTML += `<div>Validation : r${rowOf(item.index) + 1}c${colOf(item.index) + 1} = ${item.value}</div>`; });
  state.removals.forEach(item => { eventChanges.innerHTML += `<div>Retrait : r${rowOf(item.index) + 1}c${colOf(item.index) + 1} − ${item.digit}</div>`; });
  if (!state.assignments.length && !state.removals.length) eventChanges.innerHTML = '<div>Aucune modification sur cette vue.</div>';
  updateKeypadHighlight();
  renderActiveGame(state);
}

function render() {
  if (manualMode) renderManual();
  else renderTrace(Number(stepSlider.value));
}

function buildKeypad() {
  keypad.innerHTML = '';
  ALL_DIGITS.forEach(digit => {
    const key = document.createElement('button');
    key.textContent = digit;
    key.dataset.digit = digit;
    key.addEventListener('click', () => applyDigit(digit));
    keypad.appendChild(key);
  });
  const erase = document.createElement('button');
  erase.textContent = 'Effacer'; erase.className = 'erase'; erase.addEventListener('click', clearActiveCell); keypad.appendChild(erase);
}

function loadPuzzle(type, difficultyName) {
  traceData = activeGame().generate(type, difficultyName);
  manualSnapshot = clone(traceData.initialSnapshot);
  autoCandidates.checked = false;
  showErrors.checked = true;
  constraintCombinations.checked = false;
  recalculateActiveCandidates();
  manualHistory = [clone(manualSnapshot)];
  manualHistoryIndex = 0;
  activeCell = null;
  selectedCells = new Set();
  selectionAnchor = null;
  manualHint = null;
  manualMode = true;
  manualToggle.textContent = 'Voir la trace';
  stepSlider.max = traceData.steps.length;
  stepSlider.value = 0;
  traceTitle.textContent = traceData.title;
  previousStep.disabled = true;
  nextStep.disabled = true;
  stepSlider.disabled = true;
  updateHistoryButtons();
  render();
}

function generate() {
  generateButton.disabled = true;
  randomVariantsButton.disabled = true;
  generationStatus.textContent = 'Génération et vérification de l’unicité en cours…';
  window.setTimeout(() => {
    const startedAt = performance.now();
    try {
      SUPPORT_CACHE.clear();
      loadPuzzle(selectedVariants, difficulty.value);
      const name = selectedVariants.size
        ? `Sudoku ${[...selectedVariants].sort().map(variant => VARIANT_DEFINITIONS[variant].label).join(' + ')}`
        : 'Sudoku classique';
      generationStatus.textContent = `Grille ${name} ${difficulty.value} générée en ${((performance.now() - startedAt) / 1000).toFixed(2)} s, solution unique vérifiée.`;
    } catch (error) {
      generationStatus.textContent = `Erreur : ${error.message}`;
    } finally {
      generateButton.disabled = false;
      randomVariantsButton.disabled = false;
    }
  }, 0);
}

function randomVariantCombination() {
  const structural = shuffled(['diagonal', 'knight', 'king', 'nonconsecutive', 'hyper', 'disjoint', 'palindrome']);
  const decorative = shuffled(VARIANT_KEYS.filter(variant => !structural.includes(variant)));
  const ranges = {
    facile: [2, 4],
    moyen: [3, 5],
    difficile: [4, 7],
    expert: [5, 8]
  };
  const [minimum, maximum] = ranges[difficulty.value] || ranges.moyen;
  const wanted = minimum + Math.floor(Math.random() * (maximum - minimum + 1));
  const structuralCount = Math.min(structural.length, Math.random() < 0.7 ? 1 : 2, wanted);
  return new Set([...structural.slice(0, structuralCount), ...decorative.slice(0, wanted - structuralCount)]);
}

function generateRandomVariants() {
  generateButton.disabled = true;
  randomVariantsButton.disabled = true;
  generationStatus.textContent = 'Recherche d’une combinaison compatible et vérification de son unicité…';
  window.setTimeout(() => {
    const startedAt = performance.now();
    let lastError = null;
    for (let attempt = 1; attempt <= 12; attempt += 1) {
      const combination = randomVariantCombination();
      try {
        SUPPORT_CACHE.clear();
        loadPuzzle(combination, difficulty.value);
        selectedVariants = combination;
        updateVariantChoice();
        const name = [...combination].sort().map(variant => VARIANT_DEFINITIONS[variant].label).join(' + ');
        generationStatus.textContent = `Combinaison compatible ${name} générée en ${((performance.now() - startedAt) / 1000).toFixed(2)} s, solution unique vérifiée.`;
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError) generationStatus.textContent = `Aucune combinaison validée après 12 essais : ${lastError.message}`;
    generateButton.disabled = false;
    randomVariantsButton.disabled = false;
  }, 0);
}

function updateVariantChoice() {
  typeSudoku.classList.toggle('selected', selectedVariants.size === 0);
  Object.entries(VARIANT_DEFINITIONS).forEach(([variant, definition]) => definition.button.classList.toggle('selected', selectedVariants.has(variant)));
  variantChoice.textContent = selectedVariants.size
    ? `Variantes cumulées : ${[...selectedVariants].sort().map(variant => VARIANT_DEFINITIONS[variant].choice).join(' + ')}.`
    : 'Sudoku classique.';
}

function sudokuDiagnosticSummary() {
  if (!traceData) return null;
  const finalSnapshot = traceData.steps[traceData.steps.length - 1]?.snapshot || traceData.initialSnapshot;
  return {
    variants: traceData.puzzleType,
    clueCount: traceData.initialSnapshot.cells.filter(cell => cell.value).length,
    stepCount: traceData.steps.length,
    solved: isSolved(finalSnapshot),
    unique: countSolutions(traceData.initialSnapshot, traceData, 2) === 1,
  };
}

window.SudokuTestAPI = Object.freeze({
  summary: sudokuDiagnosticSummary,
  variants: () => VARIANT_KEYS.slice(),
  countCurrentSolutions: () => traceData ? countSolutions(traceData.initialSnapshot, traceData, 2) : 0,
});

typeSudoku.addEventListener('click', () => {
  selectedVariants.clear();
  updateVariantChoice();
});
Object.entries(VARIANT_DEFINITIONS).forEach(([variant, definition]) => {
  definition.button.addEventListener('click', () => {
    if (selectedVariants.has(variant)) selectedVariants.delete(variant);
    else selectedVariants.add(variant);
    updateVariantChoice();
  });
});
generateButton.addEventListener('click', generate);
randomVariantsButton.addEventListener('click', generateRandomVariants);
stepSlider.addEventListener('input', render);
previousStep.addEventListener('click', () => { stepSlider.value = Math.max(0, Number(stepSlider.value) - 1); render(); });
nextStep.addEventListener('click', () => { stepSlider.value = Math.min(traceData.steps.length, Number(stepSlider.value) + 1); render(); });
manualToggle.addEventListener('click', () => {
  manualMode = !manualMode;
  activeCell = null;
  selectedCells = new Set();
  selectionAnchor = null;
  manualToggle.textContent = manualMode ? 'Voir la trace' : 'Mode manuel';
  previousStep.disabled = manualMode; nextStep.disabled = manualMode; stepSlider.disabled = manualMode;
  render();
});
entryToggle.addEventListener('click', () => {
  if (!manualMode) return;
  pencilMode = !pencilMode;
  entryToggle.textContent = pencilMode ? 'Entrer une possibilité' : 'Entrer une valeur';
  renderManual();
});
manualReset.addEventListener('click', () => {
  if (!manualMode) return;
  manualSnapshot = clone(traceData.initialSnapshot);
  recalculateActiveCandidates();
  manualHistory = [clone(manualSnapshot)]; manualHistoryIndex = 0; activeCell = null; selectedCells = new Set(); selectionAnchor = null; updateHistoryButtons(); renderManual();
});
manualUndo.addEventListener('click', () => restoreHistory(manualHistoryIndex - 1));
manualRedo.addEventListener('click', () => restoreHistory(manualHistoryIndex + 1));
hintButton.addEventListener('click', showSudokuHint);
autoCandidates.addEventListener('change', () => { if (manualMode) renderManual(); });
showErrors.addEventListener('change', () => { if (manualMode) renderManual(); });
constraintCombinations.addEventListener('change', () => { if (manualMode) { recalculateActiveCandidates(); renderManual(); } });
document.addEventListener('pointerup', () => { isDraggingSelection = false; });
document.addEventListener('pointercancel', () => { isDraggingSelection = false; });
document.addEventListener('keydown', event => {
  const reportedCapsLock = typeof event.getModifierState === 'function' && event.getModifierState('CapsLock');
  if (event.key === 'CapsLock') {
    capsLockActive = reportedCapsLock || !capsLockActive;
    if (manualMode) renderManual();
    return;
  }
  capsLockActive = reportedCapsLock || capsLockActive;
  if (!manualMode) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      stepSlider.value = Math.max(0, Math.min(traceData.steps.length, Number(stepSlider.value) + (event.key === 'ArrowLeft' ? -1 : 1)));
      render();
    }
    return;
  }
  if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'z' || event.key.toLowerCase() === 'y')) {
    event.preventDefault();
    restoreHistory(event.key.toLowerCase() === 'y' || event.shiftKey ? manualHistoryIndex + 1 : manualHistoryIndex - 1);
    return;
  }
  if (event.key === 'Tab') {
    event.preventDefault(); pencilMode = !pencilMode; entryToggle.textContent = pencilMode ? 'Entrer une possibilité' : 'Entrer une valeur'; renderManual(); return;
  }
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
    event.preventDefault();
    const current = activeCell === null ? 0 : activeCell;
    const deltas = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
    const [deltaRow, deltaCol] = deltas[event.key];
    const target = cellIndex(Math.max(0, Math.min(SIZE - 1, rowOf(current) + deltaRow)), Math.max(0, Math.min(SIZE - 1, colOf(current) + deltaCol)));
    if (event.shiftKey) extendSelection(target);
    else selectOnly(target);
    renderManual();
    return;
  }
  if ((event.code === 'Digit0' || event.key === '0') && capsLockActive) {
    event.preventDefault();
    lockedHighlightDigits.clear();
    renderManual();
    return;
  }
  if (event.key === 'Backspace' || event.key === 'Delete' || event.code === 'Digit0' || event.key === '0') {
    event.preventDefault(); clearActiveCell(); return;
  }
  const physical = /^Digit([1-9])$/.exec(event.code);
  const digit = physical ? Number(physical[1]) : (/^[1-9]$/.test(event.key) ? Number(event.key) : 0);
  if (digit && capsLockActive) {
    event.preventDefault();
    if (lockedHighlightDigits.has(digit)) lockedHighlightDigits.delete(digit);
    else lockedHighlightDigits.add(digit);
    renderManual();
    return;
  }
  if (digit) { event.preventDefault(); applyDigit(digit); }
});

buildKeypad();
updateVariantChoice();
localStorage.setItem('game-hub:last-game', 'sudoku');
generate();
