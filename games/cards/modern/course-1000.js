import('../../../shared/options-help.js?v=3');
const table = document.getElementById('table');
document.title = 'Course 1000';
document.querySelector('h1').textContent = 'Course 1000';
const hand = document.getElementById('hand');
const status = document.getElementById('status');
const targets = document.getElementById('targets');
const playersSelect = document.getElementById('players');
const drawButton = document.getElementById('draw');
const discard = document.getElementById('discard');
document.querySelector('.toolbar').insertAdjacentHTML('beforeend', '<label class="muted">Objectif <select id="targetDistance"><option value="700">700 km</option><option value="1000" selected>1 000 km</option></select></label><label><input id="exactDistance" type="checkbox" checked> arrivée exacte</label><label><input id="coupFourre" type="checkbox" checked> coup fourré automatique</label>');
const targetDistance = document.getElementById('targetDistance');
const exactDistance = document.getElementById('exactDistance');
const coupFourre = document.getElementById('coupFourre');
let game;
let timer;
let sortByKind = true;
document.querySelector('h2').insertAdjacentHTML('beforeend', ' <button id="sortHand">Trier par type</button>');
const sortHandButton = document.getElementById('sortHand');
drawButton.insertAdjacentHTML('afterend', ' <button id="discardMode">Défausser une carte</button>');
const discardModeButton = document.getElementById('discardMode');
document.head.insertAdjacentHTML('beforeend', '<style>.card.distance{background:linear-gradient(145deg,#fff 0 60%,#bbf7d0 61% 100%);color:#17243a}.card.attack{background:linear-gradient(145deg,#fff 0 60%,#fecaca 61% 100%);color:#17243a}.card.remedy{background:linear-gradient(145deg,#fff 0 60%,#bfdbfe 61% 100%);color:#17243a}.card.safety{background:linear-gradient(145deg,#fff 0 60%,#fde68a 61% 100%);color:#17243a}.hand .card:before{content:"🚗";display:block;font-size:20px;float:right}.card.unplayable{filter:grayscale(.72);opacity:.68}.card-state{display:block;clear:both;margin-top:7px;font-size:10px;line-height:1.2;font-weight:600;color:#6b7280}.card.playable-card{outline:2px solid #16a34a55}</style>');
document.head.insertAdjacentHTML('beforeend', '<style>.hand .card.discard-choice{outline:4px solid #dc2626;outline-offset:2px;filter:saturate(.75)}#discardMode{border-color:#dc2626}</style>');

function shuffle(values) { for (let index = values.length - 1; index > 0; index -= 1) { const other = Math.floor(Math.random() * (index + 1)); [values[index], values[other]] = [values[other], values[index]]; } return values; }
function name(index) { return index ? `Bot ${index}` : 'Vous'; }
function log(text) { game.log.unshift(text); game.log = game.log.slice(0, 8); }
function card(kind, name, value = 0) { return { kind, name, value }; }
function deck() {
  const cards = [];
  [[25, 10], [50, 10], [75, 10], [100, 12], [200, 4]].forEach(([value, count]) => { for (let index = 0; index < count; index += 1) cards.push(card('distance', `${value} km`, value)); });
  [['Feu rouge', 5], ['Panne', 3], ['Crevaison', 3], ['Accident', 3], ['Limite', 4]].forEach(([name, count]) => { for (let index = 0; index < count; index += 1) cards.push(card('attack', name)); });
  [['Feu vert', 14], ['Essence', 6], ['Roue', 6], ['Réparation', 6], ['Fin limite', 6]].forEach(([name, count]) => { for (let index = 0; index < count; index += 1) cards.push(card('remedy', name)); });
  ['Véhicule prioritaire', 'Citerne', 'Increvable', 'As du volant'].forEach(name => cards.push(card('safety', name)));
  if (cards.length !== 106) throw new Error(`Paquet Course 1000 invalide : ${cards.length} cartes.`);
  return shuffle(cards);
}
function draw(player) { const drawn = game.deck.pop(); if (drawn) game.people[player].hand.push(drawn); return Boolean(drawn); }
function immune(player, attack) { return player.safeties.some(safety => ({ 'Feu rouge': 'Véhicule prioritaire', Limite: 'Véhicule prioritaire', Panne: 'Citerne', Crevaison: 'Increvable', Accident: 'As du volant' })[attack] === safety.name); }
function matchingSafety(attack) { return ({ 'Feu rouge': 'Véhicule prioritaire', Limite: 'Véhicule prioritaire', Panne: 'Citerne', Crevaison: 'Increvable', Accident: 'As du volant' })[attack]; }
function raceTarget() { return Number(targetDistance.value); }
function hasFinished(player) { return exactDistance.checked ? player.distance === raceTarget() : player.distance >= raceTarget(); }
function isRolling(player) { return player.battle === 'go' || (player.battle === 'stop' && player.safeties.some(safety => safety.name === 'Véhicule prioritaire')); }
function playable(player, played, target = null) {
  if (played.kind === 'distance') return isRolling(player) && (!player.limit || played.value <= 50) && (!exactDistance.checked || player.distance + played.value <= raceTarget()) && player.distance < raceTarget() && (played.value !== 200 || player.twoHundreds < 2);
  if (played.kind === 'safety') return !player.safeties.some(safety => safety.name === played.name);
  if (played.kind === 'remedy') return played.name === 'Feu vert' ? player.battle === 'stop' : ({ Essence: 'Panne', Roue: 'Crevaison', Réparation: 'Accident' })[played.name] === player.battle || (played.name === 'Fin limite' && player.limit);
  return played.kind === 'attack' && target && target !== player && !immune(target, played.name) && (played.name === 'Limite' ? !target.limit : isRolling(target));
}
function validTargets(playerIndex, played) { return game.people.map((target, targetIndex) => ({ target, targetIndex })).filter(({ target, targetIndex }) => targetIndex !== playerIndex && playable(game.people[playerIndex], played, target)); }
function playabilityReason(playerIndex, played, targetIndex = null) {
  const player = game.people[playerIndex];
  if (played.kind === 'attack') {
    if (targetIndex !== null) return playable(player, played, game.people[targetIndex]) ? '' : `${name(targetIndex)} est déjà protégé ou ne peut pas recevoir cette attaque.`;
    return validTargets(playerIndex, played).length ? '' : 'Aucun adversaire ne peut recevoir cette attaque actuellement.';
  }
  if (playable(player, played)) return '';
  if (played.kind === 'distance') {
    if (played.value === 200 && player.twoHundreds >= 2) return 'Deux étapes de 200 km sont déjà posées.';
    if (exactDistance.checked && player.distance + played.value > raceTarget()) return `Cette étape dépasserait ${raceTarget()} km.`;
    if (player.limit && played.value > 50) return 'La limite de vitesse n’autorise que 25 ou 50 km.';
    if (player.battle === 'stop') return 'Posez d’abord un Feu vert.';
    const parade = ({ Panne: 'Essence', Crevaison: 'Roue', Accident: 'Réparation', 'Feu rouge': 'Feu vert' })[player.battle];
    if (parade) return `Vous subissez ${player.battle} : jouez ${parade}${parade === 'Feu vert' ? '' : ', puis Feu vert'}.`;
  }
  if (played.kind === 'remedy') {
    if (played.name === 'Feu vert' && player.battle === 'go') return 'Vous roulez déjà.';
    if (played.name === 'Feu vert') return `Il faut d’abord annuler ${player.battle} avec la parade correspondante.`;
    if (played.name === 'Fin limite') return 'Vous ne subissez aucune limite de vitesse.';
    return `Cette parade ne correspond pas à l’attaque ${player.battle === 'stop' ? 'actuelle' : player.battle}.`;
  }
  if (played.kind === 'safety') return 'Cette Botte est déjà posée.';
  return 'Cette carte ne peut pas être jouée maintenant.';
}
function applyCard(playerIndex, cardIndex, targetIndex = null) {
  const player = game.people[playerIndex];
  const played = player.hand[cardIndex];
  const target = targetIndex === null ? null : game.people[targetIndex];
  if (!playable(player, played, target)) return false;
  player.hand.splice(cardIndex, 1);
  if (played.kind === 'distance') { player.distance += played.value; if (played.value === 200) player.twoHundreds += 1; }
  else if (played.kind === 'attack') {
    const safetyName = matchingSafety(played.name);
    const safetyIndex = coupFourre.checked ? target.hand.findIndex(candidate => candidate.kind === 'safety' && candidate.name === safetyName) : -1;
    if (safetyIndex >= 0) {
      const [safety] = target.hand.splice(safetyIndex, 1);
      target.safeties.push(safety);
      target.coupBonus += 300;
      if (safety.name === 'Véhicule prioritaire') target.limit = false;
      game.discard.push(played);
      game.refillBeforeTurn = targetIndex;
      game.forcedTurn = targetIndex;
      log(`${name(targetIndex)} réalise un coup fourré avec ${safety.name} et prend la main.`);
    } else {
      if (played.name === 'Limite') target.limit = true; else target.battle = played.name;
      log(`${name(playerIndex)} attaque ${name(targetIndex)} : ${played.name}.`);
    }
  }
  else if (played.kind === 'remedy') { if (played.name === 'Fin limite') player.limit = false; else if (played.name === 'Feu vert') player.battle = 'go'; else player.battle = 'stop'; }
  else {
    player.safeties.push(played);
    if (played.name === 'Véhicule prioritaire') { player.battle = 'go'; player.limit = false; }
    else if (({ Citerne: 'Panne', Increvable: 'Crevaison', 'As du volant': 'Accident' })[played.name] === player.battle) player.battle = 'stop';
    game.extraTurn = playerIndex;
    log(`${name(playerIndex)} pose ${played.name} et rejouera immédiatement.`);
  }
  window.GameEffects?.play(played.kind === 'attack' ? 'error' : 'move');
  return true;
}
function play(index, targetIndex = null) {
  if (game.turn !== 0 || game.over || game.awaitingDraw) return;
  if (game.discardMode) { discardCard(index); return; }
  const played = game.people[0].hand[index];
  if (!played) return;
  if (played.kind === 'attack' && targetIndex === null) {
    if (!validTargets(0, played).length) { status.textContent = playabilityReason(0, played); window.GameEffects?.play('error'); render(); return; }
    game.pending = index;
    status.textContent = 'Choisissez un adversaire valide, ou annulez la sélection.';
    render();
    return;
  }
  if (!applyCard(0, index, targetIndex)) { status.textContent = playabilityReason(0, played, targetIndex); window.GameEffects?.play('error'); render(); return; }
  if (hasFinished(game.people[0])) { game.over = true; status.textContent = `Vous gagnez la course de ${raceTarget()} km !`; window.GameRecords?.finish({ score: game.people[0].distance, scoreLabel: `${game.people[0].distance} km`, won: true }); render(); return; }
  next();
}
function bot() {
  const player = game.people[game.turn];
  const opponents = game.people.map((entry, index) => ({ entry, index })).filter(({ index }) => index !== game.turn);
  let index = player.hand.findIndex(played => played.kind === 'safety' && playable(player, played));
  if (index < 0) index = player.hand.findIndex(played => played.kind === 'remedy' && playable(player, played));
  if (index < 0) index = player.hand.findIndex(played => played.kind === 'distance' && playable(player, played));
  let target = null;
  if (index < 0) for (const played of player.hand.filter(entry => entry.kind === 'attack')) { const found = opponents.find(({ entry }) => playable(player, played, entry)); if (found) { index = player.hand.indexOf(played); target = found.index; break; } }
  if (index < 0) { game.discard.push(player.hand.shift()); next(); return; }
  applyCard(game.turn, index, target);
  if (hasFinished(player)) { game.over = true; status.textContent = `${name(game.turn)} gagne la course de ${raceTarget()} km.`; window.GameRecords?.finish({ score: player.distance, scoreLabel: `${player.distance} km`, won: game.turn === 0 }); render(); return; }
  next();
}
function finishExhaustedGame() {
  game.over = true;
  const bestDistance = Math.max(...game.people.map(player => player.distance));
  const winners = game.people.map((player, index) => player.distance === bestDistance ? name(index) : '').filter(Boolean);
  status.textContent = `Pioche et mains épuisées : ${winners.join(' et ')} ${winners.length > 1 ? 'terminent' : 'termine'} en tête avec ${bestDistance} km.`;
  window.GameRecords?.finish({ score: bestDistance, scoreLabel: `${bestDistance} km`, won: game.people[0].distance === bestDistance && winners.length === 1 });
  render();
}
function next() {
  game.pending = null;
  game.discardMode = false;
  const nextTurn = game.forcedTurn ?? game.extraTurn ?? (game.turn + 1) % game.people.length;
  game.turn = nextTurn;
  game.forcedTurn = null;
  game.extraTurn = null;
  if (game.refillBeforeTurn === game.turn) { draw(game.turn); game.refillBeforeTurn = null; }
  if (!game.deck.length && game.people.every(player => !player.hand.length)) { finishExhaustedGame(); return; }
  let skipped = 0;
  while (!game.deck.length && !game.people[game.turn].hand.length && skipped < game.people.length) {
    game.turn = (game.turn + 1) % game.people.length;
    skipped += 1;
  }
  if (skipped >= game.people.length) { finishExhaustedGame(); return; }
  game.awaitingDraw = game.turn === 0;
  status.textContent = game.turn ? 'Le bot pioche puis joue une carte, ou en défausse une.' : 'À vous : piochez une carte.';
  clearTimeout(timer);
  if (game.turn) {
    draw(game.turn);
    game.awaitingDraw = false;
    timer = setTimeout(bot, 650 + Math.random() * 650);
  }
  render();
}
function discardCard(index) { if (game.turn !== 0 || game.over || game.awaitingDraw) return; const [removed] = game.people[0].hand.splice(index, 1); if (!removed) return; game.discard.push(removed); game.discardMode = false; log(`Vous défaussez ${removed.name}.`); next(); }
function battleInstruction(player) {
  if (isRolling(player)) return 'Vous pouvez poser des étapes.';
  if (player.battle === 'stop') return 'Pour avancer : posez Feu vert.';
  const parade = ({ Panne: 'Essence', Crevaison: 'Roue', Accident: 'Réparation', 'Feu rouge': 'Feu vert' })[player.battle];
  return `Pour repartir : ${parade}${parade === 'Feu vert' ? '' : ', puis Feu vert'}.`;
}
function render() {
  table.innerHTML = game.people.map((player, index) => `<section class="player${index === game.turn && !game.over ? ' active' : ''}"><strong>${name(index)} · ${player.distance} / ${raceTarget()} km</strong><div class="road"><span class="car" style="left:${Math.min(100, player.distance / raceTarget() * 100)}%">🚗</span></div><small>Bataille : ${player.battle === 'go' ? 'Feu vert' : player.battle} · ${player.limit ? 'limité à 50' : 'vitesse libre'}</small><div class="route-help">${battleInstruction(player)}</div><div>${player.safeties.map(safety => `🛡️ ${safety.name}`).join(' · ') || 'Aucune botte'}</div><small>${player.hand.length} cartes${player.coupBonus ? ` · coups fourrés +${player.coupBonus}` : ''}</small></section>`).join('');
  const cards = game.people[0].hand.map((played, index) => ({ played, index })).sort((left, right) => sortByKind ? left.played.kind.localeCompare(right.played.kind) || left.played.value - right.played.value : left.index - right.index);
  hand.innerHTML = cards.map(({ played, index }) => {
    const reason = game.discardMode ? '' : playabilityReason(0, played);
    return `<button class="card ${played.kind}${game.discardMode ? ' discard-choice' : reason ? ' unplayable' : ' playable-card'}" data-card="${index}"${game.awaitingDraw || game.pending !== null ? ' disabled' : ''}><strong>${played.name}</strong>${played.value ? `<br>${played.value} kilomètres` : ''}<span class="card-state">${game.discardMode ? 'Cliquer pour défausser' : reason || (played.kind === 'attack' ? 'Choisir une cible' : 'Jouable maintenant')}</span></button>`;
  }).join('');
  hand.querySelectorAll('[data-card]').forEach(button => { button.onclick = () => play(Number(button.dataset.card)); });
  sortHandButton.textContent = sortByKind ? 'Ordre de pioche' : 'Trier par type';
  const pendingCard = game.pending === null ? null : game.people[0].hand[game.pending];
  targets.innerHTML = !pendingCard ? '' : `${validTargets(0, pendingCard).map(({ targetIndex }) => `<button data-target="${targetIndex}">Attaquer ${name(targetIndex)}</button>`).join('')}<button id="cancelTarget">Annuler</button>`;
  targets.querySelectorAll('[data-target]').forEach(button => { button.onclick = () => play(game.pending, Number(button.dataset.target)); });
  document.getElementById('cancelTarget')?.addEventListener('click', () => { game.pending = null; status.textContent = 'Jouez une carte ou défaussez-en une.'; render(); });
  drawButton.textContent = game.deck.length ? `PIOCHE ${game.deck.length}` : 'PIOCHE VIDE'; drawButton.disabled = game.turn !== 0 || game.over || !game.awaitingDraw;
  discardModeButton.disabled = game.turn !== 0 || game.over || game.awaitingDraw || game.pending !== null;
  discardModeButton.textContent = game.discardMode ? 'Annuler la défausse' : 'Défausser une carte';
  const top = game.discard[game.discard.length - 1]; discard.textContent = top ? top.name : 'Défausse';
  document.getElementById('log').innerHTML = game.log.map(entry => `<li>${entry}</li>`).join('');
}
function newGame() { clearTimeout(timer); game = { deck: deck(), discard: [], turn: 0, forcedTurn: null, extraTurn: null, refillBeforeTurn: null, pending: null, awaitingDraw: true, discardMode: false, over: false, log: [], people: Array.from({ length: Number(playersSelect.value) }, () => ({ hand: [], distance: 0, battle: 'stop', limit: false, safeties: [], twoHundreds: 0, coupBonus: 0 })) }; game.people.forEach((_, index) => { for (let count = 0; count < 6; count += 1) draw(index); }); status.textContent = `Course de ${raceTarget()} km : piochez, puis jouez une carte. Au départ, il faut un Feu vert ou la Botte Véhicule prioritaire.`; render(); }

window.Course1000TestAPI = Object.freeze({
  diagnostics: () => {
    const cards = deck();
    const stopped = { distance: 0, battle: 'stop', limit: false, safeties: [], twoHundreds: 0 };
    const rolling = { ...stopped, battle: 'go' };
    return {
      deckSize: cards.length,
      distances: cards.filter(entry => entry.kind === 'distance').length,
      attacks: cards.filter(entry => entry.kind === 'attack').length,
      remedies: cards.filter(entry => entry.kind === 'remedy').length,
      safeties: cards.filter(entry => entry.kind === 'safety').length,
      startRequiresGreen: !playable(stopped, card('distance', '25 km', 25)) && playable(stopped, card('remedy', 'Feu vert')),
      rollingAcceptsDistance: playable(rolling, card('distance', '25 km', 25)),
    };
  },
});
drawButton.onclick = () => { if (game.turn !== 0 || game.over || !game.awaitingDraw) return; const drawn = draw(0); game.awaitingDraw = false; status.textContent = drawn ? 'Jouez une carte, ou défaussez-en une.' : 'La pioche est vide : jouez ou défaussez une carte de votre main.'; render(); };
discardModeButton.onclick = () => { if (game.turn !== 0 || game.over || game.awaitingDraw) return; game.discardMode = !game.discardMode; status.textContent = game.discardMode ? 'Choisissez la carte à défausser.' : 'Jouez une carte ou défaussez-en une.'; render(); };
document.getElementById('newGame').onclick = newGame; playersSelect.onchange = newGame;
targetDistance.onchange = newGame;
exactDistance.onchange = newGame;
sortHandButton.onclick = () => { sortByKind = !sortByKind; render(); };
if (!window.GameEffects) { const script = document.createElement('script'); script.src = '../../../shared/effects.js?v=1'; document.head.appendChild(script); }
localStorage.setItem('game-hub:last-game', 'course-1000'); newGame();
