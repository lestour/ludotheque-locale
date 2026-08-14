const games = [
  {
    id: 'sudoku',
    title: 'Sudoku Lab',
    category: 'grid',
    status: 'Jouable',
    icon: '🔢', accent: '#315fc9',
    description: 'Sudoku classique, Killer, Thermometer et combinaisons de contraintes avec générateur et solveur.',
    href: 'games/grid/sudoku.html',
    variants: [
      { id: 'killer', label: 'Killer' },
      { id: 'thermometer', label: 'Thermomètre' },
      { id: 'diagonal', label: 'Diagonales' },
      { id: 'kropki', label: 'Kropki' },
      { id: 'xv', label: 'XV' },
      { id: 'knight', label: 'Anti-cavalier' },
      { id: 'king', label: 'Anti-roi' },
      { id: 'nonconsecutive', label: 'Non-consécutif' },
      { id: 'hyper', label: 'Hyper / Windoku' },
      { id: 'disjoint', label: 'Groupes disjoints' },
      { id: 'palindrome', label: 'Palindrome' },
      { id: 'arrow', label: 'Arrow' },
      { id: 'parity', label: 'Pair / Impair' },
      { id: 'whisper', label: 'German Whispers' },
      { id: 'renban', label: 'Renban' },
      { id: 'sandwich', label: 'Sandwich' },
      { id: 'entropic', label: 'Lignes entropiques' },
      { id: 'modular', label: 'Lignes modulaires' },
      { id: 'quadruple', label: 'Quadruples' }
    ]
  },
  {
    id: 'nonogram',
    title: 'Nonogram',
    category: 'grid',
    status: 'Jouable',
    icon: '🧩', accent: '#b45309',
    description: 'Nonogrammes monochromes ou couleur, génération locale et import d’image depuis votre appareil.',
    href: 'games/grid/nonogram.html'
  },
  {
    id: 'minesweeper',
    title: 'Démineur',
    category: 'grid',
    status: 'Jouable',
    icon: '💣', accent: '#475569',
    description: 'Premier clic sûr, révélations en cascade, drapeaux et trois difficultés.',
    href: 'games/grid/minesweeper.html'
  },
  {
    id: 'logic-puzzles',
    title: 'Puzzles logiques',
    category: 'grid',
    status: 'Jouable',
    icon: '🧠', accent: '#0f766e',
    description: 'Futoshiki, Kakuro, Hidato, Hitori, Nurikabe, Akari, Slitherlink et Numberlink avec indices.',
    href: 'games/grid/logic-puzzles.html'
  },
  {
    id: 'fusion-2048',
    title: 'Fusion 2048',
    category: 'grid',
    status: 'Jouable',
    icon: '🔶', accent: '#d97706',
    description: 'Fusionnez les tuiles sur des grilles 4 × 4 ou 5 × 5 avec plusieurs objectifs.',
    href: 'games/grid/fusion-2048.html'
  },
  {
    id: 'arcade',
    title: 'Arcade local',
    category: 'arcade',
    status: 'Jouable',
    icon: '🕹️', accent: '#c2410c',
    description: 'Serpent, casse-briques, labyrinthe et course express avec commandes clavier ou tactiles.',
    href: 'games/arcade/arcade.html'
  },
  {
    id: 'pong',
    title: 'Duel Pong',
    category: 'arcade',
    status: 'Jouable',
    icon: '🏓', accent: '#ea580c',
    description: 'Duel de raquettes fluide contre un bot réglable, au clavier ou en tactile.',
    href: 'games/arcade/pong.html'
  },
  {
    id: 'stellar-assault',
    title: 'Assaut Stellaire',
    category: 'arcade',
    status: 'Jouable',
    icon: '🚀', accent: '#7c3aed',
    description: 'Shoot’em up à vagues procédurales, boss, projectiles spéciaux, bonus et progression de niveau.',
    href: 'games/arcade/stellar-assault.html'
  },
  {
    id: 'vector-drift',
    title: 'Dérive Vectorielle',
    category: 'arcade',
    status: 'Jouable',
    icon: '☄️', accent: '#0f766e',
    description: 'Pilotage spatial inertiel, astéroïdes divisibles, soucoupes, capsules et secteurs procéduraux.',
    href: 'games/arcade/vector-drift.html'
  },
  {
    id: 'pocket-platformer',
    title: 'Chroniques de Poche',
    category: 'arcade',
    status: 'Jouable',
    icon: '🏃', accent: '#7c3aed',
    description: 'Platformer portable à niveaux procéduraux, gemmes, ennemis, checkpoints et contre-la-montre.',
    href: 'games/arcade/pocket-platformer.html'
  },
  {
    id: 'pinball',
    title: 'Flipper Nova',
    category: 'arcade',
    status: 'Jouable',
    icon: '🔮', accent: '#7c3aed',
    description: 'Flipper original avec physique précise, lance-bille, missions, multiplicateurs, tilt, jackpots et multibille.',
    href: 'games/arcade/pinball.html'
  },
  {
    id: 'labyrinthe-glouton',
    title: 'Labyrinthe Glouton',
    category: 'arcade',
    status: 'Jouable',
    icon: '🟡', accent: '#0f766e',
    description: 'Chasse en labyrinthe procédural avec quatre esprits aux stratégies distinctes, fruits, surcharges et niveaux accélérés.',
    href: 'games/arcade/labyrinthe-glouton.html'
  },
  {
    id: 'traversee-turbo',
    title: 'Traversée Turbo',
    category: 'arcade',
    status: 'Jouable',
    icon: '🚦', accent: '#15803d',
    description: 'Traversez routes et rivières procédurales sur des plateformes mobiles, avec combos et parcours croissants.',
    href: 'games/arcade/traversee-turbo.html'
  },
  {
    id: 'asteria',
    title: 'Chroniques d’Asteria',
    category: 'arcade',
    status: 'Jouable',
    icon: '🗺️', accent: '#15803d',
    description: 'Aventure originale vue du dessus : monde procédural à biomes, objets ouvrant les régions, donjons modulaires, boss, secrets et coopération.',
    href: 'games/arcade/asteria.html'
  },
  {
    id: 'eclipse-depths',
    title: 'Profondeurs de l’Éclipse',
    category: 'arcade',
    status: 'Jouable',
    icon: '◉', accent: '#0891b2',
    description: 'Metroid-like procédural : station interconnectée, capacités ouvrant les secteurs, secrets, raccourcis, boss et coopération.',
    href: 'games/arcade/eclipse-depths.html'
  },
  {
    id: 'connect-four',
    title: 'Alignement quatre',
    category: 'board',
    status: 'Jouable',
    icon: '🟡', accent: '#1d4ed8',
    description: 'Alignez quatre ou cinq pions sur plusieurs tailles de plateau contre un bot.',
    href: 'games/board/connect-four.html'
  },
  {
    id: 'bataille',
    title: 'Bataille',
    category: 'cards',
    status: 'Jouable',
    icon: '⚔️', accent: '#b91c1c', cardIcon: '♠️',
    description: 'Affrontez l’ordinateur avec un paquet classique, batailles incluses.',
    href: 'games/cards/classic/bataille.html'
  },
  {
    id: 'bataille-corse',
    title: 'Bataille Corse',
    category: 'cards',
    status: 'Jouable',
    icon: '✋', accent: '#a21caf', cardIcon: '♥️',
    description: 'Deux joueurs locaux, figures à contrer et réflexes sur les paires ou sandwichs.',
    href: 'games/cards/classic/bataille-corse.html'
  },
  {
    id: 'casino-plis',
    title: 'Casino & plis',
    category: 'cards',
    status: 'Jouable',
    icon: '🂡', accent: '#166534', cardIcon: '♦',
    description: '21, poker fermé et jeu de plis contre un bot local.',
    href: 'games/cards/classic/casino-plis.html'
  },
  {
    id: 'memory',
    title: 'Paires mémoire',
    category: 'cards',
    status: 'Jouable',
    icon: '🧠', accent: '#7c3aed', cardIcon: '?',
    description: 'Retrouvez les paires en solo ou face à un bot dont la mémoire est réglable.',
    href: 'games/cards/classic/memory.html'
  },
  {
    id: 'tiles-routes',
    title: 'Atelier de tuiles',
    category: 'board',
    status: 'Jouable',
    icon: '🧱', accent: '#047857',
    description: 'Territoires, mosaïque et routes : trois jeux de placement de tuiles originaux.',
    href: 'games/board/tiles-routes.html'
  },
  {
    id: 'rhythm-echo',
    title: 'Écho rythmique',
    category: 'rhythm',
    status: 'Jouable',
    icon: '🎶', accent: '#9333ea',
    description: 'Mémorisez une séquence sonore, son rythme ou sa version inversée.',
    href: 'games/rhythm/rhythm-echo.html'
  },
  {
    id: 'audio-lab',
    title: 'Audio Lab',
    category: 'rhythm',
    status: 'Jouable',
    icon: '🎚️', accent: '#6d28d9',
    description: 'Analyse locale MP3, MP4, FLAC, WAV et MIDI, avec préparation de séparation en sources.',
    href: 'games/rhythm/audio-lab.html'
  },
  {
    id: 'symbole-unique',
    title: 'Symbole Unique',
    category: 'cards',
    status: 'Jouable',
    icon: '🎯', accent: '#d97706', cardIcon: '✦',
    description: 'Paquet local mathématiquement valide et duel de réflexes contre un humain ou un bot.',
    href: 'games/cards/modern/symbole-unique.html',
    presets: [
      { label: 'Duel bot facile', opponent: 'easy', mode: 'tower' },
      { label: 'Duel bot difficile', opponent: 'hard', mode: 'tower' },
      { label: 'Défausse centrale', opponent: 'normal', mode: 'well' },
      { label: 'Relais', opponent: 'normal', mode: 'potato' }
    ]
  },
  {
    id: 'totem-reflexe',
    title: 'Totem Réflexe',
    category: 'cards',
    status: 'Jouable',
    icon: '🗿', accent: '#c2410c', cardIcon: '☀️',
    description: 'Jeu de réflexes avec totem central, duels de symboles et bot configurable.',
    href: 'games/cards/modern/totem-reflexe.html',
    presets: [
      { label: 'Duel · bot facile', players: 2, difficulty: 'easy' },
      { label: 'Duel · bot difficile', players: 2, difficulty: 'hard' },
      { label: '3 joueurs · moyen', players: 3, difficulty: 'normal' },
      { label: '4 joueurs · extrême', players: 4, difficulty: 'extreme' }
    ]
  },
  {
    id: 'derniere-couleur',
    title: 'Dernière Couleur',
    category: 'cards',
    status: 'Jouable',
    icon: '🌈', accent: '#dc2626', cardIcon: '🟥',
    description: 'Jeu local de cartes colorées avec bots et règles maison configurables.',
    href: 'games/cards/modern/derniere-couleur.html',
    presets: [
      { label: 'Classique · 2 joueurs', players: 2, difficulty: 'normal' },
      { label: 'Rapide · 3 joueurs', players: 3, difficulty: 'easy', rules: 'drawUntil' },
      { label: 'Maison · 4 joueurs', players: 4, difficulty: 'hard', rules: 'stacking,drawTwoOnFour,sevenZero' }
    ]
  },
  {
    id: 'klondike',
    title: 'Solitaire Klondike',
    category: 'cards',
    status: 'Jouable',
    icon: '♠️', accent: '#1e3a8a', cardIcon: 'A',
    description: 'Le solitaire classique, avec pioche, défausse, tableau et fondations.',
    href: 'games/cards/classic/klondike.html',
    presets: [
      { label: 'Facile · pioche 1', draw: 1, difficulty: 'easy' },
      { label: 'Moyen · pioche 3', draw: 3, difficulty: 'normal' },
      { label: 'Difficile · pioche 3', draw: 3, difficulty: 'hard' },
      { label: 'Expert · pioche 3', draw: 3, difficulty: 'expert' }
    ]
  },
  {
    id: 'grille-zero',
    title: 'Grille Zéro',
    category: 'cards',
    status: 'Jouable',
    icon: '🔢', accent: '#0f766e', cardIcon: '0',
    description: 'Réduisez votre score, révélez vos cartes et retirez les colonnes identiques.',
    href: 'games/cards/modern/grille-zero.html'
  },
  {
    id: 'sixieme-carte',
    title: 'Sixième Carte',
    category: 'cards',
    status: 'Jouable',
    icon: '🐂', accent: '#b45309', cardIcon: '6',
    description: 'Choisissez simultanément vos cartes et évitez de ramasser les têtes de bœuf.',
    href: 'games/cards/modern/sixieme-carte.html'
  },
  {
    id: 'course-1000',
    title: 'Course 1000',
    category: 'cards',
    status: 'Jouable',
    icon: '🚗', accent: '#d97706', cardIcon: '1000',
    description: 'Course de cartes : distances, incidents, réparations, protections et objectif exact de 1 000 km.',
    href: 'games/cards/modern/course-1000.html'
  },
  {
    id: 'roi-pirate',
    title: 'Roi Pirate',
    category: 'cards',
    status: 'Jouable',
    icon: '🏴‍☠️', accent: '#0f172a', cardIcon: '☠️',
    description: 'Jeu de plis pirate : enchères par manche, couleurs, atouts et cartes spéciales.',
    href: 'games/cards/modern/roi-pirate.html'
  },
  {
    id: 'chatastrophe',
    title: 'Chatastrophe',
    category: 'cards',
    status: 'Jouable',
    icon: '🐱', accent: '#be123c', cardIcon: '💥',
    description: 'Survivez à la pioche grâce aux protections, échanges, esquives et cartes de tempo.',
    href: 'games/cards/modern/chatastrophe.html'
  },
  {
    id: 'rami-cartes',
    title: 'Rami Cartes',
    category: 'cards',
    status: 'Jouable',
    icon: '🃏', accent: '#177245', cardIcon: '♣',
    description: 'Formez des groupes et suites de cartes, ouvrez au seuil choisi et complétez la table.',
    href: 'games/cards/classic/rami-cartes.html'
  },
  {
    id: 'rami-tuiles',
    title: 'Rami Tuiles',
    category: 'board',
    status: 'Jouable',
    icon: '🀄', accent: '#177245',
    description: 'Composez des séries et groupes de tuiles, avec une ouverture à 30 points.',
    href: 'games/board/rami-tuiles.html'
  },
  {
    id: 'mahjong',
    title: 'Mahjong Solitaire',
    category: 'board',
    status: 'Jouable',
    icon: '🀄', accent: '#177245',
    description: 'Retirez des paires de tuiles libres sur un plateau compact généré pour rester résoluble.',
    href: 'games/board/mahjong.html'
  },
  {
    id: 'empire-immobilier',
    title: 'Empire Immobilier',
    category: 'board',
    status: 'Jouable',
    icon: '🏠', accent: '#2563eb',
    description: 'Achetez des rues, encaissez les loyers et développez le meilleur patrimoine.',
    href: 'games/board/board-games.html?variant=estate'
  },
  {
    id: 'world-wealth',
    title: 'Marchés du Monde',
    category: 'board',
    status: 'Jouable',
    icon: '🌍', accent: '#0f766e',
    description: 'Investissez dans des pays, encaissez les dividendes et suivez l’actualité.',
    href: 'games/board/board-games.html?variant=world'
  },
  {
    id: 'payday',
    title: 'Fin de Mois',
    category: 'board',
    status: 'Jouable',
    icon: '💶', accent: '#16a34a',
    description: 'Gérez votre budget sur le calendrier du mois entre salaire, factures et transactions.',
    href: 'games/board/board-games.html?variant=payday'
  },
  {
    id: 'chess',
    title: 'Échecs',
    category: 'board',
    status: 'Jouable',
    icon: '♞', accent: '#334155',
    description: 'Jouez les Blancs contre un bot local avec contrôle des coups légaux et de l’échec.',
    href: 'games/board/chess.html?variant=chess'
  },
  {
    id: 'checkers',
    title: 'Dames',
    category: 'board',
    status: 'Jouable',
    icon: '⛀', accent: '#b91c1c',
    description: 'Dames internationales simplifiées : prises obligatoires, enchaînements et promotions.',
    href: 'games/board/chess.html?variant=checkers'
  },
  {
    id: 'go',
    title: 'Go',
    category: 'board',
    status: 'Jouable',
    icon: '⚫', accent: '#a16207',
    description: 'Go local en 9×9, 13×13 ou 19×19 avec captures, ko, passes, score et Atari Go.',
    href: 'games/board/go.html'
  },
  {
    id: 'rhythm',
    title: 'Jeux de rythme',
    category: 'rhythm',
    status: 'Jouable',
    icon: '🎵', accent: '#0891b2',
    description: 'Pistes de rythme locales, import MuseScore/MusicXML et modes piano ou boutons.',
    href: 'games/rhythm/rhythm.html'
  },
  {
    id: 'karaoke',
    title: 'Karaoké Lab',
    category: 'rhythm',
    status: 'Prototype jouable',
    icon: '🎤', accent: '#be185d',
    description: 'Chantez des notes cibles au microphone avec score de justesse, tenue, latence et accompagnement local.',
    href: 'games/rhythm/karaoke.html'
  }
];

const catalog = document.getElementById('gameCatalog');
const recentGame = document.getElementById('recentGame');
let activeFilter = 'all';
let searchTerm = localStorage.getItem('game-hub:catalog-search') || '';
let activeSort = localStorage.getItem('game-hub:catalog-sort') || 'catalog';

const portableStoragePrefixes = ['game-hub:', 'rhythm-', 'nonogram-'];
const profilesKey = 'game-hub:profiles';
const activeProfileKey = 'game-hub:active-profile';

function readProfiles() {
  try {
    const profiles = JSON.parse(localStorage.getItem(profilesKey) || '[]');
    return [{ id: 'default', name: 'Profil principal' }, ...profiles.filter(profile => profile?.id && profile?.name && profile.id !== 'default')];
  } catch { return [{ id: 'default', name: 'Profil principal' }]; }
}

function renderProfiles() {
  const select = document.getElementById('activeProfile');
  const profiles = readProfiles();
  const active = localStorage.getItem(activeProfileKey) || 'default';
  select.replaceChildren(...profiles.map(profile => {
    const option = document.createElement('option');
    option.value = profile.id;
    option.textContent = String(profile.name).slice(0, 32);
    return option;
  }));
  select.value = profiles.some(profile => profile.id === active) ? active : 'default';
  document.getElementById('deleteProfile').disabled = select.value === 'default';
}

function createProfile() {
  const name = prompt('Nom du nouveau profil :')?.trim().replace(/[<>]/g, '').slice(0, 32);
  if (!name) return;
  const id = `p-${Date.now().toString(36)}-${Math.floor(Math.random() * 1296).toString(36)}`;
  const profiles = readProfiles().filter(profile => profile.id !== 'default');
  profiles.push({ id, name });
  localStorage.setItem(profilesKey, JSON.stringify(profiles));
  localStorage.setItem(activeProfileKey, id);
  location.reload();
}

function deleteProfile() {
  const select = document.getElementById('activeProfile');
  if (select.value === 'default' || !confirm(`Supprimer le profil « ${select.options[select.selectedIndex].text} » et ses données ?`)) return;
  const profile = select.value;
  Object.keys(localStorage).filter(key => key.endsWith(`:${profile}`) || key.includes(`:${profile}:`)).forEach(key => localStorage.removeItem(key));
  localStorage.setItem(profilesKey, JSON.stringify(readProfiles().filter(item => item.id !== 'default' && item.id !== profile)));
  localStorage.setItem(activeProfileKey, 'default');
  location.reload();
}

function portableEntries() {
  return Object.fromEntries(Object.keys(localStorage)
    .filter(key => portableStoragePrefixes.some(prefix => key.startsWith(prefix)))
    .map(key => [key, localStorage.getItem(key)]));
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Kio`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mio`;
}

function openSaveManager() {
  const dialog = document.getElementById('saveDialog');
  const saves = window.GameRuntime?.listAutosaves() || [];
  const list = document.getElementById('saveList');
  const total = saves.reduce((sum, save) => sum + save.bytes, 0);
  document.getElementById('saveSummary').textContent = saves.length ? `${saves.length} partie${saves.length > 1 ? 's' : ''} · ${formatBytes(total)} · profil actif uniquement.` : 'Aucune partie sauvegardée pour ce profil.';
  list.innerHTML = saves.map((save, index) => `<li class="save-item"><strong>${String(save.title).replace(/[<>]/g, '')}</strong><small>${new Date(save.savedAt).toLocaleString()} · ${formatBytes(save.bytes)}</small><span class="save-actions"><a class="open" href="${save.route}">Reprendre</a><button type="button" data-delete-save="${index}">Supprimer</button></span></li>`).join('');
  list.querySelectorAll('[data-delete-save]').forEach(button => button.addEventListener('click', () => {
    const save = saves[Number(button.dataset.deleteSave)];
    if (save && confirm(`Supprimer la sauvegarde « ${save.title} » ?`)) { window.GameRuntime.removeAutosave(save.key); openSaveManager(); }
  }));
  if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
  else dialog.setAttribute('open', '');
}

function gameTitleForPage(pageId) {
  const [base, variant] = pageId.split(':');
  const direct = games.find(game => game.href?.includes(`${base}.html`) && (!variant || game.href.includes(`variant=${variant}`)));
  return direct?.title || ({ estate: 'Empire Immobilier', world: 'Marchés du Monde', payday: 'Fin de Mois' }[variant]) || base.replaceAll('-', ' ');
}

function openStatistics() {
  const key = window.GameRuntime?.profileKey('game-hub:statistics') || 'game-hub:statistics';
  let statistics = {};
  try { statistics = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}
  const entries = Object.entries(statistics).map(([pageId, value]) => ({ pageId, ...value })).sort((left, right) => (right.plays || 0) - (left.plays || 0));
  const totals = entries.reduce((result, entry) => ({ plays: result.plays + (entry.plays || 0), finishes: result.finishes + (entry.finishes || 0), wins: result.wins + (entry.wins || 0), seconds: result.seconds + (entry.totalSeconds || 0) }), { plays: 0, finishes: 0, wins: 0, seconds: 0 });
  const hours = Math.floor(totals.seconds / 3600), minutes = Math.floor(totals.seconds % 3600 / 60);
  document.getElementById('statisticsContent').innerHTML = `<div class="stats-grid"><div class="stats-card"><strong>${totals.plays}</strong>parties</div><div class="stats-card"><strong>${totals.finishes}</strong>terminées</div><div class="stats-card"><strong>${totals.wins}</strong>victoires</div><div class="stats-card"><strong>${hours} h ${minutes}</strong>jouées</div></div>${entries.length ? `<table class="stats-table"><thead><tr><th>Jeu</th><th>Parties</th><th>Terminées</th><th>Victoires</th><th>Réussite</th></tr></thead><tbody>${entries.map(entry => `<tr><td>${gameTitleForPage(entry.pageId)}</td><td>${entry.plays || 0}</td><td>${entry.finishes || 0}</td><td>${entry.wins || 0}</td><td>${entry.finishes ? Math.round((entry.wins || 0) / entry.finishes * 100) : 0} %</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Aucune partie enregistrée pour ce profil.</p>'}`;
  const dialog = document.getElementById('statisticsDialog');
  if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
}

function downloadData() {
  const payload = { format: 'ludotheque-local-data', version: 1, exportedAt: new Date().toISOString(), values: portableEntries() };
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  link.download = `ludotheque-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function importData(file) {
  const payload = JSON.parse(await file.text());
  if (payload?.format !== 'ludotheque-local-data' || payload.version !== 1 || !payload.values || typeof payload.values !== 'object') throw new Error('Sauvegarde incompatible.');
  let imported = 0;
  Object.entries(payload.values).forEach(([key, value]) => {
    if (!portableStoragePrefixes.some(prefix => key.startsWith(prefix)) || typeof value !== 'string') return;
    localStorage.setItem(key, value);
    imported += 1;
  });
  alert(`${imported} préférence(s), record(s) et sauvegarde(s) restauré(s). La page va être rechargée.`);
  location.reload();
}

function categoryLabel(category) {
  return { grid: 'Jeu de grille', cards: 'Jeu de cartes', board: 'Jeu de plateau', rhythm: 'Jeu de rythme', arcade: 'Jeu d’arcade' }[category];
}

function multiplayerBadge(game) {
  const shared = new Set(['sudoku', 'nonogram', 'minesweeper', 'logic-puzzles', 'mahjong']);
  const scored = new Set(['arcade', 'stellar-assault', 'vector-drift', 'pocket-platformer', 'pinball', 'labyrinthe-glouton', 'traversee-turbo', 'asteria', 'eclipse-depths', 'fusion-2048', 'memory', 'rhythm', 'karaoke', 'rhythm-echo']);
  if (shared.has(game.id)) return '🌐 Coop · Course · Équipes';
  if (scored.has(game.id)) return '🌐 Versus · Coop score · Équipes';
  return '';
}

function catalogVisits() {
  const key = window.GameRuntime?.profileKey('game-hub:catalog-visits') || 'game-hub:catalog-visits';
  try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
}

function recordCatalogVisit(gameId) {
  const key = window.GameRuntime?.profileKey('game-hub:catalog-visits') || 'game-hub:catalog-visits';
  const visits = catalogVisits();
  visits[gameId] = { count: (visits[gameId]?.count || 0) + 1, lastOpened: Date.now() };
  localStorage.setItem(key, JSON.stringify(visits));
}

function renderCatalog() {
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase('fr-FR');
  const categoryOrder = { grid: 0, cards: 1, board: 2, rhythm: 3, arcade: 4 };
  const titleCompare = (left, right) => left.title.localeCompare(right.title, 'fr', { sensitivity: 'base' });
  const visits = catalogVisits();
  const sorters = {
    catalog: () => 0,
    title: titleCompare,
    titleDesc: (left, right) => titleCompare(right, left),
    category: (left, right) => (categoryOrder[left.category] - categoryOrder[right.category]) || titleCompare(left, right),
    status: (left, right) => Number(!left.href) - Number(!right.href) || titleCompare(left, right),
    recent: (left, right) => (visits[right.id]?.lastOpened || 0) - (visits[left.id]?.lastOpened || 0) || titleCompare(left, right),
    popular: (left, right) => (visits[right.id]?.count || 0) - (visits[left.id]?.count || 0) || titleCompare(left, right)
  };
  const visibleGames = games.filter(game => {
    if (activeFilter !== 'all' && game.category !== activeFilter) return false;
    if (!normalizedSearch) return true;
    return [game.title, game.description, game.status, categoryLabel(game.category)].some(value => value?.toLocaleLowerCase('fr-FR').includes(normalizedSearch));
  }).sort(sorters[activeSort] || sorters.catalog);
  document.getElementById('catalogSummary').textContent = `${visibleGames.length} jeu${visibleGames.length > 1 ? 'x' : ''} affiché${visibleGames.length > 1 ? 's' : ''} sur ${games.length}.`;
  catalog.innerHTML = visibleGames.length ? visibleGames.map(game => `
    <article class="game category-${game.category} ${game.href ? '' : 'planned'}" style="--accent:${game.accent || '#2447a8'}">
      <div class="game-visual"><span class="game-icon">${game.icon || '🎮'}</span>${game.cardIcon ? `<span class="card-stack"><span>${game.cardIcon}</span></span>` : ''}<span class="tag">${game.status} · ${categoryLabel(game.category)}</span></div>
      <h3>${game.title}</h3>
      <p>${game.description}</p>
      ${multiplayerBadge(game) ? `<div class="multiplayer-badge">${multiplayerBadge(game)}</div>` : ''}
      ${game.variants ? `<div class="variant-picker"><button type="button" class="variant-toggle" data-variant-toggle aria-haspopup="true" aria-expanded="false">Variantes · 0 sélectionnée</button><div class="variant-menu" data-variant-menu hidden>${game.variants.map(variant => `<label><input type="checkbox" data-variant="${variant.id}"> ${variant.label}</label>`).join('')}</div></div>` : ''}
      ${game.presets ? `<label class="muted profile-picker">Profil <select data-game-preset="${game.id}">${game.presets.map((preset, index) => `<option value="${index}">${preset.label}</option>`).join('')}</select></label>` : ''}
      <footer>${game.href ? `<a class="open" data-game-link="${game.id}" href="${game.href}">Ouvrir</a>` : '<span class="muted">Module planifié</span>'}</footer>
    </article>
  `).join('') : '<div class="empty">Aucun jeu dans cette catégorie pour le moment.</div>';
  catalog.querySelectorAll('[data-game-link="sudoku"]').forEach(link => {
    const card = link.closest('.game');
    const toggle = card.querySelector('[data-variant-toggle]');
    const menu = card.querySelector('[data-variant-menu]');
    const updateLink = () => {
      const variants = [...card.querySelectorAll('[data-variant]:checked')].map(input => input.dataset.variant);
      link.href = variants.length ? `games/grid/sudoku.html?variants=${variants.join(',')}` : 'games/grid/sudoku.html';
      link.textContent = variants.length ? 'Ouvrir la sélection' : 'Ouvrir';
      toggle.textContent = variants.length ? `Variantes · ${variants.length} sélectionnée${variants.length > 1 ? 's' : ''}` : 'Variantes · aucune sélection';
    };
    toggle.addEventListener('click', event => {
      event.stopPropagation();
      const opening = menu.hidden;
      document.querySelectorAll('[data-variant-menu]').forEach(other => { other.hidden = true; });
      menu.hidden = !opening;
      document.querySelectorAll('.game.picker-open').forEach(other => other.classList.remove('picker-open'));
      card.classList.toggle('picker-open', opening);
      toggle.setAttribute('aria-expanded', String(opening));
    });
    menu.addEventListener('click', event => event.stopPropagation());
    card.querySelectorAll('[data-variant]').forEach(input => input.addEventListener('change', updateLink));
    updateLink();
  });
  catalog.querySelectorAll('[data-game-link]').forEach(link => {
    const game = games.find(item => item.id === link.dataset.gameLink);
    if (!game?.presets || game.id === 'sudoku') return;
    const presetSelect = link.closest('.game').querySelector(`[data-game-preset="${game.id}"]`);
    const updateLink = () => {
      const preset = game.presets[Number(presetSelect.value)];
      const query = new URLSearchParams(Object.entries(preset).filter(([key]) => key !== 'label').map(([key, value]) => [key, value]));
      link.href = `${game.href}?${query}`;
      link.textContent = 'Ouvrir ce profil';
    };
    presetSelect.addEventListener('change', updateLink);
    updateLink();
  });
  catalog.querySelectorAll('[data-game-link]').forEach(link => {
    link.addEventListener('click', async event => {
      recordCatalogVisit(link.dataset.gameLink);
      if (!['127.0.0.1', 'localhost'].includes(location.hostname)) return;
      event.preventDefault();
      try {
        const response = await fetch(link.href, { method: 'HEAD', cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        location.href = link.href;
      } catch {
        recentGame.textContent = 'Le serveur local s’est arrêté. Relancez « Lancer le Hub » et gardez sa fenêtre ouverte pendant la partie.';
        recentGame.classList.add('server-error');
      }
    });
  });
}

document.addEventListener('click', () => {
  document.querySelectorAll('[data-variant-menu]').forEach(menu => { menu.hidden = true; });
  document.querySelectorAll('[data-variant-toggle]').forEach(toggle => toggle.setAttribute('aria-expanded', 'false'));
  document.querySelectorAll('.game.picker-open').forEach(card => card.classList.remove('picker-open'));
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  document.querySelectorAll('[data-variant-menu]').forEach(menu => { menu.hidden = true; });
  document.querySelectorAll('[data-variant-toggle]').forEach(toggle => toggle.setAttribute('aria-expanded', 'false'));
  document.querySelectorAll('.game.picker-open').forEach(card => card.classList.remove('picker-open'));
});

document.querySelectorAll('[data-filter]').forEach(button => {
  button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(item => item.classList.toggle('selected', item === button));
    renderCatalog();
  });
});

const gameSearch = document.getElementById('gameSearch');
const gameSort = document.getElementById('gameSort');
gameSearch.value = searchTerm;
gameSort.value = activeSort;
gameSearch.addEventListener('input', () => { searchTerm = gameSearch.value; localStorage.setItem('game-hub:catalog-search', searchTerm); renderCatalog(); });
gameSort.addEventListener('change', () => { activeSort = gameSort.value; localStorage.setItem('game-hub:catalog-sort', activeSort); renderCatalog(); });

const exportDataButton = document.getElementById('exportData');
const importDataButton = document.getElementById('importData');
const importDataFile = document.getElementById('importDataFile');
exportDataButton.addEventListener('click', downloadData);
importDataButton.addEventListener('click', () => importDataFile.click());
importDataFile.addEventListener('change', async () => {
  const [file] = importDataFile.files;
  if (!file) return;
  try { await importData(file); }
  catch (error) { alert(`Import impossible : ${error.message}`); }
  finally { importDataFile.value = ''; }
});
renderProfiles();
document.getElementById('activeProfile').addEventListener('change', event => { localStorage.setItem(activeProfileKey, event.target.value); location.reload(); });
document.getElementById('addProfile').addEventListener('click', createProfile);
document.getElementById('deleteProfile').addEventListener('click', deleteProfile);
document.getElementById('manageSaves').addEventListener('click', openSaveManager);
document.querySelector('[data-close-save]').addEventListener('click', () => document.getElementById('saveDialog').close());
document.getElementById('showStatistics').addEventListener('click', openStatistics);
document.querySelector('[data-close-statistics]').addEventListener('click', () => document.getElementById('statisticsDialog').close());

let lastGame = null;
let lastRoute = null;
try {
  lastGame = localStorage.getItem('game-hub:last-game');
  lastRoute = JSON.parse(localStorage.getItem('game-hub:last-route') || 'null');
} catch (error) {
  lastGame = null;
  lastRoute = null;
}
if (lastRoute?.route?.startsWith('games/')) {
  const recentLink = document.createElement('a');
  recentLink.href = lastRoute.route;
  recentLink.textContent = `Reprendre : ${lastRoute.title || 'dernier jeu'}`;
  recentGame.replaceChildren(recentLink);
} else {
  const knownGame = games.find(game => game.id === lastGame);
  recentGame.textContent = knownGame ? `Dernier jeu ouvert : ${knownGame.title}.` : 'Tous les jeux et sauvegardes restent locaux à ce navigateur.';
}
renderCatalog();

if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}), { once: true });
}

fetch('./api/lan/status', { cache: 'no-store' }).then(response => response.ok ? response.json() : null).then(status => {
  if (!status?.lan) return;
  const shareUrl = status.publicUrls?.[0] || '';
  const panel = document.createElement('section');
  panel.className = 'lan-hub';
  const title = document.createElement('h2');
  title.textContent = '🌐 Mode LAN actif';
  const address = document.createElement('p');
  address.append('Adresse à envoyer aux autres joueurs : ');
  const code = document.createElement('code');
  code.textContent = shareUrl || 'Aucune adresse réseau détectée';
  address.append(code);
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.textContent = 'Copier l’adresse';
  copy.disabled = !shareUrl;
  copy.onclick = async () => {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(shareUrl);
    else { code.focus?.(); document.getSelection()?.selectAllChildren(code); document.execCommand('copy'); }
    copy.textContent = 'Adresse copiée';
  };
  const instructions = document.createElement('ol');
  ['Envoyez cette adresse aux personnes connectées au même Wi-Fi ou réseau.', 'Ouvrez tous le même jeu depuis le hub.', 'Dans le jeu, cliquez sur le bouton vert « Jouer en LAN » en bas à droite pour créer ou rejoindre le salon.'].forEach(text => { const item = document.createElement('li'); item.textContent = text; instructions.appendChild(item); });
  panel.append(title, address, copy, instructions);
  document.querySelector('main').prepend(panel);
}).catch(() => {});
