'use strict';

(() => {
  const BIOMES = ['plains', 'forest', 'mountain', 'lake', 'beach', 'volcano', 'swamp', 'ruins'];
  const SIZE_SETTINGS = {
    compact: { width: 48, height: 36, merchants: 3, secrets: 8 },
    standard: { width: 72, height: 54, merchants: 5, secrets: 14 },
    vast: { width: 96, height: 72, merchants: 7, secrets: 24 },
    epic: { width: 128, height: 96, merchants: 10, secrets: 38 }
  };
  const MAIN_DUNGEONS = [
    { name: 'Sanctuaire Sylvestre', biome: 'forest', reward: 'bombs', requires: null, boss: 'gardienRonce' },
    { name: 'Forge des Cimes', biome: 'mountain', reward: 'glove', requires: 'bombs', boss: 'golemBasalte' },
    { name: 'Temple des Marées', biome: 'beach', reward: 'flippers', requires: 'glove', boss: 'serpentLacustre' },
    { name: 'Ruines des Alizés', biome: 'ruins', reward: 'hookshot', requires: 'flippers', boss: 'sentinelleVent' },
    { name: 'Cœur du Volcan', biome: 'volcano', reward: 'flameWard', requires: 'hookshot', boss: 'hydreCendre' },
    { name: 'Citadelle Astrale', biome: 'mountain', reward: 'sunRelic', requires: 'flameWard', boss: 'roiEclipse' }
  ];
  const GATES = {
    bombs: { type: 'crackedRock', label: 'rocher fissuré' },
    glove: { type: 'boulder', label: 'bloc massif' },
    flippers: { type: 'deepWater', label: 'chenal profond' },
    hookshot: { type: 'chasm', label: 'gouffre' },
    flameWard: { type: 'lavaSeal', label: 'sceau de lave' }
  };
  const PUZZLES = [
    { id: 'runes', label: 'Runes séquentielles', requires: [] },
    { id: 'pressure', label: 'Dalles de pression', requires: [] },
    { id: 'bombSeals', label: 'Sceaux fissurés', requires: ['bombs'] },
    { id: 'pushBlocks', label: 'Blocs mobiles', requires: ['glove'] },
    { id: 'waterRunes', label: 'Runes immergées', requires: ['flippers'] },
    { id: 'hookCrystals', label: 'Cristaux distants', requires: ['hookshot'] },
    { id: 'lavaCircuit', label: 'Circuit volcanique', requires: ['flameWard'] }
  ];

  function fallbackHash(value) {
    let hash = 2166136261;
    for (const character of String(value)) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    return hash >>> 0;
  }

  function randomFor(seed) {
    if (window.GameRuntime?.createRandom) return window.GameRuntime.createRandom(seed);
    let state = fallbackHash(seed) || 1;
    return () => { state += 0x6d2b79f5; let value = state; value = Math.imul(value ^ value >>> 15, value | 1); value ^= value + Math.imul(value ^ value >>> 7, value | 61); return ((value ^ value >>> 14) >>> 0) / 4294967296; };
  }

  function shuffled(values, random) {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index--) { const swap = Math.floor(random() * (index + 1)); [result[index], result[swap]] = [result[swap], result[index]]; }
    return result;
  }

  function tileIndex(world, x, y) { return y * world.width + x; }
  function biomeAt(world, x, y) { return world.biomes[tileIndex(world, x, y)] || 'sea'; }
  function elevationAt(world, x, y) { return x >= 0 && y >= 0 && x < world.width && y < world.height ? world.elevations?.[tileIndex(world, x, y)] || 0 : 0; }
  function setBiome(world, x, y, biome) { if (x >= 0 && y >= 0 && x < world.width && y < world.height) world.biomes[tileIndex(world, x, y)] = biome; }
  function setElevation(world, x, y, elevation) { if (x >= 0 && y >= 0 && x < world.width && y < world.height) world.elevations[tileIndex(world, x, y)] = elevation; }

  function paintDisc(world, centerX, centerY, radius, biome) {
    for (let y = Math.floor(centerY - radius); y <= centerY + radius; y++) for (let x = Math.floor(centerX - radius); x <= centerX + radius; x++) {
      if (Math.hypot(x - centerX, y - centerY) <= radius) setBiome(world, x, y, biome);
    }
  }

  function createBiomeMap(width, height, random) {
    const world = { width, height, biomes: new Array(width * height).fill('plains'), elevations: new Array(width * height).fill(0) };
    const anchors = ['forest', 'mountain', 'lake', 'volcano', 'swamp', 'ruins', 'forest', 'mountain'].map((biome, index) => ({
      biome, x: 7 + random() * (width - 14), y: 7 + random() * (height - 14), weight: 0.75 + random() * 0.65, index
    }));
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const edge = Math.min(x, y, width - 1 - x, height - 1 - y);
      if (edge < 3) { setBiome(world, x, y, 'sea'); continue; }
      if (edge < 5) { setBiome(world, x, y, 'beach'); continue; }
      let nearest = null; let best = Infinity;
      for (const anchor of anchors) {
        const wobble = Math.sin(x * 0.31 + anchor.index) * 1.8 + Math.cos(y * 0.27 - anchor.index) * 1.5;
        const score = (Math.hypot(x - anchor.x, y - anchor.y) + wobble) / anchor.weight;
        if (score < best) { best = score; nearest = anchor; }
      }
      setBiome(world, x, y, nearest?.biome || 'plains');
    }
    const centerX = Math.floor(width / 2); const centerY = Math.floor(height / 2);
    paintDisc(world, centerX, centerY, 5, 'plains');
    anchors.filter(anchor => anchor.biome === 'lake').forEach(anchor => paintDisc(world, anchor.x, anchor.y, Math.max(4, Math.min(width, height) * 0.08), 'lake'));
    return world;
  }

  function candidatesFor(world, biome) {
    const values = [];
    for (let y = 6; y < world.height - 6; y++) for (let x = 6; x < world.width - 6; x++) if (biomeAt(world, x, y) === biome) values.push({ x, y });
    return values;
  }

  function chooseLocation(world, biome, occupied, random, minimumDistance = 8, predicate = () => true) {
    const candidates = shuffled(candidatesFor(world, biome), random).filter(predicate);
    const fallback = [];
    for (let y = 6; y < world.height - 6; y++) for (let x = 6; x < world.width - 6; x++) if (!['sea', 'lake'].includes(biomeAt(world, x, y)) && predicate({ x, y })) fallback.push({ x, y });
    const validFallback = shuffled(fallback, random);
    return candidates.find(point => occupied.every(other => Math.hypot(point.x - other.x, point.y - other.y) >= minimumDistance)) || validFallback.find(point => occupied.every(other => Math.hypot(point.x - other.x, point.y - other.y) >= minimumDistance)) || candidates[0] || validFallback[0] || { x: 6, y: 6 };
  }

  function surroundDungeon(world, dungeon) {
    const requirement = dungeon.requires || 'sword';
    const gate = GATES[requirement] || { type: 'bush', label: 'ronces anciennes' };
    const radius = 2;
    for (let offsetY = -radius; offsetY <= radius; offsetY++) for (let offsetX = -radius; offsetX <= radius; offsetX++) {
      if (Math.max(Math.abs(offsetX), Math.abs(offsetY)) !== radius) continue;
      const isGate = offsetX === 0 && offsetY === radius;
      world.obstacles.push({
        id: `${dungeon.id}-boundary-${offsetX}-${offsetY}`,
        x: dungeon.x + offsetX, y: dungeon.y + offsetY,
        type: isGate ? gate.type : 'ancientWall', label: isGate ? gate.label : 'mur naturel infranchissable',
        requires: isGate ? requirement : null, gateFor: dungeon.id, zoneBoundary: true, permanent: !isGate, cleared: false
      });
    }
  }

  function pointKey(x, y) { return `${x},${y}`; }

  function tilePassable(world, x, y, inventory, targetDungeon = null) {
    if (x < 2 || y < 2 || x >= world.width - 2 || y >= world.height - 2) return false;
    const biome = biomeAt(world, x, y);
    if (biome === 'sea' || biome === 'lake' && !inventory.has('flippers')) return false;
    return world.obstacles.filter(obstacle => !obstacle.cleared && obstacle.x === x && obstacle.y === y).every(obstacle => {
      if (obstacle.gateFor === targetDungeon?.id && obstacle.requires && inventory.has(obstacle.requires)) return true;
      if (obstacle.zoneBoundary || obstacle.permanent) return false;
      return obstacle.requires && inventory.has(obstacle.requires);
    });
  }

  function findProgressionRoute(world, targetDungeon, inventory) {
    const targetKey = pointKey(targetDungeon.x, targetDungeon.y); const startKey = pointKey(world.start.x, world.start.y);
    const pending = [{ ...world.start }]; const previous = new Map([[startKey, null]]);
    for (let cursor = 0; cursor < pending.length; cursor++) {
      const current = pending[cursor]; const currentKey = pointKey(current.x, current.y);
      if (currentKey === targetKey) {
        const route = []; let key = currentKey;
        while (key) { const [x, y] = key.split(',').map(Number); route.push({ x, y }); key = previous.get(key); }
        return route.reverse();
      }
      for (const [offsetX, offsetY] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = current.x + offsetX; const y = current.y + offsetY; const key = pointKey(x, y);
        if (previous.has(key) || !tilePassable(world, x, y, inventory, targetDungeon)) continue;
        previous.set(key, currentKey); pending.push({ x, y });
      }
    }
    return [];
  }

  function guaranteeProgressionAccess(world) {
    const inventory = new Set(['sword']); const routes = [];
    const mainDungeons = world.dungeons.filter(dungeon => dungeon.main).sort((left, right) => left.index - right.index);
    for (const dungeon of mainDungeons) {
      let route = findProgressionRoute(world, dungeon, inventory);
      if (!route.length) {
        const fallback = findSafeRoute(world, world.start, { x: dungeon.x, y: dungeon.y + 3 });
        const protectedKeys = new Set(fallback.map(point => pointKey(point.x, point.y)));
        fallback.forEach(point => setBiome(world, point.x, point.y, 'plains'));
        world.obstacles = world.obstacles.filter(obstacle => obstacle.zoneBoundary || !protectedKeys.has(pointKey(obstacle.x, obstacle.y)));
        route = findProgressionRoute(world, dungeon, inventory);
      }
      routes.push({ dungeonId: dungeon.id, requires: dungeon.requires, reward: dungeon.reward, tiles: route });
      inventory.add(dungeon.reward);
    }
    world.progressionRoutes = routes;
    const trailEntries = routes.flatMap(route => route.tiles.filter((_, index) => index % 2 === 0 || index < 5).map(point => [pointKey(point.x, point.y), point]));
    world.trails = [...new Map(trailEntries).values()];
  }

  function findSafeRoute(world, start, target) {
    const blocked = new Set(world.obstacles.filter(obstacle => obstacle.zoneBoundary && !obstacle.cleared).map(obstacle => pointKey(obstacle.x, obstacle.y)));
    function routeThrough(waypoints) {
      const route = [{ ...start }]; let current = { ...start };
      for (const waypoint of waypoints) {
        while (current.x !== waypoint.x) { current = { x: current.x + Math.sign(waypoint.x - current.x), y: current.y }; route.push(current); }
        while (current.y !== waypoint.y) { current = { x: current.x, y: current.y + Math.sign(waypoint.y - current.y) }; route.push(current); }
      }
      return route;
    }
    const candidates = [];
    for (let y = 3; y < world.height - 3; y++) candidates.push(routeThrough([{ x: start.x, y }, { x: target.x, y }, target]));
    for (let x = 3; x < world.width - 3; x++) candidates.push(routeThrough([{ x, y: start.y }, { x, y: target.y }, target]));
    return candidates.filter(route => route.every(point => !blocked.has(pointKey(point.x, point.y)))).sort((left, right) => left.length - right.length)[0] || [];
  }

  function guaranteeVillageAccess(world) {
    const protectedTiles = new Set();
    paintDisc(world, world.start.x, world.start.y, 9, 'plains');
    for (let offsetY = -7; offsetY <= 7; offsetY++) for (let offsetX = -7; offsetX <= 7; offsetX++) if (Math.hypot(offsetX, offsetY) <= 7) protectedTiles.add(pointKey(world.start.x + offsetX, world.start.y + offsetY));
    const roads = [];
    for (let distance = 0; distance <= 10; distance++) {
      [[distance, 0], [-distance, 0], [0, distance], [0, -distance]].forEach(([offsetX, offsetY]) => {
        const x = world.start.x + offsetX; const y = world.start.y + offsetY;
        protectedTiles.add(pointKey(x, y));
        roads.push({ x, y });
        setBiome(world, x, y, 'plains');
      });
    }
    const firstDungeon = world.dungeons.find(dungeon => dungeon.main && dungeon.index === 0);
    const firstGateApproach = firstDungeon ? { x: firstDungeon.x, y: firstDungeon.y + 3 } : null;
    const route = firstGateApproach ? findSafeRoute(world, world.start, firstGateApproach) : [];
    route.forEach(point => {
      protectedTiles.add(pointKey(point.x, point.y));
      setBiome(world, point.x, point.y, 'plains');
    });
    world.obstacles = world.obstacles.filter(obstacle => !protectedTiles.has(pointKey(obstacle.x, obstacle.y)));
    world.villageExits = [
      { x: world.start.x + 1, y: world.start.y }, { x: world.start.x - 1, y: world.start.y },
      { x: world.start.x, y: world.start.y + 1 }, { x: world.start.x, y: world.start.y - 1 }
    ];
    world.guaranteedRoute = route;
    world.firstGateApproach = firstGateApproach;
    world.villageClearRadius = 7;
    world.villageRoads = [...new Map(roads.map(point => [pointKey(point.x, point.y), point])).values()];
    world.village = {
      name: 'Clairval', center: { ...world.start },
      buildings: [
        { id: 'inn', x: world.start.x - 4, y: world.start.y - 3, label: 'Auberge du Levant', action: 'rest' },
        { id: 'workshop', x: world.start.x + 4, y: world.start.y - 3, label: 'Atelier des Voyageurs', action: 'guide' },
        { id: 'archive', x: world.start.x - 4, y: world.start.y + 3, label: 'Maison des Cartes', action: 'map' }
      ],
      villagers: [
        { id: 'elder', x: world.start.x + 1, y: world.start.y + 1, name: 'Méridia', dialogue: 'Les quatre chemins de Clairval restent toujours ouverts. Le sanctuaire sylvestre protège les premières bombes.' },
        { id: 'scout', x: world.start.x - 2, y: world.start.y, name: 'Orin', dialogue: 'Les échelles franchissent les falaises. Une paroi fissurée cache souvent une grotte.' },
        { id: 'healer', x: world.start.x + 2, y: world.start.y - 1, name: 'Sélène', dialogue: 'Reviens me voir lorsque tes cœurs faiblissent.', action: 'heal' }
      ]
    };
  }

  function generateCliffs(world, random) {
    const count = { compact: 2, standard: 4, vast: 7, epic: 11 }[world.size] || 4; world.cliffs = [];
    const roadKeys = new Set((world.villageRoads || []).map(point => pointKey(point.x, point.y)));
    const progressionKeys = new Set([...(world.progressionRoutes || []).flatMap(route => route.tiles.map(point => pointKey(point.x, point.y))), ...(world.guaranteedRoute || []).map(point => pointKey(point.x, point.y))]);
    const validPoint = point => Math.hypot(point.x - world.start.x, point.y - world.start.y) > (world.size === 'compact' ? 9 : 12) && world.dungeons.every(dungeon => Math.hypot(point.x - dungeon.x, point.y - dungeon.y) > (world.size === 'compact' ? 3.2 : 4));
    const fallback = []; for (let y = 9; y < world.height - 7; y++) for (let x = 8; x < world.width - 8; x++) if (!['sea', 'lake'].includes(biomeAt(world, x, y)) && validPoint({ x, y })) fallback.push({ x, y });
    const candidates = [...shuffled(candidatesFor(world, 'mountain').filter(validPoint), random), ...shuffled(fallback, random)];
    for (const point of candidates) {
      if (world.cliffs.length >= count) break;
      const width = 5 + Math.floor(random() * 4); const depth = 4 + Math.floor(random() * 3); const startX = Math.max(4, Math.min(world.width - width - 5, point.x - Math.floor(width / 2))); const southY = Math.max(depth + 4, Math.min(world.height - 5, point.y)); const topY = southY - depth;
      const footprint = [];
      for (let y = topY - 1; y <= southY; y++) for (let x = startX - 1; x <= startX + width; x++) footprint.push({ x, y });
      if (footprint.some(tile => Math.hypot(tile.x - world.start.x, tile.y - world.start.y) <= world.villageClearRadius + 1 || roadKeys.has(pointKey(tile.x, tile.y)) || progressionKeys.has(pointKey(tile.x, tile.y)) || world.obstacles.some(obstacle => obstacle.x === tile.x && obstacle.y === tile.y && (obstacle.zoneBoundary || obstacle.permanent)) || world.cliffs.some(cliff => tile.x >= cliff.x - 2 && tile.x <= cliff.x + cliff.width + 1 && tile.y >= cliff.topY - 2 && tile.y <= cliff.y + 1))) continue;
      const footprintKeys = new Set(footprint.map(tile => pointKey(tile.x, tile.y))); world.obstacles = world.obstacles.filter(obstacle => obstacle.zoneBoundary || obstacle.permanent || !footprintKeys.has(pointKey(obstacle.x, obstacle.y)));
      const ladderIndex = 1 + Math.floor(random() * (width - 2)); const caveChoices = Array.from({ length: width - 2 }, (_, index) => index + 1).filter(index => index !== ladderIndex); const caveIndex = caveChoices[Math.floor(random() * caveChoices.length)];
      const cliff = { id: `cliff-${world.cliffs.length}`, x: startX, y: southY, topY, width, depth, level: 1, height: 42 + Math.floor(random() * 24), ladderX: startX + ladderIndex, caveX: startX + caveIndex }; world.cliffs.push(cliff);
      for (let y = topY; y < southY; y++) for (let x = startX; x < startX + width; x++) { setElevation(world, x, y, cliff.level); if (biomeAt(world, x, y) !== 'volcano') setBiome(world, x, y, 'mountain'); }
      for (let index = 0; index < width; index++) {
        const tile = { x: startX + index, y: southY };
        if (index === ladderIndex) continue;
        if (index === caveIndex) world.obstacles.push({ ...tile, id: `${cliff.id}-cave`, type: 'crackedCliff', label: 'flanc de falaise fissuré', requires: 'bombs', cleared: false, cliffId: cliff.id, cave: true });
        else world.obstacles.push({ ...tile, id: `${cliff.id}-front-${index}`, type: 'cliffWall', label: 'flanc de falaise', permanent: true, cleared: false, cliffId: cliff.id });
      }
      for (let y = topY - 1; y < southY; y++) {
        world.obstacles.push({ id: `${cliff.id}-west-${y}`, x: startX - 1, y, type: 'cliffSide', label: 'paroi latérale', permanent: true, cleared: false, cliffId: cliff.id });
        world.obstacles.push({ id: `${cliff.id}-east-${y}`, x: startX + width, y, type: 'cliffSide', label: 'paroi latérale', permanent: true, cleared: false, cliffId: cliff.id });
      }
      for (let x = startX; x < startX + width; x++) world.obstacles.push({ id: `${cliff.id}-back-${x}`, x, y: topY - 1, type: 'cliffBack', label: 'corniche rocheuse', permanent: true, cleared: false, cliffId: cliff.id });
      world.chests.push({ id: `${cliff.id}-summit`, x: startX + width - 2, y: topY + 1, elevation: 1, hidden: false, opened: false, reward: shuffled(['heartPiece', 'coins', 'weaponRune', 'armorRune'], random)[0] });
      world.chests.push({ id: `${cliff.id}-treasure`, x: cliff.caveX, y: southY + 1, elevation: 0, hidden: false, opened: false, cave: true, requiresCave: `${cliff.id}-cave`, reward: shuffled(['heartPiece', 'coins', 'weaponRune', 'armorRune'], random)[0] });
    }
  }

  function generateScenery(world) {
    const occupied = new Set(world.obstacles.map(obstacle => pointKey(obstacle.x, obstacle.y)));
    const progressionKeys = new Set((world.progressionRoutes || []).flatMap(route => route.tiles.map(point => pointKey(point.x, point.y))));
    const sceneryByBiome = {
      plains: ['grass', 'flowers', 'shrub'], forest: ['tree', 'tree', 'pine', 'stump', 'mushroom'], mountain: ['rock', 'pine', 'crystal'],
      beach: ['palm', 'shell', 'driftwood'], volcano: ['basalt', 'vent', 'emberPlant'], swamp: ['reed', 'mushroom', 'deadTree'], ruins: ['column', 'rubble', 'shrub'], lake: ['reed']
    };
    const collidable = new Set(['tree', 'pine', 'palm', 'rock', 'basalt', 'deadTree', 'column', 'stump']);
    world.scenery = [];
    for (let y = 4; y < world.height - 4; y++) for (let x = 4; x < world.width - 4; x++) {
      const biome = biomeAt(world, x, y); const choices = sceneryByBiome[biome];
      if (!choices || occupied.has(pointKey(x, y)) || progressionKeys.has(pointKey(x, y)) || world.chests.some(chest => chest.x === x && chest.y === y) || Math.hypot(x - world.start.x, y - world.start.y) < 9 || world.dungeons.some(dungeon => Math.hypot(x - dungeon.x, dungeon.y - y) < 4)) continue;
      const variation = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      const density = biome === 'forest' ? 5 : ['mountain', 'swamp', 'ruins'].includes(biome) ? 8 : 11;
      if (variation % density !== 0) continue;
      const type = choices[variation % choices.length]; world.scenery.push({ id: `${type}-${x}-${y}`, type, x, y, elevation: elevationAt(world, x, y), height: 40 + variation % 37, collidable: collidable.has(type), variant: variation % 4 });
    }
  }

  function generateWorld(seed = 'asteria', size = 'standard') {
    const settings = SIZE_SETTINGS[size] || SIZE_SETTINGS.standard;
    const random = randomFor(`asteria-world:${seed}:${size}`);
    const world = createBiomeMap(settings.width, settings.height, random);
    Object.assign(world, { seed, size, start: { x: Math.floor(world.width / 2), y: Math.floor(world.height / 2) }, dungeons: [], obstacles: [], merchants: [], chests: [], landmarks: [] });
    const occupied = [world.start];
    MAIN_DUNGEONS.forEach((definition, index) => {
      const location = chooseLocation(world, definition.biome, occupied, random, Math.max(8, Math.floor(Math.min(world.width, world.height) / 8)), point => Math.hypot(point.x - world.start.x, point.y - world.start.y) >= 15);
      occupied.push(location);
      const dungeon = { ...definition, ...location, id: `main-${index + 1}`, index, main: true, difficulty: index + 1, completed: false };
      paintDisc(world, location.x, location.y, 3, definition.biome);
      world.dungeons.push(dungeon);
      world.landmarks.push({ x: location.x, y: location.y, type: 'dungeon', id: dungeon.id });
      surroundDungeon(world, dungeon);
    });
    const bonusRewards = ['swordUpgrade', 'armorUpgrade', 'heartContainer', 'bow', 'coinCache'];
    const accessItems = [null, 'bombs', 'glove', 'flippers', 'hookshot', 'flameWard'];
    const bonusCount = size === 'compact' ? 2 : size === 'standard' ? 3 : size === 'vast' ? 5 : 7;
    for (let index = 0; index < bonusCount; index++) {
      const biome = shuffled(BIOMES.filter(value => !['sea', 'lake'].includes(value)), random)[0];
      const location = chooseLocation(world, biome, occupied, random, 6); occupied.push(location);
      const requires = accessItems[Math.min(accessItems.length - 1, Math.floor(index * accessItems.length / bonusCount))];
      world.dungeons.push({ id: `bonus-${index + 1}`, name: `Crypte oubliée ${index + 1}`, biome, reward: bonusRewards[index % bonusRewards.length], requires, boss: 'gardienAncien', index, main: false, difficulty: 1 + index, ...location, completed: false });
    }
    for (let index = 0; index < settings.merchants; index++) {
      const location = chooseLocation(world, ['plains', 'forest', 'beach'][index % 3], occupied, random, 5); occupied.push(location);
      world.merchants.push({ ...location, id: `merchant-${index}`, stock: shuffled(['potion', 'bombBag', 'armorUpgrade', 'heartContainer', 'bow'], random).slice(0, 3) });
    }
    for (let index = 0; index < settings.secrets; index++) {
      const biome = shuffled(['forest', 'mountain', 'beach', 'swamp', 'ruins'], random)[0];
      const location = chooseLocation(world, biome, occupied, random, 3); occupied.push(location);
      world.chests.push({ ...location, id: `secret-${index}`, hidden: random() < 0.55, opened: false, reward: shuffled(['coins', 'potion', 'bombs', 'heartPiece'], random)[0] });
    }
    const obstacleTypes = [
      { type: 'bush', requires: 'sword', label: 'buisson dense' }, { type: 'crackedRock', requires: 'bombs', label: 'rocher fissuré' },
      { type: 'boulder', requires: 'glove', label: 'bloc mobile' }, { type: 'deepWater', requires: 'flippers', label: 'mare profonde' },
      { type: 'chasm', requires: 'hookshot', label: 'gouffre' }, { type: 'lavaSeal', requires: 'flameWard', label: 'lave vive' }
    ];
    const ambientClusters = Math.floor(world.width * world.height / 180); let ambientSerial = 0;
    for (let index = 0; index < ambientClusters; index++) {
      const definition = obstacleTypes[Math.floor(random() * obstacleTypes.length)];
      const centerX = 5 + Math.floor(random() * (world.width - 10)); const centerY = 5 + Math.floor(random() * (world.height - 10)); const clusterSize = 1 + Math.floor(random() * 4);
      for (let member = 0; member < clusterSize; member++) {
        const x = centerX + Math.floor(random() * 3) - 1; const y = centerY + Math.floor(random() * 3) - 1;
        if (Math.hypot(x - world.start.x, y - world.start.y) < 7 || occupied.some(point => Math.hypot(point.x - x, point.y - y) < 1.2) || world.obstacles.some(obstacle => obstacle.x === x && obstacle.y === y)) continue;
        world.obstacles.push({ id: `ambient-${ambientSerial++}`, x, y, cluster: index, ...definition, cleared: false, ambient: true });
      }
    }
    guaranteeVillageAccess(world);
    guaranteeProgressionAccess(world);
    generateCliffs(world, random);
    generateScenery(world);
    return world;
  }

  function connect(rooms, firstId, firstSide, secondId, secondSide, slot = 0, locked = false) {
    rooms[firstId].doors.push({ side: firstSide, slot, to: secondId, locked });
    rooms[secondId].doors.push({ side: secondSide, slot: -slot, to: firstId, locked });
  }

  function choosePuzzle(availableItems, random, afterReward = null) {
    const inventory = new Set([...availableItems, ...(afterReward ? [afterReward] : [])]);
    const compatible = PUZZLES.filter(puzzle => puzzle.requires.every(item => inventory.has(item)));
    if (afterReward) {
      const mastery = compatible.filter(puzzle => puzzle.requires.includes(afterReward));
      if (mastery.length) return mastery[Math.floor(random() * mastery.length)];
      return { id: `mastery-${afterReward}`, label: `Maîtrise de ${afterReward}`, requires: [afterReward] };
    }
    return compatible[Math.floor(random() * compatible.length)] || PUZZLES[0];
  }

  function generateDungeon(definition, availableItems = ['sword'], playerCount = 1, seed = 'dungeon') {
    const random = randomFor(`asteria-dungeon:${seed}:${definition.id}:${definition.difficulty}:${playerCount}`);
    const roomTypes = ['entrance', 'encounter', 'puzzle', 'miniboss', 'item', 'itemPuzzle', 'boss', 'treasure', 'merchant', playerCount > 1 ? 'coopPuzzle' : 'challenge'];
    const rooms = roomTypes.map((type, id) => ({ id, type, doors: [], cleared: type === 'entrance' || type === 'merchant', visited: id === 0, puzzle: null, reward: null, enemyTier: definition.difficulty }));
    connect(rooms, 0, 'east', 1, 'west');
    connect(rooms, 1, 'east', 2, 'west', -1); connect(rooms, 1, 'east', 7, 'west', 1);
    connect(rooms, 1, 'north', 8, 'south'); connect(rooms, 2, 'east', 3, 'west');
    connect(rooms, 2, 'south', 9, 'north'); connect(rooms, 3, 'east', 4, 'west', 0, true);
    connect(rooms, 4, 'east', 5, 'west', -1); connect(rooms, 4, 'east', 7, 'west', 1);
    connect(rooms, 5, 'east', 6, 'west', 0, true);
    rooms[2].puzzle = choosePuzzle(availableItems, random);
    rooms[4].reward = definition.reward;
    rooms[5].puzzle = choosePuzzle(availableItems, random, definition.reward);
    rooms[7].reward = shuffled(['coins', 'heartPiece', 'weaponRune', 'armorRune'], random)[0];
    rooms[9].puzzle = playerCount > 1 ? { id: 'coopPlates', label: `${playerCount} dalles simultanées`, requires: [] } : choosePuzzle(availableItems, random);
    rooms[6].boss = definition.boss;
    rooms.forEach(room => { room.theme = definition.biome; room.seed = Math.floor(random() * 0xffffffff); });
    return { id: definition.id, name: definition.name, reward: definition.reward, main: definition.main, difficulty: definition.difficulty, rooms, currentRoom: 0, completed: false, availableItems: [...availableItems], structure: { hubRoom: 1, firstPuzzle: 2, minibossRoom: 3, itemRoom: 4, masteryRoom: 5, bossRoom: 6, optionalRooms: [7, 8, 9], itemBacktracking: true } };
  }

  function reachableRooms(dungeon) {
    const visited = new Set([0]); const pending = [0];
    while (pending.length) {
      const room = dungeon.rooms[pending.shift()];
      room.doors.forEach(door => { if (!visited.has(door.to)) { visited.add(door.to); pending.push(door.to); } });
    }
    return visited;
  }

  function validateWorld(world) {
    const main = world.dungeons.filter(dungeon => dungeon.main).sort((left, right) => left.index - right.index);
    const rewards = new Set(['sword']); let progression = true;
    for (const dungeon of main) { if (dungeon.requires && !rewards.has(dungeon.requires)) progression = false; rewards.add(dungeon.reward); }
    const biomes = new Set(world.biomes);
    const gatedRegions = main.filter(dungeon => {
      const boundary = world.obstacles.filter(obstacle => obstacle.gateFor === dungeon.id && obstacle.zoneBoundary);
      return boundary.length === 16 && boundary.filter(obstacle => !obstacle.permanent).length === 1;
    }).length;
    const blocked = new Set(world.obstacles.filter(obstacle => !obstacle.cleared).map(obstacle => pointKey(obstacle.x, obstacle.y)));
    const safeVillageExits = (world.villageExits || []).filter(point => !blocked.has(pointKey(point.x, point.y)) && !['sea', 'lake'].includes(biomeAt(world, point.x, point.y))).length;
    let safeVillageTiles = 0; let expectedVillageTiles = 0;
    for (let offsetY = -world.villageClearRadius; offsetY <= world.villageClearRadius; offsetY++) for (let offsetX = -world.villageClearRadius; offsetX <= world.villageClearRadius; offsetX++) if (Math.hypot(offsetX, offsetY) <= world.villageClearRadius) { expectedVillageTiles++; const x = world.start.x + offsetX; const y = world.start.y + offsetY; if (!blocked.has(pointKey(x, y)) && !['sea', 'lake'].includes(biomeAt(world, x, y))) safeVillageTiles++; }
    const villageAreaClear = safeVillageTiles === expectedVillageTiles;
    const villageRoutesClear = (world.villageRoads || []).every(point => !blocked.has(pointKey(point.x, point.y)) && !['sea', 'lake'].includes(biomeAt(world, point.x, point.y)));
    const guaranteedRoute = world.guaranteedRoute || [];
    const routeClear = guaranteedRoute.length > 1 && guaranteedRoute.every(point => !blocked.has(pointKey(point.x, point.y)) && !['sea', 'lake'].includes(biomeAt(world, point.x, point.y)));
    const terrainFeatures = (world.cliffs?.length || 0) > 0 && (world.scenery?.length || 0) > 0;
    const progressionInventory = new Set(['sword']);
    const reachableMainDungeons = main.filter(dungeon => {
      const reachable = findProgressionRoute(world, dungeon, progressionInventory).length > 0;
      if (reachable) progressionInventory.add(dungeon.reward);
      return reachable;
    }).length;
    const progressionRoutesClear = (world.progressionRoutes || []).length === main.length && world.progressionRoutes.every(route => route.tiles.length > 0);
    const elevationValid = (world.cliffs || []).every(cliff => elevationAt(world, cliff.ladderX, cliff.y - 1) === cliff.level && elevationAt(world, cliff.ladderX, cliff.y) === 0 && !world.obstacles.some(obstacle => !obstacle.cleared && obstacle.x === cliff.ladderX && obstacle.y === cliff.y));
    const sceneryTypes = new Set((world.scenery || []).map(item => item.type));
    return { valid: progression && main.length === MAIN_DUNGEONS.length && gatedRegions === main.length && safeVillageExits === 4 && villageAreaClear && villageRoutesClear && terrainFeatures && elevationValid && reachableMainDungeons === main.length && progressionRoutesClear && world.village?.villagers.length >= 3 && BIOMES.every(biome => biomes.has(biome)), progression, gatedRegions, safeVillageExits, villageAreaClear, villageRoutesClear, terrainFeatures, elevationValid, sceneryTypes: sceneryTypes.size, reachableMainDungeons, progressionRoutesClear, safeVillageTiles, routeClear, routeLength: guaranteedRoute.length, cliffs: world.cliffs?.length || 0, scenery: world.scenery?.length || 0, dungeonCount: world.dungeons.length, mainDungeons: main.length, biomes: [...biomes], obstacles: world.obstacles.length, merchants: world.merchants.length, secrets: world.chests.length };
  }

  function validateDungeon(dungeon) {
    const reachable = reachableRooms(dungeon);
    const accessiblePuzzles = dungeon.rooms.filter(room => room.puzzle).every(room => room.puzzle.requires.every(item => dungeon.availableItems.includes(item) || item === dungeon.reward));
    const multipleDoorSide = dungeon.rooms.some(room => room.doors.some((door, index) => room.doors.some((other, otherIndex) => index !== otherIndex && door.side === other.side && door.slot !== other.slot)));
    const itemLoop = dungeon.structure?.itemBacktracking && dungeon.rooms[dungeon.structure.itemRoom]?.reward === dungeon.reward && dungeon.rooms[dungeon.structure.masteryRoom]?.puzzle?.requires.includes(dungeon.reward);
    return { valid: reachable.size === dungeon.rooms.length && accessiblePuzzles && multipleDoorSide && itemLoop, reachable: reachable.size, rooms: dungeon.rooms.length, accessiblePuzzles, multipleDoorSide, itemLoop, hasBoss: dungeon.rooms.some(room => room.type === 'boss'), hasItem: dungeon.rooms.some(room => room.type === 'item'), hasMiniboss: dungeon.rooms.some(room => room.type === 'miniboss') };
  }

  window.AsteriaWorld = { BIOMES, SIZE_SETTINGS, MAIN_DUNGEONS, GATES, PUZZLES, randomFor, biomeAt, elevationAt, tileIndex, generateWorld, generateDungeon, validateWorld, validateDungeon };
})();
