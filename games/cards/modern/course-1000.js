const table = document.getElementById('table');
document.title = 'Course 1000';
document.querySelector('h1').textContent = 'Course 1000';
const hand = document.getElementById('hand');
const status = document.getElementById('status');
const targets = document.getElementById('targets');
const playersSelect = document.getElementById('players');
const drawButton = document.getElementById('draw');
const discard = document.getElementById('discard');
let game;
let timer;
let sortByKind = true;
document.querySelector('h2').insertAdjacentHTML('beforeend', ' <button id="sortHand">Trier par type</button>');
const sortHandButton = document.getElementById('sortHand');
drawButton.insertAdjacentHTML('afterend', ' <button id="discardMode">Défausser une carte</button>');
const discardModeButton = document.getElementById('discardMode');
document.head.insertAdjacentHTML('beforeend', '<style>.card.distance{background:linear-gradient(145deg,#fff 0 60%,#bbf7d0 61% 100%);color:#17243a}.card.attack{background:linear-gradient(145deg,#fff 0 60%,#fecaca 61% 100%);color:#17243a}.card.remedy{background:linear-gradient(145deg,#fff 0 60%,#bfdbfe 61% 100%);color:#17243a}.card.safety{background:linear-gradient(145deg,#fff 0 60%,#fde68a 61% 100%);color:#17243a}.hand .card:before{content:"🚗";display:block;font-size:20px;float:right}</style>');
document.head.insertAdjacentHTML('beforeend', '<style>.hand .card.discard-choice{outline:4px solid #dc2626;outline-offset:2px;filter:saturate(.75)}#discardMode{border-color:#dc2626}</style>');

function shuffle(values) { for (let index = values.length - 1; index > 0; index -= 1) { const other = Math.floor(Math.random() * (index + 1)); [values[index], values[other]] = [values[other], values[index]]; } return values; }
function name(index) { return index ? `Bot ${index}` : 'Vous'; }
function log(text) { game.log.unshift(text); game.log = game.log.slice(0, 8); }
function card(kind, name, value = 0) { return { kind, name, value }; }
function deck() {
  const cards = [];
  [[25, 10], [50, 10], [75, 10], [100, 12], [200, 4]].forEach(([value, count]) => { for (let index = 0; index < count; index += 1) cards.push(card('distance', `${value} km`, value)); });
  ['Feu rouge', 'Panne', 'Crevaison', 'Accident', 'Limite'].forEach(name => { for (let index = 0; index < 3; index += 1) cards.push(card('attack', name)); });
  ['Feu vert', 'Essence', 'Roue', 'Réparation', 'Fin limite'].forEach(name => { for (let index = 0; index < 4; index += 1) cards.push(card('remedy', name)); });
  ['Véhicule prioritaire', 'Citerne', 'Increvable', 'As du volant'].forEach(name => cards.push(card('safety', name)));
  return shuffle(cards);
}
function draw(player) { if (!game.deck.length) game.deck = shuffle(game.discard.splice(0)); const drawn = game.deck.pop(); if (drawn) game.people[player].hand.push(drawn); }
function immune(player, attack) { return player.safeties.some(safety => ({ 'Feu rouge': 'Véhicule prioritaire', Limite: 'Véhicule prioritaire', Panne: 'Citerne', Crevaison: 'Increvable', Accident: 'As du volant' })[attack] === safety.name); }
function playable(player, played, target = null) {
  if (played.kind === 'distance') return (player.battle === 'go' || player.safeties.some(safety => safety.name === 'Véhicule prioritaire')) && (!player.limit || played.value <= 50) && player.distance + played.value <= 1000 && (played.value !== 200 || player.twoHundreds < 2);
  if (played.kind === 'safety') return !player.safeties.some(safety => safety.name === played.name);
  if (played.kind === 'remedy') return played.name === 'Feu vert' ? player.battle !== 'go' : ({ Essence: 'Panne', Roue: 'Crevaison', Réparation: 'Accident' })[played.name] === player.battle || (played.name === 'Fin limite' && player.limit);
  return played.kind === 'attack' && target && target !== player && !immune(target, played.name) && (played.name === 'Limite' ? !target.limit : target.battle === 'go');
}
function applyCard(playerIndex, cardIndex, targetIndex = null) {
  const player = game.people[playerIndex];
  const played = player.hand[cardIndex];
  const target = targetIndex === null ? null : game.people[targetIndex];
  if (!playable(player, played, target)) return false;
  player.hand.splice(cardIndex, 1);
  if (played.kind === 'distance') { player.distance += played.value; if (played.value === 200) player.twoHundreds += 1; }
  else if (played.kind === 'attack') { if (played.name === 'Limite') target.limit = true; else target.battle = played.name; log(`${name(playerIndex)} attaque ${name(targetIndex)} : ${played.name}.`); }
  else if (played.kind === 'remedy') { if (played.name === 'Fin limite') player.limit = false; else if (played.name === 'Feu vert') player.battle = 'go'; else player.battle = 'stop'; }
  else { player.safeties.push(played); if (played.name === 'Véhicule prioritaire') { player.battle = 'go'; player.limit = false; } else if (({ Citerne: 'Panne', Increvable: 'Crevaison', 'As du volant': 'Accident' })[played.name] === player.battle) player.battle = 'stop'; }
  window.GameEffects?.play(played.kind === 'attack' ? 'error' : 'move');
  return true;
}
function play(index, targetIndex = null) {
  if (game.turn !== 0 || game.over || game.awaitingDraw) return;
  if (game.discardMode) { discardCard(index); return; }
  const played = game.people[0].hand[index];
  if (played.kind === 'attack' && targetIndex === null) { game.pending = index; render(); return; }
  if (!applyCard(0, index, targetIndex)) { status.textContent = 'Cette carte ne peut pas être jouée ici.'; window.GameEffects?.play('error'); return; }
  if (game.people[0].distance === 1000) { game.over = true; status.textContent = 'Vous gagnez exactement 1 000 km !'; render(); return; }
  next();
}
function bot() {
  const player = game.people[game.turn];
  const opponents = game.people.map((entry, index) => ({ entry, index })).filter(({ index }) => index !== game.turn);
  let index = player.hand.findIndex(played => played.kind === 'distance' && playable(player, played));
  let target = null;
  if (index < 0) for (const played of player.hand.filter(entry => entry.kind === 'attack')) { const found = opponents.find(({ entry }) => playable(player, played, entry)); if (found) { index = player.hand.indexOf(played); target = found.index; break; } }
  if (index < 0) index = player.hand.findIndex(played => (played.kind === 'remedy' || played.kind === 'safety') && playable(player, played));
  if (index < 0) { game.discard.push(player.hand.shift()); next(); return; }
  applyCard(game.turn, index, target);
  if (player.distance === 1000) { game.over = true; status.textContent = `${name(game.turn)} gagne.`; render(); return; }
  next();
}
function next() { game.pending = null; game.discardMode = false; game.turn = (game.turn + 1) % game.people.length; game.awaitingDraw = game.turn === 0; status.textContent = game.turn ? 'Le bot pioche puis prépare sa route.' : 'À vous de piocher.'; clearTimeout(timer); if (game.turn) { draw(game.turn); game.awaitingDraw = false; timer = setTimeout(bot, 650 + Math.random() * 650); } render(); }
function discardCard(index) { if (game.turn !== 0 || game.over || game.awaitingDraw) return; const [removed] = game.people[0].hand.splice(index, 1); if (!removed) return; game.discard.push(removed); game.discardMode = false; log(`Vous défaussez ${removed.name}.`); next(); }
function render() {
  table.innerHTML = game.people.map((player, index) => `<section class="player${index === game.turn && !game.over ? ' active' : ''}"><strong>${name(index)} · ${player.distance} km</strong><div class="road"><span class="car" style="left:${player.distance / 10}%">🚗</span></div><small>Bataille : ${player.battle === 'go' ? 'Feu vert' : player.battle} · ${player.limit ? 'limité à 50' : 'vitesse libre'}</small><div>${player.safeties.map(safety => `🛡️ ${safety.name}`).join(' · ') || 'Aucune botte'}</div><small>${player.hand.length} cartes</small></section>`).join('');
  const cards = game.people[0].hand.map((played, index) => ({ played, index })).sort((left, right) => sortByKind ? left.played.kind.localeCompare(right.played.kind) || left.played.value - right.played.value : left.index - right.index);
  hand.innerHTML = cards.map(({ played, index }) => `<button class="card ${played.kind}${game.discardMode ? ' discard-choice' : ''}" data-card="${index}"${game.awaitingDraw || game.pending !== null ? ' disabled' : ''}><strong>${played.name}</strong>${played.value ? `<br>${played.value} kilomètres` : ''}</button>`).join('');
  hand.querySelectorAll('[data-card]').forEach(button => { button.onclick = () => play(Number(button.dataset.card)); });
  sortHandButton.textContent = sortByKind ? 'Ordre de pioche' : 'Trier par type';
  targets.innerHTML = game.pending === null ? '' : game.people.slice(1).map((player, index) => `<button data-target="${index + 1}">Attaquer ${name(index + 1)}</button>`).join('');
  targets.querySelectorAll('[data-target]').forEach(button => { button.onclick = () => play(game.pending, Number(button.dataset.target)); });
  drawButton.textContent = `PIOCHE ${game.deck.length}`; drawButton.disabled = game.turn !== 0 || game.over || !game.awaitingDraw;
  discardModeButton.disabled = game.turn !== 0 || game.over || game.awaitingDraw || game.pending !== null;
  discardModeButton.textContent = game.discardMode ? 'Annuler la défausse' : 'Défausser une carte';
  const top = game.discard.at(-1); discard.textContent = top ? top.name : 'Défausse';
  document.getElementById('log').innerHTML = game.log.map(entry => `<li>${entry}</li>`).join('');
}
function newGame() { clearTimeout(timer); game = { deck: deck(), discard: [], turn: 0, pending: null, awaitingDraw: true, discardMode: false, over: false, log: [], people: Array.from({ length: Number(playersSelect.value) }, () => ({ hand: [], distance: 0, battle: 'stop', limit: false, safeties: [], twoHundreds: 0 })) }; game.people.forEach((_, index) => { for (let count = 0; count < 6; count += 1) draw(index); }); status.textContent = 'À vous de piocher, puis posez une carte ou défaussez-en une.'; render(); }
drawButton.onclick = () => { if (game.turn !== 0 || game.over || !game.awaitingDraw) return; draw(0); game.awaitingDraw = false; status.textContent = 'Jouez une carte ou activez le mode défausse.'; render(); };
discardModeButton.onclick = () => { if (game.turn !== 0 || game.over || game.awaitingDraw) return; game.discardMode = !game.discardMode; status.textContent = game.discardMode ? 'Choisissez la carte à défausser.' : 'Jouez une carte ou défaussez-en une.'; render(); };
document.getElementById('newGame').onclick = newGame; playersSelect.onchange = newGame;
sortHandButton.onclick = () => { sortByKind = !sortByKind; render(); };
if (!window.GameEffects) { const script = document.createElement('script'); script.src = '../../../shared/effects.js?v=1'; document.head.appendChild(script); }
localStorage.setItem('game-hub:last-game', 'course-1000'); newGame();
