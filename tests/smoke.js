const routes = [
  '../index.html',
  '../replay.html',
  '../games/grid/sudoku.html', '../games/grid/nonogram.html', '../games/grid/minesweeper.html', '../games/grid/logic-puzzles.html', '../games/grid/fusion-2048.html',
  '../games/arcade/arcade.html', '../games/arcade/pong.html', '../games/arcade/stellar-assault.html', '../games/arcade/vector-drift.html', '../games/arcade/pocket-platformer.html', '../games/arcade/pinball.html', '../games/arcade/labyrinthe-glouton.html', '../games/arcade/traversee-turbo.html', '../games/arcade/asteria.html', '../games/arcade/eclipse-depths.html',
  '../games/cards/classic/bataille.html', '../games/cards/classic/bataille-corse.html', '../games/cards/classic/casino-plis.html', '../games/cards/classic/klondike.html', '../games/cards/classic/rami-cartes.html', '../games/cards/classic/memory.html',
  '../games/cards/modern/symbole-unique.html', '../games/cards/modern/totem-reflexe.html', '../games/cards/modern/derniere-couleur.html', '../games/cards/modern/grille-zero.html', '../games/cards/modern/sixieme-carte.html', '../games/cards/modern/course-1000.html', '../games/cards/modern/roi-pirate.html', '../games/cards/modern/chatastrophe.html',
  '../games/board/board-games.html?variant=estate', '../games/board/board-games.html?variant=world', '../games/board/board-games.html?variant=payday', '../games/board/chess.html?variant=chess', '../games/board/chess.html?variant=checkers', '../games/board/go.html', '../games/board/mahjong.html', '../games/board/rami-tuiles.html',
  '../games/board/tiles-routes.html', '../games/board/connect-four.html',
  '../games/rhythm/rhythm.html', '../games/rhythm/karaoke.html', '../games/rhythm/rhythm-echo.html', '../games/rhythm/audio-lab.html'
];
const resultsElement = document.getElementById('results');
const passedElement = document.getElementById('passed');
const failedElement = document.getElementById('failed');
const pendingElement = document.getElementById('pending');
const sandbox = document.getElementById('sandbox');
let results = [];

function updateSummary() {
  passedElement.textContent = results.filter(result => result.state === 'ok').length;
  failedElement.textContent = results.filter(result => result.state === 'fail').length;
  pendingElement.textContent = results.filter(result => result.state === 'running').length;
  resultsElement.innerHTML = results.map(result => `<tr><td>${result.name}</td><td class="${result.state}">${result.state === 'ok' ? 'Réussi' : result.state === 'fail' ? 'Échec' : 'En cours'}</td><td>${result.detail}</td></tr>`).join('');
}

async function test(name, action) {
  const result = { name, state: 'running', detail: 'Vérification…' };
  results.push(result);
  updateSummary();
  try { result.detail = await action() || 'OK'; result.state = 'ok'; }
  catch (error) { result.detail = error.message; result.state = 'fail'; }
  updateSummary();
}

function assert(condition, message) { if (!condition) throw new Error(message); }

async function testRuntime() {
  assert(GameRuntime.version >= 12, 'Une ancienne version du runtime partagé est chargée.');
  const first = GameRuntime.createRandom('même-graine');
  const second = GameRuntime.createRandom('même-graine');
  assert(Array.from({ length: 8 }, first).join(',') === Array.from({ length: 8 }, second).join(','), 'Le hasard reproductible diverge.');
  const history = GameRuntime.createHistory({ value: 1 });
  history.push({ value: 2 }); history.push({ value: 3 });
  assert(history.undo().value === 2 && history.redo().value === 3, 'Historique annuler/rétablir incorrect.');
  const shuffled = GameRuntime.shuffle([1,2,3,4], GameRuntime.createRandom('tri'));
  assert(shuffled.length === 4 && new Set(shuffled).size === 4, 'Le mélange perd des éléments.');
  assert(typeof GameRuntime.listAutosaves === 'function' && typeof GameRuntime.removeAutosave === 'function', 'Le gestionnaire de sauvegardes commun est absent.');
  return 'Graine, mélange, historique et index de sauvegardes validés.';
}

async function testMusicParser() {
  const musicXml = `<?xml version="1.0"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Chant</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>2</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes><direction><sound tempo="96"/></direction><note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><lyric><text>Bon</text></lyric><tie type="start"/></note><note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><lyric><text>jour</text></lyric><tie type="stop"/></note><note><rest/><duration>4</duration><voice>1</voice></note></measure><measure number="2"><direction><sound tempo="60"/></direction><note><pitch><step>D</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice><lyric><text>suite</text></lyric></note></measure></part></score-partwise>`;
  const tracks = MusicScoreParser.parseXml(musicXml, 'fixture.musicxml');
  assert(tracks.length === 1, 'La voix MusicXML n’est pas détectée.');
  assert(tracks[0].events.length === 2 && tracks[0].events[0].beats === 2, 'La liaison MusicXML n’est pas fusionnée.');
  assert(tracks[0].events[0].lyric === 'Bon' && tracks[0].tempo === 96, 'Paroles ou tempo MusicXML incorrects.');
  assert(tracks[0].tempoChanges.length === 2 && Math.abs(tracks[0].events[1].startMs - 2500) < 2 && Math.abs(tracks[0].events[1].durationMs - 1000) < 2, 'Les changements de tempo MusicXML ne sont pas chronométrés.');
  return 'Voix, parole, tempo variable et liaison MusicXML validés.';
}

async function testRhythmAssets() {
  const assets = [
    '../games/rhythm/assets/MS-Basic.sf3',
    '../vendor/spessasynth_lib/dist/index.js',
    '../vendor/spessasynth_lib/dist/spessasynth_processor.min.js',
    '../vendor/spessasynth_core/dist/index.js',
    '../vendor/stb-vorbis/dist/index.js',
  ];
  for (const asset of assets) {
    const response = await fetch(asset, { method: 'HEAD', cache: 'no-store' });
    assert(response.ok, `Ressource audio inaccessible : ${asset}`);
    if (asset.endsWith('.sf3')) {
      const size = Number(response.headers.get('content-length')) || 0;
      assert(!size || size > 1024 * 1024, 'La banque de sons MS Basic est incomplète.');
    }
  }
  return 'SoundFont, synthétiseur, processeur et décodeur accessibles.';
}

async function testInstallableApp() {
  const manifestResponse = await fetch('../manifest.webmanifest', { cache: 'no-store' });
  assert(manifestResponse.ok, 'Le manifeste installable est inaccessible.');
  const manifest = await manifestResponse.json();
  assert(manifest.name && manifest.start_url && manifest.icons?.length, 'Le manifeste installable est incomplet.');
  const workerResponse = await fetch('../sw.js', { cache: 'no-store' });
  assert(workerResponse.ok, 'Le service worker hors ligne est inaccessible.');
  const iconResponse = await fetch('../assets/hub-icon.svg', { cache: 'no-store' });
  assert(iconResponse.ok, 'L’icône de la ludothèque est inaccessible.');
  const lanClientResponse = await fetch('../shared/lan-multiplayer.js', { cache: 'no-store' });
  assert(lanClientResponse.ok, 'Le client des salons LAN est inaccessible.');
  return 'Manifeste, cache hors ligne, client LAN et icône accessibles.';
}

async function testAssets(route) {
  const response = await fetch(route, { cache: 'no-store' });
  assert(response.ok, `Page inaccessible : HTTP ${response.status}`);
  const html = await response.text();
  const documentNode = new DOMParser().parseFromString(html, 'text/html');
  assert(documentNode.title, 'Titre HTML manquant.');
  if (new URL(route, location.href).pathname.includes('/games/') && !new URL(route, location.href).pathname.endsWith('/index.html')) {
    const viewport = documentNode.querySelector('meta[name="viewport"]');
    assert(viewport?.content.includes('width=device-width'), 'Configuration mobile viewport absente.');
  }
  const base = new URL(route, location.href);
  const sources = [...documentNode.querySelectorAll('script[src]')].map(script => new URL(script.getAttribute('src'), base));
  for (const source of sources) {
    const scriptResponse = await fetch(source, { cache: 'no-store' });
    assert(scriptResponse.ok, `Script absent : ${source.pathname}`);
  }
  return `${sources.length} script(s) local(aux) accessible(s).`;
}

function loadRoute(route, seed = 'diagnostic') {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Chargement supérieur à 12 secondes.')), 12000);
    sandbox.onload = () => {
      clearTimeout(timeout);
      try {
        const loaded = sandbox.contentDocument;
        assert(loaded?.body && loaded.title, 'Document chargé incomplet.');
        const text = loaded.body.innerText.trim();
        assert(text.length > 20, 'Interface vide après chargement.');
        if (route.includes('/games/')) {
          assert(loaded.querySelector('style[data-mobile-layout]'), 'La couche responsive mobile commune n’est pas chargée.');
          const mobile = sandbox.contentWindow.GameRuntime?.mobileInterface(loaded);
          assert(mobile?.viewport && mobile.layoutInstalled && mobile.interactiveControls > 0, 'Le diagnostic mobile commun est incomplet.');
        }
        resolve(`Interface chargée : ${loaded.title}.`);
      } catch (error) { reject(error); }
    };
    sandbox.onerror = () => { clearTimeout(timeout); reject(new Error('Erreur de chargement du document.')); };
    const url = new URL(route, location.href); url.searchParams.set('smoke', '1'); url.searchParams.set('seed', seed); sandbox.src = url.href;
  });
}

async function waitForGameInvariant(frameWindow, route) {
  const deadline = performance.now() + 15000;
  while (performance.now() < deadline) {
    if (route.includes('/sudoku.html')) {
      const summary = frameWindow.SudokuTestAPI?.summary();
      if (summary) {
        assert(summary.solved, 'La trace Sudoku ne se termine pas sur une grille complète.');
        assert(summary.unique, 'La grille Sudoku chargée n’est pas unique.');
        return `${summary.clueCount} indice(s), ${summary.stepCount} étape(s), unicité validée.`;
      }
    } else if (route.includes('/mahjong.html')) {
      const summary = frameWindow.MahjongTestAPI?.summary();
      if (summary) {
        assert(summary.generatedSolutionValid, 'L’ordre garanti du Mahjong est invalide.');
        assert(summary.solutionPairs * 2 === summary.tileCount, 'Le Mahjong ne couvre pas toutes les tuiles.');
        const configurations = frameWindow.MahjongTestAPI.validateConfigurations?.() || [];
        assert(configurations.length >= 13 && configurations.every(configuration => configuration.valid), 'Au moins une disposition ou taille Mahjong ne génère pas un plateau complet.');
        return `${summary.tileCount} tuiles et ${configurations.length} configurations validées.`;
      }
    } else if (route.includes('/rami-tuiles.html')) {
      const summary = frameWindow.RamiTuilesTestAPI?.diagnostics();
      if (summary) {
        assert(summary.poolSize === 106 && summary.currentTileCount === 106, 'Le paquet du Rami Tuiles ne conserve pas ses 106 tuiles.');
        assert(summary.groupValid && summary.jokerRunValid && summary.duplicateColorRejected, 'La validation des combinaisons du Rami Tuiles est incorrecte.');
        return 'Paquet, groupes, suites et joker validés.';
      }
    } else if (route.includes('/course-1000.html')) {
      const summary = frameWindow.Course1000TestAPI?.diagnostics();
      if (summary) {
        assert(summary.deckSize === 106, 'Le paquet Course 1000 ne contient pas 106 cartes.');
        assert(summary.distances === 46 && summary.attacks === 18 && summary.remedies === 38 && summary.safeties === 4, 'La composition du paquet Course 1000 est incorrecte.');
        assert(summary.startRequiresGreen && summary.rollingAcceptsDistance, 'Les règles de démarrage ou de distance sont incorrectes.');
        return 'Composition du paquet et règles de route validées.';
      }
    } else if (route.includes('/board-games.html')) {
      const summary = frameWindow.BoardGamesTestAPI?.summary();
      if (summary) {
        assert(summary.positionsValid && summary.playerCount >= 2, 'L’état initial des joueurs du plateau est invalide.');
        assert(summary.estateSpaces === 40 && summary.estatePropertiesUnique, 'Le plateau immobilier est incomplet ou répète une propriété.');
        assert(summary.worldSpaces === 72 && summary.paydaySpaces === 31, 'Un anneau de jeu de plateau est incomplet.');
        return `${summary.kind} : 40/72/31 cases et propriétés uniques validées.`;
      }
    } else if (route.includes('/chess.html')) {
      const summary = frameWindow.ChessBoardTestAPI?.diagnostics();
      if (summary) {
        assert(summary.whitePieces === summary.expectedInitialPieces && summary.blackPieces === summary.expectedInitialPieces, 'Le placement initial des pièces est incomplet.');
        assert(summary.legalMoves > 0 && summary.kingsPresent, 'Le moteur ne trouve aucun coup initial légal ou un roi manque.');
        assert(summary.chess960Castles === 2 && summary.chess960CastlingValid, 'Le roque Chess960 simultané est incorrect.');
        assert(summary.historyReady, 'L’historique annuler/rétablir des échecs et dames est absent.');
        return `${summary.type} ${summary.size}×${summary.size} : ${summary.legalMoves} coups initiaux légaux.`;
      }
    } else if (route.includes('/go.html')) {
      const summary = frameWindow.GoTestAPI?.diagnostics();
      if (summary) {
        assert(summary.intersections === summary.size ** 2 && summary.legalInitialMoves === summary.intersections, 'Le plateau de Go initial contient une intersection illégale.');
        assert(summary.capturesValid && summary.variants.includes('area') && summary.variants.includes('nogo') && summary.rulesVisible, 'Les variantes ou compteurs du Go sont incomplets.');
        assert(summary.superkoBlocks && summary.historyReady && summary.hintAvailable, 'Le superko, l’historique ou l’analyse tactique du Go est incomplet.');
        return `${summary.size}×${summary.size}, ${summary.variants.length} variantes et coups initiaux validés.`;
      }
    } else if (route.includes('/rhythm.html')) {
      const api = frameWindow.RhythmLabTestApi;
      if (api) {
        const summary = api.runRhythmTests();
        assert(summary.failures.length === 0, `Autotest Rhythm Lab : ${summary.failures.join(' · ')}`);
        const mobile = api.mobileInterface();
        assert(mobile.dock && mobile.controls > 0 && mobile.focusButton && mobile.landscapeHint, 'Les commandes tactiles de Rhythm Lab sont incomplètes.');
        return `${summary.passed} contrôles musicaux validés.`;
      }
    } else if (route.includes('/karaoke.html')) {
      const summary = frameWindow.KaraokeTestAPI?.diagnostics();
      if (summary) {
        assert(summary.do4 === 60 && summary.c4 === 60 && summary.siFlat3 === 58, 'La notation des notes du Karaoké est mal interprétée.');
        assert(summary.sequenceLength > 0 && summary.positiveDuration && summary.fourBeatCountIn, 'La chronologie du Karaoké est invalide.');
        assert(summary.frenchNotationDefault && summary.pauseControl && summary.microphoneControl && summary.importedScoreControl && summary.backingControl && summary.synchronizedPause && summary.mobileFocusControl, 'Les options audio, le décompte, la pause ou la vue mobile de Karaoké Lab sont incomplets.');
        return `${summary.sequenceLength} notes, audio et pause synchronisée validés.`;
      }
    } else if (route.includes('/minesweeper.html')) {
      const summary = frameWindow.MinesweeperTestAPI?.diagnostics();
      if (summary) {
        assert(summary.settings.titan.width === 80 && summary.settings.titan.height === 48, 'La grille Titan du Démineur est absente.');
        assert(summary.overlapSafe && summary.frontierSafe, 'Le solveur ne déduit pas les cases sûres par différence de contraintes.');
        assert(summary.overlapDoesNotInventMine && summary.frontierDoesNotInventMine, 'Le solveur invente une mine dans le scénario de contrôle.');
        assert(summary.touchFlagDelay >= 350 && summary.touchFlagDelay <= 600, 'Le maintien tactile du Démineur est absent ou trop lent.');
        assert(summary.squareCells, 'Les cellules du Démineur ne sont pas carrées.');
        return 'Grandes tailles et déductions par contraintes validées.';
      }
    } else if (route.includes('/nonogram.html')) {
      const summary = frameWindow.NonogramTestAPI?.runDiagnostics();
      if (summary) {
        assert(summary.passed === summary.total, `Autotest Nonogram : ${summary.passed}/${summary.total}.`);
        const ui = frameWindow.NonogramTestAPI.interfaceSummary();
        assert(ui.viewport && ui.bounded && ui.zoomButtons === 4, 'Le viewport zoomable du Nonogram est incomplet.');
        assert(['fill', 'cross', 'erase', 'pan'].every(tool => ui.tools.includes(tool)), 'Un outil tactile du Nonogram est absent.');
        assert(ui.touchCrossDelay >= 350 && ui.touchCrossDelay <= 600, 'Le geste tactile de croix du Nonogram est absent ou trop lent.');
        return `${summary.total} contrôles mono/couleur, recherche et grandes tailles validés.`;
      }
    } else if (route.includes('/logic-puzzles.html')) {
      const summary = frameWindow.LogicPuzzlesTestAPI?.diagnostics();
      if (summary) {
        assert(summary.modes.length >= 8 && summary.rendered && summary.controls, 'Suite de puzzles logiques incomplète.');
        assert(summary.generatedValid, 'La solution générée ne respecte pas les règles du puzzle actif.');
        assert(summary.sizes >= 3, 'Le puzzle actif ne propose pas assez de tailles.');
        assert(summary.textualInputs === 0, 'Une saisie textuelle subsiste dans la grille logique.');
        const generators = frameWindow.LogicPuzzlesTestAPI.validateGenerators();
        assert(generators.length === summary.modes.length && generators.every(generator => generator.valid), `Générateur(s) invalide(s) : ${generators.filter(generator => !generator.valid).map(generator => `${generator.mode} ${generator.size}×${generator.size}`).join(', ')}.`);
        const solvers = frameWindow.LogicPuzzlesTestAPI.validateSolvers();
        assert(solvers.length === generators.length && solvers.every(solver => solver.solved), `Solveur(s) invalide(s) : ${solvers.filter(solver => !solver.solved).map(solver => `${solver.mode} ${solver.size}×${solver.size}`).join(', ')}.`);
        return `${solvers.length} configurations de générateurs et solveurs contrôlées (${solvers.reduce((total, solver) => total + solver.milliseconds, 0)} ms).`;
      }
    } else if (route.includes('/arcade.html')) {
      const summary = frameWindow.ArcadeTestAPI?.diagnostics();
      if (summary) {
        assert(summary.modes.length >= 4 && summary.canvas && summary.controls, 'Suite arcade incomplète.');
        assert(summary.mazeFormats === 3 && summary.appliedOptions, 'Les formats arcade ne modifient pas tous les moteurs.');
        assert(summary.difficultyFactors.every((factor, index, factors) => !index || factor > factors[index - 1]) && Object.keys(summary.bonuses).length === summary.modes.length, 'Une difficulté ou variante bonus arcade n’est pas appliquée.');
        return `${summary.modes.length} jeux arcade, formats et commandes tactiles prêts.`;
      }
    } else if (route.includes('/fusion-2048.html')) {
      const summary = frameWindow.Fusion2048TestAPI?.diagnostics();
      if (summary) {
        assert(summary.tiles === 2 && summary.movable && summary.targets.includes(2048), 'La grille Fusion 2048 ne démarre pas correctement.');
        return `${summary.size}×${summary.size}, deux tuiles et objectifs validés.`;
      }
    } else if (route.includes('/connect-four.html')) {
      const summary = frameWindow.ConnectFourTestAPI?.diagnostics();
      if (summary) {
        assert(summary.slots === summary.columns * summary.rows && summary.legal === summary.columns, 'Le plateau Alignement quatre est incohérent.');
        return `${summary.columns}×${summary.rows}, ${summary.legal} colonnes jouables.`;
      }
    } else if (route.includes('/memory.html')) {
      const summary = frameWindow.MemoryTestAPI?.diagnostics();
      if (summary) {
        assert(summary.cards === summary.pairs * 2 && summary.unique === summary.pairs, 'Le paquet de Paires mémoire est invalide.');
        return `${summary.pairs} paires uniques distribuées.`;
      }
    } else if (route.includes('/pong.html')) {
      const summary = frameWindow.PongTestAPI?.diagnostics();
      if (summary) {
        assert(summary.canvas && summary.difficulties === 4 && summary.targets.includes(9), 'Le duel Pong est incomplet.');
        return 'Terrain, difficultés et objectifs Pong validés.';
      }
    } else if (route.includes('/stellar-assault.html')) {
      const summary = frameWindow.StellarAssaultTestAPI?.diagnostics();
      if (summary) {
        assert(summary.canvas && summary.enemies.length >= 8, 'Les archétypes ennemis d’Assaut Stellaire sont incomplets.');
        assert(summary.projectiles.length >= 7 && summary.movements.length >= 6 && summary.formations.length >= 6, 'Les attaques ou motifs procéduraux sont incomplets.');
        assert(summary.upgrades.length >= 10 && summary.difficultyScaling && summary.mobileControls === 7, 'La progression, la difficulté ou les commandes mobiles sont incomplètes.');
        assert(summary.shipClasses.length === 4 && summary.specialAvailable, 'Les classes ou la surcharge tactique sont absentes.');
        const boss = frameWindow.StellarAssaultTestAPI.preview('boss', 5);
        const early = frameWindow.StellarAssaultTestAPI.preview('early', 3);
        const combat = frameWindow.StellarAssaultTestAPI.selfTest();
        assert(boss.boss && early.types.includes('bubbler'), 'La progression des vagues ou les boss périodiques sont invalides.');
        assert(combat.collisionDestroys && combat.attacksGenerated && combat.upgradeApplies, 'Le combat, les attaques ou les améliorations ne sont pas fonctionnels.');
        return `${summary.enemies.length} ennemis, ${summary.projectiles.length} attaques et ${summary.upgrades.length} améliorations validés.`;
      }
    } else if (route.includes('/vector-drift.html')) {
      const summary = frameWindow.VectorDriftTestAPI?.diagnostics();
      if (summary) {
        const mechanics = frameWindow.VectorDriftTestAPI.selfTest();
        assert(summary.canvas && summary.difficulties.length === 4 && summary.modes.length === 3, 'Dérive Vectorielle est incomplet.');
        assert(summary.mobileControls === 5 && summary.asteroidSizes === 3 && mechanics.split && mechanics.wrapping, 'La division, les bords ou les commandes tactiles sont invalides.');
        return 'Trois tailles d’astéroïdes, bords continus et commandes validés.';
      }
    } else if (route.includes('/pocket-platformer.html')) {
      const summary = frameWindow.PocketPlatformerTestAPI?.diagnostics();
      if (summary) {
        const generation = frameWindow.PocketPlatformerTestAPI.selfTest();
        assert(summary.canvas && summary.difficulties.length === 4 && summary.lengths.length === 3 && summary.themes.length === 3, 'Chroniques de Poche est incomplet.');
        assert(summary.mobileControls >= 6 && summary.platforms > 8 && summary.movingPlatforms > 0 && summary.springs > 0 && summary.blocks > 0 && Object.values(generation).every(Boolean), `Le niveau portable généré est invalide : ${JSON.stringify({ summary, generation })}.`);
        return `${summary.platforms} plateformes procédurales et checkpoints validés.`;
      }
    } else if (route.includes('/labyrinthe-glouton.html')) {
      const summary = frameWindow.GloutonTestAPI?.diagnostics();
      assert(summary.connected && summary.ghostBehaviors === 4 && summary.powerSources === 4 && summary.formats.length === 3 && summary.canvas, 'Labyrinthe glouton incomplet ou non connecté.');
      return 'Labyrinthe connecté, quatre IA et bonus validés.';
    } else if (route.includes('/traversee-turbo.html')) {
      const summary = frameWindow.TraverseeTestAPI?.diagnostics();
      assert(summary.lanes === 13 && summary.road && summary.river && summary.safeRows === 3 && summary.difficulties.length === 4 && summary.canvas, 'Traversée procédurale incomplète.');
      return 'Routes, rivières, zones sûres et difficultés validées.';
    } else if (route.includes('/pinball.html')) {
      const summary = frameWindow.PinballTestAPI?.diagnostics();
      if (summary) {
        const physics = frameWindow.PinballTestAPI.selfTest();
        assert(summary.canvas && summary.difficulties.length === 4 && summary.modes.length === 4 && summary.themes.length === 3 && summary.flipperStyles.length === 4, 'Les modes, thèmes ou réglages de batteurs du flipper sont incomplets.');
        assert(summary.flippers === 2 && summary.bumpers >= 4 && summary.targets === 4 && summary.mobileControls === 4 && summary.directTouchFlippers && summary.spinner && summary.saucer, 'La table ou les commandes du flipper sont incomplètes.');
        assert(Object.values(physics).every(Boolean), `Une mécanique du flipper est invalide : ${JSON.stringify(physics)}.`);
        return `${summary.bumpers} bumpers, skill shot, spinner, verrouillage et multibille validés.`;
      }
    } else if (route.includes('/asteria.html')) {
      const summary = frameWindow.AsteriaTestAPI?.diagnostics();
      if (summary) {
        const mechanics = frameWindow.AsteriaTestAPI.selfTest();
        assert(summary.canvas && summary.worldSizes.length === 4 && summary.worldSizes.every(world => world.valid), `Un format de monde Asteria est invalide : ${JSON.stringify(summary.worldSizes)}.`);
        assert(summary.dungeons.length === 6 && summary.dungeons.every(dungeon => dungeon.valid), `Un donjon modulaire est invalide : ${JSON.stringify(summary.dungeons)}.`);
        assert(summary.items.length >= 8 && summary.enemies.length >= 8 && summary.mobileControls === 8, 'La progression, les ennemis ou les commandes d’Asteria sont incomplets.');
        assert(summary.bossPatterns.length === 6, `Les boss d’Asteria ne sont pas assez distincts : ${JSON.stringify(summary.bossPatterns)}.`);
        assert(Object.values(mechanics).every(Boolean), `Une mécanique de génération Asteria est invalide : ${JSON.stringify(mechanics)}.`);
        return `${summary.worldSizes.length} mondes, ${summary.dungeons.length} donjons progressifs et coopération validés.`;
      }
    } else if (route.includes('/eclipse-depths.html')) {
      const summary = frameWindow.EclipseDepthsTestAPI?.diagnostics();
      if (summary) {
        const mechanics = frameWindow.EclipseDepthsTestAPI.selfTest();
        assert(summary.canvas && summary.worlds.length === 4 && summary.worlds.every(world => world.valid), `Une station procédurale est invalide : ${JSON.stringify(summary.worlds)}.`);
        assert(summary.mainUpgrades === 5 && summary.bonusTypes >= 13 && summary.bossPatterns === 6 && summary.mobileControls >= 9 && summary.variableRooms && summary.movingRooms, 'La progression, les boss, les salles variables ou les commandes du Metroid-like sont incomplets.');
        assert(Object.values(mechanics).every(Boolean), `Une mécanique de progression est invalide : ${JSON.stringify(mechanics)}.`);
        return `${summary.worlds.length} tailles, cinq capacités et six boss procéduraux validés.`;
      }
    } else if (route.includes('/rhythm-echo.html')) {
      const summary = frameWindow.RhythmEchoTestAPI?.diagnostics();
      if (summary) {
        assert(summary.pads === 4 && summary.modes.length === 3 && summary.tempos.length === 3, 'Écho rythmique est incomplet.');
        return 'Quatre pads, trois modes et trois tempos validés.';
      }
    } else if (route.includes('/audio-lab.html')) {
      const summary = frameWindow.AudioLabTestAPI?.diagnostics();
      if (summary) {
        assert(summary.localOnly && summary.canvas && summary.formats.includes('midi') && summary.modes.length === 3, 'Audio Lab est incomplet.');
        return `${summary.formats.length} formats et séparation locale préparés.`;
      }
    } else if (route.includes('/casino-plis.html')) {
      const summary = frameWindow.CasinoPlisTestAPI?.diagnostics();
      if (summary) {
        assert(summary.modes.length === 3 && summary.deck === 52 && summary.rendered, 'Jeux de casino ou de plis incomplets.');
        return '21, poker fermé et jeu de plis prêts.';
      }
    } else if (route.includes('/tiles-routes.html')) {
      const summary = frameWindow.TilesRoutesTestAPI?.diagnostics();
      if (summary) {
        assert(summary.modes.length === 3 && summary.cells === 36 && summary.preview && summary.controls, 'Suite de tuiles et routes incomplète.');
        return 'Territoires, mosaïque et routes prêts.';
      }
    } else if (route.includes('/rami-cartes.html')) {
      const summary = frameWindow.RamiCartesTestAPI?.diagnostics();
      if (summary) {
        assert([52, 54].includes(summary.oneDeck) && [104, 108].includes(summary.twoDecks), 'La taille des paquets du Rami Cartes est incorrecte.');
        assert(summary.setValid && summary.jokerRunValid && summary.duplicateSuitRejected, 'Une combinaison du Rami Cartes est mal validée.');
        return 'Paquets, groupes, suites et joker validés.';
      }
    } else if (route.includes('/symbole-unique.html')) {
      const summary = frameWindow.SymbolUniqueTestAPI?.diagnostics();
      if (summary) {
        assert(summary.cardCount === 31 && summary.symbolsPerCard && summary.oneCommonSymbol, 'La géométrie des cartes Symbole Unique est invalide.');
        return '31 cartes, 6 symboles et intersection unique validés.';
      }
    } else if (route.includes('/derniere-couleur.html')) {
      const summary = frameWindow.DerniereCouleurTestAPI?.diagnostics();
      if (summary) {
        assert([108, 116].includes(summary.deckSize) && summary.colorZeros && summary.wilds >= 8 && summary.initialCardsConserved, 'Le paquet Dernière Couleur est incohérent.');
        return `${summary.deckSize} cartes et distribution conservée.`;
      }
    } else if (route.includes('/sixieme-carte.html')) {
      const summary = frameWindow.SixiemeCarteTestAPI?.diagnostics();
      if (summary) {
        assert(summary.deckSize === 104 && summary.horns55 === 7 && summary.horns11 === 5 && summary.horns10 === 3 && summary.horns5 === 2 && summary.horns1 === 1, 'Le nombre de têtes des cartes est incorrect.');
        assert(summary.cardsConserved, 'La distribution Sixième Carte perd des cartes.');
        return '104 cartes, têtes spéciales et distribution validées.';
      }
    } else if (route.includes('/chatastrophe.html')) {
      const summary = frameWindow.ChatastropheTestAPI?.diagnostics();
      if (summary) {
        assert(summary.initialHandsSafe && summary.oneProtectionPerHand && summary.extraProtection && summary.kittens, 'La distribution Chatastrophe est invalide.');
        return `${summary.players} joueurs : protections et incidents correctement distribués.`;
      }
    } else if (route.includes('/roi-pirate.html')) {
      const summary = frameWindow.RoiPirateTestAPI?.diagnostics();
      if (summary) {
        assert(summary.numbers === 56 && summary.escapes === 5 && summary.pirates === 5 && summary.mermaids === 2 && summary.kings === 1, 'Le paquet Roi Pirate est incomplet.');
        assert(summary.deckSize === 69 + summary.creatures, 'Le paquet Roi Pirate perd des cartes.');
        return `${summary.deckSize} cartes et personnages spéciaux validés.`;
      }
    } else if (route.includes('/klondike.html')) {
      const summary = frameWindow.KlondikeTestAPI?.summary();
      if (summary) {
        assert(summary.cardCount === 52 && summary.solvable && summary.certifiedActions > 0, 'La distribution Klondike n’est pas certifiée solvable.');
        assert(summary.hiddenCards > 0, 'La distribution Klondike ne contient aucune carte cachée.');
        return `52 cartes, ${summary.hiddenCards} cachées, ${summary.certifiedActions} actions certifiées.`;
      }
    } else if (route.includes('/grille-zero.html')) {
      const summary = frameWindow.GrilleZeroTestAPI?.summary();
      if (summary) {
        assert(summary.numberCardCount === summary.expectedNumberCards && summary.boardSizesValid, 'La distribution Grille Zéro est incomplète.');
        assert(summary.actionCardCount === summary.expectedActionCards, 'Le paquet d’actions bonus Grille Zéro est incohérent.');
        return `${summary.numberCardCount} cartes numériques et paquet bonus validés.`;
      }
    } else if (route.includes('/totem-reflexe.html')) {
      const summary = frameWindow.TotemReflexeTestAPI?.diagnostics();
      if (summary) {
        assert(summary.cardsConserved, 'Le Totem Réflexe perd des cartes.');
        assert(summary.reactivatesRecipient, 'Un joueur réapprovisionné reste éliminé au Totem Réflexe.');
        assert(summary.turnCanProgress, 'Le tour du Totem Réflexe pointe vers un joueur éliminé.');
        return `${summary.currentCards} cartes conservées et réactivation validée.`;
      }
    } else if (route.includes('/bataille-corse.html')) {
      const summary = frameWindow.BatailleCorseTestAPI?.diagnostics();
      if (summary) {
        assert(summary.totalCards === 52, 'La Bataille Corse perd des cartes.');
        assert(summary.doubleDetected && summary.sandwichDetected && summary.sevenOptional && summary.tenOptional, 'Une combinaison de tape est mal détectée.');
        assert(summary.onlyOneHuman, 'La Bataille Corse propose plusieurs humains locaux.');
        return '52 cartes, doubles, sandwichs et options de tape validés.';
      }
    } else if (route.includes('/bataille.html')) {
      const summary = frameWindow.BatailleTestAPI?.diagnostics();
      if (summary) {
        assert(summary.totalCards === 52 && summary.distributionBalanced, 'La distribution de Bataille est invalide.');
        assert(summary.validTurnState, 'La Bataille est dans un état de tour bloqué.');
        return `52 cartes réparties entre ${summary.players} joueurs.`;
      }
    } else return 'Aucun invariant spécialisé.';
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Le moteur n’a pas exposé son état vérifiable à temps.');
}

async function testMobileRoute(route) {
  sandbox.style.width = '390px';
  sandbox.style.height = '844px';
  await loadRoute(route, 'mobile-diagnostic');
  await new Promise(resolve => setTimeout(resolve, 120));
  const loaded = sandbox.contentDocument;
  const viewportWidth = sandbox.contentWindow.innerWidth;
  const overflow = loaded.documentElement.scrollWidth - viewportWidth;
  assert(overflow <= 3, `Débordement horizontal global de ${overflow}px sur téléphone.`);
  const mobile = sandbox.contentWindow.GameRuntime?.mobileInterface(loaded);
  assert(mobile?.viewportFit && mobile.layoutInstalled, 'La couche mobile commune est incomplète.');
  return `Viewport ${viewportWidth}px sans débordement global.`;
}

async function run() {
  results = [];
  updateSummary();
  await test('Runtime partagé', testRuntime);
  await test('Parseur musical partagé', testMusicParser);
  await test('Ressources audio locales', testRhythmAssets);
  await test('Application installable', testInstallableApp);
  for (const route of routes) await test(`Ressources · ${route.replace('../', '')}`, () => testAssets(route));
  for (const route of routes) {
    await test(`Chargement · ${route.replace('../', '')}`, () => loadRoute(route));
    if (['/sudoku.html', '/mahjong.html', '/rami-tuiles.html', '/rami-cartes.html', '/course-1000.html', '/symbole-unique.html', '/totem-reflexe.html', '/derniere-couleur.html', '/sixieme-carte.html', '/chatastrophe.html', '/roi-pirate.html', '/klondike.html', '/grille-zero.html', '/bataille.html', '/bataille-corse.html', '/casino-plis.html', '/board-games.html', '/tiles-routes.html', '/chess.html', '/go.html', '/rhythm.html', '/karaoke.html', '/minesweeper.html', '/nonogram.html', '/logic-puzzles.html', '/arcade.html', '/fusion-2048.html', '/connect-four.html', '/memory.html', '/pong.html', '/stellar-assault.html', '/vector-drift.html', '/pocket-platformer.html', '/pinball.html', '/labyrinthe-glouton.html', '/traversee-turbo.html', '/asteria.html', '/eclipse-depths.html', '/rhythm-echo.html', '/audio-lab.html'].some(path => route.includes(path))) {
      await test(`Invariant · ${route.replace('../', '')}`, () => waitForGameInvariant(sandbox.contentWindow, route));
    }
  }
  for (const route of [
    '../games/grid/sudoku.html',
    '../games/grid/nonogram.html',
    '../games/grid/minesweeper.html',
    '../games/arcade/stellar-assault.html',
    '../games/arcade/vector-drift.html',
    '../games/arcade/pocket-platformer.html',
    '../games/arcade/pinball.html',
    '../games/arcade/labyrinthe-glouton.html',
    '../games/arcade/traversee-turbo.html',
    '../games/arcade/asteria.html',
    '../games/arcade/eclipse-depths.html',
    '../games/cards/modern/derniere-couleur.html',
    '../games/board/chess.html?variant=chess',
    '../games/rhythm/rhythm.html',
    '../games/rhythm/karaoke.html'
  ]) await test(`Mobile · ${route.replace('../', '')}`, () => testMobileRoute(route));
  sandbox.style.width = '';
  sandbox.style.height = '';
}

async function runStressCampaign() {
  results = [];
  updateSummary();
  const campaigns = [
    '../games/grid/sudoku.html',
    '../games/grid/sudoku.html?variants=killer,thermometer,diagonal',
    '../games/grid/nonogram.html',
    '../games/arcade/eclipse-depths.html',
    '../games/board/mahjong.html',
    '../games/cards/classic/klondike.html'
  ];
  const seeds = Array.from({ length: 40 }, (_, index) => `campagne-${String(index + 1).padStart(2, '0')}`);
  for (const route of campaigns) {
    for (const seed of seeds) {
      const label = `${route.replace('../', '')} · ${seed}`;
      await test(`Campagne · ${label}`, async () => {
        await loadRoute(route, seed);
        return waitForGameInvariant(sandbox.contentWindow, route);
      });
    }
  }
}

document.getElementById('run').addEventListener('click', run);
document.getElementById('stress').addEventListener('click', runStressCampaign);
if (new URLSearchParams(location.search).has('campaign')) runStressCampaign();
else run();
