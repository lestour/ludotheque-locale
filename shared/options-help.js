(() => {
  const descriptions = {
    newGame: 'Recommence avec une nouvelle distribution ou une nouvelle grille en utilisant les paramètres actuels.',
    generate: 'Génère une nouvelle grille avec les variantes et la difficulté sélectionnées.',
    randomVariants: 'Choisit plusieurs variantes compatibles puis génère une grille unique avec cette combinaison.',
    reset: 'Restaure la partie dans son état initial sans changer sa génération.',
    difficulty: 'Règle la difficulté du bot ou de la génération selon le jeu.',
    players: 'Choisit le nombre total de joueurs, vous compris.',
    playerCount: 'Choisit le nombre total de joueurs, vous compris.',
    variant: 'Sélectionne le jeu ou la variante de plateau à lancer.',
    gameType: 'Bascule entre les règles des échecs et celles des dames.',
    gameMode: 'Sélectionne la variante et la disposition utilisées pour cette partie.',
    boardSkin: 'Change le thème visuel et les noms du plateau sans changer ses règles principales.',
    chainCaptures: 'Oblige une dame ou un pion à poursuivre une prise multiple lorsqu’une autre prise est disponible.',
    noGuess: 'Demande au générateur une grille résoluble logiquement sans choix aléatoire.',
    adaptDensity: 'Ajuste la densité des mines pour augmenter les chances d’obtenir une grande grille logiquement résoluble.',
    solveStep: 'Applique une seule déduction logique et explique le raisonnement utilisé.',
    solveAll: 'Enchaîne les déductions automatiques jusqu’à la résolution ou jusqu’à un blocage.',
    hint: 'Met en évidence une action utile sans jouer entièrement à votre place.',
    hintButton: 'Met en évidence une déduction possible et affiche son explication.',
    undo: 'Annule la dernière action autorisée.',
    redo: 'Rétablit la dernière action annulée.',
    showErrors: 'Signale visuellement les entrées incompatibles avec la solution.',
    autoCandidates: 'Calcule et affiche automatiquement les possibilités encore valides de chaque case.',
    constraintCombinations: 'Teste les combinaisons complètes des contraintes spéciales, au prix de calculs plus longs.',
    size: 'Détermine le nombre de lignes et de colonnes de la grille.',
    mode: 'Change le mode d’affichage ou le type de partie proposé par ce jeu.',
    imageInput: 'Importe une image locale afin de la convertir en nonogramme.',
    paletteLimit: 'Limite le nombre de couleurs conservées lors de la conversion de l’image.',
    paletteSize: 'Choisit le nombre maximal de couleurs de la grille générée ou extraite de l’image.',
    imageGridFormat: 'Découpe l’image en plusieurs sous-grilles selon le format choisi.',
    traceMode: 'Affiche la résolution automatique étape par étape.',
    traceModeToggle: 'Bascule entre la grille jouable et la trace de résolution étape par étape.',
    drawCount: 'Choisit de retourner une ou trois cartes à chaque pioche.',
    acePosition: 'Détermine si l’As est placé avant le 2 ou après le Roi dans les suites.',
    redealLimit: 'Limite le nombre de recyclages autorisés de la défausse vers la pioche.',
    dealDifficulty: 'Influence la complexité et le nombre de recherches nécessaires pour résoudre la distribution.',
    autoFoundation: 'Envoie automatiquement les cartes sûres vers les fondations.',
    slapOnSeven: 'Autorise à taper le tas central lorsqu’un 7 apparaît.',
    slapOnTenSandwich: 'Autorise à taper lorsque deux cartes séparées par une carte totalisent dix.',
    opponent: 'Choisit un adversaire local ou la vitesse de réaction du bot.',
    stacking: 'Autorise le cumul de cartes de pénalité compatibles.',
    sevenZero: 'Active les échanges ou rotations de mains provoqués par les 7 et les 0.',
    jumpIn: 'Permet de jouer immédiatement une carte strictement identique même hors de son tour.',
    drawUntil: 'Force à continuer de piocher jusqu’à obtenir une carte jouable.',
    strictFour: 'N’autorise le +4 que sans couleur jouable et permet de contester un usage illégal.',
    announcementPenalty: 'Applique une pénalité au joueur qui oublie d’annoncer sa dernière carte.',
    columns: 'Retire une colonne lorsque ses trois cartes visibles ont la même valeur.',
    doubleFinish: 'Double les points du finisseur si son total n’est pas le plus faible.',
    bonusRules: 'Ajoute les étoiles, les lignes supprimables et un paquet de cartes Action aux règles classiques.',
    limit: 'Détermine le score qui met fin à la partie complète.',
    inputStyle: 'Choisit le périphérique ou la méthode utilisée pour jouer les notes.',
    keyboardLayout: 'Adapte les libellés de touches à la disposition physique de votre clavier.',
    valveHandedness: 'Utilise Q/S/D pour la main gauche, J/K/L pour la main droite, ou votre mappage personnalisé.',
    breathEnabled: 'Exige une commande séparée pour simuler le souffle avec les pistons ou la coulisse.',
    requireHold: 'Évalue aussi la durée pendant laquelle la note reste tenue.',
    microphoneSensitivity: 'Règle le niveau sonore minimal reconnu par l’analyse du microphone.',
    calibrateMicrophone: 'Mesure la latence acoustique du microphone afin de corriger le jugement rythmique.',
    toggleTuner: 'Affiche la fréquence, la note détectée et son écart en cents.',
    speed: 'Modifie la vitesse de lecture, y compris pendant une partie en cours.',
    metronome: 'Fait entendre le métronome pendant tout le morceau après le décompte initial.',
    accompaniment: 'Joue les autres pistes de la partition en accompagnement.',
    currentTrackPlayback: 'Fait aussi entendre automatiquement la piste que vous devez jouer.',
    audioStyle: 'Choisit le moteur sonore utilisé pour reproduire les instruments.',
    concertPitch: 'Affiche les notes à hauteur réelle au lieu de la tonalité écrite pour l’instrument.',
    clefOverride: 'Force une clef d’affichage différente sans modifier les hauteurs importées.',
    colorNotes: 'Associe une couleur aux notes et à leurs commandes.',
    showFingering: 'Affiche sous chaque note les pistons, positions ou touches attendus.',
    showRests: 'Affiche les symboles de silence et les mesures vides.',
    showMeasures: 'Affiche les barres et numéros de mesure.',
    scoreScale: 'Agrandit ou réduit la partition sans changer son tempo.',
    noteSpacing: 'Modifie la distance visuelle entre les notes qui défilent.',
    approachTime: 'Règle la durée pendant laquelle une note reste visible avant d’atteindre la barre de jeu.',
    practicePreset: 'Applique un ensemble cohérent de réglages de difficulté.',
    loopEnabled: 'Répète uniquement la plage de mesures choisie.',
    adaptiveSpeed: 'Ajuste automatiquement la vitesse selon votre précision à la fin de chaque boucle.',
    typeKiller: 'Ajoute des cages dont les chiffres doivent atteindre la somme indiquée sans répétition.',
    typeThermometer: 'Ajoute des thermomètres dont les valeurs augmentent du bulbe vers leur extrémité.',
    typeDiagonal: 'Impose aussi l’unicité des chiffres sur les grandes diagonales.',
    typeKropki: 'Ajoute des points indiquant des valeurs consécutives ou dans un rapport de deux.',
    typeXV: 'Ajoute des marques imposant une somme de 5 ou de 10 entre deux cases.',
    typeKnight: 'Interdit deux chiffres identiques à une distance de cavalier.',
    typeKing: 'Interdit deux chiffres identiques dans des cases diagonalement adjacentes.',
    typeNonConsecutive: 'Interdit deux valeurs consécutives dans des cases orthogonalement voisines.',
    typeHyper: 'Ajoute quatre régions supplémentaires où chaque chiffre doit rester unique.',
    typeDisjoint: 'Rend uniques les cases occupant la même position relative dans chaque boîte.',
    typePalindrome: 'Impose des valeurs identiques à égale distance du centre de chaque ligne palindrome.',
    typeArrow: 'Impose que la valeur du cercle égale la somme des chiffres placés sur sa flèche.',
    typeParity: 'Impose la parité paire ou impaire indiquée dans certaines cases.',
    typeWhisper: 'Impose un écart minimal entre les valeurs voisines le long des lignes indiquées.',
    typeRenban: 'Impose un ensemble de chiffres consécutifs, dans n’importe quel ordre, sur chaque ligne Renban.',
    typeSandwich: 'Indique la somme des chiffres placés entre les deux valeurs extrêmes d’une ligne ou colonne.'
  };

  const categoryRules = [
    ['Son', /audio|volume|sound|metronome|accompaniment|playback/i],
    ['Commandes', /input|keyboard|key|valve|breath|slide|microphone|midi|control/i],
    ['Affichage', /show|display|color|palette|scale|spacing|approach|skin|zoom|accidental|clef|concert/i],
    ['Règles', /rule|stack|strict|seven|jump|penalty|capture|guess|density|column|finish|candidate|constraint|type[A-Z]|hold/i]
  ];

  const style = document.createElement('style');
  style.textContent = `.game-options-menu{position:relative;z-index:20}.game-options-menu>summary{list-style:none;cursor:pointer;padding:8px 12px;border:1px solid #8da0ba;border-radius:9px;background:var(--options-bg,#fff);color:inherit;font-weight:800}.game-options-menu>summary::-webkit-details-marker{display:none}.game-options-menu[open]>summary{outline:3px solid #60a5fa55}.game-options-content{position:fixed;z-index:5000;width:min(440px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;padding:12px;border:1px solid #8da0ba;border-radius:12px;background:var(--options-panel,#fff);box-shadow:0 14px 35px #0004;color:inherit}.game-options-section{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:8px;padding:8px 0}.game-options-section+ .game-options-section{border-top:1px solid #94a3b866}.game-options-section>strong{grid-column:1/-1;color:inherit}.game-options-section label{display:flex;gap:7px;align-items:center;justify-content:space-between;min-width:0;padding:6px 7px;border-radius:7px;background:#94a3b818}.game-options-section label select,.game-options-section label input:not([type=checkbox]){max-width:100%;min-width:0}.option-help-target{text-decoration-decoration-style:dotted}.option-help-tooltip{position:fixed;z-index:10000;max-width:min(330px,calc(100vw - 24px));padding:8px 10px;border:1px solid #334155;border-radius:8px;background:#17243a;color:#fff;font:500 13px/1.35 Arial,sans-serif;box-shadow:0 8px 24px #0006;pointer-events:none;opacity:0;transform:translateY(4px);transition:opacity .12s,transform .12s}.option-help-tooltip.visible{opacity:1;transform:none}@media(prefers-color-scheme:dark){.game-options-menu{--options-bg:#263447;--options-panel:#172235}.game-options-content{border-color:#60718a}.game-options-section label{background:#94a3b824}.option-help-tooltip{border-color:#94a3b8;background:#eef4ff;color:#17243a}}`;
  document.head.append(style);

  const tooltip = document.createElement('div');
  tooltip.className = 'option-help-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.id = 'optionHelpTooltip';
  document.body.append(tooltip);

  const cleanLabel = element => {
    const label = element.matches('label') ? element : element.closest('label');
    const text = (label?.textContent || element.textContent || element.getAttribute('aria-label') || element.id || 'cette option').replace(/\s+/g, ' ').trim();
    return text.length > 70 ? `${text.slice(0, 67)}…` : text;
  };
  const fallbackDescription = element => {
    const label = cleanLabel(element);
    if (element.matches('select')) return `Choisit « ${label} ». Le réglage est pris en compte par la partie concernée.`;
    if (element.matches('input[type="checkbox"]')) return `Active ou désactive l’option « ${label} ».`;
    if (element.matches('input[type="range"]')) return `Ajuste progressivement « ${label} ».`;
    if (element.matches('input[type="file"]')) return `Sélectionne un fichier local pour « ${label} » ; il reste traité dans votre navigateur.`;
    return `Exécute l’action « ${label} ».`;
  };
  const descriptionFor = element => element.dataset.help || descriptions[element.id] || descriptions[element.closest('label')?.querySelector('[id]')?.id] || fallbackDescription(element);
  const placeTooltip = element => {
    const box = element.getBoundingClientRect();
    const width = tooltip.offsetWidth || 300;
    const left = Math.max(12, Math.min(innerWidth - width - 12, box.left + box.width / 2 - width / 2));
    const below = box.bottom + 10;
    const top = below + tooltip.offsetHeight < innerHeight ? below : Math.max(12, box.top - tooltip.offsetHeight - 10);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  };
  const showTooltip = element => {
    tooltip.textContent = descriptionFor(element);
    tooltip.classList.add('visible');
    placeTooltip(element);
  };
  const hideTooltip = () => tooltip.classList.remove('visible');
  const viewportBox = () => {
    const viewport = window.visualViewport;
    return {
      left: viewport?.offsetLeft || 0,
      top: viewport?.offsetTop || 0,
      width: viewport?.width || window.innerWidth,
      height: viewport?.height || window.innerHeight
    };
  };
  const placeOptionsMenu = menu => {
    if (!menu.open) return;
    const content = menu.querySelector(':scope > .game-options-content');
    const summary = menu.querySelector(':scope > summary');
    if (!content || !summary) return;
    const margin = 12;
    const gap = 7;
    const viewport = viewportBox();
    const anchor = summary.getBoundingClientRect();
    content.style.width = `${Math.min(440, viewport.width - margin * 2)}px`;
    content.style.maxHeight = `${Math.max(120, viewport.height - margin * 2)}px`;
    const measured = content.getBoundingClientRect();
    const roomBelow = viewport.top + viewport.height - anchor.bottom - margin - gap;
    const roomAbove = anchor.top - viewport.top - margin - gap;
    const openBelow = roomBelow >= Math.min(measured.height, 240) || roomBelow >= roomAbove;
    const availableHeight = Math.max(120, openBelow ? roomBelow : roomAbove);
    const preferredLeft = anchor.right - measured.width;
    const left = Math.max(viewport.left + margin, Math.min(preferredLeft, viewport.left + viewport.width - measured.width - margin));
    const top = openBelow
      ? anchor.bottom + gap
      : Math.max(viewport.top + margin, anchor.top - Math.min(measured.height, availableHeight) - gap);
    content.style.left = `${left}px`;
    content.style.top = `${top}px`;
    content.style.right = 'auto';
    content.style.bottom = 'auto';
    content.style.maxHeight = `${availableHeight}px`;
  };
  const suitableTarget = element => {
    if (!(element instanceof HTMLElement) || element.dataset.helpReady) return false;
    if (element.matches('.card,.tile,.cell,.piece,.checker,.palette-color,[data-row],[data-card],[data-cell]')) return false;
    return element.matches('select,input,button[id],label:has(select),label:has(input)');
  };
  const enhance = root => {
    const descendants = root.querySelectorAll ? [...root.querySelectorAll('select,input,button[id],label')] : [];
    const elements = [root, ...descendants];
    elements.filter(suitableTarget).forEach(element => {
      element.dataset.helpReady = 'true';
      element.classList.add('option-help-target');
      const description = descriptionFor(element);
      if (!element.title) element.title = description;
      element.setAttribute('aria-describedby', tooltip.id);
      element.addEventListener('pointerenter', () => showTooltip(element));
      element.addEventListener('pointerleave', hideTooltip);
      element.addEventListener('focusin', () => showTooltip(element));
      element.addEventListener('focusout', hideTooltip);
    });
  };
  const categoryFor = control => categoryRules.find(([, pattern]) => pattern.test(`${control.id} ${cleanLabel(control)}`))?.[0] || 'Partie';
  const groupContainerOptions = container => {
    if (container.dataset.optionsGrouped || container.closest('.option-groups,.game-options-menu') || document.getElementById('variantChoice') || document.getElementById('inputMappingPanel')) return;
    const labels = [...container.children].filter(child => child.matches?.('label') && child.querySelector('select,input:not([type="file"])'));
    if (!labels.length) return;
    container.dataset.optionsGrouped = 'true';
    const menu = document.createElement('details');
    menu.className = 'game-options-menu';
    const summary = document.createElement('summary');
    summary.textContent = labels.length === 1 ? 'Option' : `Options · ${labels.length}`;
    const content = document.createElement('div');
    content.className = 'game-options-content';
    menu.append(summary, content);
    menu.addEventListener('toggle', () => {
      if (!menu.open) return;
      document.querySelectorAll('.game-options-menu[open]').forEach(other => { if (other !== menu) other.open = false; });
      requestAnimationFrame(() => placeOptionsMenu(menu));
    });
    const anchor = labels[0];
    container.insertBefore(menu, anchor);
    const categories = new Map();
    labels.forEach(label => {
      const control = label.querySelector('select,input');
      const category = categoryFor(control);
      if (!categories.has(category)) {
        const section = document.createElement('section');
        section.className = 'game-options-section';
        section.innerHTML = `<strong>${category}</strong>`;
        categories.set(category, section);
        content.append(section);
      }
      categories.get(category).append(label);
    });
  };
  const initialize = () => {
    enhance(document);
    document.querySelectorAll('.toolbar,.bar,.rules').forEach(groupContainerOptions);
    new MutationObserver(mutations => mutations.forEach(mutation => mutation.addedNodes.forEach(node => { if (node.nodeType === Node.ELEMENT_NODE) enhance(node); }))).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('pointerdown', event => { if (!event.target.closest('.game-options-menu')) document.querySelectorAll('.game-options-menu[open]').forEach(menu => { menu.open = false; }); });
    addEventListener('scroll', () => {
      hideTooltip();
      document.querySelectorAll('.game-options-menu[open]').forEach(placeOptionsMenu);
    }, true);
    addEventListener('resize', () => {
      hideTooltip();
      document.querySelectorAll('.game-options-menu[open]').forEach(placeOptionsMenu);
    });
    window.visualViewport?.addEventListener('resize', () => document.querySelectorAll('.game-options-menu[open]').forEach(placeOptionsMenu));
    if (new URLSearchParams(location.search).has('optionsTest')) window.setTimeout(() => { document.title = `AIDE OPTIONS · ${document.querySelectorAll('.game-options-menu').length} menu(s) · ${document.querySelectorAll('.option-help-target').length} contrôle(s)`; }, 80);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true }); else initialize();
})();
