const rackEl = document.getElementById('rack');
document.title = 'Rami Tuiles';
document.querySelector('h1').textContent = 'Rami Tuiles';
const boardEl = document.getElementById('board');
const playersView = document.getElementById('playersView');
const statusEl = document.getElementById('status');
const selectionEl = document.getElementById('selection');
const drawBtn = document.getElementById('draw');
const playersEl = document.getElementById('players');
let game;
let timer;
let autosave;
let sortMode = 'value';
let lanTileState = null;
let lanTileSeatOrder = [];
let lanTileNames = [];
let lanTilePending = false;
const colors = ['red', 'blue', 'black', 'orange'];

selectionEl.insertAdjacentHTML('beforebegin', '<button id="endTurn">Valider le tour</button><button id="undoTurn">Annuler le tour</button><button id="sortRack">Trier par couleur</button>');
const endTurnButton = document.getElementById('endTurn');
const undoTurnButton = document.getElementById('undoTurn');
const sortRackButton = document.getElementById('sortRack');

function shuffle(values) { const result = values.slice(); for (let index = result.length - 1; index > 0; index -= 1) { const other = Math.floor(Math.random() * (index + 1)); [result[index], result[other]] = [result[other], result[index]]; } return result; }
function makePool() { let id = 0; const pool = []; colors.forEach(color => { for (let value = 1; value <= 13; value += 1) for (let copy = 0; copy < 2; copy += 1) pool.push({ id: id += 1, color, value }); }); pool.push({ id: id += 1, joker: true }, { id: id += 1, joker: true }); return shuffle(pool); }
function name(index) { return index ? `Bot ${index}` : 'Vous'; }
function tileText(tile) { return tile.joker ? `★${tile.representedValue ? `(${tile.representedValue})` : ''}` : tile.value; }
function tileClass(tile) { return tile.joker ? 'joker' : tile.color; }
function tileValue(tile) { return tile.joker ? (tile.representedValue || 30) : tile.value; }
function draw(index) { const tile = game.pool.pop(); if (tile) game.people[index].rack.push(tile); return tile; }
function cloneState() { return { rack: game.people[0].rack.map(tile => ({ ...tile })), table: game.table.map(group => group.map(tile => ({ ...tile }))), opened: game.people[0].opened, changed: game.changed, openingPoints: game.openingPoints }; }
function restoreState(snapshot) { game.people[0].rack = snapshot.rack.map(tile => ({ ...tile })); game.table = snapshot.table.map(group => group.map(tile => ({ ...tile }))); game.people[0].opened = snapshot.opened; game.changed = snapshot.changed; game.openingPoints = snapshot.openingPoints || 0; game.selected = []; }
function sameTile(left, right) { return left.id === right.id; }

function analyzeMeld(tiles) {
  if (tiles.length < 3 || tiles.length > 13) return null;
  const normal = tiles.filter(tile => !tile.joker);
  const jokers = tiles.filter(tile => tile.joker);
  if (!normal.length) return null;
  const sameValue = normal.every(tile => tile.value === normal[0].value);
  const uniqueColors = new Set(normal.map(tile => tile.color)).size === normal.length;
  if (sameValue && uniqueColors && tiles.length <= 4) {
    const freeColors = colors.filter(color => !normal.some(tile => tile.color === color));
    if (jokers.length > freeColors.length) return null;
    const assignments = new Map(jokers.map((joker, index) => [joker.id, { value: normal[0].value, color: freeColors[index] }]));
    const arranged = tiles.slice().sort((left, right) => colors.indexOf(left.color || assignments.get(left.id)?.color) - colors.indexOf(right.color || assignments.get(right.id)?.color));
    return { type: 'group', arranged, assignments };
  }
  if (new Set(normal.map(tile => tile.color)).size !== 1 || new Set(normal.map(tile => tile.value)).size !== normal.length) return null;
  const candidates = [];
  for (let start = 1; start <= 14 - tiles.length; start += 1) {
    const end = start + tiles.length - 1;
    if (normal.some(tile => tile.value < start || tile.value > end)) continue;
    const missing = [];
    for (let value = start; value <= end; value += 1) if (!normal.some(tile => tile.value === value)) missing.push(value);
    if (missing.length !== jokers.length) continue;
    const score = jokers.reduce((total, joker, index) => total + Number(joker.representedValue && joker.representedValue !== missing[index]), 0);
    candidates.push({ start, missing, score });
  }
  if (!candidates.length) return null;
  candidates.sort((left, right) => left.score - right.score || left.start - right.start);
  const choice = candidates[0];
  const assignments = new Map(jokers.map((joker, index) => [joker.id, { value: choice.missing[index], color: normal[0].color }]));
  const arranged = tiles.slice().sort((left, right) => (left.value || assignments.get(left.id).value) - (right.value || assignments.get(right.id).value));
  return { type: 'run', arranged, assignments };
}

function applyMeldAnalysis(analysis) {
  analysis.arranged.forEach(tile => {
    if (!tile.joker) return;
    const assignment = analysis.assignments.get(tile.id);
    tile.representedValue = assignment.value;
    tile.representedColor = assignment.color;
  });
  return analysis.arranged;
}

function normalizeMeld(tiles) {
  const analysis = analyzeMeld(tiles);
  return analysis ? applyMeldAnalysis(analysis) : null;
}

function validMeld(tiles) { return Boolean(analyzeMeld(tiles)); }
function meldPoints(tiles) { const normalized = normalizeMeld(tiles); return normalized ? normalized.reduce((sum, tile) => sum + tileValue(tile), 0) : 0; }

function selectedTiles() { return game.selected.map(item => item.tile); }
function selectedFromRack() { return game.selected.filter(item => item.source === 'rack').map(item => item.tile); }
function selectTile(source, tile) {
  if (game.turn !== 0 || game.over) return;
  if (source !== 'rack' && !game.people[0].opened) { statusEl.textContent = 'Vous devez ouvrir avec 30 points depuis votre chevalet avant de manipuler la table.'; return; }
  const position = game.selected.findIndex(item => item.source === source && sameTile(item.tile, tile));
  if (position >= 0) game.selected.splice(position, 1); else game.selected.push({ source, tile });
  render();
}

function removeTile(tile) {
  const rack = game.people[0].rack;
  const rackIndex = rack.findIndex(item => sameTile(item, tile));
  if (rackIndex >= 0) { rack.splice(rackIndex, 1); return; }
  game.table.forEach(group => { const index = group.findIndex(item => sameTile(item, tile)); if (index >= 0) group.splice(index, 1); });
  game.table = game.table.filter(group => group.length);
}

function playSelected() {
  if (game.turn !== 0 || game.over) return;
  const tiles = selectedTiles();
  if (!analyzeMeld(tiles)) { statusEl.textContent = 'Sélectionnez un groupe valide : même valeur/couleurs différentes, ou série consécutive d’une même couleur (3 tuiles minimum).'; return; }
  const person = game.people[0];
  if (!person.opened) {
    if (game.selected.some(item => item.source !== 'rack')) { statusEl.textContent = 'Avant l’ouverture, toutes les tuiles doivent provenir de votre chevalet.'; return; }
  }
  const reclaimed = game.selected.some(item => item.source === 'table');
  const stagedTiles = game.selected.map(item => ({ ...item.tile, reclaimed: item.source === 'table' || item.tile.reclaimed, pending: item.source === 'rack' || item.tile.pending }));
  const normalized = normalizeMeld(stagedTiles);
  if (!person.opened) game.openingPoints += normalized.reduce((sum, tile) => sum + tileValue(tile), 0);
  tiles.forEach(removeTile);
  game.table.push(normalized);
  game.selected = [];
  game.changed = true;
  statusEl.textContent = !person.opened ? `Ouverture provisoire : ${game.openingPoints}/30 points. Vous pouvez poser d’autres groupes avant de valider.` : reclaimed ? 'Groupe réorganisé : les tuiles reprises doivent rester posées dans ce tour.' : 'Groupe posé. Vous pouvez encore poser ou compléter d’autres groupes.';
  window.GameEffects?.play('move');
  render();
}

function tableIsValid() {
  const normalized = game.table.map(normalizeMeld);
  if (normalized.some(group => !group)) return false;
  game.table = normalized;
  return true;
}
function endTurn() {
  if (game.turn !== 0 || game.over) return;
  if (!game.changed) { statusEl.textContent = 'Posez une ou plusieurs combinaisons, ou piochez une tuile.'; return; }
  if (!tableIsValid()) { statusEl.textContent = 'Impossible de finir : chaque groupe présent sur la table doit compter au moins trois tuiles et rester valide.'; return; }
  if (!game.people[0].opened && game.openingPoints < 30) { statusEl.textContent = `Ouverture insuffisante : ${game.openingPoints}/30 points. Posez une autre combinaison ou annulez le tour.`; return; }
  if (!game.people[0].opened) game.people[0].opened = true;
  game.table.forEach(group => group.forEach(tile => { delete tile.reclaimed; delete tile.pending; }));
  game.turnSnapshot = null;
  game.selected = [];
  game.passes = 0;
  log('Vous validez votre tour.');
  if (!game.people[0].rack.length) { finish(0); return; }
  next();
}

function undoTurn() { if (game.turn !== 0 || !game.turnSnapshot) return; restoreState(game.turnSnapshot); statusEl.textContent = 'Tour annulé : le chevalet et la table reviennent à leur état de début de tour.'; render(); }
function log(text) { game.log.unshift(text); game.log = game.log.slice(0, 8); }

function combinations(items, size, startIndex = 0, prefix = [], result = []) {
  if (prefix.length === size) { result.push(prefix.slice()); return result; }
  for (let index = startIndex; index <= items.length - (size - prefix.length); index += 1) {
    prefix.push(items[index]);
    combinations(items, size, index + 1, prefix, result);
    prefix.pop();
  }
  return result;
}

function meldCandidates(rack) {
  const candidates = new Map();
  const jokers = rack.filter(tile => tile.joker);
  const addCandidate = tiles => {
    const analysis = analyzeMeld(tiles);
    if (!analysis) return;
    const key = tiles.map(tile => tile.id).sort((left, right) => left - right).join('-');
    const points = analysis.arranged.reduce((sum, tile) => sum + (tile.joker ? analysis.assignments.get(tile.id).value : tile.value), 0);
    if (!candidates.has(key)) candidates.set(key, { key, tiles: analysis.arranged, points });
  };
  for (let value = 1; value <= 13; value += 1) {
    const normals = colors.map(color => rack.find(tile => !tile.joker && tile.color === color && tile.value === value)).filter(Boolean);
    for (let normalCount = 1; normalCount <= Math.min(4, normals.length); normalCount += 1) {
      combinations(normals, normalCount).forEach(normalTiles => {
        for (let jokerCount = 0; jokerCount <= Math.min(jokers.length, 4 - normalCount); jokerCount += 1) {
          addCandidate([...normalTiles, ...jokers.slice(0, jokerCount)]);
        }
      });
    }
  }
  colors.forEach(color => {
    const byValue = new Map();
    rack.filter(tile => !tile.joker && tile.color === color).forEach(tile => {
      if (!byValue.has(tile.value)) byValue.set(tile.value, tile);
    });
    for (let startValue = 1; startValue <= 11; startValue += 1) {
      for (let endValue = startValue + 2; endValue <= 13; endValue += 1) {
        const normalTiles = [];
        let missing = 0;
        for (let value = startValue; value <= endValue; value += 1) {
          const tile = byValue.get(value);
          if (tile) normalTiles.push(tile); else missing += 1;
        }
        if (missing <= jokers.length) addCandidate([...normalTiles, ...jokers.slice(0, missing)]);
      }
    }
  });
  return [...candidates.values()].sort((left, right) => right.tiles.length - left.tiles.length || right.tiles.reduce((sum, tile) => sum + tileValue(tile), 0) - left.tiles.reduce((sum, tile) => sum + tileValue(tile), 0));
}

function bestMeldPlan(rack, openingRequired) {
  let best = null;
  let visited = 0;
  const search = (remaining, melds, points, minimumKey) => {
    visited += 1;
    const tileCount = melds.reduce((sum, meld) => sum + meld.length, 0);
    if ((!openingRequired || points >= 30) && (!best || tileCount > best.tileCount || (tileCount === best.tileCount && points > best.points))) {
      best = { melds: melds.map(meld => meld.slice()), points, tileCount };
    }
    if (visited >= 7000 || melds.length >= 6) return;
    const candidates = meldCandidates(remaining).filter(candidate => candidate.key > minimumKey).slice(0, 55);
    candidates.forEach(candidate => {
      const usedIds = new Set(candidate.tiles.map(tile => tile.id));
      const nextRack = remaining.filter(tile => !usedIds.has(tile.id));
      search(nextRack, [...melds, candidate.tiles], points + candidate.points, candidate.key);
    });
  };
  search(rack, [], 0, '');
  return best?.melds || [];
}

function removeRackTiles(rack, tiles) {
  tiles.forEach(tile => {
    const index = rack.findIndex(candidate => sameTile(candidate, tile));
    if (index >= 0) rack.splice(index, 1);
  });
}

function bestTableExtension(person, requiredTileId = null, excludedGroup = -1) {
  let best = null;
  for (let groupIndex = 0; groupIndex < game.table.length; groupIndex += 1) {
    if (groupIndex === excludedGroup) continue;
    for (let amount = 1; amount <= Math.min(3, person.rack.length); amount += 1) {
      combinations(person.rack, amount).forEach(tiles => {
        if (requiredTileId !== null && !tiles.some(tile => tile.id === requiredTileId)) return;
        const analysis = analyzeMeld([...game.table[groupIndex], ...tiles]);
        if (!analysis) return;
        const score = tiles.length * 100 + tiles.reduce((sum, tile) => sum + tileValue(tile), 0);
        if (!best || score > best.score) best = { groupIndex, tiles, analysis, score };
      });
    }
  }
  return best;
}

function applyTableExtension(person, extension) {
  removeRackTiles(person.rack, extension.tiles);
  game.table[extension.groupIndex] = applyMeldAnalysis(extension.analysis);
  return extension.tiles.length;
}

function appendBotTiles(person) {
  let count = 0;
  let extension = bestTableExtension(person);
  while (extension) {
    count += applyTableExtension(person, extension);
    extension = bestTableExtension(person);
  }
  return count;
}

function reorganizeBotTable(person) {
  let usedRackTiles = 0;
  for (let pass = 0; pass < 3; pass += 1) {
    let best = null;
    game.table.forEach((group, groupIndex) => {
      for (let tableAmount = 1; tableAmount <= Math.min(2, group.length - 3); tableAmount += 1) {
        combinations(group.filter(tile => !tile.joker), tableAmount).forEach(movedTiles => {
          const movedIds = new Set(movedTiles.map(tile => tile.id));
          const remainderAnalysis = analyzeMeld(group.filter(tile => !movedIds.has(tile.id)));
          if (!remainderAnalysis) return;
          for (let rackAmount = Math.max(1, 3 - tableAmount); rackAmount <= Math.min(3, person.rack.length); rackAmount += 1) {
            combinations(person.rack, rackAmount).forEach(rackTiles => {
              const newAnalysis = analyzeMeld([...movedTiles, ...rackTiles]);
              if (!newAnalysis) return;
              const score = rackTiles.length * 100 + rackTiles.reduce((sum, tile) => sum + tileValue(tile), 0);
              if (!best || score > best.score) best = { groupIndex, rackTiles, remainderAnalysis, newAnalysis, score };
            });
          }
        });
      }
    });
    if (!best) break;
    removeRackTiles(person.rack, best.rackTiles);
    game.table[best.groupIndex] = applyMeldAnalysis(best.remainderAnalysis);
    game.table.push(applyMeldAnalysis(best.newAnalysis));
    usedRackTiles += best.rackTiles.length;
  }
  return usedRackTiles;
}

function reuseTableJoker(person) {
  const initialRackLength = person.rack.length;
  const possibilities = game.table.flatMap((group, groupIndex) => group
    .filter(tile => tile.joker && tile.representedValue && tile.representedColor)
    .map(tile => ({ groupIndex, jokerId: tile.id, value: tile.representedValue, color: tile.representedColor })));
  for (const possibility of possibilities) {
    const replacement = person.rack.find(tile => !tile.joker && tile.value === possibility.value && tile.color === possibility.color);
    if (!replacement) continue;
    const rackSnapshot = person.rack.map(tile => ({ ...tile }));
    const tableSnapshot = game.table.map(group => group.map(tile => ({ ...tile })));
    const group = game.table[possibility.groupIndex];
    const jokerIndex = group.findIndex(tile => tile.id === possibility.jokerId);
    const rackIndex = person.rack.findIndex(tile => tile.id === replacement.id);
    const reclaimedJoker = { ...group[jokerIndex] };
    delete reclaimedJoker.representedValue;
    delete reclaimedJoker.representedColor;
    group[jokerIndex] = person.rack.splice(rackIndex, 1, reclaimedJoker)[0];
    game.table[possibility.groupIndex] = normalizeMeld(group);
    const extension = bestTableExtension(person, reclaimedJoker.id, possibility.groupIndex);
    if (extension) {
      applyTableExtension(person, extension);
      return initialRackLength - person.rack.length;
    }
    const candidate = meldCandidates(person.rack).find(item => item.tiles.some(tile => tile.id === reclaimedJoker.id));
    if (candidate) {
      removeRackTiles(person.rack, candidate.tiles);
      game.table.push(normalizeMeld(candidate.tiles.map(tile => ({ ...tile }))));
      return initialRackLength - person.rack.length;
    }
    person.rack = rackSnapshot;
    game.table = tableSnapshot;
  }
  return 0;
}

function finishStalemate() {
  game.over = true;
  const totals = game.people.map(person => person.rack.reduce((sum, tile) => sum + tileValue(tile), 0));
  const lowest = Math.min(...totals);
  const winner = totals.indexOf(lowest);
  statusEl.textContent = `Pioche épuisée et table bloquée : ${name(winner)} gagne avec ${lowest} points restants.`;
  window.GameRecords?.finish({ score: lowest, scoreLabel: `${lowest} points`, lowerIsBetter: true, won: winner === 0 });
  log(`Partie bloquée : ${totals.map((total, index) => `${name(index)} ${total}`).join(' · ')}.`);
  render();
}

function start() { clearTimeout(timer); const count = Number(playersEl.value); game = { pool: makePool(), table: [], turn: 0, selected: [], changed: false, openingPoints: 0, turnSnapshot: null, passes: 0, over: false, log: [], people: Array.from({ length: count }, () => ({ rack: [], opened: false, score: 0 })) }; game.people.forEach((person, index) => { for (let tile = 0; tile < 14; tile += 1) draw(index); }); game.turnSnapshot = cloneState(); statusEl.textContent = 'Sélectionnez des tuiles dans l’ordre voulu. L’ouverture peut cumuler plusieurs groupes pour atteindre 30 points.'; render(); autosave?.save(); }

function botMove() {
  if (game.turn === 0 || game.over) return;
  const playerIndex = game.turn;
  const person = game.people[playerIndex];
  let playedTiles = 0;
  if (person.opened) {
    playedTiles += appendBotTiles(person);
    playedTiles += reorganizeBotTable(person);
    playedTiles += reuseTableJoker(person);
    playedTiles += appendBotTiles(person);
  }
  const plan = bestMeldPlan(person.rack, !person.opened);
  if (plan.length) {
    plan.forEach(meld => { removeRackTiles(person.rack, meld); game.table.push(normalizeMeld(meld.map(tile => ({ ...tile })))); playedTiles += meld.length; });
    person.opened = true;
    playedTiles += appendBotTiles(person);
    playedTiles += reorganizeBotTable(person);
    playedTiles += reuseTableJoker(person);
    playedTiles += appendBotTiles(person);
  }
  if (playedTiles) {
    game.passes = 0;
    log(`${name(playerIndex)} pose ou complète ${playedTiles} tuile${playedTiles > 1 ? 's' : ''}.`);
    if (!person.rack.length) { finish(playerIndex); return; }
  } else {
    const drawn = draw(playerIndex);
    if (drawn) { game.passes = 0; log(`${name(playerIndex)} pioche.`); }
    else { game.passes += 1; log(`${name(playerIndex)} passe : la pioche est vide.`); }
  }
  if (!game.pool.length && game.passes >= game.people.length) { finishStalemate(); return; }
  next();
}
function next() { game.turn = (game.turn + 1) % game.people.length; game.selected = []; game.changed = false; game.openingPoints = 0; if (game.turn === 0) game.turnSnapshot = cloneState(); statusEl.textContent = game.turn ? 'Le bot examine son chevalet.' : 'À vous : posez plusieurs groupes, réorganisez la table, puis validez.'; render(); clearTimeout(timer); if (game.turn) timer = setTimeout(botMove, 650 + Math.random() * 650); }
function finish(winner) { game.over = true; game.people.forEach((person, index) => { const remaining = person.rack.reduce((sum, tile) => sum + tileValue(tile), 0); person.score += index === winner ? game.people.reduce((sum, other, otherIndex) => sum + (otherIndex === winner ? 0 : other.rack.reduce((total, tile) => total + tileValue(tile), 0)), 0) : -remaining; }); statusEl.textContent = `${name(winner)} termine son chevalet et gagne !`; window.GameRecords?.finish({ score: game.people[winner].score, scoreLabel: `${game.people[winner].score} points`, won: winner === 0 }); window.GameEffects?.play('win'); render(); }
function sortRack() { const rack = game.people[0].rack; const colorOrder = Object.fromEntries(colors.map((color, index) => [color, index])); rack.sort((left, right) => sortMode === 'value' ? (tileValue(left) - tileValue(right) || (colorOrder[left.color] ?? 9) - (colorOrder[right.color] ?? 9)) : ((colorOrder[left.color] ?? 9) - (colorOrder[right.color] ?? 9) || tileValue(left) - tileValue(right))); sortMode = sortMode === 'value' ? 'color' : 'value'; render(); }
function tileMarkup(tile, source) { const selected = game.selected.some(item => item.source === source && sameTile(item.tile, tile)); const content = tile.joker ? `★${tile.representedValue ? `<small>${tile.representedValue}</small>` : ''}` : tile.value; return `<button class="tile ${tileClass(tile)}${selected ? ' selected' : ''}${tile.pending ? ' pending' : ''}${tile.reclaimed ? ' reclaimed' : ''}" data-source="${source}" data-id="${tile.id}"${tile.joker && tile.representedValue ? ` title="Joker : ${tile.representedColor} ${tile.representedValue}"` : ''}>${content}</button>`; }
function render() { const person = game.people[0]; playersView.innerHTML = game.people.map((player, index) => `<article class="player${index === game.turn && !game.over ? ' active' : ''}"><strong>${name(index)}</strong><br><small>${player.rack.length} tuiles · ${player.opened ? 'ouvert' : 'pas encore ouvert'} · score ${player.score}</small></article>`).join(''); boardEl.innerHTML = game.table.length ? game.table.map((meld, groupIndex) => `<div class="meld" data-group="${groupIndex}">${meld.map(tile => tileMarkup(tile, 'table')).join('')}</div>`).join('') : '<span class="muted">Aucune combinaison posée.</span>'; rackEl.innerHTML = person.rack.map(tile => tileMarkup(tile, 'rack')).join(''); const findTile = id => [...person.rack, ...game.table.flat()].find(tile => tile.id === Number(id)); document.querySelectorAll('[data-source]').forEach(button => button.onclick = () => selectTile(button.dataset.source, findTile(button.dataset.id))); selectionEl.textContent = game.selected.length ? `${game.selected.length} tuile(s), dans l’ordre de sélection · ${selectedTiles().map(tileText).join(' · ')}` : 'Sélectionnez dans l’ordre de pose ; ★ peut représenter une tuile manquante.'; drawBtn.textContent = game.changed ? `${game.pool.length ? 'ANNULER ET PIOCHER' : 'ANNULER ET PASSER'} · ${game.pool.length}` : game.pool.length ? `PIOCHER · ${game.pool.length}` : 'PASSER · PIOCHE VIDE'; drawBtn.disabled = game.turn !== 0 || game.over; endTurnButton.disabled = game.turn !== 0 || game.over || !game.changed; undoTurnButton.disabled = game.turn !== 0 || game.over || !game.turnSnapshot; sortRackButton.textContent = sortMode === 'value' ? 'Trier par couleur' : 'Trier par valeur'; document.getElementById('log').innerHTML = game.log.map(entry => `<li>${entry}</li>`).join(''); }

window.RamiTuilesTestAPI = Object.freeze({
  diagnostics: () => {
    const group = [{ id: 1001, color: 'red', value: 7 }, { id: 1002, color: 'blue', value: 7 }, { id: 1003, color: 'black', value: 7 }];
    const runWithJoker = [{ id: 1004, color: 'orange', value: 4 }, { id: 1005, joker: true }, { id: 1006, color: 'orange', value: 6 }];
    const invalid = [{ id: 1007, color: 'red', value: 7 }, { id: 1008, color: 'red', value: 7 }, { id: 1009, color: 'black', value: 7 }];
    return {
      poolSize: makePool().length,
      groupValid: validMeld(group),
      jokerRunValid: validMeld(runWithJoker),
      duplicateColorRejected: !validMeld(invalid),
      currentTileCount: game.pool.length + game.people.reduce((total, person) => total + person.rack.length, 0) + game.table.reduce((total, meld) => total + meld.length, 0),
    };
  },
});

function drawOrPass() {
  if (game.turn !== 0 || game.over) return;
  if (game.changed && game.turnSnapshot) {
    restoreState(game.turnSnapshot);
    log('Vous annulez vos modifications provisoires avant de piocher.');
  }
  const drawn = draw(0);
  if (drawn) { game.passes = 0; log('Vous piochez.'); }
  else { game.passes += 1; log('Vous passez : la pioche est vide.'); }
  if (!game.pool.length && game.passes >= game.people.length) { finishStalemate(); return; }
  next();
}

document.getElementById('play').onclick = playSelected;
endTurnButton.onclick = endTurn;
undoTurnButton.onclick = undoTurn;
sortRackButton.onclick = sortRack;
drawBtn.onclick = drawOrPass;
document.getElementById('newGame').onclick = start;
playersEl.onchange = start;
if (!window.GameEffects) { const script = document.createElement('script'); script.src = '../../shared/effects.js?v=1'; document.head.appendChild(script); }
localStorage.setItem('game-hub:last-game', 'rami-tuiles');
autosave = window.GameRuntime?.createAutosave('partie', { capture: () => game, validate: value => Array.isArray(value?.pool) && Array.isArray(value?.people) && Array.isArray(value?.table), restore: value => { game = value; render(); if (game.turn && !game.over) timer = setTimeout(botMove, 500); } });
if (!autosave?.restore()) start();

const localTilePlaySelected = playSelected;
const localTileEndTurn = endTurn;
const localTileUndoTurn = undoTurn;
const localTileDrawOrPass = drawOrPass;
const localTileName = name;
function sendTileAction(action) {
  if (!window.LanMultiplayer?.active || lanTilePending) return;
  lanTilePending = true;
  window.LanMultiplayer.sendPrivateAction(action).catch(error => { statusEl.textContent = `Action refusée : ${error.message}`; }).finally(() => { lanTilePending = false; });
}
function applyLanTileState(room) {
  const snapshot = room?.gameState;
  if (!snapshot || snapshot.yourSeat === null || snapshot.yourSeat === undefined) { if (room?.phase === 'lobby') lanTileState = null; return; }
  lanTileState = snapshot;
  lanTilePending = false;
  lanTileSeatOrder = [snapshot.yourSeat, ...snapshot.rackCounts.map((_, index) => index).filter(index => index !== snapshot.yourSeat)];
  lanTileNames = lanTileSeatOrder.map((seat, index) => room.seats?.[seat]?.label || (index ? 'Adversaire' : 'Vous'));
  game = {
    pool: Array.from({ length: snapshot.poolCount }, () => null), table: snapshot.table.map(group => group.map(tile => ({ ...tile }))),
    turn: lanTileSeatOrder.indexOf(snapshot.turn), selected: [], changed: snapshot.changed, openingPoints: snapshot.openingPoints,
    turnSnapshot: {}, passes: 0, over: snapshot.over, log: [snapshot.message],
    people: lanTileSeatOrder.map((seat, index) => ({ rack: index === 0 ? snapshot.rack.map(tile => ({ ...tile })) : Array.from({ length: snapshot.rackCounts[seat] }, (_, hidden) => ({ id: -(hidden + 1), color: 'black', value: 0 })), opened: snapshot.opened[seat], score: 0 })),
  };
  if (snapshot.over) statusEl.textContent = snapshot.winner === snapshot.yourSeat ? 'Vous terminez votre chevalet et gagnez !' : `${room.seats?.[snapshot.winner]?.label || 'Un adversaire'} gagne la partie.`;
  else if (snapshot.turn === snapshot.yourSeat) statusEl.textContent = snapshot.changed ? 'Vous pouvez continuer à réorganiser ou valider le tour.' : 'Posez des groupes valides ou piochez.';
  else statusEl.textContent = snapshot.message;
  render();
}
name = function lanAwareTileName(index) { return lanTileState ? (lanTileNames[index] || `Joueur ${index + 1}`) : localTileName(index); };
document.getElementById('play').onclick = () => {
  if (!lanTileState) { localTilePlaySelected(); return; }
  const before = JSON.stringify(game.table.map(group => group.map(tile => tile.id)));
  localTilePlaySelected();
  const groups = game.table.map(group => group.map(tile => tile.id));
  if (JSON.stringify(groups) !== before) sendTileAction({ type: 'rearrange', groups });
};
endTurnButton.onclick = () => {
  if (!lanTileState) { localTileEndTurn(); return; }
  if (!game.changed) { statusEl.textContent = 'Posez au moins une tuile avant de valider.'; return; }
  sendTileAction({ type: 'end' });
};
undoTurnButton.onclick = () => { if (!lanTileState) localTileUndoTurn(); else sendTileAction({ type: 'undo' }); };
drawBtn.onclick = () => { if (!lanTileState) localTileDrawOrPass(); else sendTileAction({ type: 'draw' }); };
window.addEventListener('lan:room', event => applyLanTileState(event.detail?.room));
window.addEventListener('lan:left', () => { lanTileState = null; lanTileSeatOrder = []; lanTileNames = []; start(); });
