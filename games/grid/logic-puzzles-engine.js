(function () {
  'use strict';

  const metadata = {
    futoshiki: {
      title: 'Futoshiki',
      rules: 'Remplissez chaque ligne et chaque colonne avec les nombres de 1 à N, sans répétition. Entre deux cases, la pointe du signe désigne toujours la plus petite valeur.',
      legend: ['Les cases bleues sont imposées.', 'Les signes horizontaux et verticaux comparent leurs deux voisines.', 'Une solution est contrôlée uniquement avec ces contraintes.'],
      sizes: [4, 5, 6, 7]
    },
    kakuro: {
      title: 'Kakuro',
      rules: 'Chaque case noire indique la somme de la série blanche qui commence à sa droite et/ou sous elle. Dans une même série, utilisez des chiffres de 1 à 9 sans répétition.',
      legend: ['Le nombre en bas à gauche concerne la série vers la droite.', 'Le nombre en haut à droite concerne la série vers le bas.', 'Chaque série doit atteindre exactement sa somme.'],
      sizes: [5, 6, 7, 8]
    },
    hidato: {
      title: 'Hidato',
      rules: 'Placez tous les nombres de 1 à N². Deux nombres consécutifs doivent se toucher par un côté ou un coin.',
      legend: ['Chaque nombre apparaît une seule fois.', 'Les nombres bleus sont imposés.', 'Les diagonales comptent comme voisines.'],
      sizes: [4, 5, 6, 7]
    },
    hitori: {
      title: 'Hitori',
      rules: 'Noircissez des cases pour supprimer les répétitions dans chaque ligne et colonne. Deux cases noires ne se touchent jamais par un côté et toutes les cases claires restent connectées.',
      legend: ['Cliquez une case pour la noircir.', 'Les diagonales entre cases noires sont autorisées.', 'La validation contrôle les trois règles, pas une image mémorisée.'],
      sizes: [4, 5, 6, 7]
    },
    nurikabe: {
      title: 'Nurikabe',
      rules: 'Les cases claires forment des îles. Chaque île contient un seul indice et exactement autant de cases que cet indice. La mer forme une zone connectée sans carré 2 × 2.',
      legend: ['Cliquez pour alterner île et mer.', 'Deux îles distinctes ne se touchent pas.', 'Les cases indicées restent toujours dans leur île.'],
      sizes: [5, 6, 7]
    },
    akari: {
      title: 'Akari',
      rules: 'Placez des ampoules dans les cases blanches pour tout éclairer. Une ampoule éclaire en ligne droite jusqu’à un mur, mais aucune ampoule ne doit en voir une autre.',
      legend: ['Un mur chiffré exige ce nombre d’ampoules adjacentes.', 'Les murs bloquent la lumière.', 'Chaque case blanche doit être éclairée.'],
      sizes: [5, 6, 7]
    },
    slitherlink: {
      title: 'Slitherlink',
      rules: 'Sélectionnez des segments pour former une seule boucle fermée, sans branche ni croisement. Un indice donne le nombre de côtés sélectionnés autour de sa case.',
      legend: ['Chaque sommet utilisé possède exactement deux segments.', 'Tous les segments appartiennent à une seule boucle.', 'Une case sans chiffre n’impose aucun total.'],
      sizes: [3, 4, 5, 6]
    },
    numberlink: {
      title: 'Numberlink',
      rules: 'Reliez les deux extrémités de chaque couleur par un chemin orthogonal. Les chemins ne se croisent pas et remplissent toute la grille.',
      legend: ['Cliquez pour choisir la couleur d’une case.', 'Chaque couleur forme un chemin simple.', 'Les extrémités colorées sont imposées.'],
      sizes: [4, 5, 6, 7]
    }
  };

  const range = length => Array.from({ length }, (_, index) => index);
  const sum = values => values.reduce((total, value) => total + value, 0);
  const shuffle = (values, random) => {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1));
      [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
  };
  const neighbors4 = (index, size) => {
    const row = Math.floor(index / size);
    const col = index % size;
    return [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]
      .filter(([nextRow, nextCol]) => nextRow >= 0 && nextRow < size && nextCol >= 0 && nextCol < size)
      .map(([nextRow, nextCol]) => nextRow * size + nextCol);
  };
  const neighbors8 = (index, size) => {
    const row = Math.floor(index / size);
    const col = index % size;
    const result = [];
    for (let rowOffset = -1; rowOffset <= 1; rowOffset++) for (let colOffset = -1; colOffset <= 1; colOffset++) {
      if (!rowOffset && !colOffset) continue;
      const nextRow = row + rowOffset;
      const nextCol = col + colOffset;
      if (nextRow >= 0 && nextRow < size && nextCol >= 0 && nextCol < size) result.push(nextRow * size + nextCol);
    }
    return result;
  };
  const connected = (indexes, size) => {
    const allowed = new Set(indexes);
    if (!allowed.size) return false;
    const seen = new Set();
    const stack = [allowed.values().next().value];
    while (stack.length) {
      const index = stack.pop();
      if (seen.has(index)) continue;
      seen.add(index);
      neighbors4(index, size).forEach(neighbor => { if (allowed.has(neighbor) && !seen.has(neighbor)) stack.push(neighbor); });
    }
    return seen.size === allowed.size;
  };
  const transformedIndex = (index, size, turns, mirror) => {
    let row = Math.floor(index / size);
    let col = index % size;
    for (let turn = 0; turn < turns; turn++) [row, col] = [col, size - 1 - row];
    if (mirror) col = size - 1 - col;
    return row * size + col;
  };
  const transformArray = (values, size, turns, mirror) => {
    const result = Array(values.length);
    values.forEach((value, index) => { result[transformedIndex(index, size, turns, mirror)] = value; });
    return result;
  };

  function latinSolution(size, random) {
    const rows = shuffle(range(size), random);
    const cols = shuffle(range(size), random);
    const digits = shuffle(range(size).map(value => value + 1), random);
    return rows.flatMap(row => cols.map(col => digits[(row + col) % size]));
  }

  function validFutoshiki(puzzle, values, complete = false) {
    const { size, inequalities } = puzzle;
    for (let row = 0; row < size; row++) {
      const present = values.slice(row * size, row * size + size).filter(Boolean);
      if (new Set(present).size !== present.length) return false;
    }
    for (let col = 0; col < size; col++) {
      const present = range(size).map(row => values[row * size + col]).filter(Boolean);
      if (new Set(present).size !== present.length) return false;
    }
    for (const [left, right, sign] of inequalities) {
      const first = values[left];
      const second = values[right];
      if (first && second && (sign === '<' ? first >= second : first <= second)) return false;
    }
    return !complete || values.every(value => value >= 1 && value <= size);
  }

  function solveFutoshiki(puzzle, initial, limit = 1) {
    const values = initial.slice();
    const solutions = [];
    const search = () => {
      if (solutions.length >= limit) return;
      let best = -1;
      let choices = null;
      for (let index = 0; index < values.length; index++) if (!values[index]) {
        const allowed = [];
        for (let digit = 1; digit <= puzzle.size; digit++) {
          values[index] = digit;
          if (validFutoshiki(puzzle, values)) allowed.push(digit);
        }
        values[index] = 0;
        if (!allowed.length) return;
        if (!choices || allowed.length < choices.length) [best, choices] = [index, allowed];
      }
      if (best < 0) {
        if (validFutoshiki(puzzle, values, true)) solutions.push(values.slice());
        return;
      }
      for (const digit of choices) {
        values[best] = digit;
        search();
        values[best] = 0;
        if (solutions.length >= limit) return;
      }
    };
    search();
    return solutions;
  }

  function generateFutoshiki(size, difficulty, random) {
    const solution = latinSolution(size, random);
    const pairs = [];
    for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
      const index = row * size + col;
      if (col + 1 < size) pairs.push([index, index + 1]);
      if (row + 1 < size) pairs.push([index, index + size]);
    }
    const rates = { easy: 0.45, normal: 0.3, hard: 0.2, expert: 0.1 };
    const clueOrder = shuffle(range(solution.length), random);
    const inequalityOrder = shuffle(pairs, random);
    const givens = {};
    const inequalities = [];
    const targetGivens = Math.max(1, Math.round(solution.length * rates[difficulty]));
    clueOrder.slice(0, targetGivens).forEach(index => { givens[index] = solution[index]; });
    inequalityOrder.slice(0, Math.max(size, Math.round(solution.length * (0.58 - rates[difficulty] / 2)))).forEach(([left, right]) => {
      inequalities.push([left, right, solution[left] < solution[right] ? '<' : '>']);
    });
    const puzzle = { ...metadata.futoshiki, mode: 'futoshiki', size, solution, givens, inequalities };
    let cursor = targetGivens;
    let inequalityCursor = inequalities.length;
    while (solveFutoshiki(puzzle, valuesWithGivens(puzzle), 2).length !== 1 && (cursor < clueOrder.length || inequalityCursor < inequalityOrder.length)) {
      if (inequalityCursor < inequalityOrder.length && (difficulty !== 'easy' || random() < 0.65)) {
        const [left, right] = inequalityOrder[inequalityCursor++];
        inequalities.push([left, right, solution[left] < solution[right] ? '<' : '>']);
      } else if (cursor < clueOrder.length) {
        const index = clueOrder[cursor++];
        givens[index] = solution[index];
      }
    }
    return puzzle;
  }

  function valuesWithGivens(puzzle) {
    const values = Array(puzzle.solution.length).fill(0);
    Object.entries(puzzle.givens || {}).forEach(([index, value]) => { values[index] = value; });
    return values;
  }

  function kakuroRuns(mask, size) {
    const runs = [];
    const addRun = (direction, cells, clueIndex) => {
      if (cells.length >= 2) runs.push({ direction, cells, clueIndex, sum: 0 });
    };
    for (let row = 0; row < size; row++) {
      let col = 0;
      while (col < size) {
        if (!mask[row * size + col]) { col++; continue; }
        const start = col;
        const cells = [];
        while (col < size && mask[row * size + col]) cells.push(row * size + col++);
        addRun('right', cells, row * size + start - 1);
      }
    }
    for (let col = 0; col < size; col++) {
      let row = 0;
      while (row < size) {
        if (!mask[row * size + col]) { row++; continue; }
        const start = row;
        const cells = [];
        while (row < size && mask[row * size + col]) cells.push(row++ * size + col);
        addRun('down', cells, (start - 1) * size + col);
      }
    }
    return runs;
  }

  function validKakuro(puzzle, values, complete = false) {
    for (const run of puzzle.runs) {
      const present = run.cells.map(index => values[index]).filter(Boolean);
      if (new Set(present).size !== present.length || sum(present) > run.sum) return false;
      if (present.length === run.cells.length && sum(present) !== run.sum) return false;
      if (complete && present.length !== run.cells.length) return false;
    }
    return true;
  }

  function solveKakuro(puzzle, initial, limit = 1) {
    const values = initial.slice();
    const white = puzzle.mask.map((isWhite, index) => isWhite ? index : -1).filter(index => index >= 0);
    const runsByCell = new Map(white.map(index => [index, puzzle.runs.filter(run => run.cells.includes(index))]));
    const solutions = [];
    const search = () => {
      if (solutions.length >= limit) return;
      let best = -1;
      let choices = null;
      for (const index of white) if (!values[index]) {
        const allowed = [];
        for (let digit = 1; digit <= 9; digit++) {
          values[index] = digit;
          if (runsByCell.get(index).every(run => {
            const present = run.cells.map(cell => values[cell]).filter(Boolean);
            return new Set(present).size === present.length && sum(present) <= run.sum && (present.length < run.cells.length || sum(present) === run.sum);
          })) allowed.push(digit);
        }
        values[index] = 0;
        if (!allowed.length) return;
        if (!choices || allowed.length < choices.length) [best, choices] = [index, allowed];
      }
      if (best < 0) {
        if (validKakuro(puzzle, values, true)) solutions.push(values.slice());
        return;
      }
      for (const digit of choices) {
        values[best] = digit;
        search();
        values[best] = 0;
        if (solutions.length >= limit) return;
      }
    };
    search();
    return solutions;
  }

  function generateKakuro(size, difficulty, random) {
    const mask = range(size * size).map(index => Math.floor(index / size) > 0 && index % size > 0);
    const validMask = candidate => {
      const candidateRuns = kakuroRuns(candidate, size);
      return candidate.every((white, index) => !white || candidateRuns.filter(run => run.cells.includes(index)).length === 2);
    };
    const removable = shuffle(range(size * size).filter(index => Math.floor(index / size) > 1 && index % size > 1), random);
    const blackTargets = { easy: 0.05, normal: 0.1, hard: 0.16, expert: 0.22 };
    const target = Math.round((size - 1) ** 2 * blackTargets[difficulty]);
    let removed = 0;
    for (const index of removable) {
      if (removed >= target) break;
      mask[index] = false;
      if (validMask(mask)) removed++;
      else mask[index] = true;
    }
    const runs = kakuroRuns(mask, size);
    const offset = Math.floor(random() * 9);
    const solution = range(size * size).map(index => mask[index] ? ((Math.floor(index / size) + index % size + offset) % 9) + 1 : 0);
    const white = mask.map((value, index) => value ? index : -1).filter(index => index >= 0);
    runs.forEach(run => { run.sum = sum(run.cells.map(index => solution[index])); });
    const givens = {};
    const puzzle = { ...metadata.kakuro, mode: 'kakuro', size, mask, runs, solution, givens };
    const order = shuffle(white, random);
    let cursor = 0;
    while (solveKakuro(puzzle, valuesWithGivens(puzzle), 2).length !== 1 && cursor < order.length) {
      const index = order[cursor++];
      givens[index] = solution[index];
    }
    return puzzle;
  }

  function generateHidato(size, difficulty, random) {
    let path = [];
    for (let attempt = 0; attempt < 24 && path.length !== size * size; attempt++) {
      const used = new Set();
      const candidatePath = [Math.floor(random() * size * size)];
      used.add(candidatePath[0]);
      let operations = 0;
      const search = () => {
        if (++operations > 180000) return false;
        if (candidatePath.length === size * size) return true;
        const current = candidatePath.at(-1);
        const candidates = neighbors8(current, size).filter(index => !used.has(index)).map(index => ({
          index,
          onward: neighbors8(index, size).filter(neighbor => !used.has(neighbor)).length,
          tie: random()
        })).sort((left, right) => left.onward - right.onward || left.tie - right.tie);
        for (const candidate of candidates) {
          used.add(candidate.index);
          candidatePath.push(candidate.index);
          if (search()) return true;
          candidatePath.pop();
          used.delete(candidate.index);
        }
        return false;
      };
      if (search()) path = candidatePath;
    }
    if (!path.length) for (let row = 0; row < size; row++) (row % 2 ? range(size).reverse() : range(size)).forEach(col => path.push(row * size + col));
    const solution = Array(size * size);
    path.forEach((index, step) => { solution[index] = step + 1; });
    const rates = { easy: 0.38, normal: 0.27, hard: 0.18, expert: 0.11 };
    const givens = {};
    const positions = Array(solution.length);
    solution.forEach((value, index) => { positions[value - 1] = index; });
    const count = Math.max(4, Math.round(solution.length * rates[difficulty]));
    const selected = new Set([positions[0], positions[positions.length - 1], ...shuffle(range(solution.length), random).slice(0, count)]);
    const maximumGap = { easy: 3, normal: 5, hard: 8, expert: Infinity }[difficulty];
    if (Number.isFinite(maximumGap)) {
      for (let value = 1; value <= solution.length; value += maximumGap) selected.add(positions[value - 1]);
    }
    selected.forEach(index => { givens[index] = solution[index]; });
    const puzzle = { ...metadata.hidato, mode: 'hidato', size, solution, givens };
    const remaining = shuffle(range(solution.length).filter(index => givens[index] === undefined), random);
    let cursor = 0;
    while (solveHidato(puzzle, valuesWithGivens(puzzle), 2).length !== 1 && cursor < remaining.length) {
      const index = remaining[cursor++];
      givens[index] = solution[index];
    }
    return puzzle;
  }

  function validHidato(puzzle, values, complete = false) {
    const present = values.filter(Boolean);
    if (new Set(present).size !== present.length || present.some(value => value < 1 || value > values.length)) return false;
    const positions = new Map();
    values.forEach((value, index) => { if (value) positions.set(value, index); });
    for (let value = 1; value < values.length; value++) if (positions.has(value) && positions.has(value + 1) && !neighbors8(positions.get(value), puzzle.size).includes(positions.get(value + 1))) return false;
    return !complete || values.every(Boolean);
  }

  function solveHidato(puzzle, initial, limit = 1) {
    const values = initial.slice();
    const fixedPosition = new Map();
    values.forEach((value, index) => { if (value) fixedPosition.set(value, index); });
    const used = new Set(values.filter(Boolean));
    const solutions = [];
    const positions = Array(values.length + 1).fill(-1);
    values.forEach((value, index) => { if (value) positions[value] = index; });
    const search = value => {
      if (solutions.length >= limit) return;
      if (value > values.length) {
        if (validHidato(puzzle, values, true)) solutions.push(values.slice());
        return;
      }
      if (positions[value] >= 0) {
        if (value === 1 || positions[value - 1] < 0 || neighbors8(positions[value - 1], puzzle.size).includes(positions[value])) search(value + 1);
        return;
      }
      const candidates = value === 1 ? range(values.length).filter(index => !values[index]) : neighbors8(positions[value - 1], puzzle.size).filter(index => !values[index]);
      for (const index of candidates) {
        if (fixedPosition.has(value + 1) && !neighbors8(index, puzzle.size).includes(fixedPosition.get(value + 1))) continue;
        values[index] = value;
        positions[value] = index;
        used.add(value);
        search(value + 1);
        used.delete(value);
        positions[value] = -1;
        values[index] = 0;
      }
    };
    search(1);
    return solutions;
  }

  function generateHitori(size, difficulty, random) {
    let fallback;
    for (let attempt = 0; attempt < 80; attempt++) {
      const values = latinSolution(size, random);
      const solution = Array(size * size).fill(0);
      const candidates = shuffle(range(size * size), random);
      const rates = { easy: 0.13, normal: 0.18, hard: 0.22, expert: 0.25 };
      const target = Math.max(2, Math.round(size * size * rates[difficulty]));
      for (const index of candidates) {
        if (sum(solution) >= target || neighbors4(index, size).some(neighbor => solution[neighbor])) continue;
        const row = Math.floor(index / size);
        const col = index % size;
        const otherCol = (col + 1 + Math.floor(random() * (size - 1))) % size;
        values[index] = values[row * size + otherCol];
        solution[index] = 1;
      }
      const puzzle = { ...metadata.hitori, mode: 'hitori', size, values, solution };
      fallback = puzzle;
      if (validHitori(puzzle, solution, true) && solveHitori(puzzle, Array(solution.length).fill(0), 2).length === 1) return puzzle;
    }
    return fallback;
  }

  function validHitori(puzzle, marked, complete = true) {
    const { size, values } = puzzle;
    for (let index = 0; index < marked.length; index++) if (marked[index] && neighbors4(index, size).some(neighbor => marked[neighbor])) return false;
    for (let row = 0; row < size; row++) {
      const visible = range(size).map(col => row * size + col).filter(index => !marked[index]).map(index => values[index]);
      if (new Set(visible).size !== visible.length) return false;
    }
    for (let col = 0; col < size; col++) {
      const visible = range(size).map(row => row * size + col).filter(index => !marked[index]).map(index => values[index]);
      if (new Set(visible).size !== visible.length) return false;
    }
    return !complete || connected(range(marked.length).filter(index => !marked[index]), size);
  }

  function solveHitori(puzzle, initial, limit = 1) {
    const marked = initial.slice();
    const candidates = range(marked.length).filter(index => {
      const row = Math.floor(index / puzzle.size);
      const col = index % puzzle.size;
      return range(puzzle.size).some(other => other !== col && puzzle.values[row * puzzle.size + other] === puzzle.values[index]) || range(puzzle.size).some(other => other !== row && puzzle.values[other * puzzle.size + col] === puzzle.values[index]);
    }).filter(index => !marked[index]);
    const solutions = [];
    const search = position => {
      if (solutions.length >= limit) return;
      if (position === candidates.length) {
        if (validHitori(puzzle, marked, true)) solutions.push(marked.slice());
        return;
      }
      const index = candidates[position];
      search(position + 1);
      if (!neighbors4(index, puzzle.size).some(neighbor => marked[neighbor])) {
        marked[index] = 1;
        search(position + 1);
        marked[index] = 0;
      }
    };
    search(0);
    return solutions;
  }

  function validNurikabe(puzzle, marked, complete = true) {
    const sea = range(marked.length).filter(index => marked[index]);
    if (complete && !connected(sea, puzzle.size)) return false;
    for (let row = 0; row < puzzle.size - 1; row++) for (let col = 0; col < puzzle.size - 1; col++) {
      const square = [row * puzzle.size + col, row * puzzle.size + col + 1, (row + 1) * puzzle.size + col, (row + 1) * puzzle.size + col + 1];
      if (square.every(index => marked[index])) return false;
    }
    if (!complete) return true;
    const land = new Set(range(marked.length).filter(index => !marked[index]));
    while (land.size) {
      const start = land.values().next().value;
      const component = [];
      const stack = [start];
      while (stack.length) {
        const index = stack.pop();
        if (!land.delete(index)) continue;
        component.push(index);
        neighbors4(index, puzzle.size).forEach(neighbor => { if (land.has(neighbor)) stack.push(neighbor); });
      }
      const clues = component.filter(index => puzzle.clues[index] !== undefined);
      if (clues.length !== 1 || puzzle.clues[clues[0]] !== component.length) return false;
    }
    return true;
  }

  function generateNurikabe(size, difficulty, random) {
    for (let attempt = 0; attempt < 500; attempt++) {
      const marked = range(size * size).map(() => random() < ({ easy: 0.54, normal: 0.58, hard: 0.61, expert: 0.63 }[difficulty]) ? 1 : 0);
      marked[Math.floor(random() * marked.length)] = 0;
      if (!validNurikabe({ size, clues: {} }, marked, false) || !connected(range(marked.length).filter(index => marked[index]), size)) continue;
      const land = new Set(range(marked.length).filter(index => !marked[index]));
      const clues = {};
      let acceptable = true;
      while (land.size) {
        const start = land.values().next().value;
        const component = [];
        const stack = [start];
        while (stack.length) {
          const index = stack.pop();
          if (!land.delete(index)) continue;
          component.push(index);
          neighbors4(index, size).forEach(neighbor => { if (land.has(neighbor)) stack.push(neighbor); });
        }
        if (component.length > Math.max(6, size)) { acceptable = false; break; }
        const clue = component[Math.floor(random() * component.length)];
        clues[clue] = component.length;
      }
      const puzzle = { ...metadata.nurikabe, mode: 'nurikabe', size, clues, solution: marked };
      if (acceptable && validNurikabe(puzzle, marked, true)) return puzzle;
    }
    const marked = range(size * size).map(index => (Math.floor(index / size) % 2 || index % size) ? 1 : 0);
    const clues = {};
    marked.forEach((value, index) => { if (!value) clues[index] = 1; });
    return { ...metadata.nurikabe, mode: 'nurikabe', size, clues, solution: marked };
  }

  function solveNurikabe(puzzle, initial, limit = 1) {
    const states = initial.map(value => value ? 1 : -1);
    Object.keys(puzzle.clues).forEach(index => { states[Number(index)] = 0; });
    const solutions = [];
    const partialValid = () => {
      for (let row = 0; row < puzzle.size - 1; row++) for (let col = 0; col < puzzle.size - 1; col++) {
        const square = [row * puzzle.size + col, row * puzzle.size + col + 1, (row + 1) * puzzle.size + col, (row + 1) * puzzle.size + col + 1];
        if (square.every(index => states[index] === 1)) return false;
      }
      const seen = new Set();
      for (let start = 0; start < states.length; start++) {
        if (states[start] !== 0 || seen.has(start)) continue;
        const component = [];
        const stack = [start];
        while (stack.length) {
          const index = stack.pop();
          if (seen.has(index) || states[index] !== 0) continue;
          seen.add(index);
          component.push(index);
          neighbors4(index, puzzle.size).forEach(neighbor => stack.push(neighbor));
        }
        const clues = component.filter(index => puzzle.clues[index] !== undefined);
        if (clues.length > 1) return false;
        if (clues.length && component.length > puzzle.clues[clues[0]]) return false;
      }
      for (const [clueText, target] of Object.entries(puzzle.clues)) {
        const clue = Number(clueText);
        const reachable = new Set();
        const stack = [clue];
        while (stack.length) {
          const index = stack.pop();
          if (reachable.has(index) || states[index] === 1) continue;
          reachable.add(index);
          neighbors4(index, puzzle.size).forEach(neighbor => {
            if (puzzle.clues[neighbor] === undefined || neighbor === clue) stack.push(neighbor);
          });
        }
        if (reachable.size < target) return false;
      }
      return true;
    };
    const search = () => {
      if (solutions.length >= limit || !partialValid()) return;
      let index = -1;
      let bestWeight = -1;
      for (let candidate = 0; candidate < states.length; candidate++) if (states[candidate] < 0) {
        const weight = neighbors4(candidate, puzzle.size).filter(neighbor => states[neighbor] >= 0 || puzzle.clues[neighbor] !== undefined).length;
        if (weight > bestWeight) [index, bestWeight] = [candidate, weight];
      }
      if (index < 0) {
        const marked = states.map(value => value === 1 ? 1 : 0);
        if (validNurikabe(puzzle, marked, true)) solutions.push(marked);
        return;
      }
      for (const value of [1, 0]) {
        states[index] = value;
        search();
        states[index] = -1;
      }
    };
    search();
    return solutions;
  }

  function visibleCells(index, puzzle) {
    const result = [index];
    const row = Math.floor(index / puzzle.size);
    const col = index % puzzle.size;
    for (const [rowStep, colStep] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      let nextRow = row + rowStep;
      let nextCol = col + colStep;
      while (nextRow >= 0 && nextRow < puzzle.size && nextCol >= 0 && nextCol < puzzle.size) {
        const next = nextRow * puzzle.size + nextCol;
        if (puzzle.walls[next] !== undefined) break;
        result.push(next);
        nextRow += rowStep;
        nextCol += colStep;
      }
    }
    return result;
  }

  function validAkari(puzzle, bulbs, complete = true) {
    const bulbIndexes = range(bulbs.length).filter(index => bulbs[index]);
    if (bulbIndexes.some(index => puzzle.walls[index] !== undefined || visibleCells(index, puzzle).some(other => other !== index && bulbs[other]))) return false;
    for (const [indexText, clue] of Object.entries(puzzle.walls)) if (clue !== null) {
      const adjacent = neighbors4(Number(indexText), puzzle.size).filter(index => bulbs[index]).length;
      if (adjacent > clue || (complete && adjacent !== clue)) return false;
    }
    if (complete) for (let index = 0; index < bulbs.length; index++) {
      if (puzzle.walls[index] !== undefined) continue;
      if (!visibleCells(index, puzzle).some(other => bulbs[other])) return false;
    }
    return true;
  }

  function solveAkari(puzzle, initial, limit = 1) {
    const bulbs = initial.slice();
    const cells = range(bulbs.length).filter(index => puzzle.walls[index] === undefined && !bulbs[index]);
    const solutions = [];
    const search = position => {
      if (solutions.length >= limit || !validAkari(puzzle, bulbs, false)) return;
      const dark = cells.find(index => !visibleCells(index, puzzle).some(other => bulbs[other]));
      if (dark === undefined) {
        if (validAkari(puzzle, bulbs, true)) solutions.push(bulbs.slice());
        return;
      }
      const candidates = visibleCells(dark, puzzle).filter(index => !bulbs[index] && !visibleCells(index, puzzle).some(other => bulbs[other]));
      for (const index of candidates) {
        bulbs[index] = 1;
        search(position + 1);
        bulbs[index] = 0;
      }
    };
    search(0);
    return solutions;
  }

  function generateAkari(size, difficulty, random) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const walls = {};
      range(size * size).forEach(index => { if (random() < 0.2) walls[index] = null; });
      const puzzle = { ...metadata.akari, mode: 'akari', size, walls, solution: Array(size * size).fill(0) };
      const solutions = solveAkari(puzzle, Array(size * size).fill(0), 1);
      if (!solutions.length) continue;
      puzzle.solution = solutions[0];
      const numberRate = { easy: 0.85, normal: 0.65, hard: 0.45, expert: 0.3 }[difficulty];
      Object.keys(walls).forEach(indexText => {
        const index = Number(indexText);
        if (random() < numberRate) walls[index] = neighbors4(index, size).filter(neighbor => puzzle.solution[neighbor]).length;
      });
      const verified = solveAkari(puzzle, Array(size * size).fill(0), 2);
      if (verified.length === 1) {
        puzzle.solution = verified[0];
        return puzzle;
      }
    }
    const walls = {};
    for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) if ((row + col) % 4 === 2) walls[row * size + col] = null;
    const puzzle = { ...metadata.akari, mode: 'akari', size, walls, solution: Array(size * size).fill(0) };
    puzzle.solution = solveAkari(puzzle, puzzle.solution, 1)[0] || puzzle.solution;
    Object.keys(walls).forEach(indexText => { walls[indexText] = neighbors4(Number(indexText), size).filter(index => puzzle.solution[index]).length; });
    return puzzle;
  }

  const edgeId = (orientation, row, col, size) => orientation === 'h' ? `h${row * size + col}` : `v${row * (size + 1) + col}`;
  function edgeVertices(id, size) {
    const orientation = id[0];
    const number = Number(id.slice(1));
    if (orientation === 'h') {
      const row = Math.floor(number / size);
      const col = number % size;
      return [row * (size + 1) + col, row * (size + 1) + col + 1];
    }
    const row = Math.floor(number / (size + 1));
    const col = number % (size + 1);
    return [row * (size + 1) + col, (row + 1) * (size + 1) + col];
  }
  function cellEdges(index, size) {
    const row = Math.floor(index / size);
    const col = index % size;
    return [edgeId('h', row, col, size), edgeId('h', row + 1, col, size), edgeId('v', row, col, size), edgeId('v', row, col + 1, size)];
  }
  function allEdges(size) {
    const result = [];
    for (let row = 0; row <= size; row++) for (let col = 0; col < size; col++) result.push(edgeId('h', row, col, size));
    for (let row = 0; row < size; row++) for (let col = 0; col <= size; col++) result.push(edgeId('v', row, col, size));
    return result;
  }
  function validSlitherlink(puzzle, selected, complete = true) {
    const edges = selected instanceof Set ? selected : new Set(selected);
    for (let index = 0; index < puzzle.clues.length; index++) if (puzzle.clues[index] !== null) {
      const count = cellEdges(index, puzzle.size).filter(edge => edges.has(edge)).length;
      if (count > puzzle.clues[index] || (complete && count !== puzzle.clues[index])) return false;
    }
    const adjacency = new Map();
    edges.forEach(edge => {
      const [first, second] = edgeVertices(edge, puzzle.size);
      if (!adjacency.has(first)) adjacency.set(first, []);
      if (!adjacency.has(second)) adjacency.set(second, []);
      adjacency.get(first).push(second);
      adjacency.get(second).push(first);
    });
    if ([...adjacency.values()].some(list => list.length > 2 || (complete && list.length !== 2))) return false;
    if (!complete) return true;
    if (!edges.size) return false;
    const start = adjacency.keys().next().value;
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length) adjacency.get(stack.pop()).forEach(vertex => { if (!seen.has(vertex)) { seen.add(vertex); stack.push(vertex); } });
    return seen.size === adjacency.size;
  }

  function generateSlitherlink(size, difficulty, random) {
    const insetTop = random() < 0.5 ? 0 : 1;
    const insetLeft = random() < 0.5 ? 0 : 1;
    const insetBottom = random() < 0.5 ? 0 : 1;
    const insetRight = random() < 0.5 ? 0 : 1;
    const top = Math.min(insetTop, size - 2);
    const left = Math.min(insetLeft, size - 2);
    const bottom = Math.max(top + 2, size - insetBottom);
    const right = Math.max(left + 2, size - insetRight);
    const solution = new Set();
    for (let col = left; col < right; col++) {
      solution.add(edgeId('h', top, col, size));
      solution.add(edgeId('h', bottom, col, size));
    }
    for (let row = top; row < bottom; row++) {
      solution.add(edgeId('v', row, left, size));
      solution.add(edgeId('v', row, right, size));
    }
    const rates = { easy: 0.9, normal: 0.72, hard: 0.58, expert: 0.45 };
    const clues = range(size * size).map(index => random() < rates[difficulty] ? cellEdges(index, size).filter(edge => solution.has(edge)).length : null);
    return { ...metadata.slitherlink, mode: 'slitherlink', size, clues, solution: [...solution] };
  }

  function solveSlitherlink(puzzle, initial, limit = 1) {
    const edges = allEdges(puzzle.size);
    const state = new Map(edges.map(edge => [edge, initial.includes(edge) ? 1 : -1]));
    const solutions = [];
    const incident = new Map();
    edges.forEach(edge => edgeVertices(edge, puzzle.size).forEach(vertex => {
      if (!incident.has(vertex)) incident.set(vertex, []);
      incident.get(vertex).push(edge);
    }));
    const propagate = () => {
      let changed = true;
      while (changed) {
        changed = false;
        for (let index = 0; index < puzzle.clues.length; index++) {
          const clue = puzzle.clues[index];
          if (clue === null) continue;
          const around = cellEdges(index, puzzle.size);
          const on = around.filter(edge => state.get(edge) === 1).length;
          const unknown = around.filter(edge => state.get(edge) < 0);
          if (on > clue || on + unknown.length < clue) return false;
          if (on === clue) unknown.forEach(edge => { state.set(edge, 0); changed = true; });
          else if (on + unknown.length === clue) unknown.forEach(edge => { state.set(edge, 1); changed = true; });
        }
        for (const around of incident.values()) {
          const on = around.filter(edge => state.get(edge) === 1).length;
          const unknown = around.filter(edge => state.get(edge) < 0);
          if (on > 2 || (on === 1 && !unknown.length)) return false;
          if (on === 2) unknown.forEach(edge => { state.set(edge, 0); changed = true; });
          else if (on === 1 && unknown.length === 1) { state.set(unknown[0], 1); changed = true; }
          else if (on === 0 && unknown.length === 1) { state.set(unknown[0], 0); changed = true; }
        }
      }
      return true;
    };
    const search = () => {
      if (solutions.length >= limit) return;
      const snapshot = new Map(state);
      if (!propagate()) { state.clear(); snapshot.forEach((value, edge) => state.set(edge, value)); return; }
      const undecided = edges.find(edge => state.get(edge) < 0);
      if (!undecided) {
        const selected = edges.filter(edge => state.get(edge) === 1);
        if (validSlitherlink(puzzle, selected, true)) solutions.push(selected);
      } else {
        const branchSnapshot = new Map(state);
        for (const value of [1, 0]) {
          state.set(undecided, value);
          search();
          state.clear();
          branchSnapshot.forEach((saved, edge) => state.set(edge, saved));
          if (solutions.length >= limit) break;
        }
      }
      state.clear();
      snapshot.forEach((value, edge) => state.set(edge, value));
    };
    search();
    return solutions;
  }

  function generateNumberlink(size, difficulty, random) {
    const colors = size;
    let solution = Array(size * size).fill(0);
    const endpoints = {};
    for (let row = 0; row < size; row++) {
      const color = row + 1;
      for (let col = 0; col < size; col++) solution[row * size + col] = color;
      endpoints[row * size] = color;
      endpoints[row * size + size - 1] = color;
    }
    const turns = Math.floor(random() * 4);
    const mirror = random() < 0.5;
    solution = transformArray(solution, size, turns, mirror);
    const transformedEndpoints = {};
    Object.entries(endpoints).forEach(([index, color]) => { transformedEndpoints[transformedIndex(Number(index), size, turns, mirror)] = color; });
    return { ...metadata.numberlink, mode: 'numberlink', size, colors, endpoints: transformedEndpoints, solution };
  }

  function validNumberlink(puzzle, values, complete = true) {
    if (complete && values.some(value => !value)) return false;
    for (let color = 1; color <= puzzle.colors; color++) {
      const cells = range(values.length).filter(index => values[index] === color);
      const endpoints = Object.entries(puzzle.endpoints).filter(([, value]) => value === color).map(([index]) => Number(index));
      if (complete && (endpoints.length !== 2 || !connected(cells, puzzle.size))) return false;
      for (const index of cells) {
        const degree = neighbors4(index, puzzle.size).filter(neighbor => values[neighbor] === color).length;
        if (complete && endpoints.includes(index) ? degree !== 1 : complete && degree !== 2) return false;
        if (degree > 2) return false;
      }
    }
    return true;
  }

  function solveNumberlink(puzzle, initial, limit = 1) {
    const direct = initial.slice();
    let directPossible = true;
    for (let color = 1; color <= puzzle.colors; color++) {
      const endpoints = Object.entries(puzzle.endpoints).filter(([, value]) => value === color).map(([index]) => Number(index));
      if (endpoints.length !== 2) { directPossible = false; break; }
      const [first, second] = endpoints;
      const firstRow = Math.floor(first / puzzle.size);
      const secondRow = Math.floor(second / puzzle.size);
      const firstCol = first % puzzle.size;
      const secondCol = second % puzzle.size;
      const path = [];
      if (firstRow === secondRow) for (let col = Math.min(firstCol, secondCol); col <= Math.max(firstCol, secondCol); col++) path.push(firstRow * puzzle.size + col);
      else if (firstCol === secondCol) for (let row = Math.min(firstRow, secondRow); row <= Math.max(firstRow, secondRow); row++) path.push(row * puzzle.size + firstCol);
      else { directPossible = false; break; }
      if (path.some(index => direct[index] && direct[index] !== color)) { directPossible = false; break; }
      path.forEach(index => { direct[index] = color; });
    }
    if (directPossible && validNumberlink(puzzle, direct, true)) return [direct];
    const values = initial.slice();
    const solutions = [];
    const search = () => {
      if (solutions.length >= limit) return;
      let best = values.findIndex(value => !value);
      if (best < 0) {
        if (validNumberlink(puzzle, values, true)) solutions.push(values.slice());
        return;
      }
      const adjacentColors = [...new Set(neighbors4(best, puzzle.size).map(index => values[index]).filter(Boolean))];
      const choices = adjacentColors.length ? adjacentColors : range(puzzle.colors).map(index => index + 1);
      for (const color of choices) {
        values[best] = color;
        if (validNumberlink(puzzle, values, false)) search();
        values[best] = 0;
      }
    };
    search();
    return solutions;
  }

  function numericCandidates(puzzle, values, index) {
    if (puzzle.mode === 'futoshiki') {
      const row = Math.floor(index / puzzle.size);
      const col = index % puzzle.size;
      const used = new Set([...values.slice(row * puzzle.size, row * puzzle.size + puzzle.size), ...range(puzzle.size).map(currentRow => values[currentRow * puzzle.size + col])].filter(Boolean));
      return range(puzzle.size).map(value => value + 1).filter(value => {
        if (used.has(value)) return false;
        return puzzle.inequalities.every(([left, right, sign]) => {
          if (left !== index && right !== index) return true;
          const first = left === index ? value : values[left];
          const second = right === index ? value : values[right];
          return !first || !second || (sign === '<' ? first < second : first > second);
        });
      });
    }
    if (puzzle.mode === 'kakuro') {
      return range(9).map(value => value + 1).filter(value => puzzle.runs.filter(run => run.cells.includes(index)).every(run => {
        const present = run.cells.map(cell => cell === index ? value : values[cell]).filter(Boolean);
        if (new Set(present).size !== present.length || sum(present) > run.sum) return false;
        const missing = run.cells.length - present.length;
        if (!missing) return sum(present) === run.sum;
        const available = range(9).map(number => number + 1).filter(number => !present.includes(number));
        const minimum = sum([...available].sort((a, b) => a - b).slice(0, missing));
        const maximum = sum([...available].sort((a, b) => b - a).slice(0, missing));
        return sum(present) + minimum <= run.sum && sum(present) + maximum >= run.sum;
      }));
    }
    if (puzzle.mode === 'hidato') {
      const used = new Set(values.filter(Boolean));
      return range(values.length).map(value => value + 1).filter(value => {
        if (used.has(value)) return false;
        const previous = values.indexOf(value - 1);
        const next = values.indexOf(value + 1);
        return (previous < 0 || neighbors8(index, puzzle.size).includes(previous)) && (next < 0 || neighbors8(index, puzzle.size).includes(next));
      });
    }
    if (puzzle.mode === 'numberlink') {
      const adjacent = [...new Set(neighbors4(index, puzzle.size).map(neighbor => values[neighbor]).filter(Boolean))];
      return adjacent.length ? adjacent : range(puzzle.colors).map(value => value + 1);
    }
    return [];
  }

  function traceFromSolution(puzzle, sourceState) {
    const state = { values: [...sourceState.values], marked: [...sourceState.marked], edges: [...sourceState.edges] };
    const answer = solve(puzzle, state, 1)[0];
    if (!answer) return [];
    const steps = [{ state: structuredClone(state), focus: null, comment: 'État initial. Chaque étape suivante choisit la contrainte la plus restrictive disponible.' }];
    if (puzzle.mode === 'slitherlink') {
      const remaining = answer.filter(edge => !state.edges.includes(edge));
      remaining.sort((left, right) => {
        const score = edge => range(puzzle.clues.length).filter(index => puzzle.clues[index] !== null && cellEdges(index, puzzle.size).includes(edge)).reduce((total, index) => total + 4 - puzzle.clues[index], 0);
        return score(right) - score(left);
      });
      remaining.forEach(edge => {
        state.edges.push(edge);
        const clues = range(puzzle.clues.length).filter(index => puzzle.clues[index] !== null && cellEdges(index, puzzle.size).includes(edge)).map(index => puzzle.clues[index]);
        steps.push({ state: structuredClone(state), focus: edge, comment: `Segment ${edge} retenu : les indices voisins ${clues.join(' et ') || 'sans chiffre'} et la règle des deux segments par sommet éliminent les autres configurations.` });
      });
      return steps;
    }
    if (['futoshiki', 'kakuro', 'hidato', 'numberlink'].includes(puzzle.mode)) {
      const pending = new Set(range(answer.length).filter(index => !state.values[index] && (puzzle.mode !== 'kakuro' || puzzle.mask[index])));
      while (pending.size) {
        const ranked = [...pending]
          .map(index => ({ index, candidates: numericCandidates(puzzle, state.values, index) }))
          .sort((left, right) => left.candidates.length - right.candidates.length || left.index - right.index);
        let forced = null;
        for (const entry of ranked) {
          const viable = entry.candidates.filter(candidate => {
            const branch = structuredClone(state);
            branch.values[entry.index] = candidate;
            return solve(puzzle, branch, 1).length > 0;
          });
          if (viable.length === 1) {
            forced = { ...entry, viable };
            break;
          }
        }
        if (!forced) break;
        const { index, candidates, viable } = forced;
        const value = viable[0];
        state.values[index] = value;
        pending.delete(index);
        let reason;
        if (candidates.length === 1) reason = `Case ${index + 1} : seul ${value} reste possible après les exclusions locales.`;
        else if (puzzle.mode === 'futoshiki') reason = `Case ${index + 1} : candidats locaux ${candidates.join(', ')}. Les essais ${candidates.filter(candidate => candidate !== value).join(', ')} mènent réellement à une contradiction de ligne, colonne ou inégalité ; ${value} est forcé.`;
        else if (puzzle.mode === 'kakuro') reason = `Case ${index + 1} : les sommes et chiffres déjà utilisés laissent ${candidates.join(', ')}. Seul ${value} permet de terminer les deux séries sans répétition.`;
        else if (puzzle.mode === 'hidato') reason = `Case ${index + 1} : parmi ${candidates.slice(0, 9).join(', ')}${candidates.length > 9 ? '…' : ''}, seul ${value} conserve un chemin continu entre son précédent et son suivant.`;
        else reason = `Case ${index + 1} : seul le chemin de couleur ${value} peut rester connecté sans croisement ni branche.`;
        steps.push({ state: structuredClone(state), focus: index, comment: reason });
      }
      if (pending.size) steps.push({ state: structuredClone(state), focus: null, comment: `Blocage logique : ${pending.size} case(s) nécessitent encore une déduction plus avancée. Aucune valeur n’a été révélée arbitrairement.` });
      return steps;
    }
    const pending = range(answer.length).filter(index => answer[index] && !state.marked[index]);
    pending.sort((left, right) => {
      const score = index => puzzle.mode === 'hitori'
        ? neighbors4(index, puzzle.size).length + puzzle.values.filter(value => value === puzzle.values[index]).length
        : puzzle.mode === 'nurikabe'
          ? neighbors4(index, puzzle.size).filter(neighbor => puzzle.clues[neighbor] !== undefined).length
          : neighbors4(index, puzzle.size).filter(neighbor => puzzle.walls[neighbor] !== undefined).length;
      return score(right) - score(left);
    });
    pending.forEach(index => {
      state.marked[index] = 1;
      const reason = puzzle.mode === 'hitori'
        ? `Case ${index + 1} noircie : elle supprime une répétition tout en conservant les cases claires connectées et sans cases noires adjacentes.`
        : puzzle.mode === 'nurikabe'
          ? `Case ${index + 1} ajoutée à la mer : elle sépare les îles à leur taille exacte sans créer de carré bleu 2 × 2.`
          : `Ampoule en case ${index + 1} : elle éclaire une zone encore sombre sans voir une autre ampoule et respecte les murs numérotés.`;
      steps.push({ state: structuredClone(state), focus: index, comment: reason });
    });
    return steps;
  }

  function generate(mode, size, difficulty, random = Math.random) {
    let puzzle;
    if (mode === 'futoshiki') puzzle = generateFutoshiki(size, difficulty, random);
    else if (mode === 'kakuro') puzzle = generateKakuro(size, difficulty, random);
    else if (mode === 'hidato') puzzle = generateHidato(size, difficulty, random);
    else if (mode === 'hitori') puzzle = generateHitori(size, difficulty, random);
    else if (mode === 'nurikabe') puzzle = generateNurikabe(size, difficulty, random);
    else if (mode === 'akari') puzzle = generateAkari(size, difficulty, random);
    else if (mode === 'slitherlink') puzzle = generateSlitherlink(size, difficulty, random);
    else puzzle = generateNumberlink(size, difficulty, random);
    return { ...puzzle, engineVersion: 2 };
  }

  function solve(puzzle, state, limit = 1) {
    if (puzzle.mode === 'futoshiki') return solveFutoshiki(puzzle, state.values, limit);
    if (puzzle.mode === 'kakuro') return solveKakuro(puzzle, state.values, limit);
    if (puzzle.mode === 'hidato') return solveHidato(puzzle, state.values, limit);
    if (puzzle.mode === 'hitori') return solveHitori(puzzle, state.marked, limit);
    if (puzzle.mode === 'nurikabe') return solveNurikabe(puzzle, state.marked, limit);
    if (puzzle.mode === 'akari') return solveAkari(puzzle, state.marked, limit);
    if (puzzle.mode === 'slitherlink') return solveSlitherlink(puzzle, state.edges, limit);
    if (puzzle.mode === 'numberlink') return solveNumberlink(puzzle, state.values, limit);
    return [];
  }

  function validate(puzzle, state) {
    if (puzzle.mode === 'futoshiki') return validFutoshiki(puzzle, state.values, true);
    if (puzzle.mode === 'kakuro') return validKakuro(puzzle, state.values, true);
    if (puzzle.mode === 'hidato') return validHidato(puzzle, state.values, true);
    if (puzzle.mode === 'hitori') return validHitori(puzzle, state.marked, true);
    if (puzzle.mode === 'nurikabe') return validNurikabe(puzzle, state.marked, true);
    if (puzzle.mode === 'akari') return validAkari(puzzle, state.marked, true);
    if (puzzle.mode === 'slitherlink') return validSlitherlink(puzzle, state.edges, true);
    return validNumberlink(puzzle, state.values, true);
  }

  window.LogicPuzzleEngine = {
    metadata,
    generate,
    solve,
    traceFromSolution,
    validate,
    valuesWithGivens,
    helpers: { cellEdges, allEdges, validFutoshiki, validKakuro, validHidato, validHitori, validNurikabe, validAkari, validSlitherlink, validNumberlink }
  };
}());
