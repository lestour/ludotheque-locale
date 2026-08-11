import('../../../shared/options-help.js?v=2');

const table = document.getElementById('table');
const status = document.getElementById('status');
const scores = document.getElementById('scores');
const rules = document.getElementById('rules');
const deckButton = document.getElementById('deck');
const discardButton = document.getElementById('discard');
const discardDrawButton = document.getElementById('discardDraw');
const continueActionButton = document.getElementById('continueAction');
const playersSelect = document.getElementById('players');
const limitSelect = document.getElementById('limit');
const columnsOption = document.getElementById('columns');
const doubleFinishOption = document.getElementById('doubleFinish');
const bonusRulesOption = document.getElementById('bonusRules');
const bonusArea = document.getElementById('bonusArea');
const actionDeckButton = document.getElementById('actionDeck');
const actionCount = document.getElementById('actionCount');
const actionMarket = document.getElementById('actionMarket');
const actionHand = document.getElementById('actionHand');
const actionChoice = document.getElementById('actionChoice');

const ACTIONS = {
  selfSwap: { name: 'Échange interne', text: 'Échangez deux cartes de votre grille.' },
  doubleTurn: { name: 'Double tour', text: 'Jouez deux tours supplémentaires.' },
  drawThree: { name: 'Choix de 3', text: 'Piochez trois nombres et gardez-en au plus un.' },
  inspect: { name: 'Éclairage', text: 'Regardez temporairement une ligne adverse ou personnelle.' },
  reactivate: { name: 'Réactivation', text: 'Rejouez la dernière action défaussée.' },
  defense: { name: 'Défense', text: 'Bloque une attaque ou donne un tour supplémentaire.' },
  opponentSwap: { name: 'Échange adverse', text: 'Échangez une de vos cartes avec celle d’un adversaire.' },
  thief: { name: 'Voleur', text: 'Volez une action adverse puis rejouez.' },
  meteor: { name: 'Météore', text: 'Chaque adversaire remplace une carte, sauf défense.' },
};

const ACTION_COUNTS = {
  selfSwap: 4,
  doubleTurn: 4,
  drawThree: 4,
  inspect: 4,
  reactivate: 3,
  defense: 3,
  opponentSwap: 3,
  thief: 2,
  meteor: 3,
};

let game;
let botTimer;

function shuffle(values) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [values[index], values[randomIndex]] = [values[randomIndex], values[index]];
  }
  return values;
}

function numberCard(value) {
  return { kind: 'number', value };
}

function starCard() {
  return { kind: 'star', value: 0 };
}

function plainCard(card) {
  return { kind: card.kind, value: card.value };
}

function boardCard(card, up = false) {
  return { ...plainCard(card), up, removed: false };
}

function makeDeck() {
  const cards = [
    ...Array(5).fill(null).map(() => numberCard(-2)),
    ...Array(10).fill(null).map(() => numberCard(-1)),
    ...Array(15).fill(null).map(() => numberCard(0)),
    ...Array.from({ length: 12 }, (_, index) => Array(10).fill(null).map(() => numberCard(index + 1))).flat(),
  ];
  if (bonusRulesOption.checked) cards.push(...Array(8).fill(null).map(starCard));
  return shuffle(cards);
}

function makeActionDeck() {
  return shuffle(Object.entries(ACTION_COUNTS).flatMap(([id, count]) => Array(count).fill(id)));
}

function name(index) {
  return index === 0 ? 'Vous' : `Bot ${index}`;
}

function log(text) {
  game.log.unshift(text);
  game.log = game.log.slice(0, 12);
}

function visible(card) {
  return card && card.up && !card.removed;
}

function isStar(card) {
  return card?.kind === 'star';
}

function cardPoints(card) {
  return isStar(card) ? 0 : card?.value ?? 0;
}

function cardLabel(card) {
  return isStar(card) ? '★' : `${card?.value ?? '—'}`;
}

function sameCard(left, right) {
  return left?.kind === right?.kind && (isStar(left) || left?.value === right?.value);
}

function boardScore(player) {
  return player.board.reduce((sum, card) => sum + (visible(card) ? cardPoints(card) : 0), player.roundBonus || 0);
}

function allRevealed(player) {
  return player.board.every(card => card.removed || card.up);
}

function drawCard() {
  if (!game.deck.length) {
    const topDiscard = game.discard.pop();
    game.deck = shuffle(game.discard.splice(0));
    if (topDiscard) game.discard.push(topDiscard);
  }
  return game.deck.pop() || numberCard(0);
}

function refillActionMarket() {
  while (game.actionMarket.length < 4) {
    if (!game.actionDeck.length) {
      if (!game.actionDiscard.length) break;
      game.actionDeck = shuffle(game.actionDiscard.splice(0));
    }
    const next = game.actionDeck.pop();
    if (!next) break;
    game.actionMarket.push(next);
  }
}

function removeMatchedGroups(player, playerIndex) {
  if (!columnsOption.checked && !bonusRulesOption.checked) return;
  let changed = true;
  while (changed) {
    changed = false;
    const groups = [];
    if (columnsOption.checked) {
      for (let column = 0; column < 4; column += 1) groups.push([column, column + 4, column + 8]);
    }
    if (bonusRulesOption.checked) {
      for (let row = 0; row < 3; row += 1) groups.push([row * 4, row * 4 + 1, row * 4 + 2, row * 4 + 3]);
    }
    for (const indexes of groups) {
      const cards = indexes.map(index => player.board[index]);
      if (!cards.every(visible) || !cards.every(card => sameCard(card, cards[0]))) continue;
      cards.forEach(card => { card.removed = true; });
      if (isStar(cards[0])) player.roundBonus -= indexes.length === 4 ? 15 : 10;
      log(`${name(playerIndex)} retire ${indexes.length === 4 ? 'une ligne' : 'une colonne'} de ${cardLabel(cards[0])}.`);
      changed = true;
    }
  }
}

function acquireAction(playerIndex, marketIndex = null, free = false) {
  if (!bonusRulesOption.checked) return false;
  let actionId;
  if (marketIndex === null) actionId = game.actionDeck.pop();
  else actionId = game.actionMarket.splice(marketIndex, 1)[0];
  if (!actionId) return false;
  game.people[playerIndex].actions.push({ id: actionId, readyAfter: game.turnSerial + 1 });
  refillActionMarket();
  log(`${name(playerIndex)} reçoit l’action « ${ACTIONS[actionId].name} ».${free ? ' grâce à une étoile' : ''}`);
  if (!free) nextTurn();
  else render();
  return true;
}

function grantStarAction(playerIndex) {
  if (!bonusRulesOption.checked) return;
  refillActionMarket();
  if (game.actionMarket.length) acquireAction(playerIndex, 0, true);
  else if (game.actionDeck.length) acquireAction(playerIndex, null, true);
}

function revealCard(playerIndex, cardIndex) {
  const card = game.people[playerIndex].board[cardIndex];
  if (!card || card.removed || card.up) return false;
  card.up = true;
  if (isStar(card)) grantStarAction(playerIndex);
  return true;
}

function finishRound(finisher) {
  game.people.forEach((player, playerIndex) => {
    player.board.forEach(card => { if (!card.removed) card.up = true; });
    removeMatchedGroups(player, playerIndex);
  });
  const roundScores = game.people.map(player => boardScore(player) + (bonusRulesOption.checked ? player.actions.length * 10 : 0));
  if (doubleFinishOption.checked && roundScores[finisher] !== Math.min(...roundScores)) roundScores[finisher] *= 2;
  game.people.forEach((player, index) => { player.score += roundScores[index]; });
  log(`Fin de manche : ${roundScores.map((score, index) => `${name(index)} ${score}`).join(' · ')}.`);
  if (game.people.some(player => player.score >= Number(limitSelect.value))) {
    game.over = true;
    const winner = game.people.map((player, index) => ({ index, score: player.score })).sort((left, right) => left.score - right.score)[0];
    status.textContent = `${name(winner.index)} gagne avec ${winner.score} points.`;
    render();
    return;
  }
  game.round += 1;
  startRound();
}

function nextTurn() {
  const completed = allRevealed(game.people[game.turn]);
  if (completed && game.finisher === null) {
    game.finisher = game.turn;
    log(`${name(game.turn)} révèle sa dernière carte : chaque adversaire joue encore une fois.`);
  }
  game.pending = null;
  game.selection = null;
  game.actionChoice = null;
  game.peek = null;
  if (game.extraTurns > 0) {
    game.extraTurns -= 1;
    game.turnSerial += 1;
    status.textContent = `${name(game.turn)} joue encore (${game.extraTurns + 1} tour${game.extraTurns ? 's' : ''}).`;
    render();
    scheduleBot();
    return;
  }
  const nextPlayer = (game.turn + 1) % game.people.length;
  if (game.finisher !== null && nextPlayer === game.finisher) {
    finishRound(game.finisher);
    return;
  }
  game.turn = nextPlayer;
  game.turnSerial += 1;
  status.textContent = game.turn === 0 ? 'À vous de jouer.' : `${name(game.turn)} réfléchit.`;
  render();
  scheduleBot();
}

function replaceBoardCard(playerIndex, cardIndex, replacement) {
  const player = game.people[playerIndex];
  const old = player.board[cardIndex];
  player.board[cardIndex] = boardCard(replacement, true);
  if (old && !old.removed) game.discard.push(plainCard(old));
  if (isStar(replacement)) grantStarAction(playerIndex);
  removeMatchedGroups(player, playerIndex);
}

function replace(cardIndex) {
  if (game.turn !== 0 || !game.pending) return;
  const replacement = game.pending.card;
  replaceBoardCard(0, cardIndex, replacement);
  log(`Vous remplacez une carte par ${cardLabel(replacement)}.`);
  nextTurn();
}

function useDiscard() {
  if (game.phase !== 'play' || game.turn !== 0 || game.pending || game.selection || !game.discard.length) return;
  game.pending = { card: game.discard.pop(), fromDiscard: true };
  status.textContent = 'Choisissez vous-même la carte à remplacer.';
  render();
}

function draw() {
  if (game.phase !== 'play' || game.turn !== 0 || game.pending || game.selection) return;
  game.pending = { card: drawCard(), fromDiscard: false };
  status.textContent = 'Remplacez une carte, ou défaussez-la puis choisissez une carte cachée à retourner.';
  render();
}

function discardAndReveal() {
  if (game.turn !== 0 || !game.pending || game.pending.fromDiscard) return;
  game.discard.push(plainCard(game.pending.card));
  log(`Vous défaussez ${cardLabel(game.pending.card)}.`);
  game.pending = null;
  game.selection = { type: 'revealOwn', picks: [] };
  status.textContent = 'Choisissez maintenant la carte cachée de votre grille à retourner.';
  render();
}

function consumeDefense(playerIndex) {
  const player = game.people[playerIndex];
  const defenseIndex = player.actions.findIndex(action => action.id === 'defense');
  if (defenseIndex < 0) return false;
  player.actions.splice(defenseIndex, 1);
  game.actionDiscard.push('defense');
  log(`${name(playerIndex)} bloque l’attaque avec une Défense.`);
  return true;
}

function stealAction(playerIndex) {
  const targets = game.people.map((player, index) => ({ player, index })).filter(entry => entry.index !== playerIndex && entry.player.actions.length);
  if (!targets.length) {
    log('Le Voleur ne trouve aucune action à prendre.');
    return;
  }
  const target = targets.sort((left, right) => right.player.actions.length - left.player.actions.length)[0];
  if (consumeDefense(target.index)) return;
  const stolen = target.player.actions.pop();
  game.people[playerIndex].actions.push({ ...stolen, readyAfter: game.turnSerial + 1 });
  log(`${name(playerIndex)} vole « ${ACTIONS[stolen.id].name} » à ${name(target.index)}.`);
}

function meteorShower(playerIndex) {
  game.people.forEach((player, targetIndex) => {
    if (targetIndex === playerIndex || consumeDefense(targetIndex)) return;
    const candidates = player.board.map((card, index) => ({ card, index })).filter(entry => !entry.card.removed);
    const target = candidates.filter(entry => visible(entry.card)).sort((left, right) => cardPoints(right.card) - cardPoints(left.card))[0] || candidates[0];
    if (target) replaceBoardCard(targetIndex, target.index, drawCard());
  });
  log(`${name(playerIndex)} déclenche une pluie de météores.`);
}

function completeAction() {
  nextTurn();
}

function runAction(playerIndex, actionId, isBot = false) {
  if (actionId === 'selfSwap') {
    if (isBot) {
      const available = game.people[playerIndex].board.map((card, index) => ({ card, index })).filter(entry => !entry.card.removed);
      if (available.length > 1) {
        const firstIndex = available[0].index;
        const lastIndex = available.at(-1).index;
        [game.people[playerIndex].board[firstIndex], game.people[playerIndex].board[lastIndex]] = [game.people[playerIndex].board[lastIndex], game.people[playerIndex].board[firstIndex]];
      }
      log(`${name(playerIndex)} échange deux cartes de sa grille.`);
      completeAction();
    } else {
      game.selection = { type: 'selfSwap', picks: [] };
      status.textContent = 'Sélectionnez deux cartes de votre grille à échanger.';
      render();
    }
    return;
  }
  if (actionId === 'doubleTurn') {
    game.extraTurns += 2;
    log(`${name(playerIndex)} obtient deux tours supplémentaires.`);
    completeAction();
    return;
  }
  if (actionId === 'drawThree') {
    const choices = [drawCard(), drawCard(), drawCard()];
    if (isBot) {
      const best = choices.sort((left, right) => cardPoints(left) - cardPoints(right))[0];
      choices.filter(card => card !== best).forEach(card => game.discard.push(plainCard(card)));
      const player = game.people[playerIndex];
      const target = player.board.map((card, index) => ({ card, index })).filter(entry => !entry.card.removed).sort((left, right) => cardPoints(right.card) - cardPoints(left.card))[0];
      if (target) replaceBoardCard(playerIndex, target.index, best);
      log(`${name(playerIndex)} choisit une carte parmi trois.`);
      completeAction();
    } else {
      game.actionChoice = choices;
      status.textContent = 'Choisissez une des trois cartes, ou aucune.';
      render();
    }
    return;
  }
  if (actionId === 'inspect') {
    if (isBot) {
      log(`${name(playerIndex)} inspecte une ligne cachée.`);
      completeAction();
    } else {
      game.selection = { type: 'inspect', picks: [] };
      status.textContent = 'Cliquez sur une carte pour inspecter toute sa ligne.';
      render();
    }
    return;
  }
  if (actionId === 'reactivate') {
    const previous = [...game.actionDiscard].reverse().find(id => id !== 'reactivate' && id !== 'defense');
    if (!previous) {
      log('Aucune action ne peut être réactivée.');
      completeAction();
    } else {
      log(`${name(playerIndex)} réactive « ${ACTIONS[previous].name} ».`);
      runAction(playerIndex, previous, isBot);
    }
    return;
  }
  if (actionId === 'defense') {
    game.extraTurns += 1;
    log(`${name(playerIndex)} joue sa Défense pour obtenir un tour supplémentaire.`);
    completeAction();
    return;
  }
  if (actionId === 'opponentSwap') {
    if (isBot) {
      const own = game.people[playerIndex].board.map((card, index) => ({ card, index })).filter(entry => !entry.card.removed).sort((left, right) => cardPoints(right.card) - cardPoints(left.card))[0];
      const targetIndex = playerIndex === 0 ? 1 : 0;
      if (consumeDefense(targetIndex)) {
        completeAction();
        return;
      }
      const other = game.people[targetIndex].board.map((card, index) => ({ card, index })).filter(entry => !entry.card.removed).sort((left, right) => cardPoints(left.card) - cardPoints(right.card))[0];
      if (own && other) [game.people[playerIndex].board[own.index], game.people[targetIndex].board[other.index]] = [other.card, own.card];
      log(`${name(playerIndex)} échange une carte avec ${name(targetIndex)}.`);
      completeAction();
    } else {
      game.selection = { type: 'opponentSwap', picks: [] };
      status.textContent = 'Choisissez une de vos cartes, puis une carte adverse.';
      render();
    }
    return;
  }
  if (actionId === 'thief') {
    stealAction(playerIndex);
    game.extraTurns += 1;
    completeAction();
    return;
  }
  if (actionId === 'meteor') {
    meteorShower(playerIndex);
    completeAction();
  }
}

function playHumanAction(actionIndex) {
  if (game.phase !== 'play' || game.turn !== 0 || game.pending || game.selection || game.actionChoice) return;
  const player = game.people[0];
  const action = player.actions[actionIndex];
  if (!action || action.readyAfter > game.turnSerial) return;
  player.actions.splice(actionIndex, 1);
  game.actionDiscard.push(action.id);
  runAction(0, action.id, false);
}

function chooseDrawThree(choiceIndex) {
  if (!game.actionChoice) return;
  const choices = game.actionChoice;
  if (choiceIndex < 0) {
    choices.forEach(card => game.discard.push(plainCard(card)));
    game.actionChoice = null;
    game.selection = { type: 'revealOwn', picks: [] };
    status.textContent = 'Aucune carte gardée : choisissez une carte cachée à révéler.';
  } else {
    const selected = choices[choiceIndex];
    choices.forEach((card, index) => { if (index !== choiceIndex) game.discard.push(plainCard(card)); });
    game.actionChoice = null;
    game.pending = { card: selected, fromDiscard: true };
    status.textContent = `Placez ${cardLabel(selected)} dans votre grille.`;
  }
  render();
}

function handleCellClick(playerIndex, cardIndex) {
  if (game.over) return;
  const player = game.people[playerIndex];
  const card = player.board[cardIndex];
  if (game.phase === 'setup') {
    if (playerIndex !== 0 || game.setupCount >= 2 || !revealCard(0, cardIndex)) return;
    game.setupCount += 1;
    log(`Vous retournez ${cardLabel(card)} pour préparer la manche.`);
    if (game.setupCount === 2) beginRound();
    else {
      status.textContent = 'Choisissez encore une carte de votre grille à retourner.';
      render();
    }
    return;
  }
  if (game.turn !== 0) return;
  if (game.selection?.type === 'revealOwn') {
    if (playerIndex !== 0 || !revealCard(0, cardIndex)) return;
    log(`Vous choisissez de révéler ${cardLabel(card)}.`);
    removeMatchedGroups(game.people[0], 0);
    nextTurn();
    return;
  }
  if (game.selection?.type === 'selfSwap') {
    if (playerIndex !== 0 || card.removed) return;
    if (game.selection.picks.includes(cardIndex)) return;
    game.selection.picks.push(cardIndex);
    if (game.selection.picks.length === 2) {
      const [first, second] = game.selection.picks;
      [player.board[first], player.board[second]] = [player.board[second], player.board[first]];
      log('Vous échangez deux cartes de votre grille.');
      removeMatchedGroups(player, 0);
      completeAction();
    } else render();
    return;
  }
  if (game.selection?.type === 'inspect') {
    if (card.removed) return;
    const row = Math.floor(cardIndex / 4);
    game.peek = { playerIndex, indexes: [row * 4, row * 4 + 1, row * 4 + 2, row * 4 + 3] };
    game.selection = null;
    status.textContent = `Ligne inspectée chez ${name(playerIndex)}. Cliquez sur Continuer après l’avoir observée.`;
    render();
    return;
  }
  if (game.selection?.type === 'opponentSwap') {
    if (card.removed) return;
    if (!game.selection.picks.length) {
      if (playerIndex !== 0) return;
      game.selection.picks.push({ playerIndex, cardIndex });
      status.textContent = 'Choisissez maintenant une carte adverse.';
      render();
      return;
    }
    if (playerIndex === 0) return;
    if (consumeDefense(playerIndex)) {
      completeAction();
      return;
    }
    const own = game.selection.picks[0];
    [game.people[0].board[own.cardIndex], player.board[cardIndex]] = [player.board[cardIndex], game.people[0].board[own.cardIndex]];
    log(`Vous échangez une carte avec ${name(playerIndex)}.`);
    removeMatchedGroups(game.people[0], 0);
    removeMatchedGroups(player, playerIndex);
    completeAction();
    return;
  }
  if (game.pending && playerIndex === 0 && !card.removed) replace(cardIndex);
}

function botPlayAction(playerIndex) {
  const player = game.people[playerIndex];
  const playable = player.actions.map((action, index) => ({ action, index })).filter(entry => entry.action.readyAfter <= game.turnSerial && entry.action.id !== 'defense');
  if (!playable.length || Math.random() > 0.35) return false;
  const selected = playable[Math.floor(Math.random() * playable.length)];
  player.actions.splice(selected.index, 1);
  game.actionDiscard.push(selected.action.id);
  runAction(playerIndex, selected.action.id, true);
  return true;
}

function botPlay() {
  if (game.over || game.phase !== 'play' || game.turn === 0) return;
  const playerIndex = game.turn;
  const player = game.people[playerIndex];
  if (bonusRulesOption.checked && botPlayAction(playerIndex)) return;
  if (bonusRulesOption.checked && Math.random() < 0.14 && (game.actionMarket.length || game.actionDeck.length)) {
    acquireAction(playerIndex, game.actionMarket.length ? Math.floor(Math.random() * game.actionMarket.length) : null, false);
    return;
  }
  const discard = game.discard.at(-1);
  const candidates = player.board.map((card, index) => ({ card, index })).filter(entry => !entry.card.removed);
  const worst = candidates.filter(entry => visible(entry.card)).sort((left, right) => cardPoints(right.card) - cardPoints(left.card))[0];
  const hidden = candidates.filter(entry => !entry.card.up);
  const target = worst || hidden[0] || candidates[0];
  const useDiscard = discard && cardPoints(discard) <= cardPoints(worst?.card || numberCard(8));
  const drawn = useDiscard ? game.discard.pop() : drawCard();
  if (target && (useDiscard || isStar(drawn) || cardPoints(drawn) <= cardPoints(worst?.card || numberCard(8)))) {
    replaceBoardCard(playerIndex, target.index, drawn);
    log(`${name(playerIndex)} remplace une carte par ${cardLabel(drawn)}.`);
  } else {
    game.discard.push(plainCard(drawn));
    const toReveal = hidden[Math.floor(Math.random() * hidden.length)];
    if (toReveal) revealCard(playerIndex, toReveal.index);
    log(`${name(playerIndex)} défausse et choisit une carte à révéler.`);
    removeMatchedGroups(player, playerIndex);
  }
  nextTurn();
}

function scheduleBot() {
  clearTimeout(botTimer);
  if (!game.over && game.phase === 'play' && game.turn !== 0) botTimer = setTimeout(botPlay, 650 + Math.random() * 650);
}

function isSelectable(playerIndex, cardIndex, card) {
  if (card.removed || game.over) return false;
  if (game.phase === 'setup') return playerIndex === 0 && !card.up && game.setupCount < 2;
  if (game.turn !== 0) return false;
  if (game.selection?.type === 'revealOwn') return playerIndex === 0 && !card.up;
  if (game.selection?.type === 'selfSwap') return playerIndex === 0;
  if (game.selection?.type === 'inspect') return true;
  if (game.selection?.type === 'opponentSwap') return game.selection.picks.length ? playerIndex !== 0 : playerIndex === 0;
  return Boolean(game.pending && playerIndex === 0);
}

function isSelected(playerIndex, cardIndex) {
  return game.selection?.picks?.some(pick => typeof pick === 'number' ? playerIndex === 0 && pick === cardIndex : pick.playerIndex === playerIndex && pick.cardIndex === cardIndex);
}

function renderCard(card, playerIndex, cardIndex) {
  const peeked = game.peek?.playerIndex === playerIndex && game.peek.indexes.includes(cardIndex);
  const shown = card.up || peeked;
  const classes = ['card'];
  if (card.removed) classes.push('removed');
  if (!shown) classes.push('back');
  if (!isStar(card) && card.value < 0) classes.push('negative');
  if (isStar(card)) classes.push('star');
  if (peeked) classes.push('peeked');
  if (isSelectable(playerIndex, cardIndex, card)) classes.push('selectable');
  if (isSelected(playerIndex, cardIndex)) classes.push('selected');
  return `<button class="${classes.join(' ')}" data-player="${playerIndex}" data-cell="${cardIndex}">${shown ? cardLabel(card) : ''}</button>`;
}

function renderActionCard(actionId, attributes = '', ready = false) {
  const action = ACTIONS[actionId];
  return `<button class="action-card${ready ? ' ready' : ''}${actionId === 'defense' ? ' defense' : ''}" ${attributes}><strong>${action.name}</strong><small>${action.text}</small></button>`;
}

function renderBonus() {
  bonusArea.hidden = !bonusRulesOption.checked;
  if (!bonusRulesOption.checked) return;
  actionCount.textContent = game.actionDeck.length;
  const acquisitionBlocked = game.phase !== 'play' || game.turn !== 0 || Boolean(game.pending || game.selection || game.actionChoice);
  actionDeckButton.disabled = acquisitionBlocked || !game.actionDeck.length;
  actionMarket.innerHTML = game.actionMarket.map((id, index) => renderActionCard(id, `data-market-action="${index}"`)).join('');
  actionMarket.querySelectorAll('[data-market-action]').forEach(button => {
    button.disabled = acquisitionBlocked;
    button.addEventListener('click', () => acquireAction(0, Number(button.dataset.marketAction), false));
  });
  const player = game.people[0];
  actionHand.innerHTML = player.actions.length
    ? player.actions.map((action, index) => renderActionCard(action.id, `data-hand-action="${index}"`, action.readyAfter <= game.turnSerial)).join('')
    : '<span class="muted">Aucune action.</span>';
  actionHand.querySelectorAll('[data-hand-action]').forEach(button => {
    const action = player.actions[Number(button.dataset.handAction)];
    button.disabled = game.phase !== 'play' || game.turn !== 0 || action.readyAfter > game.turnSerial || Boolean(game.pending || game.selection || game.actionChoice);
    button.addEventListener('click', () => playHumanAction(Number(button.dataset.handAction)));
  });
  if (game.actionChoice) {
    actionChoice.innerHTML = `<strong>Choix de 3 :</strong>${game.actionChoice.map((card, index) => `<button data-choice="${index}">${cardLabel(card)}</button>`).join('')}<button data-choice="-1">Aucune</button>`;
    actionChoice.querySelectorAll('[data-choice]').forEach(button => button.addEventListener('click', () => chooseDrawThree(Number(button.dataset.choice))));
  } else actionChoice.innerHTML = '';
}

function render() {
  table.innerHTML = game.people.map((player, playerIndex) => `
    <section class="player${game.phase === 'play' && playerIndex === game.turn ? ' active' : ''}">
      <strong>${name(playerIndex)}</strong>
      <div class="grid">${player.board.map((card, cardIndex) => renderCard(card, playerIndex, cardIndex)).join('')}</div>
      <small>${boardScore(player)} points visibles${bonusRulesOption.checked ? ` · ${player.actions.length} action(s)` : ''}</small>
    </section>`).join('');
  table.querySelectorAll('[data-player][data-cell]').forEach(cell => cell.addEventListener('click', () => handleCellClick(Number(cell.dataset.player), Number(cell.dataset.cell))));
  const blocked = game.over || game.phase !== 'play' || game.turn !== 0 || Boolean(game.pending || game.selection || game.actionChoice || game.peek);
  deckButton.disabled = blocked;
  deckButton.textContent = game.pending && !game.pending.fromDiscard ? cardLabel(game.pending.card) : 'PIOCHE';
  deckButton.classList.toggle('pending', Boolean(game.pending && !game.pending.fromDiscard));
  discardButton.disabled = blocked || !game.discard.length;
  discardButton.textContent = cardLabel(game.discard.at(-1));
  discardButton.classList.toggle('pending', Boolean(game.pending?.fromDiscard));
  const hasHiddenHumanCard = game.people[0].board.some(card => !card.up && !card.removed);
  discardDrawButton.hidden = !(game.pending && !game.pending.fromDiscard && game.turn === 0 && hasHiddenHumanCard);
  continueActionButton.hidden = !game.peek;
  scores.innerHTML = game.people.map((player, index) => `<p><strong>${name(index)}</strong> : ${player.score} pts</p>`).join('');
  document.getElementById('log').innerHTML = game.log.map(entry => `<li>${entry}</li>`).join('');
  rules.innerHTML = bonusRulesOption.checked
    ? '<strong>Mode bonus</strong><br>Les étoiles donnent une action. Trois étoiles en colonne valent −10, quatre en ligne −15. Les lignes identiques peuvent aussi disparaître. Chaque action inutilisée vaut +10 en fin de manche.'
    : '<strong>Règles classiques</strong><br>Prenez la défausse ou piochez. Une carte piochée peut remplacer la carte de votre choix, ou être défaussée pour retourner une carte cachée choisie.';
  renderBonus();
}

function beginRound() {
  game.phase = 'play';
  game.turnSerial += 1;
  game.turn = game.people.map((player, index) => ({ index, total: player.board.filter(visible).reduce((sum, card) => sum + cardPoints(card), 0) })).sort((left, right) => right.total - left.total)[0].index;
  status.textContent = `Nouvelle manche : ${name(game.turn)} commence avec le total visible le plus élevé.`;
  render();
  scheduleBot();
}

function startRound() {
  game.deck = makeDeck();
  game.discard = [];
  let firstDiscard = drawCard();
  while (isStar(firstDiscard)) {
    game.deck.unshift(firstDiscard);
    shuffle(game.deck);
    firstDiscard = drawCard();
  }
  game.discard.push(firstDiscard);
  game.actionDeck = bonusRulesOption.checked ? makeActionDeck() : [];
  game.actionMarket = [];
  game.actionDiscard = [];
  refillActionMarket();
  game.people.forEach((player, playerIndex) => {
    player.board = Array.from({ length: 12 }, () => boardCard(drawCard()));
    player.actions = [];
    player.roundBonus = 0;
    if (playerIndex !== 0) {
      shuffle(player.board.map((_, index) => index)).slice(0, 2).forEach(cardIndex => revealCard(playerIndex, cardIndex));
    }
  });
  game.phase = 'setup';
  game.setupCount = 0;
  game.turn = 0;
  game.finisher = null;
  game.pending = null;
  game.selection = null;
  game.actionChoice = null;
  game.peek = null;
  game.extraTurns = 0;
  status.textContent = 'Choisissez vous-même deux cartes de votre grille à retourner.';
  render();
}

function newGame() {
  clearTimeout(botTimer);
  game = {
    people: Array.from({ length: Number(playersSelect.value) }, () => ({ score: 0, board: [], actions: [], roundBonus: 0 })),
    round: 1,
    phase: 'setup',
    setupCount: 0,
    turn: 0,
    turnSerial: 0,
    deck: [],
    discard: [],
    actionDeck: [],
    actionMarket: [],
    actionDiscard: [],
    pending: null,
    selection: null,
    actionChoice: null,
    peek: null,
    extraTurns: 0,
    finisher: null,
    over: false,
    log: [],
  };
  startRound();
}

document.getElementById('newGame').addEventListener('click', newGame);
playersSelect.addEventListener('change', newGame);
bonusRulesOption.addEventListener('change', newGame);
deckButton.addEventListener('click', draw);
discardButton.addEventListener('click', useDiscard);
discardDrawButton.addEventListener('click', discardAndReveal);
continueActionButton.addEventListener('click', completeAction);
actionDeckButton.addEventListener('click', () => acquireAction(0, null, false));
columnsOption.addEventListener('change', render);
doubleFinishOption.addEventListener('change', render);
localStorage.setItem('game-hub:last-game', 'grille-zero');
newGame();
