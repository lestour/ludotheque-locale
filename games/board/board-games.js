const board = document.getElementById('board');
const titleElement = document.getElementById('title');
const rulesElement = document.getElementById('rules');
const statusElement = document.getElementById('status');
const variantSelect = document.getElementById('variant');
const skinSelect = document.getElementById('boardSkin');
const playerCountSelect = document.getElementById('playerCount');
const rollButton = document.getElementById('roll');
const buyButton = document.getElementById('buy');
const skipButton = document.getElementById('skip');
const buildButton = document.getElementById('build');
const tradeButton = document.getElementById('trade');
const wheelElement = document.getElementById('wheel');
const diceElement = document.getElementById('dice');
const offersElement = document.getElementById('offers');
const playersElement = document.getElementById('players');
const assetsElement = document.getElementById('assets');
const assetsTitleElement = document.getElementById('assetsTitle');
const logElement = document.getElementById('log');
const modalHost = document.getElementById('modalHost');

const tokenColors = ['#2563eb', '#dc2626', '#059669', '#7c3aed'];
let game;
let botTimer;
let wheelRotation = 0;
let flashSequence = 0;

const estateGroups = [
  ['brun', '#7a4b2b', 2], ['bleu ciel', '#7bd2e8', 3], ['rose', '#d56a9d', 3],
  ['orange', '#ed9146', 3], ['rouge', '#d94a4a', 3], ['jaune', '#e9d34c', 3],
  ['vert', '#54a56d', 3], ['bleu nuit', '#335a9f', 2]
];
const estatePropertyIndexes = [1, 3, 6, 8, 9, 11, 13, 14, 16, 18, 19, 21, 23, 24, 26, 27, 29, 31, 32, 34, 37, 39];
const estateSkins = {
  france: ['Départ', 'Marcillac-Vallon', 'Caisse commune', 'Millau', 'Impôts', 'Gare de Lyon', 'Angers', 'Destin', 'Bordeaux', 'Toulouse', 'Prison / visite', 'Montpellier', 'Électricité', 'Rennes', 'Strasbourg', 'Gare de Paris', 'Lille', 'Caisse commune', 'Nice', 'Marseille', 'Parc gratuit', 'Lyon', 'Destin', 'Nantes', 'Reims', 'Gare du Nord', 'Chambéry', 'Grenoble', 'Eaux', 'Annecy', 'Allez en prison', 'Dijon', 'Aix-en-Provence', 'Caisse commune', 'Biarritz', 'Gare Saint-Charles', 'Destin', 'Versailles', 'Taxe de luxe', 'Paris'],
  usa: ['Départ', 'Boston', 'Caisse commune', 'Chicago', 'Impôts', 'Gare centrale', 'Seattle', 'Destin', 'Denver', 'Austin', 'Prison / visite', 'Miami', 'Électricité', 'Atlanta', 'Dallas', 'Gare de l’Union', 'San Francisco', 'Caisse commune', 'Las Vegas', 'Nouvelle-Orléans', 'Parc gratuit', 'Phoenix', 'Destin', 'Los Angeles', 'Washington', 'Gare du Capitole', 'Portland', 'Detroit', 'Eaux', 'Philadelphie', 'Allez en prison', 'Houston', 'Orlando', 'Caisse commune', 'Honolulu', 'Grand Central', 'Destin', 'San Diego', 'Taxe de luxe', 'New York'],
  uk: ['Départ', 'Édimbourg', 'Caisse commune', 'Cardiff', 'Impôts', 'Gare du Nord', 'Bristol', 'Destin', 'Liverpool', 'Manchester', 'Prison / visite', 'Brighton', 'Électricité', 'Leeds', 'Birmingham', 'Gare du Sud', 'Glasgow', 'Caisse commune', 'Cambridge', 'York', 'Parc gratuit', 'Sheffield', 'Destin', 'Oxford', 'Windsor', 'Gare de l’Ouest', 'Bath', 'Nottingham', 'Eaux', 'Canterbury', 'Allez en prison', 'Belfast', 'Swansea', 'Caisse commune', 'Dover', 'Gare de l’Est', 'Destin', 'Newcastle', 'Taxe de luxe', 'Londres'],
  galaxy: ['Départ', 'Auriga', 'Réseau stellaire', 'Nébula', 'Taxe orbitale', 'Navette centrale', 'Cérès', 'Destin', 'Orion', 'Cygnus', 'Cellule / visite', 'Hélios', 'Énergie', 'Vesper', 'Nova', 'Port spatial', 'Titan', 'Réseau stellaire', 'Kepler', 'Atlas', 'Repos orbital', 'Nyx', 'Destin', 'Zénith', 'Éclipse', 'Navette libre', 'Aster', 'Solaria', 'Eau', 'Polaris', 'Station pénitentiaire', 'Gaïa', 'Altaïr', 'Réseau stellaire', 'Lumen', 'Navette lointaine', 'Destin', 'Andromède', 'Taxe de luxe', 'Cosmos'],
  fantasy: ['Départ', 'Valbois', 'Conseil', 'Hauterive', 'Taxe royale', 'Gare des forges', 'Clairvallon', 'Destin', 'Sylveclaire', 'Montedor', 'Prison / visite', 'Rochebrune', 'Pierre de vision', 'Fortacier', 'Boisombre', 'Gare forestière', 'Mines profondes', 'Conseil', 'Tourcendre', 'Citadelle blanche', 'Repos', 'Terres noires', 'Destin', 'Désert rouge', 'Île éternelle', 'Gare du Nord', 'Vieilleforêt', 'Lacbourg', 'Eaux', 'Monts de fer', 'Tour sombre', 'Havres clairs', 'Valdor', 'Conseil', 'Nordgel', 'Gare de l’Ouest', 'Destin', 'Port-Serein', 'Taxe de luxe', 'Pic du Dragon'],
  academy: ['Départ', 'Village des mages', 'Banque runique', 'Val-enchanté', 'Taxe magique', 'Express arcanique', 'Allée des grimoires', 'Destin', 'Maison des alchimistes', 'Clinique enchantée', 'Prison / visite', 'Conseil magique', 'Énergie mystique', 'Académie boréale', 'Académie australe', 'Voie secrète', 'Forteresse magique', 'Banque runique', 'Manoir ancien', 'Maison du serpent', 'Salle mouvante', 'Institut occidental', 'Destin', 'Maison du blaireau', 'Maison de l’aigle', 'Carrosse nocturne', 'Maison du lion', 'Marché des sortilèges', 'Eaux', 'Crypte des secrets', 'Forteresse magique', 'Forêt enchantée', 'Banque runique', 'Manoir des ombres', 'Tournoi aérien', 'Gare de l’académie', 'Destin', 'Institut tropical', 'Taxe de luxe', 'Grande Académie']
};
let estateNames = estateSkins.france.slice();

const chanceCards = [
  { title: 'Destin', text: 'Avancez jusqu’au départ.', effect: { type: 'move', index: 0, collect: true } },
  { title: 'Destin', text: 'Avancez de trois cases.', effect: { type: 'relativeMove', steps: 3 } },
  { title: 'Destin', text: 'Reculez de trois cases.', effect: { type: 'relativeMove', steps: -3 } },
  { title: 'Destin', text: 'Prime exceptionnelle : recevez 120 €.', effect: { type: 'cash', amount: 120 } },
  { title: 'Destin', text: 'Amende administrative : payez 80 €.', effect: { type: 'cash', amount: -80 } },
  { title: 'Destin', text: 'Rendez-vous immédiatement en prison.', effect: { type: 'jail' } },
  { title: 'Destin', text: 'Réparations : 25 € par maison.', effect: { type: 'repairs', amount: 25 } },
  { title: 'Destin', text: 'Votre placement rapporte 150 €.', effect: { type: 'cash', amount: 150 } },
  { title: 'Destin', text: 'Frais de voyage : payez 60 €.', effect: { type: 'cash', amount: -60 } },
  { title: 'Destin', text: 'Recevez une carte de libération.', effect: { type: 'stored', id: 'release', label: 'Libération' } }
];
const communityCards = [
  { title: 'Caisse commune', text: 'Remboursement fiscal : recevez 100 €.', effect: { type: 'cash', amount: 100 } },
  { title: 'Caisse commune', text: 'Facture médicale : payez 50 €.', effect: { type: 'cash', amount: -50 } },
  { title: 'Caisse commune', text: 'Héritage : recevez 120 €.', effect: { type: 'cash', amount: 120 } },
  { title: 'Caisse commune', text: 'Avancez jusqu’au départ.', effect: { type: 'move', index: 0, collect: true } },
  { title: 'Caisse commune', text: 'Recevez une carte de libération.', effect: { type: 'stored', id: 'release', label: 'Libération' } },
  { title: 'Caisse commune', text: 'Frais scolaires : payez 90 €.', effect: { type: 'cash', amount: -90 } },
  { title: 'Caisse commune', text: 'Vente d’occasion : recevez 75 €.', effect: { type: 'cash', amount: 75 } },
  { title: 'Caisse commune', text: 'Travaux de voirie : 20 € par maison.', effect: { type: 'repairs', amount: 20 } }
];

const resources = ['Aluminium', 'Blé', 'Bois', 'Cacao', 'Café', 'Charbon', 'Cobalt', 'Coton', 'Cuivre', 'Diamant', 'Fer', 'Gaz', 'Hydraulique', 'Laine', 'Maïs', 'Or', 'Pétrole', 'Plomb', 'Riz', 'Solaire', 'Sucre', 'Thé', 'Tourisme', 'Uranium'];
const countries = ['France', 'Belgique', 'Royaume-Uni', 'Suède', 'Allemagne', 'Italie', 'Espagne', 'Maroc', 'Égypte', 'Ghana', 'Éthiopie', 'Inde', 'Chine', 'Japon', 'Vietnam', 'Indonésie', 'Australie', 'Nouvelle-Zélande', 'Canada', 'États-Unis', 'Mexique', 'Brésil', 'Pérou', 'Argentine', 'Colombie', 'Venezuela', 'Russie', 'Kazakhstan', 'Turquie', 'Iran', 'Afrique du Sud', 'Qatar', 'Corée'];
const worldTrack = ['Départ', 'France', 'Actualité', 'Blé', 'Belgique', 'Enchères', 'Cobalt', 'Royaume-Uni', 'Choix Europe', 'Suède', 'Bois', 'Allemagne', 'Joker', 'Italie', 'Tourisme', 'Espagne', 'Douane', 'Maroc', 'Cacao', 'Égypte', 'Choix Afrique', 'Ghana', 'Or', 'Éthiopie', 'Actualité', 'Inde', 'Thé', 'Chine', 'Choix Asie', 'Japon', 'Cuivre', 'Vietnam', 'Joker', 'Indonésie', 'Pétrole', 'Australie', 'Laine', 'Nouvelle-Zélande', 'Enchères', '500 000 €', 'Canada', 'Fer', 'États-Unis', 'Choix Amérique', 'Mexique', 'Maïs', 'Brésil', 'Café', 'Pérou', 'Argentine', 'Cuivre', 'Colombie', 'Actualité', 'Venezuela', 'Pétrole', 'Choix mondial', 'Russie', 'Gaz', 'Kazakhstan', 'Uranium', 'Douane', 'Turquie', 'Coton', 'Iran', 'Qatar', 'Joker', 'Afrique du Sud', 'Diamant', 'Actualité', 'Choix mondial', '500 000 €', 'Enchères'];
const worldNews = [
  { text: 'Hausse des cours : recevez 1 500 000 €.', amount: 1500000 },
  { text: 'Taxe environnementale : payez 1 000 000 €.', amount: -1000000 },
  { text: 'Subvention industrielle : recevez 2 000 000 €.', amount: 2000000 },
  { text: 'Crise des marchés : payez 2 000 000 €.', amount: -2000000 },
  { text: 'Contrat exceptionnel : recevez 3 000 000 €.', amount: 3000000 }
];

const paydayTrack = [
  { type: 'start', label: 'Départ' }, { type: 'mail', label: '2 courriers', count: 2 },
  { type: 'deal', label: 'Acquisition' }, { type: 'mail', label: '1 courrier', count: 1 },
  { type: 'sale', label: 'Vente' }, { type: 'mail', label: '3 courriers', count: 3 },
  { type: 'deal', label: 'Acquisition' }, { type: 'election', label: 'Caisse électorale' },
  { type: 'mail', label: '2 courriers', count: 2 }, { type: 'dice', label: 'Concours de roue' },
  { type: 'deal', label: 'Acquisition' }, { type: 'mail', label: '1 courrier', count: 1 },
  { type: 'lottery', label: 'Loterie' }, { type: 'mail', label: '2 courriers', count: 2 },
  { type: 'rest', label: 'Repos' }, { type: 'deal', label: 'Acquisition' },
  { type: 'mail', label: '3 courriers', count: 3 }, { type: 'sale', label: 'Vente' },
  { type: 'mail', label: '1 courrier', count: 1 }, { type: 'lottery', label: 'Loterie' },
  { type: 'deal', label: 'Acquisition' }, { type: 'mail', label: '2 courriers', count: 2 },
  { type: 'savings', label: 'Épargne' }, { type: 'clock', label: 'Changement d’heure' },
  { type: 'deal', label: 'Acquisition' }, { type: 'mail', label: '3 courriers', count: 3 },
  { type: 'sale', label: 'Vente' }, { type: 'mail', label: '1 courrier', count: 1 },
  { type: 'deal', label: 'Acquisition' }, { type: 'winning', label: 'Tirage du mois' },
  { type: 'payday', label: 'Jour de paye' }
];
const paydayMail = [
  { title: 'Courrier', text: 'Remboursement : recevez 250 €.', type: 'cash', amount: 250 },
  { title: 'Courrier', text: 'Réparation automobile : payez 300 €.', type: 'cash', amount: -300 },
  { title: 'Courrier', text: 'Facture médicale de 250 €.', type: 'bill', amount: 250 },
  { title: 'Courrier', text: 'Facture d’énergie de 180 €.', type: 'bill', amount: 180 },
  { title: 'Courrier', text: 'Vous recevez un billet de loterie.', type: 'stored', kind: 'lottery', label: 'Billet de loterie' },
  { title: 'Courrier', text: 'Carte postale : aucun mouvement financier.', type: 'none' },
  { title: 'Courrier', text: 'Ristourne : recevez 180 €.', type: 'cash', amount: 180 },
  { title: 'Courrier', text: 'Cotisation : payez 120 €.', type: 'cash', amount: -120 }
];
const paydayDeals = [
  { name: 'Vélo vintage', cost: 300, value: 550 }, { name: 'Collection de bandes dessinées', cost: 450, value: 820 },
  { name: 'Appareil photo', cost: 600, value: 1000 }, { name: 'Petit terrain', cost: 900, value: 1400 },
  { name: 'Ordinateur restauré', cost: 720, value: 1160 }, { name: 'Mobilier ancien', cost: 520, value: 910 }
];

function shuffle(values) {
  const copy = values.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

function money(value) {
  return `${Math.round(value).toLocaleString('fr-FR')} €`;
}

function playerName(index) {
  return index === 0 ? 'Vous' : `Bot ${index}`;
}

function currentPlayer() {
  return game.people[game.turn];
}

function log(message) {
  game.log.unshift(message);
  game.log = game.log.slice(0, 10);
}

function delay(duration) {
  if (game?.fast) return Promise.resolve();
  return new Promise(resolve => setTimeout(resolve, duration));
}

function changeCash(playerIndex, amount, reason = '') {
  const player = game.people[playerIndex];
  player.cash += amount;
  flashSequence += 1;
  game.cashFlashes ||= {};
  game.cashFlashes[playerIndex] = { amount, sequence: flashSequence };
  if (reason) log(`${playerName(playerIndex)} ${amount >= 0 ? 'reçoit' : 'paie'} ${money(Math.abs(amount))} — ${reason}.`);
  renderSidebar();
  const sequence = flashSequence;
  setTimeout(() => {
    if (game?.cashFlashes?.[playerIndex]?.sequence === sequence) {
      delete game.cashFlashes[playerIndex];
      renderSidebar();
    }
  }, 1250);
}

function showModal({ title, text, color = '#d97706', actions = [{ label: 'Continuer', value: 'continue' }], content = '' }) {
  const defaultValue = actions[0]?.value;
  if (game.fast) return Promise.resolve(defaultValue);
  modalHost.innerHTML = '';
  return new Promise(resolve => {
    const modal = document.createElement('div');
    modal.className = 'board-modal';
    modal.style.setProperty('--modal-color', color);
    modal.innerHTML = `<article><h2>${title}</h2><p>${text}</p>${content}<div class="modal-actions">${actions.map((action, index) => `<button data-modal-action="${index}">${action.label}</button>`).join('')}</div></article>`;
    const finish = value => {
      modal.remove();
      resolve(value);
    };
    modal.querySelectorAll('[data-modal-action]').forEach((button, index) => {
      button.addEventListener('click', () => finish(actions[index].value));
    });
    modalHost.append(modal);
    if (game.turn !== 0) setTimeout(() => finish(defaultValue), 700 + Math.random() * 350);
  });
}

async function spinOneDie() {
  const value = 1 + Math.floor(Math.random() * 6);
  wheelRotation += 720 + (6 - value) * 60 + Math.floor(Math.random() * 2) * 360;
  wheelElement.style.setProperty('--rotation', `${wheelRotation}deg`);
  const startedAt = performance.now();
  while (!game.fast && performance.now() - startedAt < 930) {
    wheelElement.dataset.value = String(1 + Math.floor(Math.random() * 6));
    await delay(75);
  }
  wheelElement.dataset.value = String(value);
  await delay(130);
  return value;
}

async function spinDice(count) {
  const values = [];
  for (let index = 0; index < count; index += 1) values.push(await spinOneDie());
  diceElement.textContent = count === 1 ? String(values[0]) : `${values[0]} + ${values[1]} = ${values[0] + values[1]}`;
  return values;
}

async function movePlayer(playerIndex, steps, trackLength, onWrap) {
  const player = game.people[playerIndex];
  const direction = steps < 0 ? -1 : 1;
  for (let count = 0; count < Math.abs(steps); count += 1) {
    const previous = player.pos;
    player.pos = (player.pos + direction + trackLength) % trackLength;
    if (direction > 0 && player.pos < previous) {
      player.laps = (player.laps || 0) + 1;
      if (onWrap) onWrap();
    }
    renderBoard();
    await delay(92);
  }
}

async function moveTo(playerIndex, target, trackLength, collect, onWrap) {
  const player = game.people[playerIndex];
  let steps = (target - player.pos + trackLength) % trackLength;
  if (steps === 0 && collect) steps = trackLength;
  await movePlayer(playerIndex, steps, trackLength, onWrap);
}

function estateSpace(index) {
  if (estatePropertyIndexes.includes(index)) {
    const order = estatePropertyIndexes.indexOf(index);
    let passed = 0;
    const group = estateGroups.findIndex(([, , count]) => {
      passed += count;
      return order < passed;
    });
    return { type: 'property', group, cost: 60 + group * 40 + (order % 3) * 20 };
  }
  if ([5, 15, 25, 35].includes(index)) return { type: 'station', cost: 200 };
  if ([12, 28].includes(index)) return { type: 'utility', cost: 150 };
  if ([2, 17, 33].includes(index)) return { type: 'community' };
  if ([7, 22, 36].includes(index)) return { type: 'chance' };
  if ([4, 38].includes(index)) return { type: 'tax', cost: index === 4 ? 200 : 100 };
  if (index === 30) return { type: 'jail' };
  return { type: index === 0 ? 'start' : index === 10 ? 'visit' : index === 20 ? 'parking' : 'rest' };
}

function estateOwner(index) {
  return game.people.findIndex(player => player.assets.some(asset => asset.kind === 'estate' && asset.index === index));
}

function estateAsset(index) {
  const owner = estateOwner(index);
  return owner < 0 ? null : game.people[owner].assets.find(asset => asset.index === index);
}

function hasEstateSet(player, group) {
  return player.assets.filter(asset => asset.kind === 'estate' && asset.group === group).length === estateGroups[group][2];
}

function estateWorth(player) {
  return player.cash + player.assets.reduce((total, asset) => total + (asset.cost || 0) + (asset.houses || 0) * (asset.houseCost || 0), 0);
}

function createEstate() {
  estateNames = (estateSkins[skinSelect.value] || estateSkins.france).slice();
  game = {
    kind: 'estate', turn: 0, turns: 0, busy: false, over: false, pending: null, log: [],
    chance: shuffle(chanceCards), community: shuffle(communityCards),
    people: Array.from({ length: Number(playerCountSelect.value) }, () => ({ cash: 1500, pos: 0, laps: 0, assets: [], stored: [], jail: 0, doubles: 0, out: false }))
  };
}

function enterJail(playerIndex) {
  const player = game.people[playerIndex];
  player.pos = 10;
  player.jail = 2;
  player.doubles = 0;
  log(`${playerName(playerIndex)} va en prison.`);
}

async function drawEstateCard(deckName) {
  const deck = game[deckName];
  const card = deck.shift();
  deck.push(card);
  await showModal({ title: card.title, text: card.text, color: deckName === 'chance' ? '#c026d3' : '#0284c7' });
  const playerIndex = game.turn;
  const player = currentPlayer();
  const effect = card.effect;
  if (effect.type === 'cash') {
    changeCash(playerIndex, effect.amount, card.title);
    endTurn();
  } else if (effect.type === 'jail') {
    enterJail(playerIndex);
    endTurn();
  } else if (effect.type === 'repairs') {
    const amount = player.assets.reduce((sum, asset) => sum + (asset.houses || 0) * effect.amount, 0);
    if (amount) changeCash(playerIndex, -amount, 'réparations');
    endTurn();
  } else if (effect.type === 'stored') {
    player.stored.push({ id: effect.id, label: effect.label });
    log(`${playerName(playerIndex)} conserve une carte ${effect.label}.`);
    endTurn();
  } else if (effect.type === 'move') {
    await moveTo(playerIndex, effect.index, 40, effect.collect, () => changeCash(playerIndex, 200, 'passage au départ'));
    await resolveEstateSpace();
  } else if (effect.type === 'relativeMove') {
    await movePlayer(playerIndex, effect.steps, 40, () => changeCash(playerIndex, 200, 'passage au départ'));
    await resolveEstateSpace();
  }
}

function estateRent(asset, ownerIndex) {
  if (asset.type === 'station') {
    return 25 * 2 ** (game.people[ownerIndex].assets.filter(item => item.type === 'station').length - 1);
  }
  if (asset.type === 'utility') {
    return (game.lastDice || 7) * 5 * game.people[ownerIndex].assets.filter(item => item.type === 'utility').length;
  }
  return asset.rent * (asset.houses ? asset.houses + 1 : hasEstateSet(game.people[ownerIndex], asset.group) ? 2 : 1);
}

async function resolveEstateSpace() {
  const playerIndex = game.turn;
  const player = currentPlayer();
  const space = estateSpace(player.pos);
  if (['property', 'station', 'utility'].includes(space.type)) {
    const owner = estateOwner(player.pos);
    if (owner < 0) {
      game.pending = { type: 'estateBuy', space, index: player.pos };
      statusElement.textContent = `${estateNames[player.pos]} est disponible pour ${money(space.cost)}.`;
      render();
      if (playerIndex !== 0) {
        await delay(450);
        decideEstatePurchase(player.cash >= space.cost * 1.7 || Math.random() < .7);
      }
      return;
    }
    if (owner !== playerIndex) {
      const rent = estateRent(estateAsset(player.pos), owner);
      changeCash(playerIndex, -rent, `loyer de ${estateNames[player.pos]}`);
      changeCash(owner, rent);
    }
    endTurn();
    return;
  }
  if (space.type === 'chance') {
    await drawEstateCard('chance');
    return;
  }
  if (space.type === 'community') {
    await drawEstateCard('community');
    return;
  }
  if (space.type === 'tax') changeCash(playerIndex, -space.cost, 'taxe');
  if (space.type === 'jail') enterJail(playerIndex);
  endTurn();
}

function decideEstatePurchase(accepted) {
  const pending = game.pending;
  if (!pending || pending.type !== 'estateBuy') return;
  const playerIndex = game.turn;
  const player = currentPlayer();
  if (accepted && player.cash >= pending.space.cost) {
    const asset = {
      kind: 'estate', index: pending.index, type: pending.space.type, group: pending.space.group,
      cost: pending.space.cost, rent: Math.max(6, Math.round(pending.space.cost * .1)), houses: 0,
      houseCost: 50 + (pending.space.group || 0) * 10
    };
    changeCash(playerIndex, -asset.cost, `achat de ${estateNames[asset.index]}`);
    player.assets.push(asset);
    game.boardFlash = { index: asset.index, type: 'bought' };
  } else {
    log(`${playerName(playerIndex)} laisse ${estateNames[pending.index]} à la banque.`);
  }
  game.pending = null;
  endTurn();
}

function buildEstate(index) {
  const player = game.people[0];
  const choices = player.assets.filter(asset => asset.type === 'property' && hasEstateSet(player, asset.group) && asset.houses < 4 && player.cash >= asset.houseCost);
  const asset = Number.isInteger(index) ? choices.find(choice => choice.index === index) : choices.sort((left, right) => left.houses - right.houses)[0];
  if (!asset || game.turn !== 0 || game.busy || game.pending) return;
  changeCash(0, -asset.houseCost, `construction sur ${estateNames[asset.index]}`);
  asset.houses += 1;
  game.boardFlash = { index: asset.index, type: 'built' };
  render();
}

async function rollEstate() {
  const playerIndex = game.turn;
  const player = currentPlayer();
  if (player.jail > 0) {
    const releaseIndex = player.stored.findIndex(card => card.id === 'release');
    if (releaseIndex >= 0) {
      player.stored.splice(releaseIndex, 1);
      player.jail = 0;
      log(`${playerName(playerIndex)} utilise une carte de libération.`);
    } else {
      player.jail -= 1;
      log(`${playerName(playerIndex)} reste en prison.`);
      endTurn();
      return;
    }
  }
  const values = await spinDice(2);
  const steps = values[0] + values[1];
  game.lastDice = steps;
  player.doubles = values[0] === values[1] ? player.doubles + 1 : 0;
  if (player.doubles === 3) {
    enterJail(playerIndex);
    endTurn();
    return;
  }
  await movePlayer(playerIndex, steps, 40, () => changeCash(playerIndex, 200, 'passage au départ'));
  await resolveEstateSpace();
}

function createWorld() {
  const titles = [];
  resources.forEach((resource, resourceIndex) => {
    [5, 10, 15, 20, 20, 30].forEach((share, titleIndex) => {
      titles.push({
        kind: 'world', resource, share,
        country: countries[(resourceIndex * 3 + titleIndex * 5) % countries.length],
        cost: (titleIndex + 1) * 500000,
        color: `hsl(${(resourceIndex * 47) % 360} 62% 52%)`
      });
    });
  });
  game = {
    kind: 'world', turn: 0, turns: 0, tradeTurns: 0, busy: false, over: false, pending: null, log: [], pot: 0,
    titles: shuffle(titles), news: shuffle(worldNews), tradingUnlocked: false,
    people: Array.from({ length: Number(playerCountSelect.value) }, () => ({ cash: 66000000, pos: 0, laps: 0, assets: [], stored: [], jokers: 0, skip: 0, out: false }))
  };
}

function worldShare(player, resource) {
  return player.assets.filter(asset => asset.resource === resource).reduce((sum, asset) => sum + asset.share, 0);
}

function worldRoyalty(player, resource) {
  const share = worldShare(player, resource);
  if (share >= 90) return 18000000;
  if (share >= 70) return 9000000;
  if (share >= 50) return 4500000;
  if (share >= 30) return 900000;
  return 0;
}

function unlockWorldTrading() {
  if (!game.tradingUnlocked && game.titles.length === 0) {
    game.tradingUnlocked = true;
    game.tradeTurns = 0;
    log('Tous les titres sont attribués : les échanges sont désormais ouverts.');
  }
}

function worldOffers(country, player) {
  const direct = game.titles.filter(asset => asset.country === country);
  if (direct.length) return direct.slice(0, 6);
  const usefulResources = new Set(player.assets.map(asset => asset.resource));
  const useful = game.titles.filter(asset => usefulResources.has(asset.resource));
  return (useful.length ? useful : game.titles).slice(0, 6);
}

async function drawWorldNews() {
  const card = game.news.shift();
  game.news.push(card);
  await showModal({ title: 'Actualité', text: card.text, color: '#0f766e' });
  changeCash(game.turn, card.amount, 'actualité');
  endTurn();
}

async function resolveWorldSpace() {
  const player = currentPlayer();
  const label = worldTrack[player.pos];
  if (countries.includes(label)) {
    const choices = worldOffers(label, player);
    if (!choices.length) {
      unlockWorldTrading();
      endTurn();
      return;
    }
    game.pending = { type: 'worldBuy', label, offers: choices };
    statusElement.textContent = `${label} : choisissez les titres à acquérir, puis terminez vos achats.`;
    render();
    if (game.turn !== 0) await botWorldPurchases();
    return;
  }
  if (resources.includes(label)) {
    game.people.forEach((owner, ownerIndex) => {
      if (ownerIndex === game.turn) return;
      const royalty = worldRoyalty(owner, label);
      if (!royalty) return;
      changeCash(game.turn, -royalty, `royalties de ${label}`);
      changeCash(ownerIndex, royalty);
    });
    endTurn();
    return;
  }
  if (label === 'Actualité') {
    await drawWorldNews();
    return;
  }
  if (label === '500 000 €') {
    changeCash(game.turn, 500000 * (game.lastDice || 7), 'prime de la roue');
  } else if (label === 'Douane') {
    player.skip = 1;
    log(`${playerName(game.turn)} perdra son prochain tour.`);
  } else if (label === 'Joker') {
    if (player.cash >= 3000000) {
      changeCash(game.turn, -3000000, 'achat d’un Joker');
      player.jokers += 1;
      player.stored.push({ id: 'joker', label: 'Joker commercial' });
    }
  } else if (label.startsWith('Choix') && player.laps > 0 && game.titles.length) {
    game.pending = { type: 'worldBuy', label, offers: worldOffers('', player) };
    render();
    if (game.turn !== 0) await botWorldPurchases();
    return;
  } else if (label === 'Enchères' && player.laps > 0 && game.titles.length) {
    const asset = game.titles[0];
    const price = Math.max(100000, Math.round(asset.cost * (.55 + Math.random() * .45)));
    await showModal({ title: 'Enchères', text: `${asset.resource} ${asset.share}% (${asset.country}) est adjugé ${money(price)}.`, color: asset.color });
    if (player.cash >= price) {
      changeCash(game.turn, -price, 'enchère');
      player.assets.push(asset);
      game.titles.shift();
      unlockWorldTrading();
    }
  }
  endTurn();
}

function buyWorldAsset(index) {
  const pending = game.pending;
  const player = currentPlayer();
  const asset = pending?.offers[index];
  if (!asset || player.cash < asset.cost) return false;
  changeCash(game.turn, -asset.cost, `titre ${asset.resource} ${asset.share}%`);
  player.assets.push(asset);
  game.titles.splice(game.titles.indexOf(asset), 1);
  pending.offers.splice(index, 1);
  unlockWorldTrading();
  render();
  return true;
}

async function botWorldPurchases() {
  const player = currentPlayer();
  let purchases = 0;
  while (game.pending?.offers.length && purchases < 3) {
    const ranked = game.pending.offers
      .map((asset, index) => ({ asset, index, score: worldShare(player, asset.resource) * 3 + asset.share * 2 - asset.cost / 500000 }))
      .filter(entry => entry.asset.cost <= player.cash * .6)
      .sort((left, right) => right.score - left.score);
    if (!ranked.length || (purchases > 0 && Math.random() < .35)) break;
    buyWorldAsset(ranked[0].index);
    purchases += 1;
    await delay(250);
  }
  game.pending = null;
  endTurn();
}

function worldAssetScore(player, asset) {
  return asset.cost + worldShare(player, asset.resource) * 100000;
}

function executeWorldTrade(fromIndex, toIndex, offered, requested, offeredCash, requestedCash) {
  const from = game.people[fromIndex];
  const to = game.people[toIndex];
  if (!offered || !requested || from.cash < offeredCash || to.cash < requestedCash) return false;
  const offeredIndex = from.assets.indexOf(offered);
  const requestedIndex = to.assets.indexOf(requested);
  if (offeredIndex < 0 || requestedIndex < 0) return false;
  const offeredValue = worldAssetScore(to, offered) + offeredCash;
  const requestedValue = worldAssetScore(to, requested) + requestedCash;
  const strategicGain = worldShare(to, offered.resource) > worldShare(to, requested.resource);
  if (toIndex !== 0 && offeredValue < requestedValue * (strategicGain ? .78 : .95)) return false;
  from.assets.splice(offeredIndex, 1, requested);
  to.assets.splice(requestedIndex, 1, offered);
  changeCash(fromIndex, requestedCash - offeredCash);
  changeCash(toIndex, offeredCash - requestedCash);
  log(`${playerName(fromIndex)} et ${playerName(toIndex)} échangent ${offered.resource} contre ${requested.resource}.`);
  render();
  return true;
}

async function openWorldTrade() {
  if (game.kind !== 'world' || !game.tradingUnlocked || game.turn !== 0 || game.pending || game.busy) return;
  const human = game.people[0];
  const opponents = game.people.map((player, index) => ({ player, index })).filter(entry => entry.index > 0 && entry.player.assets.length);
  if (!human.assets.length || !opponents.length) {
    statusElement.textContent = 'Un échange exige au moins un titre de chaque côté.';
    return;
  }
  const opponentOptions = opponents.map(entry => `<option value="${entry.index}">${playerName(entry.index)}</option>`).join('');
  const ownOptions = human.assets.map((asset, index) => `<option value="${index}">${asset.resource} ${asset.share}%</option>`).join('');
  const requestedOptions = opponents[0].player.assets.map((asset, index) => `<option value="${index}">${asset.resource} ${asset.share}%</option>`).join('');
  const content = `<div class="trade-grid"><label>Partenaire<select id="tradeOpponent">${opponentOptions}</select></label><label>Votre titre<select id="tradeOwn">${ownOptions}</select></label><label>Titre demandé<select id="tradeWanted">${requestedOptions}</select></label><label>Argent offert<input id="tradeOfferCash" type="number" min="0" step="100000" value="0"></label><label>Argent demandé<input id="tradeWantCash" type="number" min="0" step="100000" value="0"></label></div>`;
  modalHost.innerHTML = `<div class="board-modal" style="--modal-color:#0f766e"><article><h2>Échange commercial</h2><p>Proposez un titre et, si besoin, une compensation.</p>${content}<div class="modal-actions"><button id="confirmTrade">Proposer</button><button id="cancelTrade">Annuler</button></div></article></div>`;
  const modal = modalHost.firstElementChild;
  const opponentSelect = modal.querySelector('#tradeOpponent');
  const wantedSelect = modal.querySelector('#tradeWanted');
  opponentSelect.addEventListener('change', () => {
    const opponent = game.people[Number(opponentSelect.value)];
    wantedSelect.innerHTML = opponent.assets.map((asset, index) => `<option value="${index}">${asset.resource} ${asset.share}%</option>`).join('');
  });
  modal.querySelector('#cancelTrade').addEventListener('click', () => modal.remove());
  modal.querySelector('#confirmTrade').addEventListener('click', () => {
    const opponentIndex = Number(opponentSelect.value);
    const opponent = game.people[opponentIndex];
    const accepted = executeWorldTrade(
      0, opponentIndex,
      human.assets[Number(modal.querySelector('#tradeOwn').value)],
      opponent.assets[Number(wantedSelect.value)],
      Math.max(0, Number(modal.querySelector('#tradeOfferCash').value) || 0),
      Math.max(0, Number(modal.querySelector('#tradeWantCash').value) || 0)
    );
    modal.remove();
    statusElement.textContent = accepted ? 'Échange accepté.' : 'Échange refusé.';
  });
}

function maybeBotWorldTrade() {
  if (!game.tradingUnlocked || Math.random() > .28) return;
  const candidates = game.people.map((player, index) => ({ player, index })).filter(entry => entry.index > 0 && entry.player.assets.length);
  if (candidates.length < 2) return;
  const [first, second] = shuffle(candidates).slice(0, 2);
  const offered = first.player.assets.find(asset => worldShare(second.player, asset.resource) > worldShare(first.player, asset.resource));
  const requested = second.player.assets.find(asset => worldShare(first.player, asset.resource) > worldShare(second.player, asset.resource));
  if (offered && requested) executeWorldTrade(first.index, second.index, offered, requested, 0, 0);
}

async function rollWorld() {
  const player = currentPlayer();
  if (player.skip > 0) {
    player.skip -= 1;
    log(`${playerName(game.turn)} reste à la douane.`);
    endTurn();
    return;
  }
  const values = await spinDice(2);
  const steps = values[0] + values[1];
  game.lastDice = steps;
  if (values[0] === values[1]) changeCash(game.turn, -values[0] * 1000000, 'double à la roue');
  await movePlayer(game.turn, steps, worldTrack.length);
  await resolveWorldSpace();
}

function createPayday() {
  game = {
    kind: 'payday', turn: 0, turns: 0, busy: false, over: false, pending: null, log: [], pot: 0, targetMonths: 2,
    mail: shuffle(paydayMail), deals: shuffle(paydayDeals),
    people: Array.from({ length: Number(playerCountSelect.value) }, () => ({ cash: 6500, pos: 0, laps: 0, bills: 0, loans: 0, savings: 0, assets: [], stored: [], monthsCompleted: 0, out: false }))
  };
}

async function drawPaydayMail(count) {
  const playerIndex = game.turn;
  for (let index = 0; index < count; index += 1) {
    const card = game.mail.shift();
    game.mail.push(card);
    await showModal({ title: `${card.title} · ${index + 1}/${count}`, text: card.text, color: '#ca8a04' });
    const player = game.people[playerIndex];
    if (card.type === 'cash') changeCash(playerIndex, card.amount, 'courrier');
    if (card.type === 'bill') {
      player.bills += card.amount;
      log(`${playerName(playerIndex)} ajoute une facture de ${money(card.amount)}.`);
    }
    if (card.type === 'stored') {
      player.stored.push({ id: card.kind, label: card.label });
      log(`${playerName(playerIndex)} conserve ${card.label}.`);
    }
    render();
  }
}

async function offerPaydayDeal() {
  const playerIndex = game.turn;
  const player = currentPlayer();
  const deal = game.deals.shift();
  game.deals.push(deal);
  const choice = await showModal({
    title: 'Acquisition', text: `${deal.name} coûte ${money(deal.cost)} et peut être revendu ${money(deal.value)}.`, color: '#15803d',
    actions: player.cash >= deal.cost ? [{ label: 'Acheter', value: 'buy' }, { label: 'Passer', value: 'skip' }] : [{ label: 'Fonds insuffisants', value: 'skip' }]
  });
  if (choice === 'buy' && player.cash >= deal.cost) {
    changeCash(playerIndex, -deal.cost, `achat de ${deal.name}`);
    player.assets.push({ kind: 'deal', ...deal });
    game.boardFlash = { index: player.pos, type: 'bought' };
  }
}

async function sellPaydayAsset() {
  const playerIndex = game.turn;
  const player = currentPlayer();
  const sellable = player.assets.filter(asset => asset.kind === 'deal');
  if (!sellable.length) {
    await showModal({ title: 'Vente', text: 'Vous ne possédez aucune acquisition à revendre.', color: '#15803d' });
    return;
  }
  const actions = sellable.map((asset, index) => ({ label: `${asset.name} · ${money(asset.value)}`, value: index }));
  actions.push({ label: 'Ne rien vendre', value: -1 });
  const selected = await showModal({ title: 'Vente', text: 'Choisissez une acquisition à revendre.', color: '#15803d', actions });
  if (selected >= 0) {
    const asset = sellable[selected];
    player.assets.splice(player.assets.indexOf(asset), 1);
    changeCash(playerIndex, asset.value, `vente de ${asset.name}`);
  }
}

async function paydayDiceContest() {
  const results = game.people.map(() => 1 + Math.floor(Math.random() * 6));
  const best = Math.max(...results);
  const winner = results.indexOf(best);
  await showModal({ title: 'Concours de roue', text: `${game.people.map((player, index) => `${playerName(index)} : ${results[index]}`).join(' · ')}. ${playerName(winner)} gagne ${money(2000)}.`, color: '#7e22ce' });
  changeCash(winner, 2000, 'concours de roue');
}

async function finishPaydayMonth() {
  const playerIndex = game.turn;
  const player = currentPlayer();
  const interest = Math.round(player.loans * .1);
  const savingsInterest = Math.round(player.savings * .1);
  changeCash(playerIndex, 6500 + savingsInterest - player.bills - interest, 'solde du mois');
  player.bills = 0;
  player.stored = player.stored.filter(card => card.id !== 'lottery');
  player.monthsCompleted += 1;
  await showModal({ title: 'Jour de paye', text: `Salaire : ${money(6500)} · intérêts d’épargne : ${money(savingsInterest)} · intérêts de prêt : ${money(interest)}.`, color: '#0284c7' });
  player.pos = 0;
  if (game.people.every(person => person.monthsCompleted >= game.targetMonths)) {
    finishGame();
    return;
  }
  endTurn();
}

async function resolvePaydaySpace() {
  const playerIndex = game.turn;
  const player = currentPlayer();
  const space = paydayTrack[player.pos];
  if (space.type === 'mail') await drawPaydayMail(space.count);
  if (space.type === 'deal') await offerPaydayDeal();
  if (space.type === 'sale') await sellPaydayAsset();
  if (space.type === 'election') {
    game.people.forEach((person, index) => {
      changeCash(index, -1000, 'caisse électorale');
      game.pot += 1000;
    });
    await showModal({ title: 'Caisse électorale', text: `Chaque joueur verse ${money(1000)}. La caisse contient ${money(game.pot)}.`, color: '#b91c1c' });
  }
  if (space.type === 'dice') await paydayDiceContest();
  if (space.type === 'lottery') {
    changeCash(playerIndex, -100, 'billet de loterie');
    player.stored.push({ id: 'lottery', label: 'Billet de loterie' });
  }
  if (space.type === 'savings') {
    const deposit = Math.min(500, Math.max(0, player.cash));
    if (deposit) {
      changeCash(playerIndex, -deposit, 'versement sur l’épargne');
      player.savings += deposit;
    }
  }
  if (space.type === 'clock') {
    game.people.forEach(person => { person.pos = Math.max(0, person.pos - 1); });
    await showModal({ title: 'Changement d’heure', text: 'Tous les joueurs reculent d’une case.', color: '#b91c1c' });
  }
  if (space.type === 'winning') {
    const tickets = player.stored.filter(card => card.id === 'lottery');
    const prize = tickets.length * 2000;
    if (prize) changeCash(playerIndex, prize, 'tirage du mois');
    player.stored = player.stored.filter(card => card.id !== 'lottery');
    await showModal({ title: 'Tirage du mois', text: prize ? `Vos billets rapportent ${money(prize)}.` : 'Vous ne possédez aucun billet.', color: '#7e22ce' });
  }
  if (space.type === 'payday') {
    await finishPaydayMonth();
    return;
  }
  endTurn();
}

async function rollPayday() {
  const [value] = await spinDice(1);
  const player = currentPlayer();
  const steps = Math.min(value, 30 - player.pos);
  await movePlayer(game.turn, steps, paydayTrack.length);
  await resolvePaydaySpace();
}

function playerValue(player) {
  if (game.kind === 'estate') return estateWorth(player);
  if (game.kind === 'world') return player.cash + player.assets.reduce((sum, asset) => sum + asset.cost, 0);
  return player.cash + player.savings - player.loans + player.assets.reduce((sum, asset) => sum + (asset.value || 0), 0);
}

function finishGame() {
  game.over = true;
  game.busy = false;
  const ranking = game.people.map((player, index) => ({ index, value: playerValue(player) })).sort((left, right) => right.value - left.value);
  statusElement.textContent = `${playerName(ranking[0].index)} remporte la partie avec ${money(ranking[0].value)}.`;
  render();
}

function ensureSolvency(playerIndex) {
  const player = game.people[playerIndex];
  if (player.cash >= 0) return;
  if (game.kind === 'payday') {
    const loan = Math.ceil(Math.abs(player.cash) / 1000) * 1000;
    player.loans += loan;
    changeCash(playerIndex, loan, 'prêt bancaire');
    return;
  }
  player.out = true;
  log(`${playerName(playerIndex)} est éliminé faute de liquidités.`);
  if (game.people.filter(person => !person.out).length <= 1) finishGame();
}

function endTurn() {
  if (game.over) return;
  ensureSolvency(game.turn);
  if (game.over) return;
  game.pending = null;
  game.busy = false;
  game.turns += 1;
  if (game.kind === 'world') {
    if (game.tradingUnlocked) game.tradeTurns += 1;
    maybeBotWorldTrade();
  }
  do game.turn = (game.turn + 1) % game.people.length;
  while (game.people[game.turn].out);
  if (game.kind === 'world' && game.tradingUnlocked && game.tradeTurns > 60) {
    finishGame();
    return;
  }
  statusElement.textContent = game.turn === 0 ? 'À vous de jouer.' : `${playerName(game.turn)} joue.`;
  render();
  scheduleBot();
}

function scheduleBot() {
  clearTimeout(botTimer);
  if (game.over || game.turn === 0 || game.busy || game.pending) return;
  botTimer = setTimeout(performRoll, 620 + Math.random() * 520);
}

async function performRoll() {
  if (game.over || game.busy || game.pending) return;
  game.busy = true;
  renderControls();
  if (game.kind === 'estate') await rollEstate();
  else if (game.kind === 'world') await rollWorld();
  else await rollPayday();
}

function perimeterPosition(index, size) {
  const edge = size - 1;
  if (index <= edge) return [size - index, 1];
  if (index <= edge * 2) return [1, index - edge + 1];
  if (index <= edge * 3) return [index - edge * 2 + 1, size];
  return [size, size - (index - edge * 3)];
}

function rectanglePosition(index, columns, rows) {
  if (index < rows) return [rows - index, 1];
  let remaining = index - rows;
  if (remaining < columns - 1) return [1, remaining + 2];
  remaining -= columns - 1;
  if (remaining < rows - 1) return [remaining + 2, columns];
  remaining -= rows - 1;
  return [rows, columns - remaining - 1];
}

function tokensAt(index) {
  return game.people.map((player, playerIndex) => player.pos === index && !player.out ? `<i class="token" style="--token:${tokenColors[playerIndex]}">${playerIndex + 1}</i>` : '').join('');
}

function estateOwnerMarkup(index) {
  const owner = estateOwner(index);
  if (owner < 0) return '';
  const asset = estateAsset(index);
  return `<i class="owner-mark" title="${playerName(owner)}" style="--owner:${tokenColors[owner]}">${owner + 1}</i>${asset.houses ? `<span class="owner-houses">${'🏠'.repeat(asset.houses)}</span>` : ''}`;
}

function renderEstateBoard() {
  const cells = estateNames.map((label, index) => {
    const [row, column] = perimeterPosition(index, 11);
    const space = estateSpace(index);
    const edge = index > 0 && index < 10 ? 'west' : index > 10 && index < 20 ? 'north' : index > 20 && index < 30 ? 'east' : index > 30 && index < 40 ? 'south' : '';
    const corner = [0, 10, 20, 30].includes(index) ? 'corner' : '';
    const flash = game.boardFlash?.index === index ? `just-${game.boardFlash.type}` : '';
    return `<div class="space estate-space ${space.type} ${edge} ${corner} ${flash}" style="grid-area:${row}/${column};--band:${space.group !== undefined ? estateGroups[space.group][1] : '#d0d5dd'}">${space.group !== undefined ? '<i class="band"></i>' : ''}<span class="name">${label}</span><span>${tokensAt(index)}</span>${estateOwnerMarkup(index)}</div>`;
  }).join('');
  const legend = estateGroups.map((group, groupIndex) => `<div><i style="--group-color:${group[1]}"></i><span>${estatePropertyIndexes.filter(index => estateSpace(index).group === groupIndex).map(index => estateNames[index]).join(' · ')}</span></div>`).join('');
  board.innerHTML = `<div class="square-board"><div class="center-art"><h2>EMPIRE<br>IMMOBILIER</h2><p>${skinSelect.options[skinSelect.selectedIndex].text}</p><div class="estate-legend">${legend}</div></div>${cells}</div>`;
}

function worldRegion(label) {
  if (['France', 'Belgique', 'Royaume-Uni', 'Suède', 'Allemagne', 'Italie', 'Espagne', 'Russie', 'Kazakhstan', 'Turquie'].includes(label)) return 'europe';
  if (['Maroc', 'Égypte', 'Ghana', 'Éthiopie', 'Afrique du Sud'].includes(label)) return 'africa';
  if (['Inde', 'Chine', 'Japon', 'Vietnam', 'Indonésie', 'Iran'].includes(label)) return 'asia';
  if (['Australie', 'Nouvelle-Zélande'].includes(label)) return 'oceania';
  if (countries.includes(label)) return 'america';
  if (resources.includes(label)) return 'resource';
  return 'special';
}

function worldSkinLabel(label, index) {
  if (!['galaxy', 'fantasy', 'academy'].includes(skinSelect.value)) return label;
  const themes = {
    galaxy: { places: ['Auriga', 'Nébula', 'Cérès', 'Orion', 'Cygnus', 'Vesper', 'Nova', 'Titan', 'Kepler', 'Atlas', 'Polaris', 'Andromède'], resources: ['Plasma', 'Cristal', 'Alliage', 'Hélium'] },
    fantasy: { places: ['Valbois', 'Clairvallon', 'Sylveclaire', 'Montedor', 'Rochebrune', 'Fortacier', 'Boisombre', 'Terres noires', 'Valdor', 'Désert rouge', 'Île éternelle', 'Tourcendre'], resources: ['Acier ancien', 'Bois sacré', 'Or des forges', 'Herbes rares'] },
    academy: { places: ['Grande Académie', 'Village des mages', 'Allée des grimoires', 'Conseil magique', 'Académie boréale', 'Académie australe', 'Forteresse magique', 'Val-enchanté', 'Banque runique', 'Forêt enchantée', 'Maison des alchimistes', 'Manoir des ombres'], resources: ['Runes', 'Baguettes', 'Potions', 'Balais'] }
  };
  const theme = themes[skinSelect.value];
  if (countries.includes(label)) return theme.places[index % theme.places.length];
  if (resources.includes(label)) return theme.resources[index % theme.resources.length];
  return label;
}

function worldOwnershipMarkup(label) {
  if (countries.includes(label)) {
    return `<span class="world-ownership">${game.people.map((player, index) => {
      const count = player.assets.filter(asset => asset.country === label).length;
      return count ? `<i class="world-share" title="${playerName(index)} : ${count} titre(s)" style="--owner:${tokenColors[index]}">${count}</i>` : '';
    }).join('')}</span>`;
  }
  if (resources.includes(label)) {
    return `<span class="world-ownership">${game.people.map((player, index) => {
      const share = worldShare(player, label);
      return share ? `<i class="world-share" title="${playerName(index)} : ${share}%" style="--owner:${tokenColors[index]}">${share}</i>` : '';
    }).join('')}</span>`;
  }
  return '';
}

function renderWorldBoard() {
  const cell = (label, globalIndex, localIndex, size) => {
    const [row, column] = perimeterPosition(localIndex, size);
    return `<div class="space world-space ${worldRegion(label)}" style="grid-area:${row}/${column}"><span class="name">${worldSkinLabel(label, globalIndex)}</span><span>${tokensAt(globalIndex)}</span>${worldOwnershipMarkup(label)}</div>`;
  };
  const theme = ['galaxy', 'fantasy', 'academy'].includes(skinSelect.value) ? skinSelect.value : '';
  board.innerHTML = `<div class="world-board"><div class="world-ring outer" style="--ring:11">${worldTrack.slice(0, 40).map((label, index) => cell(label, index, index, 11)).join('')}</div><div class="world-ring inner" style="--ring:9">${worldTrack.slice(40).map((label, index) => cell(label, index + 40, index, 9)).join('')}</div><div class="world-map ${theme}"><h2>MARCHÉS<br>DU MONDE</h2><p>40 cases extérieures · 32 cases intérieures</p></div></div>`;
}

function renderPaydayBoard() {
  const outer = paydayTrack.slice(0, 16);
  const inner = paydayTrack.slice(16, 30);
  const cell = (space, globalIndex, localIndex, columns, rows) => {
    const [row, column] = rectanglePosition(localIndex, columns, rows);
    const flash = game.boardFlash?.index === globalIndex ? `just-${game.boardFlash.type}` : '';
    return `<div class="payday-space ${space.type} ${flash}" style="grid-area:${row}/${column}"><b>${globalIndex + 1}</b><span>${space.label}</span><span>${tokensAt(globalIndex)}</span></div>`;
  };
  board.innerHTML = `<div class="payday-board"><div class="payday-ring outer" style="--columns:6;--rows:4">${outer.map((space, index) => cell(space, index, index, 6, 4)).join('')}</div><div class="payday-ring inner" style="--columns:5;--rows:4">${inner.map((space, index) => cell(space, index + 16, index, 5, 4)).join('')}</div><div class="payday-arrow in">↙</div><div class="payday-arrow out">↗</div><div class="payday-center"><h2>FIN DE MOIS</h2><p>Deux tours du calendrier</p><small>31 · Jour de paye</small><span>${tokensAt(30)}</span></div></div>`;
}

function renderBoard() {
  if (game.kind === 'estate') renderEstateBoard();
  else if (game.kind === 'world') renderWorldBoard();
  else renderPaydayBoard();
}

function assetColor(asset) {
  if (asset.kind === 'world') return asset.color;
  if (asset.kind === 'estate' && asset.group !== undefined) return estateGroups[asset.group][1];
  if (asset.type === 'station') return '#334155';
  if (asset.type === 'utility') return '#0891b2';
  return '#64748b';
}

function assetLabel(asset) {
  if (asset.kind === 'estate') return `${estateNames[asset.index]}${asset.houses ? ` · ${asset.houses} maison(s)` : ''}`;
  if (asset.kind === 'world') return `${asset.resource} ${asset.share}% · ${asset.country}`;
  return `${asset.name} · revente ${money(asset.value)}`;
}

function renderSidebar() {
  playersElement.innerHTML = game.people.map((player, index) => {
    const visibleAssets = player.assets.map(asset => `<span class="mini-asset" style="--asset-color:${assetColor(asset)}">${assetLabel(asset)}</span>`).join('');
    const stored = player.stored.map(card => `<span class="mini-asset" style="--asset-color:#7c3aed">${card.label}</span>`).join('');
    const details = game.kind === 'payday' ? `Factures ${money(player.bills)} · prêt ${money(player.loans)} · épargne ${money(player.savings)}` : game.kind === 'world' ? `${player.assets.length} titre(s) · ${player.jokers} Joker(s)` : `${player.assets.length} propriété(s)`;
    const cashFlash = game.cashFlashes?.[index];
    const flash = cashFlash ? `<span class="money-change ${cashFlash.amount >= 0 ? 'gain' : 'loss'}">${cashFlash.amount >= 0 ? '+' : '−'}${money(Math.abs(cashFlash.amount))}</span>` : '';
    return `<article class="player ${game.turn === index ? 'active' : ''}" style="border-left:7px solid ${tokenColors[index]}"><strong>${playerName(index)}</strong> · ${money(player.cash)}${flash}<small>${details}</small><div class="player-assets">${visibleAssets}${stored}</div></article>`;
  }).join('');
}

function renderAssets() {
  const player = game.people[0];
  assetsTitleElement.textContent = 'Vos actifs et cartes conservées';
  const cards = player.assets.map(asset => {
    const buildable = game.kind === 'estate' && asset.type === 'property' && hasEstateSet(player, asset.group) && asset.houses < 4 && player.cash >= asset.houseCost;
    return `<article class="card ${asset.kind === 'world' ? 'resource' : ''}" style="--resource:${assetColor(asset)}"><strong>${assetLabel(asset)}</strong>${asset.kind === 'estate' ? `<p>Achat ${money(asset.cost)} · loyer ${money(estateRent(asset, 0))}</p>` : ''}${buildable ? `<button data-build="${asset.index}">Construire · ${money(asset.houseCost)}</button>` : ''}</article>`;
  });
  player.stored.forEach(card => cards.push(`<article class="card special-card"><strong>${card.label}</strong><p>Carte conservée jusqu’à son utilisation.</p></article>`));
  assetsElement.innerHTML = cards.join('') || '<span class="muted">Aucun actif pour le moment.</span>';
  assetsElement.querySelectorAll('[data-build]').forEach(button => button.addEventListener('click', () => buildEstate(Number(button.dataset.build))));
}

function renderOffers() {
  offersElement.innerHTML = '';
  if (game.pending?.type === 'worldBuy') {
    offersElement.innerHTML = game.pending.offers.map((asset, index) => `<article class="card resource" style="--resource:${asset.color}"><strong>${asset.resource} · ${asset.share}%</strong><p>${asset.country}<br>${money(asset.cost)}</p>${game.turn === 0 ? `<button data-world-buy="${index}">Acheter</button>` : ''}</article>`).join('');
    offersElement.querySelectorAll('[data-world-buy]').forEach(button => button.addEventListener('click', () => buyWorldAsset(Number(button.dataset.worldBuy))));
  }
}

function renderControls() {
  const humanTurn = game.turn === 0 && !game.over;
  rollButton.disabled = !humanTurn || game.busy || Boolean(game.pending);
  buyButton.hidden = !(humanTurn && game.pending?.type === 'estateBuy');
  skipButton.hidden = !(humanTurn && ['estateBuy', 'worldBuy'].includes(game.pending?.type));
  buildButton.hidden = !(humanTurn && game.kind === 'estate' && !game.pending && game.people[0].assets.some(asset => asset.type === 'property' && hasEstateSet(game.people[0], asset.group) && asset.houses < 4 && game.people[0].cash >= asset.houseCost));
  tradeButton.hidden = !(humanTurn && game.kind === 'world' && game.tradingUnlocked && !game.pending);
}

function render() {
  titleElement.textContent = game.kind === 'estate' ? 'Empire Immobilier' : game.kind === 'world' ? 'Marchés du Monde' : 'Fin de Mois';
  rulesElement.textContent = game.kind === 'estate'
    ? 'Achetez des propriétés, indiquez leurs propriétaires, complétez des groupes et construisez. Les cartes sont résolues une par une après leur fermeture.'
    : game.kind === 'world'
      ? 'Un tour complet parcourt les 40 cases extérieures puis les 32 intérieures. Les titres donnent des royalties dès 30 % et deviennent échangeables lorsque le marché est épuisé.'
      : 'Parcourez les 31 jours : courriers, acquisitions, ventes, loteries, épargne et paye. Chaque courrier est lu et résolu séparément.';
  renderBoard();
  renderSidebar();
  renderAssets();
  renderOffers();
  renderControls();
  logElement.innerHTML = game.log.map(entry => `<li>${entry}</li>`).join('');
  if (game.boardFlash) setTimeout(() => { if (game) { game.boardFlash = null; renderBoard(); } }, 950);
}

function newGame() {
  clearTimeout(botTimer);
  modalHost.innerHTML = '';
  wheelElement.dataset.value = '—';
  diceElement.textContent = '—';
  if (variantSelect.value === 'estate') createEstate();
  else if (variantSelect.value === 'world') createWorld();
  else createPayday();
  statusElement.textContent = 'À vous de jouer.';
  render();
}

rollButton.addEventListener('click', performRoll);
buyButton.addEventListener('click', () => decideEstatePurchase(true));
skipButton.addEventListener('click', () => {
  if (game.pending?.type === 'estateBuy') decideEstatePurchase(false);
  else if (game.pending?.type === 'worldBuy') {
    game.pending = null;
    endTurn();
  }
});
buildButton.addEventListener('click', () => buildEstate());
tradeButton.addEventListener('click', openWorldTrade);
document.getElementById('newGame').addEventListener('click', newGame);
variantSelect.addEventListener('change', newGame);
playerCountSelect.addEventListener('change', newGame);
skinSelect.addEventListener('change', () => {
  if (game.kind === 'estate') estateNames = (estateSkins[skinSelect.value] || estateSkins.france).slice();
  render();
});

Object.entries(estateSkins).forEach(([skin, labels]) => {
  if (labels.length !== 40) throw new Error(`Le thème ${skin} ne comporte pas 40 cases.`);
  const properties = estatePropertyIndexes.map(index => labels[index]);
  if (new Set(properties).size !== properties.length) throw new Error(`Le thème ${skin} répète une propriété.`);
});
if (worldTrack.length !== 72) throw new Error('Marchés du Monde doit comporter 72 cases.');
if (paydayTrack.length !== 31) throw new Error('Fin de Mois doit comporter 31 jours.');

newGame();
