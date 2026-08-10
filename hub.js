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
      { id: 'sandwich', label: 'Sandwich' }
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
  }
];

const catalog = document.getElementById('gameCatalog');
const recentGame = document.getElementById('recentGame');
let activeFilter = 'all';

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
      ${game.presets ? `<label class="muted">Profil <select data-game-preset="${game.id}">${game.presets.map((preset, index) => `<option value="${index}">${preset.label}</option>`).join('')}</select></label>` : ''}
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

let lastGame = null;
try { lastGame = localStorage.getItem('game-hub:last-game'); } catch (error) { lastGame = null; }
recentGame.textContent = lastGame === 'bataille-corse'
  ? 'Dernier jeu ouvert : Bataille Corse.'
  : (lastGame === 'sudoku'
  ? 'Dernier jeu ouvert : Sudoku Lab.'
  : (lastGame === 'nonogram'
    ? 'Dernier jeu ouvert : Nonogram.'
    : (lastGame === 'minesweeper'
      ? 'Dernier jeu ouvert : Démineur.'
      : (lastGame === 'bataille'
        ? 'Dernier jeu ouvert : Bataille.'
        : (lastGame === 'klondike' ? 'Dernier jeu ouvert : Solitaire Klondike.' : 'Tous les jeux et sauvegardes restent locaux à ce navigateur.')))));
renderCatalog();
