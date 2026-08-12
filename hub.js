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
    id: 'cards',
    title: 'Autres jeux de cartes',
    category: 'cards',
    status: 'À venir',
    icon: '🃏', accent: '#7c3aed', cardIcon: '♣️',
    description: 'Jeux de couleurs, tarot, symboles, réflexes et règles personnalisables.'
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
    id: 'board-games',
    title: 'Jeux de plateau',
    category: 'board',
    status: 'À venir',
    icon: '♟️', accent: '#334155',
    description: 'Échecs, dames, mahjong et autres jeux à coups légaux et bots.'
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
  return { grid: 'Jeu de grille', cards: 'Jeu de cartes', board: 'Jeu de plateau', rhythm: 'Jeu de rythme' }[category];
}

function renderCatalog() {
  const visibleGames = games.filter(game => activeFilter === 'all' || game.category === activeFilter);
  catalog.innerHTML = visibleGames.length ? visibleGames.map(game => `
    <article class="game category-${game.category} ${game.href ? '' : 'planned'}" style="--accent:${game.accent || '#2447a8'}">
      <div class="game-visual"><span class="game-icon">${game.icon || '🎮'}</span>${game.cardIcon ? `<span class="card-stack"><span>${game.cardIcon}</span></span>` : ''}<span class="tag">${game.status} · ${categoryLabel(game.category)}</span></div>
      <h3>${game.title}</h3>
      <p>${game.description}</p>
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
