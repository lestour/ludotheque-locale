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
let sortMode = 'value';
const colors = ['red', 'blue', 'black', 'orange'];

selectionEl.insertAdjacentHTML('beforebegin', '<button id="endTurn">Valider le tour</button><button id="undoTurn">Annuler le tour</button><button id="sortRack">Trier par couleur</button>');
const endTurnButton = document.getElementById('endTurn');
const undoTurnButton = document.getElementById('undoTurn');
const sortRackButton = document.getElementById('sortRack');

function shuffle(values) { const result = values.slice(); for (let index = result.length - 1; index > 0; index -= 1) { const other = Math.floor(Math.random() * (index + 1)); [result[index], result[other]] = [result[other], result[index]]; } return result; }
function makePool() { let id = 0; const pool = []; colors.forEach(color => { for (let value = 1; value <= 13; value += 1) for (let copy = 0; copy < 2; copy += 1) pool.push({ id: id += 1, color, value }); }); pool.push({ id: id += 1, joker: true }, { id: id += 1, joker: true }); return shuffle(pool); }
function name(index) { return index ? `Bot ${index}` : 'Vous'; }
function tileText(tile) { return tile.joker ? '★' : tile.value; }
function tileClass(tile) { return tile.joker ? 'joker' : tile.color; }
function tileValue(tile) { return tile.joker ? 30 : tile.value; }
function draw(index) { const tile = game.pool.pop(); if (tile) game.people[index].rack.push(tile); return tile; }
function cloneState() { return { rack: game.people[0].rack.map(tile => ({ ...tile })), table: game.table.map(group => group.map(tile => ({ ...tile }))), opened: game.people[0].opened, changed: game.changed, openingPoints: game.openingPoints }; }
function restoreState(snapshot) { game.people[0].rack = snapshot.rack.map(tile => ({ ...tile })); game.table = snapshot.table.map(group => group.map(tile => ({ ...tile }))); game.people[0].opened = snapshot.opened; game.changed = snapshot.changed; game.openingPoints = snapshot.openingPoints || 0; game.selected = []; }
function sameTile(left, right) { return left.id === right.id; }

function validMeld(tiles) {
  if (tiles.length < 3 || tiles.length > 13) return false;
  const normal = tiles.filter(tile => !tile.joker);
  const jokers = tiles.length - normal.length;
  if (!normal.length) return false;
  const isGroup = normal.every(tile => tile.value === normal[0].value) && new Set(normal.map(tile => tile.color)).size === normal.length && tiles.length <= 4;
  if (isGroup) return jokers <= 4 - normal.length;
  if (new Set(normal.map(tile => tile.color)).size !== 1) return false;
  const values = normal.map(tile => tile.value).sort((left, right) => left - right);
  if (new Set(values).size !== values.length) return false;
  return values.at(-1) - values[0] < tiles.length && values.at(-1) <= 13 && values[0] >= 1 && jokers >= tiles.length - (values.at(-1) - values[0] + 1);
}

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
  if (!validMeld(tiles)) { statusEl.textContent = 'Sélectionnez un groupe valide : même valeur/couleurs différentes, ou série consécutive d’une même couleur (3 tuiles minimum).'; return; }
  const person = game.people[0];
  if (!person.opened) {
    if (game.selected.some(item => item.source !== 'rack')) { statusEl.textContent = 'Avant l’ouverture, toutes les tuiles doivent provenir de votre chevalet.'; return; }
    game.openingPoints += tiles.reduce((sum, tile) => sum + tileValue(tile), 0);
  }
  const reclaimed = game.selected.some(item => item.source === 'table');
  tiles.forEach(removeTile);
  game.table.push(tiles.map(tile => ({ ...tile, reclaimed })));
  game.selected = [];
  game.changed = true;
  statusEl.textContent = !person.opened ? `Ouverture provisoire : ${game.openingPoints}/30 points. Vous pouvez poser d’autres groupes avant de valider.` : reclaimed ? 'Groupe réorganisé : les tuiles reprises doivent rester posées dans ce tour.' : 'Groupe posé. Vous pouvez encore poser ou compléter d’autres groupes.';
  window.GameEffects?.play('move');
  render();
}

function tableIsValid() { return game.table.every(validMeld); }
function endTurn() {
  if (game.turn !== 0 || game.over) return;
  if (!game.changed) { statusEl.textContent = 'Posez une ou plusieurs combinaisons, ou piochez une tuile.'; return; }
  if (!tableIsValid()) { statusEl.textContent = 'Impossible de finir : chaque groupe présent sur la table doit compter au moins trois tuiles et rester valide.'; return; }
  if (!game.people[0].opened && game.openingPoints < 30) { statusEl.textContent = `Ouverture insuffisante : ${game.openingPoints}/30 points. Posez une autre combinaison ou annulez le tour.`; return; }
  if (!game.people[0].opened) game.people[0].opened = true;
  game.table.forEach(group => group.forEach(tile => { delete tile.reclaimed; }));
  game.turnSnapshot = null;
  game.selected = [];
  log('Vous validez votre tour.');
  if (!game.people[0].rack.length) { finish(0); return; }
  next();
}

function undoTurn() { if (game.turn !== 0 || !game.turnSnapshot) return; restoreState(game.turnSnapshot); statusEl.textContent = 'Tour annulé : le chevalet et la table reviennent à leur état de début de tour.'; render(); }
function log(text) { game.log.unshift(text); game.log = game.log.slice(0, 8); }

function possibleMeld(rack) { for (let first = 0; first < rack.length; first += 1) for (let second = first + 1; second < rack.length; second += 1) for (let third = second + 1; third < rack.length; third += 1) { const candidate = [rack[first], rack[second], rack[third]]; if (validMeld(candidate)) return candidate; } return null; }
function start() { clearTimeout(timer); const count = Number(playersEl.value); game = { pool: makePool(), table: [], turn: 0, selected: [], changed: false, openingPoints: 0, turnSnapshot: null, over: false, log: [], people: Array.from({ length: count }, () => ({ rack: [], opened: false, score: 0 })) }; game.people.forEach((person, index) => { for (let tile = 0; tile < 14; tile += 1) draw(index); }); game.turnSnapshot = cloneState(); statusEl.textContent = 'Sélectionnez des tuiles dans l’ordre voulu. L’ouverture peut cumuler plusieurs groupes pour atteindre 30 points.'; render(); }

function botMove() { if (game.turn === 0 || game.over) return; const person = game.people[game.turn]; let meld = possibleMeld(person.rack); if (meld && (person.opened || meld.reduce((sum, tile) => sum + tileValue(tile), 0) >= 30)) { meld.forEach(tile => person.rack.splice(person.rack.findIndex(item => sameTile(item, tile)), 1)); person.opened = true; game.table.push(meld); log(`${name(game.turn)} pose ${meld.length} tuiles.`); if (!person.rack.length) { finish(game.turn); return; } } else { draw(game.turn); log(`${name(game.turn)} pioche.`); } next(); }
function next() { game.turn = (game.turn + 1) % game.people.length; game.selected = []; game.changed = false; game.openingPoints = 0; if (game.turn === 0) game.turnSnapshot = cloneState(); statusEl.textContent = game.turn ? 'Le bot examine son chevalet.' : 'À vous : posez plusieurs groupes, réorganisez la table, puis validez.'; render(); clearTimeout(timer); if (game.turn) timer = setTimeout(botMove, 650 + Math.random() * 650); }
function finish(winner) { game.over = true; game.people.forEach((person, index) => { const remaining = person.rack.reduce((sum, tile) => sum + tileValue(tile), 0); person.score += index === winner ? game.people.reduce((sum, other, otherIndex) => sum + (otherIndex === winner ? 0 : other.rack.reduce((total, tile) => total + tileValue(tile), 0)), 0) : -remaining; }); statusEl.textContent = `${name(winner)} termine son chevalet et gagne !`; window.GameEffects?.play('win'); render(); }
function sortRack() { const rack = game.people[0].rack; const colorOrder = Object.fromEntries(colors.map((color, index) => [color, index])); rack.sort((left, right) => sortMode === 'value' ? (tileValue(left) - tileValue(right) || (colorOrder[left.color] ?? 9) - (colorOrder[right.color] ?? 9)) : ((colorOrder[left.color] ?? 9) - (colorOrder[right.color] ?? 9) || tileValue(left) - tileValue(right))); sortMode = sortMode === 'value' ? 'color' : 'value'; render(); }
function tileMarkup(tile, source) { const selected = game.selected.some(item => item.source === source && sameTile(item.tile, tile)); return `<button class="tile ${tileClass(tile)}${selected ? ' selected' : ''}${tile.reclaimed ? ' reclaimed' : ''}" data-source="${source}" data-id="${tile.id}">${tileText(tile)}</button>`; }
function render() { const person = game.people[0]; playersView.innerHTML = game.people.map((player, index) => `<article class="player${index === game.turn && !game.over ? ' active' : ''}"><strong>${name(index)}</strong><br><small>${player.rack.length} tuiles · ${player.opened ? 'ouvert' : 'pas encore ouvert'} · score ${player.score}</small></article>`).join(''); boardEl.innerHTML = game.table.length ? game.table.map((meld, groupIndex) => `<div class="meld" data-group="${groupIndex}">${meld.map(tile => tileMarkup(tile, 'table')).join('')}</div>`).join('') : '<span class="muted">Aucune combinaison posée.</span>'; rackEl.innerHTML = person.rack.map(tile => tileMarkup(tile, 'rack')).join(''); const findTile = id => [...person.rack, ...game.table.flat()].find(tile => tile.id === Number(id)); document.querySelectorAll('[data-source]').forEach(button => button.onclick = () => selectTile(button.dataset.source, findTile(button.dataset.id))); selectionEl.textContent = game.selected.length ? `${game.selected.length} tuile(s), dans l’ordre de sélection · ${selectedTiles().map(tileText).join(' · ')}` : 'Sélectionnez dans l’ordre de pose ; ★ peut représenter une tuile manquante.'; drawBtn.textContent = `PIOCHER · ${game.pool.length}`; drawBtn.disabled = game.turn !== 0 || game.over || game.changed; endTurnButton.disabled = game.turn !== 0 || game.over || !game.changed; undoTurnButton.disabled = game.turn !== 0 || game.over || !game.turnSnapshot; sortRackButton.textContent = sortMode === 'value' ? 'Trier par couleur' : 'Trier par valeur'; document.getElementById('log').innerHTML = game.log.map(entry => `<li>${entry}</li>`).join(''); }

document.getElementById('play').onclick = playSelected;
endTurnButton.onclick = endTurn;
undoTurnButton.onclick = undoTurn;
sortRackButton.onclick = sortRack;
drawBtn.onclick = () => { if (game.turn === 0 && !game.over && !game.changed) { draw(0); log('Vous piochez.'); next(); } };
document.getElementById('newGame').onclick = start;
playersEl.onchange = start;
if (!window.GameEffects) { const script = document.createElement('script'); script.src = '../../shared/effects.js?v=1'; document.head.appendChild(script); }
localStorage.setItem('game-hub:last-game', 'rami-tuiles');
start();
