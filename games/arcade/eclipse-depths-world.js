'use strict';

(() => {
  const SIZE_SETTINGS = {
    compact: { segment: 3, columns: 6, bonuses: 5, shortcuts: 2 },
    standard: { segment: 4, columns: 7, bonuses: 8, shortcuts: 4 },
    vast: { segment: 6, columns: 9, bonuses: 12, shortcuts: 7 },
    labyrinth: { segment: 8, columns: 10, bonuses: 18, shortcuts: 11 }
  };
  const MAIN_UPGRADES = [
    { id: 'morphCore', name: 'Noyau compact', icon: '◉', gate: 'conduit étroit', zone: 'Laboratoires noyés', color: '#22d3ee' },
    { id: 'jumpBoots', name: 'Bottes gravitationnelles', icon: '⇈', gate: 'puits vertical', zone: 'Jardins mycéliens', color: '#a3e635' },
    { id: 'phaseDash', name: 'Propulseur de phase', icon: '➟', gate: 'rideau photonique', zone: 'Fonderie magnétique', color: '#f97316' },
    { id: 'grapple', name: 'Filin quantique', icon: '⌁', gate: 'abîme magnétique', zone: 'Nef des abysses', color: '#c084fc' },
    { id: 'plasmaCore', name: 'Cœur plasma', icon: '✹', gate: 'blindage oméga', zone: 'Réacteur de l’éclipse', color: '#f43f5e' }
  ];
  const BONUS_UPGRADES = [
    { id: 'chargeBeam', name: 'Rayon chargé', icon: '◎', effect: 'Maintenez le tir pour rompre les sceaux renforcés' },
    { id: 'missileLauncher', name: 'Lance-missiles', icon: '➤', effect: 'Tir secondaire explosif et portes balistiques' },
    { id: 'morphBombs', name: 'Bombes compactes', icon: '●', effect: 'Détruit les blocs depuis la forme compacte' },
    { id: 'speedBooster', name: 'Accélérateur', icon: '≫', effect: 'Déclenche une course supersonique après un élan' },
    { id: 'spikeSuit', name: 'Armure tellurique', icon: '♢', effect: 'Neutralise les pics et sols corrosifs' },
    { id: 'energyTank', name: 'Réservoir d’énergie', icon: '♥', effect: '+2 énergie maximale' },
    { id: 'missilePack', name: 'Charge explosive', icon: '◆', effect: 'Chaque cinquième tir explose' },
    { id: 'cannonModule', name: 'Condensateur', icon: '»', effect: 'Cadence et dégâts améliorés' },
    { id: 'mapChip', name: 'Puce cartographique', icon: '▦', effect: 'Révèle les salles voisines' },
    { id: 'overcharge', name: 'Surcharge cinétique', icon: 'ϟ', effect: 'Le dash inflige des dégâts' },
    { id: 'scanPulse', name: 'Écho spectral', icon: '⌾', effect: 'Le plan révèle temporairement les embranchements et modules cachés' },
    { id: 'tractionModule', name: 'Griffes de paroi', icon: '⋔', effect: 'Prolonge l’adhérence murale et renforce le saut mural' },
    { id: 'energyTank2', name: 'Réservoir d’énergie II', icon: '♥', effect: '+2 énergie maximale' },
    { id: 'missilePack2', name: 'Réserve explosive', icon: '◆', effect: 'Explosion plus large' },
    { id: 'cannonModule2', name: 'Focaliseur plasma', icon: '»', effect: 'Tirs plus rapides' }
  ];
  const ZONE_THEMES = [
    { background: '#071c2b', far: '#0e7490', wall: '#164e63', platform: '#67e8f9', detail: '#a5f3fc' },
    { background: '#10200d', far: '#3f6212', wall: '#365314', platform: '#a3e635', detail: '#d9f99d' },
    { background: '#2b1208', far: '#9a3412', wall: '#7c2d12', platform: '#fb923c', detail: '#fed7aa' },
    { background: '#190d2c', far: '#6b21a8', wall: '#581c87', platform: '#c084fc', detail: '#e9d5ff' },
    { background: '#270814', far: '#9f1239', wall: '#881337', platform: '#fb7185', detail: '#fecdd3' }
  ];
  const JUMP_PHYSICS = Object.freeze({ speed: 420, boostedSpeed: 510, gravity: 1240, horizontalSpeed: 245, maximumRise: 56, maximumGap: 142, maximumDropGap: 188 });

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

  function shuffle(values, random) {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index--) { const swap = Math.floor(random() * (index + 1)); [result[index], result[swap]] = [result[swap], result[index]]; }
    return result;
  }

  function coordinateKey(x, y) { return `${x},${y}`; }
  function directionBetween(left, right) {
    if (right.x > left.x) return ['east', 'west'];
    if (right.x < left.x) return ['west', 'east'];
    if (right.y > left.y) return ['south', 'north'];
    return ['north', 'south'];
  }

  function connect(world, first, second, requires = null, kind = 'passage', shotRequires = null) {
    if (world.edges.some(edge => edge.a === first.id && edge.b === second.id || edge.a === second.id && edge.b === first.id)) return false;
    const [firstDirection, secondDirection] = directionBetween(first, second);
    const requestedShot = shotRequires || requires;
    const doorShot = ['plasmaCore', 'chargeBeam', 'missileLauncher'].includes(requestedShot) ? requestedShot : 'pulseCannon';
    const edge = { id: `edge-${world.edges.length}`, a: first.id, b: second.id, requires, kind, shotRequires: doorShot, firstDirection, secondDirection };
    world.edges.push(edge);
    first.doors.push({ edgeId: edge.id, to: second.id, side: firstDirection, requires, kind, shotRequires: doorShot });
    second.doors.push({ edgeId: edge.id, to: first.id, side: secondDirection, requires, kind, shotRequires: doorShot });
    if (requires && ['progressionGate', 'secretGate'].includes(kind) && !second.entryRequirement) second.entryRequirement = requires;
    return true;
  }

  function criticalCoordinates(length, columns) {
    const coordinates = [];
    for (let index = 0; index < length; index++) {
      const row = Math.floor(index / columns); const local = index % columns;
      coordinates.push({ x: 2 + (row % 2 ? columns - 1 - local : local), y: 2 + row });
    }
    return coordinates;
  }

  function createRoom(id, x, y, zoneIndex, type = 'encounter') {
    return { id, x, y, zoneIndex, zone: MAIN_UPGRADES[Math.min(zoneIndex, MAIN_UPGRADES.length - 1)].zone, type, doors: [], pickup: null, bonus: null, boss: null, criticalIndex: null, entryRequirement: null, traversalRequirement: null };
  }

  function horizontalGap(first, second) {
    if (first.x + first.width < second.x) return second.x - (first.x + first.width);
    if (second.x + second.width < first.x) return first.x - (second.x + second.width);
    return 0;
  }

  function canJumpBetween(first, second) {
    const rise = first.y - second.y;
    const gap = horizontalGap(first, second);
    if (rise > JUMP_PHYSICS.maximumRise) return false;
    return gap <= (rise < -30 ? JUMP_PHYSICS.maximumDropGap : JUMP_PHYSICS.maximumGap);
  }

  function platformReachability(platforms, floorY) {
    const reachable = new Set(platforms.map((platform, index) => platform.y === floorY ? index : -1).filter(index => index >= 0));
    let changed = true;
    while (changed) {
      changed = false;
      platforms.forEach((target, targetIndex) => {
        if (reachable.has(targetIndex)) return;
        if ([...reachable].some(sourceIndex => canJumpBetween(platforms[sourceIndex], target))) { reachable.add(targetIndex); changed = true; }
      });
    }
    let maximumRise = 0; let maximumGap = 0;
    platforms.forEach((target, targetIndex) => {
      if (target.y === floorY) return;
      const candidates = platforms.filter((source, sourceIndex) => sourceIndex !== targetIndex && reachable.has(sourceIndex) && canJumpBetween(source, target));
      if (!candidates.length) return;
      const source = candidates.sort((left, right) => horizontalGap(left, target) - horizontalGap(right, target))[0];
      maximumRise = Math.max(maximumRise, source.y - target.y); maximumGap = Math.max(maximumGap, horizontalGap(source, target));
    });
    return { valid: reachable.size === platforms.length, reachable: reachable.size, total: platforms.length, maximumRise, maximumGap, unreachable: platforms.map((_, index) => index).filter(index => !reachable.has(index)) };
  }

  function routePlatform(anchor, bounds, index, random) {
    const span = Math.max(120, bounds.maximumX - bounds.minimumX); const width = Math.min(span, 112 + random() * Math.min(74, span * 0.24));
    const rise = 24 + random() * 22; const gap = 12 + random() * 48; const direction = index % 2 ? -1 : 1;
    let x = direction > 0 ? anchor.x + anchor.width + gap : anchor.x - width - gap;
    if (x < bounds.minimumX || x + width > bounds.maximumX) x = direction > 0 ? anchor.x - width - gap : anchor.x + anchor.width + gap;
    x = Math.max(bounds.minimumX, Math.min(bounds.maximumX - width, x));
    return { x, y: Math.max(105, anchor.y - rise), width, height: 18, routeIndex: index, reachableFrom: anchor.routeIndex ?? -1 };
  }

  function freeNeighbors(room, occupied) {
    return shuffle([{ x: room.x, y: room.y - 1 }, { x: room.x + 1, y: room.y }, { x: room.x, y: room.y + 1 }, { x: room.x - 1, y: room.y }], () => 0.5).filter(point => !occupied.has(coordinateKey(point.x, point.y)));
  }

  function generateWorld(seed = 'eclipse', size = 'standard') {
    const settings = SIZE_SETTINGS[size] || SIZE_SETTINGS.standard; const random = randomFor(`eclipse-world:${seed}:${size}`);
    const criticalLength = MAIN_UPGRADES.length * settings.segment + 2; const coordinates = criticalCoordinates(criticalLength, settings.columns);
    const upgradeOrder = [MAIN_UPGRADES[0], ...shuffle(MAIN_UPGRADES.slice(1, -1), random), MAIN_UPGRADES.at(-1)];
    const world = { seed, size, rooms: [], edges: [], startRoom: 'critical-0', finalRoom: `critical-${criticalLength - 1}`, mainOrder: upgradeOrder.map(item => item.id), bonusOrder: [], bonusDistribution: 'seeded-shuffle', width: settings.columns + 6, height: Math.ceil(criticalLength / settings.columns) + 6 };
    const occupied = new Map();
    coordinates.forEach((point, index) => {
      const pickupIndex = index > 0 && index <= MAIN_UPGRADES.length * settings.segment && index % settings.segment === 0 ? index / settings.segment - 1 : -1;
      const zoneIndex = Math.min(MAIN_UPGRADES.length - 1, Math.max(0, Math.floor(Math.max(0, index - 1) / settings.segment)));
      const sectorStation = index > settings.segment && index % settings.segment === 1;
      const type = index === criticalLength - 1 ? 'finalBoss' : index === 0 || sectorStation ? 'station' : pickupIndex >= 0 ? 'boss' : index % Math.max(2, settings.segment - 1) === 0 ? 'navigation' : 'encounter';
      const room = createRoom(`critical-${index}`, point.x, point.y, zoneIndex, type); room.criticalIndex = index;
      if (type === 'navigation') room.puzzle = index % 2 ? 'relay' : 'sequence';
      if (pickupIndex >= 0) { room.pickup = upgradeOrder[pickupIndex].id; room.boss = ['sentinel', 'sporeQueen', 'forgeTitan', 'voidRay', 'omegaWarden'][pickupIndex]; }
      if (type === 'finalBoss') room.boss = 'eclipseMind';
      world.rooms.push(room); occupied.set(coordinateKey(room.x, room.y), room);
      if (index > 0) {
        const requires = index > settings.segment && index % settings.segment === 1 ? upgradeOrder[Math.floor(index / settings.segment) - 1].id : null;
        connect(world, world.rooms[index - 1], room, requires, requires ? 'progressionGate' : 'passage');
      }
    });
    for (let stage = 1; stage < MAIN_UPGRADES.length; stage++) {
      const challengeRoom = world.rooms[stage * settings.segment + 2]; if (challengeRoom && challengeRoom.type !== 'finalBoss') challengeRoom.traversalRequirement = upgradeOrder[stage - 1].id;
    }
    world.rooms[criticalLength - 1].traversalRequirement = upgradeOrder.at(-1).id;

    const branchCandidates = shuffle(world.rooms.filter(room => room.criticalIndex >= 2 && room.criticalIndex < criticalLength - 2), random);
    const masteryBonusIds = new Set(['chargeBeam', 'missileLauncher', 'morphBombs', 'speedBooster', 'spikeSuit']);
    const bonusPool = [...shuffle(BONUS_UPGRADES.filter(bonus => masteryBonusIds.has(bonus.id)), random), ...shuffle(BONUS_UPGRADES.filter(bonus => !masteryBonusIds.has(bonus.id)), random)];
    for (let bonusIndex = 0; bonusIndex < settings.bonuses; bonusIndex++) {
      const anchor = branchCandidates.find(room => freeNeighbors(room, new Set(occupied.keys())).length);
      if (!anchor) break;
      branchCandidates.splice(branchCandidates.indexOf(anchor), 1);
      const firstPoint = shuffle([{ x: anchor.x, y: anchor.y - 1 }, { x: anchor.x + 1, y: anchor.y }, { x: anchor.x, y: anchor.y + 1 }, { x: anchor.x - 1, y: anchor.y }], random).find(point => !occupied.has(coordinateKey(point.x, point.y)));
      if (!firstPoint) continue;
      const availableCount = Math.min(MAIN_UPGRADES.length, Math.floor(anchor.criticalIndex / settings.segment));
      const requirement = availableCount ? upgradeOrder[Math.floor(random() * availableCount)].id : null;
      const firstRoom = createRoom(`branch-${bonusIndex}-0`, firstPoint.x, firstPoint.y, anchor.zoneIndex, bonusIndex % 3 === 0 ? 'challenge' : 'secret');
      if (firstRoom.type === 'challenge') firstRoom.puzzle = 'timedRelay';
      world.rooms.push(firstRoom); occupied.set(coordinateKey(firstRoom.x, firstRoom.y), firstRoom); connect(world, anchor, firstRoom, requirement, requirement ? 'secretGate' : 'hiddenPassage');
      let finalRoom = firstRoom;
      if (bonusIndex % 2 === 1) {
        const nextPoint = shuffle([{ x: firstRoom.x, y: firstRoom.y - 1 }, { x: firstRoom.x + 1, y: firstRoom.y }, { x: firstRoom.x, y: firstRoom.y + 1 }, { x: firstRoom.x - 1, y: firstRoom.y }], random).find(point => !occupied.has(coordinateKey(point.x, point.y)));
        if (nextPoint) { finalRoom = createRoom(`branch-${bonusIndex}-1`, nextPoint.x, nextPoint.y, anchor.zoneIndex, 'secret'); world.rooms.push(finalRoom); occupied.set(coordinateKey(finalRoom.x, finalRoom.y), finalRoom); connect(world, firstRoom, finalRoom); }
      }
      const bonus = bonusPool[bonusIndex % bonusPool.length]; finalRoom.bonus = bonus.id; world.bonusOrder.push({ roomId: finalRoom.id, bonus: bonus.id, requires: requirement });
      const masteryPoint = shuffle([{ x: finalRoom.x, y: finalRoom.y - 1 }, { x: finalRoom.x + 1, y: finalRoom.y }, { x: finalRoom.x, y: finalRoom.y + 1 }, { x: finalRoom.x - 1, y: finalRoom.y }], random).find(point => !occupied.has(coordinateKey(point.x, point.y)));
      if (masteryPoint && masteryBonusIds.has(bonus.id)) {
        const mastery = createRoom(`mastery-${bonusIndex}`, masteryPoint.x, masteryPoint.y, anchor.zoneIndex, 'mastery');
        mastery.traversalRequirement = bonus.id; mastery.masteryReward = 'energyCell'; mastery.puzzle = bonus.id;
        world.rooms.push(mastery); occupied.set(coordinateKey(mastery.x, mastery.y), mastery); connect(world, finalRoom, mastery, bonus.id, 'masteryGate', bonus.id);
      }
    }

    const criticalRooms = world.rooms.filter(room => room.criticalIndex !== null);
    const shortcutPairs = [];
    for (let firstIndex = 0; firstIndex < criticalRooms.length; firstIndex++) for (let secondIndex = firstIndex + 2; secondIndex < criticalRooms.length; secondIndex++) {
      const first = criticalRooms[firstIndex]; const second = criticalRooms[secondIndex];
      if (Math.abs(first.x - second.x) + Math.abs(first.y - second.y) === 1 && !world.edges.some(edge => edge.a === first.id && edge.b === second.id || edge.a === second.id && edge.b === first.id)) shortcutPairs.push([first, second]);
    }
    shuffle(shortcutPairs, random).slice(0, settings.shortcuts).forEach(([first, second]) => {
      const later = Math.max(first.criticalIndex, second.criticalIndex); const zoneIndex = Math.min(MAIN_UPGRADES.length - 1, Math.floor(Math.max(0, later - 1) / settings.segment));
      connect(world, first, second, upgradeOrder[zoneIndex].id, 'returnShortcut');
    });
    world.bounds = world.rooms.reduce((bounds, room) => ({ minX: Math.min(bounds.minX, room.x), maxX: Math.max(bounds.maxX, room.x), minY: Math.min(bounds.minY, room.y), maxY: Math.max(bounds.maxY, room.y) }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
    return world;
  }

  function generateRoomLayout(world, roomId, difficulty = 'normal') {
    const room = world.rooms.find(candidate => candidate.id === roomId); const random = randomFor(`eclipse-room:${world.seed}:${world.size}:${roomId}`);
    const widthChoices = room.type === 'boss' || room.type === 'finalBoss' ? [1120, 1360] : [960, 1180, 1420, 1660];
    const heightChoices = room.type === 'station' ? [540, 620] : [540, 680, 820, 940];
    const width = widthChoices[Math.floor(random() * widthChoices.length)]; const height = heightChoices[Math.floor(random() * heightChoices.length)]; const floorY = height - 62;
    const traversal = room.traversalRequirement; const grappleGap = 360; const platforms = traversal === 'grapple' ? [{ x: 0, y: floorY, width: width / 2 - grappleGap / 2, height: 62, floor: true }, { x: width / 2 + grappleGap / 2, y: floorY, width: width / 2 - grappleGap / 2, height: 62, floor: true }] : [{ x: 0, y: floorY, width, height: 62, floor: true }];
    const platformCount = room.type === 'boss' || room.type === 'finalBoss' ? 3 : 4 + Math.floor(random() * 5);
    const routeFloors = [...platforms]; const routeAnchors = [...routeFloors];
    for (let index = 0; index < platformCount; index++) {
      const route = index % routeFloors.length; const anchor = routeAnchors[route]; const floor = routeFloors[route];
      const bounds = { minimumX: floor.x + 34, maximumX: floor.x + floor.width - 34 };
      const platform = routePlatform(anchor, bounds, index, random); platforms.push(platform); routeAnchors[route] = platform;
    }
    const movingPlatforms = [];
    if (height > 620) {
      const floor = platforms[0]; const liftX = Math.max(floor.x + 55, Math.min(floor.x + floor.width - 175, floor.x + floor.width * 0.18));
      movingPlatforms.push({ id: `${room.id}-lift`, x: liftX, y: floorY - 34, width: 120, height: 16, originX: liftX, originY: floorY - 34, rangeX: 0, rangeY: -Math.min(235, height - 515), speed: 0.72 + random() * 0.35, phase: 0, deltaX: 0, deltaY: 0, initialized: false });
    }
    if (width > 1180) {
      const anchor = platforms.at(-1); const railX = Math.max(55, Math.min(width - 190, anchor.x + anchor.width / 2 - 68));
      movingPlatforms.push({ id: `${room.id}-rail`, x: railX, y: anchor.y - 38, width: 135, height: 16, originX: railX, originY: anchor.y - 38, rangeX: Math.min(190, width - railX - 155), rangeY: 0, speed: 0.62 + random() * 0.4, phase: 0, deltaX: 0, deltaY: 0, initialized: false });
    }
    const difficultyFactor = { easy: 0.75, normal: 1, hard: 1.3, extreme: 1.65 }[difficulty] || 1;
    const baseCount = ['station', 'navigation', 'secret'].includes(room.type) ? 0 : room.type === 'boss' ? 1 : room.type === 'finalBoss' ? 1 : 2 + room.zoneIndex;
    const enemyCount = Math.ceil(baseCount * difficultyFactor); const enemies = [];
    const aerialPlatforms = platforms.filter(platform => !platform.floor && platform.width >= 92).map((platform, index) => ({ ...platform, id: `${room.id}-platform-${index}` }));
    for (let index = 0; index < enemyCount; index++) {
      const type = room.boss && !index ? room.boss : ['crawler', 'drone', 'turret', 'charger'][Math.floor(random() * 4)]; const boss = Boolean(room.boss && !index);
      const floorSegments = platforms.filter(platform => platform.y === floorY); const perch = !boss && type !== 'drone' && aerialPlatforms.length && index % 2 ? aerialPlatforms[index % aerialPlatforms.length] : null; const segment = perch || floorSegments[Math.floor(random() * floorSegments.length)] || platforms[0];
      const groundX = segment.x + 35 + random() * Math.max(1, segment.width - 70);
      enemies.push({ id: `${room.id}-enemy-${index}`, type, x: boss ? width - 225 : type === 'drone' ? 140 + random() * (width - 310) : groundX, y: boss ? floorY - 62 : type === 'drone' ? 150 + random() * Math.max(170, height - 380) : segment.y - 28, supportId: perch?.id || null, supportY: perch?.y || floorY, tier: room.zoneIndex + 1, boss });
    }
    const occupiedPlatforms = new Set(enemies.map(enemy => enemy.supportId).filter(Boolean));
    const featureTypes = room.type === 'secret' ? ['relic', 'energy', 'relic'] : room.type === 'challenge' ? ['relay', 'energy', 'relay'] : ['energy', 'relay', 'archive'];
    const platformFeatures = aerialPlatforms.filter(platform => !occupiedPlatforms.has(platform.id)).map((platform, index) => ({ id: `${room.id}-feature-${index}`, type: featureTypes[(index + room.zoneIndex) % featureTypes.length], platformId: platform.id, x: platform.x + platform.width / 2, y: platform.y - 18, collected: false }));
    const anchors = traversal === 'grapple' || room.zoneIndex >= 3 ? [{ x: width / 2 - 120, y: Math.max(120, floorY - 300) }, { x: width / 2 + 120, y: Math.max(150, floorY - 270) }] : [];
    const obstacles = [];
    const barrierX = width / 2 - 28;
    if (traversal === 'morphCore') obstacles.push({ id: 'morph-tunnel', type: 'morph', x: barrierX - 45, y: 0, width: 145, height: floorY - 28 });
    if (traversal === 'jumpBoots') obstacles.push({ id: 'gravity-wall', type: 'jump', x: barrierX, y: floorY - 88, width: 56, height: 88 });
    if (traversal === 'phaseDash') obstacles.push({ id: 'phase-curtain', type: 'phase', x: barrierX, y: floorY - 260, width: 22, height: 260 });
    if (traversal === 'plasmaCore') obstacles.push({ id: 'omega-seal', type: 'plasma', x: barrierX, y: floorY - 210, width: 64, height: 210, health: 5 });
    if (traversal === 'chargeBeam') obstacles.push({ id: 'charge-seal', type: 'charge', x: barrierX, y: floorY - 220, width: 58, height: 220, health: 1 });
    if (traversal === 'missileLauncher') obstacles.push({ id: 'missile-seal', type: 'missile', x: barrierX, y: floorY - 220, width: 58, height: 220, health: 1 });
    if (traversal === 'morphBombs') obstacles.push({ id: 'bomb-blocks', type: 'bomb', x: barrierX - 25, y: floorY - 58, width: 110, height: 58, health: 1 });
    if (traversal === 'speedBooster') obstacles.push({ id: 'speed-wall', type: 'speed', x: barrierX, y: floorY - 145, width: 52, height: 145, health: 1 });
    const spikes = traversal === 'spikeSuit' || room.zoneIndex >= 2 && room.type === 'challenge' ? [{ x: width * 0.35, y: floorY - 16, width: width * 0.3, height: 16 }] : [];
    const puzzleOrders = { relay: [1, 0, 3, 2], timedRelay: [0, 2, 1, 3], mirror: [0, 3, 1, 2], pulse: [2, 0, 3, 1] }; const puzzleType = room.puzzle === 'relay' && room.zoneIndex >= 2 ? ['relay', 'mirror', 'pulse'][Math.floor(random() * 3)] : room.puzzle;
    const puzzleOrder = puzzleOrders[puzzleType] || [0, 1, 2, 3];
    const puzzle = puzzleType && !['chargeBeam', 'missileLauncher', 'morphBombs', 'speedBooster', 'spikeSuit'].includes(puzzleType) ? { type: puzzleType, order: puzzleOrder, timeLimit: puzzleType === 'timedRelay' ? 8 : 0, nodes: [0.22, 0.41, 0.59, 0.78].map((ratio, index) => ({ id: `${room.id}-node-${index}`, x: width * ratio, y: floorY - 68 - (index % 2) * 28, radius: 18, order: index })) } : null;
    const decorTypes = room.type === 'station' ? ['terminal', 'pipe', 'lamp'] : room.type === 'boss' || room.type === 'finalBoss' ? ['reactor', 'pillar', 'vent'] : room.type === 'secret' ? ['crystal', 'relic', 'pipe'] : ['pipe', 'crystal', 'vent', 'cable'];
    const environment = Array.from({ length: Math.max(5, Math.floor(width / 210)) }, (_, index) => ({ type: decorTypes[index % decorTypes.length], x: 62 + index * (width - 124) / Math.max(1, Math.floor(width / 210) - 1), y: floorY, scale: 0.68 + random() * 0.68, depth: index % 3 }));
    const architecture = { type: room.type, ribs: Math.max(4, Math.floor(width / 180)), shafts: height > 700 ? 2 : 1, damaged: room.zoneIndex > 1 && room.type !== 'station', seed: Math.floor(random() * 0xffffffff) };
    return { width, height, floorY, platforms, movingPlatforms, enemies, platformFeatures, anchors, obstacles, spikes, puzzle, environment, architecture, traversal, hazard: room.zoneIndex === 2 ? 'lava' : room.zoneIndex === 3 ? 'void' : room.zoneIndex === 4 ? 'plasma' : null };
  }

  function validateRoomLayout(world, roomId) {
    const room = world.rooms.find(candidate => candidate.id === roomId); const layout = generateRoomLayout(world, roomId);
    const platformBounds = [...layout.platforms, ...layout.movingPlatforms].every(platform => platform.x >= 0 && platform.x + platform.width <= layout.width && platform.y >= 0 && platform.y + platform.height <= layout.height);
    const jumpGraph = platformReachability(layout.platforms, layout.floorY);
    const movingBounds = layout.movingPlatforms.every(platform => {
      const endX = platform.originX + platform.rangeX; const endY = platform.originY + platform.rangeY;
      return Math.min(platform.originX, endX) >= 0 && Math.max(platform.originX, endX) + platform.width <= layout.width && Math.min(platform.originY, endY) >= 0 && Math.max(platform.originY, endY) + platform.height <= layout.floorY;
    });
    const movingAccessible = layout.movingPlatforms.every(platform => {
      const endpoints = [platform, { ...platform, x: platform.originX + platform.rangeX, y: platform.originY + platform.rangeY }];
      return endpoints.some(endpoint => layout.platforms.some(surface => canJumpBetween(surface, endpoint)));
    });
    const traversalMechanic = !room.traversalRequirement || (room.traversalRequirement === 'grapple' ? layout.anchors.length >= 2 : room.traversalRequirement === 'spikeSuit' ? layout.spikes.length > 0 : layout.obstacles.some(obstacle => ({ morphCore: 'morph', jumpBoots: 'jump', phaseDash: 'phase', plasmaCore: 'plasma', chargeBeam: 'charge', missileLauncher: 'missile', morphBombs: 'bomb', speedBooster: 'speed' })[room.traversalRequirement] === obstacle.type));
    const puzzleValid = !layout.puzzle || layout.puzzle.nodes.length === layout.puzzle.order.length && new Set(layout.puzzle.order).size === layout.puzzle.nodes.length && layout.puzzle.order.every(order => layout.puzzle.nodes.some(node => node.order === order));
    const purposefulPlatforms = layout.platforms.filter(platform => !platform.floor).every((platform, index) => layout.enemies.some(enemy => enemy.supportId === `${room.id}-platform-${index}`) || layout.platformFeatures.some(feature => feature.platformId === `${room.id}-platform-${index}`));
    return { valid: platformBounds && jumpGraph.valid && movingBounds && movingAccessible && traversalMechanic && puzzleValid && purposefulPlatforms, platformBounds, jumpGraph, movingBounds, movingAccessible, traversalMechanic, puzzleValid, purposefulPlatforms };
  }

  function validateWorld(world) {
    const roomById = new Map(world.rooms.map(room => [room.id, room])); const inventory = new Set(['pulseCannon']); const reachable = new Set([world.startRoom]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const roomId of [...reachable]) {
        const room = roomById.get(roomId);
        if (room?.pickup && !inventory.has(room.pickup)) { inventory.add(room.pickup); changed = true; }
        if (room?.bonus && !inventory.has(room.bonus)) { inventory.add(room.bonus); changed = true; }
        for (const door of room?.doors || []) { const destination = roomById.get(door.to); if ((!door.requires || inventory.has(door.requires)) && (!destination?.traversalRequirement || inventory.has(destination.traversalRequirement)) && !reachable.has(door.to)) { reachable.add(door.to); changed = true; } }
      }
    }
    const uniqueCoordinates = new Set(world.rooms.map(room => coordinateKey(room.x, room.y))).size === world.rooms.length;
    const mainProgression = MAIN_UPGRADES.every(upgrade => inventory.has(upgrade.id));
    const bonusReachable = world.bonusOrder.every(entry => reachable.has(entry.roomId));
    const validDoors = world.edges.every(edge => roomById.get(edge.a)?.doors.some(door => door.edgeId === edge.id) && roomById.get(edge.b)?.doors.some(door => door.edgeId === edge.id));
    const gatedMainRegions = world.edges.filter(edge => edge.kind === 'progressionGate').length;
    const traversalRooms = world.rooms.filter(room => room.traversalRequirement).length; const stationCount = world.rooms.filter(room => room.type === 'station').length; const masteryRooms = world.rooms.filter(room => room.type === 'mastery').length; const puzzleRooms = world.rooms.filter(room => room.puzzle).length;
    const layoutFailures = world.rooms.map(room => ({ roomId: room.id, ...validateRoomLayout(world, room.id) })).filter(result => !result.valid);
    const validLayouts = layoutFailures.length === 0;
    const mainPickups = world.rooms.filter(room => room.pickup).map(room => room.pickup); const pickupPlacementValid = mainPickups.length === MAIN_UPGRADES.length && new Set(mainPickups).size === MAIN_UPGRADES.length && world.rooms.filter(room => room.pickup).every(room => room.type === 'boss' && room.criticalIndex !== null) && world.rooms.filter(room => room.bonus).every(room => room.criticalIndex === null);
    return { valid: reachable.has(world.finalRoom) && mainProgression && bonusReachable && uniqueCoordinates && validDoors && validLayouts && pickupPlacementValid && gatedMainRegions === MAIN_UPGRADES.length && traversalRooms >= MAIN_UPGRADES.length && stationCount >= MAIN_UPGRADES.length, reachable: reachable.size, rooms: world.rooms.length, mainProgression, bonusReachable, pickupPlacementValid, uniqueCoordinates, validDoors, validLayouts, layoutFailures: layoutFailures.slice(0, 3), gatedMainRegions, traversalRooms, stationCount, masteryRooms, puzzleRooms, shortcuts: world.edges.filter(edge => edge.kind === 'returnShortcut').length, branches: world.bonusOrder.length };
  }

  window.EclipseDepthsWorld = { SIZE_SETTINGS, MAIN_UPGRADES, BONUS_UPGRADES, ZONE_THEMES, JUMP_PHYSICS, randomFor, generateWorld, generateRoomLayout, validateRoomLayout, validateWorld, canJumpBetween, platformReachability };
})();
