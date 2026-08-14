'use strict';

const canvas = document.getElementById('screen');
const context = canvas.getContext('2d');
const minimap = document.getElementById('minimap');
const minimapContext = minimap.getContext('2d');
const worldSizeSelect = document.getElementById('worldSize');
const difficultySelect = document.getElementById('difficulty');
const gameModeSelect = document.getElementById('gameMode');
const soundToggle = document.getElementById('sound');
const hintsToggle = document.getElementById('showHints');
const statusElement = document.getElementById('status');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayText = document.getElementById('overlayText');
const controls = new Set();
const remotePlayers = new Map();
const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const SAVE_KEY = window.GameRuntime?.profileKey('eclipse-depths:save') || 'eclipse-depths:save';
const difficultySettings = {
  easy: { health: 0.58, damage: 0.48, count: 0.55, score: 0.8 },
  normal: { health: 0.85, damage: 0.78, count: 0.78, score: 1 },
  hard: { health: 1.38, damage: 1.35, count: 1.25, score: 1.5 },
  extreme: { health: 1.9, damage: 1.75, count: 1.55, score: 2.2 }
};
const enemyDefinitions = {
  crawler: { health: 3, damage: 1, speed: 72, color: '#84cc16', style: 'ground' },
  drone: { health: 2, damage: 1, speed: 95, color: '#22d3ee', style: 'flying' },
  turret: { health: 4, damage: 1, speed: 0, color: '#f59e0b', style: 'ranged' },
  charger: { health: 5, damage: 1.5, speed: 58, color: '#f97316', style: 'charge' }
};
const bossDefinitions = {
  sentinel: { label: 'Sentinelle bathyale', health: 30, color: '#0891b2', pattern: 'spread' },
  sporeQueen: { label: 'Reine sporale', health: 42, color: '#65a30d', pattern: 'summon' },
  forgeTitan: { label: 'Titan de forge', health: 56, color: '#ea580c', pattern: 'charge' },
  voidRay: { label: 'Raie du vide', health: 68, color: '#9333ea', pattern: 'teleport' },
  omegaWarden: { label: 'Gardien Oméga', health: 82, color: '#e11d48', pattern: 'radial' },
  eclipseMind: { label: 'Esprit de l’Éclipse', health: 120, color: '#111827', pattern: 'eclipse' }
};
const mainUpgradeMap = new Map(EclipseDepthsWorld.MAIN_UPGRADES.map(upgrade => [upgrade.id, upgrade]));
const bonusUpgradeMap = new Map(EclipseDepthsWorld.BONUS_UPGRADES.map(upgrade => [upgrade.id, upgrade]));

let game = null;
let running = false;
let paused = false;
let showMap = false;
let frame = 0;
let previousTime = 0;
let audioContext = null;
let overlayCallback = null;

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const overlaps = (left, right) => left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y;
const distance = (left, right) => Math.hypot(left.x - right.x, left.y - right.y);
const random = () => game?.random?.() ?? Math.random();
const roomById = id => game?.world.rooms.find(room => room.id === id);
const owned = id => game?.inventory.includes(id);

function sound(kind) {
  if (!soundToggle.checked) return;
  try {
    audioContext ||= new AudioContext(); const oscillator = audioContext.createOscillator(); const gain = audioContext.createGain(); const now = audioContext.currentTime;
    const tone = { shoot: [420, 0.06], hit: [110, 0.08], hurt: [72, 0.17], jump: [260, 0.07], dash: [165, 0.12], door: [310, 0.15], item: [760, 0.34], boss: [52, 0.4], save: [530, 0.25] }[kind] || [240, 0.08];
    oscillator.type = ['boss', 'hurt', 'dash'].includes(kind) ? 'sawtooth' : kind === 'item' ? 'triangle' : 'square'; oscillator.frequency.setValueAtTime(tone[0], now); oscillator.frequency.exponentialRampToValueAtTime(Math.max(38, tone[0] * 0.58), now + tone[1]); gain.gain.setValueAtTime(0.035, now); gain.gain.exponentialRampToValueAtTime(0.0001, now + tone[1]); oscillator.connect(gain).connect(audioContext.destination); oscillator.start(); oscillator.stop(now + tone[1]);
  } catch {}
}

function createPlayer() { return { x: 90, y: 420, width: 28, height: 44, normalHeight: 44, vx: 0, vy: 0, facing: 1, grounded: false, jumps: 0, coyote: 0, jumpBuffer: 0, wallSide: 0, wallGrace: 0, attackCooldown: 0, dashCooldown: 0, dashTimer: 0, invulnerable: 0, morph: false, shotCount: 0, charge: 0, speedCharge: 0, speedBoost: 0, afterimages: [] }; }

function saveGame() {
  if (!game || window.LanMultiplayer?.active) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 6, seed: game.seed, options: { worldSize: worldSizeSelect.value, difficulty: difficultySelect.value, gameMode: gameModeSelect.value }, roomId: game.roomId, inventory: game.inventory, explored: [...game.explored], clearedRooms: [...game.clearedRooms], collectedRooms: [...game.collectedRooms], collectedFeatures: [...game.collectedFeatures], masteryRewards: [...game.masteryRewards], openedEdges: [...game.openedEdges], maxEnergy: game.maxEnergy, energy: game.energy, maxMissiles: game.maxMissiles, missiles: game.missiles, score: game.score, elapsed: game.elapsed, highlightAbility: game.highlightAbility }));
    document.getElementById('continue').disabled = false;
  } catch {}
}

function loadSave() {
  try { const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return [2, 3, 4, 5, 6].includes(saved?.version) && saved.seed ? saved : null; } catch { return null; }
}

function applySavedOptions(saved) {
  for (const [id, value] of Object.entries(saved?.options || {})) { const control = document.getElementById(id); if (control) control.value = value; }
}

function createGame(seed, saved = null) {
  const world = EclipseDepthsWorld.generateWorld(seed, worldSizeSelect.value); const startRoom = world.rooms.some(room => room.id === saved?.roomId) ? saved.roomId : world.startRoom;
  return {
    seed, random: EclipseDepthsWorld.randomFor(`eclipse-play:${seed}`), world, roomId: startRoom, layout: null, roomStates: new Map(), player: createPlayer(),
    inventory: saved?.inventory || ['pulseCannon'], explored: new Set(saved?.explored || [startRoom]), clearedRooms: new Set(saved?.clearedRooms || []), collectedRooms: new Set(saved?.collectedRooms || []), collectedFeatures: new Set(saved?.collectedFeatures || []), masteryRewards: new Set(saved?.masteryRewards || []),
    openedEdges: new Set(saved?.openedEdges || []), maxEnergy: saved?.maxEnergy || 8, energy: saved?.energy || saved?.maxEnergy || 8, maxMissiles: saved?.maxMissiles || 0, missiles: saved?.missiles ?? saved?.maxMissiles ?? 0, score: saved?.score || 0, elapsed: saved?.elapsed || 0, highlightAbility: saved?.highlightAbility || null, scanUntil: 0, projectiles: [], enemyProjectiles: [], bombs: [], particles: [], camera: { x: 0, y: 0 }, completed: false, nextAutosave: (saved?.elapsed || 0) + 10
  };
}

function startGame(saved = null) {
  cancelAnimationFrame(frame); controls.clear(); remotePlayers.clear(); if (saved) applySavedOptions(saved);
  const seed = saved?.seed || new URLSearchParams(location.search).get('seed') || `${Date.now()}:${Math.random()}`;
  game = createGame(seed, saved); running = true; paused = false; showMap = false; overlay.hidden = true; document.getElementById('pause').textContent = 'Pause';
  enterRoom(game.roomId, null, true); renderInventory(); updateHud(); window.GameRecords?.reset(); previousTime = performance.now(); frame = requestAnimationFrame(loop); saveGame();
}

function createEnemy(source) {
  const bossDefinition = source.boss ? bossDefinitions[source.type] : null; const definition = bossDefinition || enemyDefinitions[source.type] || enemyDefinitions.crawler; const settings = difficultySettings[difficultySelect.value];
  const health = Math.ceil(definition.health * settings.health * (1 + source.tier * 0.12));
  return { ...source, width: source.boss ? 62 : 28, height: source.boss ? 62 : 28, vx: 0, vy: 0, originX: source.x, health, maxHealth: health, damage: definition.damage ? definition.damage * settings.damage : 2 * settings.damage, speed: definition.speed || 48, style: definition.style || 'boss', color: definition.color, label: definition.label, pattern: definition.pattern, cooldown: 0.5 + random(), phase: random() * Math.PI * 2, step: 0, dead: false };
}

function roomState(id) {
  if (!game.roomStates.has(id)) {
    const room = game.world.rooms.find(candidate => candidate.id === id); const layout = EclipseDepthsWorld.generateRoomLayout(game.world, id, difficultySelect.value);
    const enemies = game.clearedRooms.has(id) ? [] : layout.enemies.map(createEnemy);
    const puzzle = layout.puzzle ? { ...layout.puzzle, nodes: layout.puzzle.nodes.map(node => ({ ...node, active: false })), progress: 0, timer: 0, solved: game.clearedRooms.has(id) } : null;
    const masterySolved = room.type !== 'mastery' || game.clearedRooms.has(id);
    game.roomStates.set(id, { layout, enemies, obstacles: layout.obstacles.map(obstacle => ({ ...obstacle })), platformFeatures: (layout.platformFeatures || []).map(feature => ({ ...feature, collected: game.collectedFeatures.has(feature.id) })), puzzle, drops: [], masterySolved, masteryDirection: 0, cleared: game.clearedRooms.has(id) || !enemies.length && !puzzle && masterySolved });
  }
  return game.roomStates.get(id);
}

function enterRoom(id, fromSide = null, initial = false) {
  game.roomId = id; const runtime = roomState(id); game.layout = runtime.layout; game.projectiles = []; game.enemyProjectiles = []; game.bombs = []; game.particles = []; game.explored.add(id);
  if (owned('mapChip')) roomById(id).doors.forEach(door => game.explored.add(door.to));
  if (!initial) {
    const floorY = game.layout.floorY; const positions = { west: { x: game.layout.width - 78, y: floorY - game.player.height }, east: { x: 50, y: floorY - game.player.height }, north: { x: game.layout.width * 0.64, y: floorY - game.player.height }, south: { x: game.layout.width * 0.34, y: floorY - game.player.height } };
    Object.assign(game.player, positions[fromSide] || { x: 90, y: floorY - game.player.height }, { vx: 0, vy: 0, charge: 0, speedCharge: 0, speedBoost: 0 }); sound('door');
  } else Object.assign(game.player, { x: 90, y: game.layout.floorY - game.player.height, vx: 0, vy: 0 });
  if (roomById(id).type === 'mastery' && !runtime.masterySolved) runtime.masteryDirection = game.player.x < game.layout.width / 2 ? 1 : -1;
  game.camera.x = clamp(game.player.x - WIDTH * 0.35, 0, Math.max(0, game.layout.width - WIDTH)); game.camera.y = clamp(game.player.y - HEIGHT * 0.56, 0, Math.max(0, game.layout.height - HEIGHT));
  const room = roomById(id); statusElement.textContent = `${room.zone} · ${roomLabel(room)}.`; updateObjective(); saveGame();
}

function roomLabel(room) { return ({ station: 'Station de sauvegarde', encounter: 'Galerie hostile', navigation: 'Nœud de navigation', boss: 'Gardien principal', finalBoss: 'Cœur de la station', challenge: 'Épreuve secrète', secret: 'Annexe dissimulée', mastery: 'Épreuve de maîtrise' })[room.type] || room.type; }

function jump() {
  if (!game || paused || showMap) return; game.player.jumpBuffer = 0.12;
}

function activateAbility() {
  if (!game || paused || showMap) return; const player = game.player;
  if (player.morph && owned('morphBombs')) { dropMorphBomb(); return; }
  if (owned('grapple') && !player.grounded && game.layout.anchors.length) {
    const center = { x: player.x + player.width / 2, y: player.y + player.height / 2 }; const anchor = [...game.layout.anchors].sort((left, right) => distance(center, left) - distance(center, right))[0]; const length = distance(center, anchor) || 1;
    if (length < 430) { player.vx = (anchor.x - center.x) / length * 430; player.vy = (anchor.y - center.y) / length * 430; sound('dash'); return; }
  }
  if (owned('phaseDash') && player.dashCooldown <= 0) { player.dashTimer = 0.18; player.dashCooldown = owned('overcharge') ? 0.62 : 0.9; player.vx = player.facing * 620; player.vy *= 0.18; sound('dash'); return; }
  if (owned('morphCore')) toggleMorph();
  else statusElement.textContent = 'Aucune capacité active disponible.';
}

function toggleMorph() {
  if (!game || paused || showMap || !owned('morphCore')) { if (game && !owned('morphCore')) statusElement.textContent = 'Le Noyau compact n’a pas encore été trouvé.'; return; }
  const player = game.player;
  if (player.morph) {
    const expanded = { x: player.x, y: player.y - (player.normalHeight - player.height), width: player.width, height: player.normalHeight };
    if (activeObstacles().some(obstacle => overlaps(expanded, obstacle))) { statusElement.textContent = 'Impossible de déployer l’armure dans cet espace étroit.'; return; }
    player.y = expanded.y; player.height = player.normalHeight; player.morph = false;
  } else { player.morph = true; player.height = 22; }
  statusElement.textContent = player.morph ? 'Forme compacte activée.' : 'Armure déployée.';
}

function shoot(charged = false) {
  if (!game || paused || showMap || game.player.attackCooldown > 0) return; const player = game.player; player.shotCount++;
  const upgraded = owned('cannonModule') || owned('cannonModule2'); const plasma = owned('plasmaCore'); const explosive = owned('missilePack') && player.shotCount % 5 === 0;
  player.attackCooldown = owned('cannonModule2') ? 0.09 : upgraded ? 0.14 : 0.22;
  game.projectiles.push({ x: player.x + player.width / 2, y: player.y + player.height * 0.42, vx: player.facing * (charged ? 760 : plasma ? 650 : 520), vy: 0, width: charged ? 27 : plasma ? 16 : 11, height: charged ? 16 : plasma ? 8 : 6, damage: (1 + Number(upgraded) + Number(plasma) * 2) * (charged ? 3 : 1), explosive, plasma, charged, kind: charged ? 'chargeBeam' : plasma ? 'plasmaCore' : 'pulseCannon', life: 2.2 }); sound('shoot');
}

function releaseChargedShot() {
  if (!game || !owned('chargeBeam')) return; const charged = game.player.charge >= 0.62; game.player.charge = 0; shoot(charged);
}

function fireMissile() {
  if (!game || paused || showMap) return;
  if (!owned('missileLauncher')) { statusElement.textContent = 'Le lance-missiles n’a pas encore été trouvé.'; return; }
  if (game.missiles <= 0) { statusElement.textContent = 'Réserve de missiles vide. Rechargez-la à une station.'; return; }
  const player = game.player; game.missiles--;
  game.projectiles.push({ x: player.x + player.width / 2, y: player.y + player.height * 0.42, vx: player.facing * 430, vy: 0, width: 24, height: 12, damage: 6, explosive: true, missile: true, kind: 'missileLauncher', life: 2.6 }); sound('boss');
}

function dropMorphBomb() {
  if (game.bombs.some(bomb => !bomb.exploded && distance(bomb, game.player) < 42)) return;
  game.bombs.push({ x: game.player.x + game.player.width / 2 - 8, y: game.player.y + game.player.height - 16, width: 16, height: 16, timer: 0.72, exploded: false }); sound('shoot');
}

function doorPosition(side) {
  const width = game?.layout?.width || WIDTH; const floorY = game?.layout?.floorY || HEIGHT - 62;
  return { west: { x: 16, y: floorY - 96, width: 38, height: 96 }, east: { x: width - 54, y: floorY - 96, width: 38, height: 96 }, north: { x: width * 0.36, y: floorY - 54, width: 58, height: 54 }, south: { x: width * 0.62, y: floorY - 54, width: 58, height: 54 } }[side];
}

function roomLocked(id = game.roomId) { const runtime = roomState(id); return runtime.enemies.length > 0 || Boolean(runtime.puzzle && !runtime.puzzle.solved) || !runtime.masterySolved; }

function nearbyDoor() {
  const room = roomById(game.roomId); const playerCenter = { x: game.player.x + game.player.width / 2, y: game.player.y + game.player.height / 2 };
  return room.doors.find(door => { const position = doorPosition(door.side); return distance(playerCenter, { x: position.x + position.width / 2, y: position.y + position.height / 2 }) < 78; });
}

function interact() {
  if (!game || paused || showMap) return; const room = roomById(game.roomId); const door = nearbyDoor();
  if (door) {
    if (roomLocked()) { statusElement.textContent = roomState(game.roomId).enemies.length ? 'Le verrou de combat reste actif tant que des créatures subsistent.' : 'Le circuit de la salle doit encore être résolu.'; return; }
    if (door.requires && !owned(door.requires)) { const upgrade = mainUpgradeMap.get(door.requires); statusElement.textContent = `${upgrade?.gate || 'Passage verrouillé'} : ${upgrade?.name || door.requires} nécessaire.`; return; }
    if (!game.openedEdges.has(door.edgeId)) { statusElement.textContent = door.shotRequires === 'missileLauncher' ? 'Cette porte attend un missile.' : door.shotRequires === 'chargeBeam' ? 'Maintenez le tir puis relâchez-le sur la porte.' : door.shotRequires === 'plasmaCore' ? 'Un tir plasma peut rompre ce verrou.' : 'Tirez sur la porte pour l’ouvrir.'; return; }
    enterRoom(door.to, door.side); return;
  }
  if (room.type === 'station' && Math.abs(game.player.x - game.layout.width / 2) < 115) { game.energy = game.maxEnergy; game.missiles = game.maxMissiles; saveGame(); sound('save'); statusElement.textContent = 'Énergie et missiles restaurés, progression enregistrée.'; return; }
  statusElement.textContent = hintsToggle.checked ? 'Aucun terminal à portée.' : '';
}

function updatePlayer(delta) {
  const player = game.player; const direction = (controls.has('right') ? 1 : 0) - (controls.has('left') ? 1 : 0); if (direction) player.facing = direction; player.afterimages ||= []; if (player.dashTimer > 0 && (!player.afterimages.length || game.elapsed - player.afterimages.at(-1).time > .035)) player.afterimages.push({ x: player.x, y: player.y, morph: player.morph, time: game.elapsed }); player.afterimages = player.afterimages.filter(image => game.elapsed - image.time < .22);
  if (player.grounded && player.groundPlatform) { player.x += player.groundPlatform.deltaX || 0; player.y += player.groundPlatform.deltaY || 0; }
  player.coyote = player.grounded ? 0.1 : Math.max(0, player.coyote - delta); player.jumpBuffer = Math.max(0, player.jumpBuffer - delta); player.wallGrace = Math.max(0, player.wallGrace - delta);
  const maxJumps = owned('jumpBoots') ? 2 : 1;
  if (player.jumpBuffer > 0 && player.wallGrace > 0 && !player.grounded) { player.vy = owned('tractionModule') ? -500 : -450; player.vx = -player.wallSide * (owned('tractionModule') ? 360 : 310); player.facing = -player.wallSide; player.wallGrace = 0; player.jumpBuffer = 0; player.jumps = Math.min(player.jumps, maxJumps - 1); sound('jump'); }
  else if (player.jumpBuffer > 0 && (player.coyote > 0 || player.jumps < maxJumps)) { player.vy = owned('jumpBoots') ? -510 : -420; player.grounded = false; player.coyote = 0; player.jumpBuffer = 0; player.jumps++; sound('jump'); }
  if (owned('speedBooster') && direction && player.grounded) player.speedCharge = Math.min(1.6, player.speedCharge + delta); else player.speedCharge = Math.max(0, player.speedCharge - delta * 2.2);
  if (player.speedCharge >= 1.18) player.speedBoost = 0.24; else player.speedBoost = Math.max(0, player.speedBoost - delta);
  const acceleration = player.grounded ? 1900 : 1050; const target = direction * (player.speedBoost > 0 ? 410 : player.morph ? 175 : 245); player.vx += clamp(target - player.vx, -acceleration * delta, acceleration * delta);
  if (!direction && player.grounded && player.dashTimer <= 0) player.vx *= Math.pow(0.003, delta);
  player.vy += 1240 * delta; player.attackCooldown = Math.max(0, player.attackCooldown - delta); player.dashCooldown = Math.max(0, player.dashCooldown - delta); player.dashTimer = Math.max(0, player.dashTimer - delta); player.invulnerable = Math.max(0, player.invulnerable - delta);
  const previousBottom = player.y + player.height; const previousX = player.x; player.wallSide = 0; player.x += player.vx * delta;
  for (const obstacle of activeObstacles()) {
    if (obstacle.type === 'speed' && player.speedBoost > 0 && overlaps(player, obstacle)) { obstacle.health = 0; addParticles(obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2, '#fef08a', 18); game.score += 300; continue; }
    if (!overlaps(player, obstacle) || obstacle.type === 'phase' && player.dashTimer > 0) continue;
    if (player.vx > 0) { player.x = obstacle.x - player.width; player.wallSide = 1; } else if (player.vx < 0) { player.x = obstacle.x + obstacle.width; player.wallSide = -1; } else player.x = previousX; player.vx = 0;
  }
  if (player.x <= 45 && direction < 0) player.wallSide = -1; else if (player.x + player.width >= game.layout.width - 45 && direction > 0) player.wallSide = 1;
  if (player.wallSide && !player.grounded && player.vy > 0 && direction === player.wallSide) { player.wallGrace = owned('tractionModule') ? 0.24 : 0.12; player.vy = Math.min(player.vy, owned('tractionModule') ? 82 : 145); }
  player.y += player.vy * delta; player.grounded = false; player.groundPlatform = null;
  const landingSurfaces = [...game.layout.platforms, ...(game.layout.movingPlatforms || []), ...activeObstacles().filter(obstacle => ['jump', 'plasma'].includes(obstacle.type))];
  if (player.vy >= 0) for (const platform of landingSurfaces) {
    const nextBottom = player.y + player.height;
    if (player.x + player.width > platform.x && player.x < platform.x + platform.width && previousBottom <= platform.y + 5 && nextBottom >= platform.y) { player.y = platform.y - player.height; player.vy = 0; player.grounded = true; player.groundPlatform = platform; player.jumps = 0; break; }
  }
  player.x = clamp(player.x, 45, game.layout.width - 45 - player.width);
  for (const spike of game.layout.spikes || []) if (overlaps(player, spike) && !owned('spikeSuit') && player.speedBoost <= 0) hurtPlayer(1);
  if (player.y > game.layout.height + 80) { player.x = 90; player.y = game.layout.floorY - player.height; player.vx = 0; player.vy = 0; hurtPlayer(1); }
}

function activeObstacles() { return roomState(game.roomId).obstacles.filter(obstacle => !['plasma', 'charge', 'missile', 'bomb', 'speed'].includes(obstacle.type) || obstacle.health > 0); }

function damageEnemy(enemy, amount, broadcast = true) {
  if (!enemy || enemy.dead || amount <= 0) return;
  if (broadcast && sharedCombat()) window.LanMultiplayer.sendAction({ type: 'eclipse-enemy-damage', roomId: game.roomId, enemyId: enemy.id, amount })?.catch(() => {});
  enemy.health -= amount; sound('hit');
  if (enemy.health > 0) return;
  enemy.dead = true; game.score += Math.round((enemy.boss ? 2800 : 150) * difficultySettings[difficultySelect.value].score); addParticles(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.color, enemy.boss ? 28 : 10);
  if (!enemy.boss && random() < 0.16) roomState(game.roomId).drops.push({ x: enemy.x + enemy.width / 2 - 7, y: enemy.y + enemy.height / 2 - 7, width: 14, height: 14, energy: 1 });
}

function sharedCombat() { return window.LanMultiplayer?.active && ['coop', 'teams'].includes(window.LanMultiplayer.format); }
function hurtPlayer(amount) { if (game.player.invulnerable > 0) return; game.energy -= amount; game.player.invulnerable = 1; game.player.vx = -game.player.facing * 260; game.player.vy = -260; sound('hurt'); if (game.energy <= 0) respawn(); }
function respawn() { game.energy = Math.max(2, Math.ceil(game.maxEnergy * 0.55)); const station = [...game.explored].map(roomById).filter(room => room?.type === 'station').pop() || roomById(game.world.startRoom); enterRoom(station.id, null); game.player.x = game.layout.width / 2 - 14; game.player.y = game.layout.floorY - game.player.height; statusElement.textContent = 'Reconstruction depuis la dernière station.'; }
function addParticles(x, y, color, count) { for (let index = 0; index < count; index++) game.particles.push({ x, y, vx: (random() - 0.5) * 260, vy: (random() - 0.5) * 220, life: 0.3 + random() * 0.55, color }); }

function spawnEnemyProjectile(enemy, angle, speed = 230, count = 1, spread = 0) {
  for (let index = 0; index < count; index++) { const shotAngle = angle + (index - (count - 1) / 2) * spread; game.enemyProjectiles.push({ x: enemy.x + enemy.width / 2, y: enemy.y + enemy.height / 2, vx: Math.cos(shotAngle) * speed, vy: Math.sin(shotAngle) * speed, width: 9, height: 9, damage: enemy.damage, life: 3 }); }
}

function bossAttack(enemy, angle) {
  enemy.step++; const phaseTwo = enemy.health < enemy.maxHealth * 0.5; const bossRandom = EclipseDepthsWorld.randomFor(`eclipse-boss:${game.seed}:${game.roomId}:${enemy.id}:${enemy.step}`);
  if (enemy.pattern === 'spread') { spawnEnemyProjectile(enemy, angle, 235, phaseTwo ? 7 : 5, 0.16); enemy.cooldown = phaseTwo ? 0.75 : 1.1; }
  else if (enemy.pattern === 'summon') { const runtime = roomState(game.roomId); const count = runtime.enemies.filter(candidate => !candidate.dead && !candidate.boss).length; if (count < 4) for (let index = count; index < Math.min(4, count + 2); index++) runtime.enemies.push(createEnemy({ id: `${enemy.id}-spawn-${enemy.step}-${index}`, type: index % 2 ? 'drone' : 'crawler', x: 180 + bossRandom() * 560, y: 390, tier: enemy.tier, boss: false })); spawnEnemyProjectile(enemy, angle); enemy.cooldown = 1.45; }
  else if (enemy.pattern === 'charge') { enemy.vx = Math.cos(angle) * (phaseTwo ? 520 : 420); enemy.cooldown = phaseTwo ? 0.85 : 1.25; }
  else if (enemy.pattern === 'teleport') { enemy.x = 120 + bossRandom() * 680; enemy.y = 180 + bossRandom() * 190; spawnEnemyProjectile(enemy, angle, 260, 3, 0.28); enemy.cooldown = 0.9; }
  else if (enemy.pattern === 'radial') { const count = phaseTwo ? 14 : 10; for (let index = 0; index < count; index++) spawnEnemyProjectile(enemy, index * Math.PI * 2 / count + enemy.phase, 205); enemy.cooldown = phaseTwo ? 0.8 : 1.2; }
  else { const count = phaseTwo ? 16 : 10; for (let index = 0; index < count; index++) spawnEnemyProjectile(enemy, index * Math.PI * 2 / count + enemy.phase, 215); spawnEnemyProjectile(enemy, angle, 330, 3, 0.12); if (phaseTwo) { enemy.x = 120 + bossRandom() * 680; enemy.y = 170 + bossRandom() * 210; } enemy.cooldown = phaseTwo ? 0.6 : 0.9; }
}

function updateEnemies(delta) {
  const runtime = roomState(game.roomId); const playerCenter = { x: game.player.x + game.player.width / 2, y: game.player.y + game.player.height / 2 };
  runtime.enemies.forEach(enemy => {
    if (enemy.dead) return; enemy.cooldown -= delta; enemy.phase += delta; const enemyCenter = { x: enemy.x + enemy.width / 2, y: enemy.y + enemy.height / 2 }; const dx = playerCenter.x - enemyCenter.x; const dy = playerCenter.y - enemyCenter.y; const length = Math.hypot(dx, dy) || 1;
    if (enemy.boss) { enemy.vx += dx / length * enemy.speed * delta * 2; if (enemy.cooldown <= 0) bossAttack(enemy, Math.atan2(dy, dx)); }
    else if (enemy.style === 'ground') enemy.vx = Math.sign(dx) * enemy.speed;
    else if (enemy.style === 'flying') { enemy.vx = Math.sign(dx) * enemy.speed * 0.7; enemy.y += Math.sin(enemy.phase * 2.8) * 42 * delta; }
    else if (enemy.style === 'ranged' && enemy.cooldown <= 0) { spawnEnemyProjectile(enemy, Math.atan2(dy, dx)); enemy.cooldown = 1.5 + random(); }
    else if (enemy.style === 'charge' && enemy.cooldown <= 0) { enemy.vx = Math.sign(dx) * 320; enemy.cooldown = 2; }
    if (!enemy.boss && enemy.style !== 'flying') enemy.y = (enemy.supportY || game.layout.floorY) - enemy.height;
    const nextX = clamp(enemy.x + enemy.vx * delta, 60, game.layout.width - 60 - enemy.width); const candidate = { ...enemy, x: nextX };
    const blocked = activeObstacles().some(obstacle => overlaps(candidate, obstacle));
    const supported = enemy.boss || enemy.style === 'flying' || game.layout.platforms.some(platform => candidate.x + candidate.width > platform.x + 3 && candidate.x < platform.x + platform.width - 3 && Math.abs(candidate.y + candidate.height - platform.y) <= 5);
    if (!blocked && supported) enemy.x = nextX; else enemy.vx *= -0.35;
    if (overlaps(game.player, enemy)) { if (game.player.dashTimer > 0 && owned('overcharge')) damageEnemy(enemy, 3); else hurtPlayer(enemy.damage); }
  });
  runtime.enemies = runtime.enemies.filter(enemy => !enemy.dead);
  if (!runtime.enemies.length && (!runtime.puzzle || runtime.puzzle.solved) && runtime.masterySolved && !runtime.cleared) clearCurrentRoom();
}

function projectileOpensDoor(projectile, door) {
  return door.shotRequires === 'pulseCannon' || door.shotRequires === projectile.kind;
}

function openDoor(door) {
  if (game.openedEdges.has(door.edgeId)) return;
  game.openedEdges.add(door.edgeId); sound('door'); addParticles(doorPosition(door.side).x, doorPosition(door.side).y + 35, '#67e8f9', 15);
  statusElement.textContent = 'Porte déverrouillée. Approchez-vous puis utilisez ACTION.';
  if (sharedCombat()) window.LanMultiplayer.sendAction({ type: 'eclipse-door-open', edgeId: door.edgeId })?.catch(() => {});
}

function hitPuzzleNode(projectile, node, puzzle) {
  if (projectile.life <= 0 || !overlaps(projectile, { x: node.x - node.radius, y: node.y - node.radius, width: node.radius * 2, height: node.radius * 2 })) return false;
  const order = puzzle.order || [0, 1, 2, 3]; const expected = order[puzzle.progress];
  if (node.order === expected) { node.active = true; puzzle.progress++; if (puzzle.timeLimit && puzzle.progress === 1) puzzle.timer = puzzle.timeLimit; statusElement.textContent = `Relais ${puzzle.progress}/${order.length} activé${puzzle.timer ? ` · ${puzzle.timer.toFixed(1)} s` : ''}.`; }
  else { puzzle.progress = 0; puzzle.nodes.forEach(candidate => { candidate.active = false; }); statusElement.textContent = 'Séquence incorrecte : circuit réinitialisé.'; }
  if (puzzle.progress >= order.length) { puzzle.solved = true; sound('item'); game.score += 500; statusElement.textContent = 'Circuit résolu : les portes sont alimentées.'; if (!roomState(game.roomId).enemies.length) clearCurrentRoom(); }
  projectile.life = 0; return true;
}

function updateMovingPlatforms(delta) {
  (game.layout.movingPlatforms || []).forEach(platform => {
    const previousX = platform.x; const previousY = platform.y; const wave = (Math.sin(game.elapsed * platform.speed + platform.phase) + 1) / 2;
    platform.x = platform.originX + wave * platform.rangeX; platform.y = platform.originY + wave * platform.rangeY;
    platform.deltaX = platform.initialized ? platform.x - previousX : 0; platform.deltaY = platform.initialized ? platform.y - previousY : 0; platform.initialized = true;
  });
}

function updatePuzzleTimer(delta) {
  const puzzle = roomState(game.roomId).puzzle; if (!puzzle || puzzle.solved || !puzzle.timer) return; puzzle.timer = Math.max(0, puzzle.timer - delta);
  if (!puzzle.timer && puzzle.progress) { puzzle.progress = 0; puzzle.nodes.forEach(node => { node.active = false; }); statusElement.textContent = 'Le relais temporel s’est réinitialisé.'; sound('hurt'); }
}

function updateMasteryChallenge() {
  const room = roomById(game.roomId); const runtime = roomState(game.roomId);
  if (room.type !== 'mastery' || runtime.masterySolved) return;
  const obstacleType = ({ chargeBeam: 'charge', missileLauncher: 'missile', morphBombs: 'bomb', speedBooster: 'speed' })[room.traversalRequirement];
  let solved = obstacleType ? runtime.obstacles.some(obstacle => obstacle.type === obstacleType && obstacle.health <= 0) : false;
  if (room.traversalRequirement === 'spikeSuit') {
    const spikes = game.layout.spikes[0];
    solved = Boolean(spikes) && (runtime.masteryDirection >= 0 ? game.player.x > spikes.x + spikes.width + 28 : game.player.x + game.player.width < spikes.x - 28);
  }
  if (!solved) return;
  runtime.masterySolved = true; game.score += 450; sound('item'); statusElement.textContent = 'Capacité maîtrisée : le verrou de l’épreuve est levé.';
  if (!runtime.enemies.length && (!runtime.puzzle || runtime.puzzle.solved)) clearCurrentRoom();
}

function updateBombs(delta) {
  const runtime = roomState(game.roomId);
  game.bombs.forEach(bomb => {
    bomb.timer -= delta;
    if (bomb.timer > 0 || bomb.exploded) return;
    bomb.exploded = true; addParticles(bomb.x, bomb.y, '#fbbf24', 24); sound('boss');
    runtime.obstacles.filter(obstacle => obstacle.type === 'bomb' && obstacle.health > 0 && distance(bomb, obstacle) < 125).forEach(obstacle => { obstacle.health = 0; game.score += 300; });
    runtime.enemies.forEach(enemy => { if (distance(bomb, enemy) < 105) damageEnemy(enemy, 4); });
  });
  game.bombs = game.bombs.filter(bomb => !bomb.exploded);
}

function updateProjectiles(delta) {
  const runtime = roomState(game.roomId);
  game.projectiles.forEach(projectile => {
    projectile.x += projectile.vx * delta; projectile.life -= delta;
    roomById(game.roomId).doors.forEach(door => { if (projectile.life > 0 && overlaps(projectile, doorPosition(door.side))) { if (door.requires && !owned(door.requires) || !projectileOpensDoor(projectile, door)) { statusElement.textContent = `Le tir requis est ${bonusUpgradeMap.get(door.shotRequires)?.name || mainUpgradeMap.get(door.shotRequires)?.name || 'plus puissant'}.`; } else openDoor(door); projectile.life = 0; } });
    if (runtime.puzzle && !runtime.puzzle.solved) runtime.puzzle.nodes.some(node => hitPuzzleNode(projectile, node, runtime.puzzle));
    runtime.obstacles.filter(obstacle => ['plasma', 'charge', 'missile'].includes(obstacle.type) && obstacle.health > 0).forEach(obstacle => { if (projectile.life > 0 && overlaps(projectile, obstacle)) { const valid = obstacle.type === 'plasma' ? projectile.plasma : obstacle.type === 'charge' ? projectile.charged : projectile.missile; if (valid) obstacle.health = 0; projectile.life = 0; addParticles(obstacle.x + obstacle.width / 2, projectile.y, '#fb7185', 10); if (valid) { game.score += 350; sound('item'); statusElement.textContent = 'Blindage spécialisé désintégré.'; } else statusElement.textContent = 'Ce blindage résiste à ce type de tir.'; } });
    runtime.enemies.forEach(enemy => { if (enemy.dead || projectile.life <= 0 || !overlaps(projectile, enemy)) return; damageEnemy(enemy, projectile.damage); if (projectile.explosive) runtime.enemies.forEach(candidate => { if (!candidate.dead && distance(candidate, enemy) < (owned('missilePack2') ? 125 : 82)) damageEnemy(candidate, 2); }); projectile.life = 0; });
  });
  game.enemyProjectiles.forEach(projectile => { projectile.x += projectile.vx * delta; projectile.y += projectile.vy * delta; projectile.life -= delta; if (overlaps(projectile, game.player)) { hurtPlayer(projectile.damage); projectile.life = 0; } });
  game.projectiles = game.projectiles.filter(projectile => projectile.life > 0 && projectile.x > -30 && projectile.x < game.layout.width + 30); game.enemyProjectiles = game.enemyProjectiles.filter(projectile => projectile.life > 0 && projectile.x > -40 && projectile.x < game.layout.width + 40 && projectile.y > -40 && projectile.y < game.layout.height + 40);
}

function grantMasteryReward(room, announce = true) {
  if (room?.type !== 'mastery' || game.masteryRewards.has(room.id)) return false;
  game.masteryRewards.add(room.id); game.maxEnergy += 1; game.energy = game.maxEnergy; game.score += 900;
  if (announce) { statusElement.textContent = 'Épreuve maîtrisée : capacité énergétique augmentée.'; sound('item'); }
  return true;
}

function clearCurrentRoom(broadcast = true) {
  const runtime = roomState(game.roomId); if (!runtime.masterySolved) return; runtime.cleared = true; game.clearedRooms.add(game.roomId); game.score += 400;
  if (broadcast && sharedCombat()) window.LanMultiplayer.sendAction({ type: 'eclipse-room-cleared', roomId: game.roomId })?.catch(() => {});
  const room = roomById(game.roomId);
  if (!grantMasteryReward(room)) statusElement.textContent = room.pickup || room.bonus ? 'Une amélioration vient d’apparaître.' : 'Salle sécurisée.';
  checkVictory();
}

function availablePickup() {
  const room = roomById(game.roomId); if (!room || game.collectedRooms.has(room.id) || !roomState(room.id).cleared) return null;
  return room.pickup || room.bonus ? { id: room.pickup || room.bonus, main: Boolean(room.pickup), x: game.layout.width / 2 - 18, y: game.layout.floorY - 76, width: 36, height: 36 } : null;
}

function collectPickup(pickup, broadcast = true) {
  const room = roomById(game.roomId); if (!pickup || game.collectedRooms.has(room.id)) return; game.collectedRooms.add(room.id); if (!owned(pickup.id)) game.inventory.push(pickup.id);
  const upgrade = mainUpgradeMap.get(pickup.id) || bonusUpgradeMap.get(pickup.id); if (pickup.id.startsWith('energyTank')) { game.maxEnergy += 2; game.energy = game.maxEnergy; }
  if (pickup.id === 'missileLauncher') { game.maxMissiles = Math.max(game.maxMissiles, 5); game.missiles = game.maxMissiles; }
  if (pickup.id.startsWith('missilePack')) { game.maxMissiles += 3; game.missiles = game.maxMissiles; }
  game.highlightAbility = pickup.id; game.score += pickup.main ? 3200 : 1100; sound('item'); addParticles(game.layout.width / 2, game.layout.floorY - 72, upgrade?.color || '#fef08a', 25); renderInventory(); updateObjective(); saveGame();
  if (broadcast && sharedCombat()) window.LanMultiplayer.sendAction({ type: 'eclipse-pickup', roomId: room.id, pickupId: pickup.id, main: pickup.main })?.catch(() => {});
  if (broadcast) showOverlay(upgrade?.name || 'Amélioration', `${upgrade?.effect || `Nouvelle capacité : ${upgrade?.gate}.`} ${pickup.main ? 'Un nouveau secteur est désormais accessible.' : 'Cette amélioration est optionnelle.'}`, closeOverlay);
  else statusElement.textContent = `${upgrade?.name || 'Amélioration'} récupérée par l’équipe.`;
  checkVictory();
}

function checkVictory() {
  if (!game.clearedRooms.has(game.world.finalRoom)) return;
  const missingBonuses = game.world.bonusOrder.filter(entry => !game.collectedRooms.has(entry.roomId)).length;
  if (gameModeSelect.value === 'completion' && missingBonuses) { statusElement.textContent = `Le cœur est neutralisé, mais ${missingBonuses} amélioration(s) bonus restent à retrouver.`; return; }
  finishGame();
}

function update(delta) {
  if (!game || game.completed || paused || showMap) return; game.elapsed += delta;
  if (controls.has('shoot')) { if (owned('chargeBeam')) game.player.charge = Math.min(1.4, game.player.charge + delta); else shoot(); }
  updateMovingPlatforms(delta); updatePlayer(delta); updateEnemies(delta); updateProjectiles(delta); updateBombs(delta); updatePuzzleTimer(delta); updateMasteryChallenge();
  const pickup = availablePickup(); if (pickup && overlaps(game.player, pickup)) collectPickup(pickup);
  const runtime = roomState(game.roomId); runtime.drops.forEach(drop => { if (overlaps(game.player, drop)) { drop.collected = true; game.energy = Math.min(game.maxEnergy, game.energy + drop.energy); sound('save'); } }); runtime.drops = runtime.drops.filter(drop => !drop.collected);
  runtime.platformFeatures.forEach(feature => { if (feature.collected || !overlaps(game.player, { x: feature.x - 15, y: feature.y - 18, width: 30, height: 30 })) return; feature.collected = true; game.collectedFeatures.add(feature.id); const rewards = { energy: 1, relay: 0, archive: 0, relic: 2 }; game.energy = Math.min(game.maxEnergy, game.energy + rewards[feature.type]); game.score += feature.type === 'relic' ? 450 : feature.type === 'archive' ? 250 : 140; sound('item'); addParticles(feature.x, feature.y, feature.type === 'relay' ? '#67e8f9' : '#fef08a', 12); statusElement.textContent = feature.type === 'relay' ? 'Relais d’altitude synchronisé.' : feature.type === 'archive' ? 'Archive secrète analysée.' : feature.type === 'relic' ? 'Relique de secteur récupérée.' : 'Capsule énergétique récupérée.'; saveGame(); });
  game.particles.forEach(particle => { particle.x += particle.vx * delta; particle.y += particle.vy * delta; particle.vy += 250 * delta; particle.life -= delta; }); game.particles = game.particles.filter(particle => particle.life > 0);
  const targetCameraX = clamp(game.player.x - WIDTH * 0.36, 0, Math.max(0, game.layout.width - WIDTH)); const targetCameraY = clamp(game.player.y - HEIGHT * 0.58, 0, Math.max(0, game.layout.height - HEIGHT));
  game.camera.x += (targetCameraX - game.camera.x) * Math.min(1, delta * 7); game.camera.y += (targetCameraY - game.camera.y) * Math.min(1, delta * 7);
  remotePlayers.forEach(remote => { remote.displayX += (remote.x - remote.displayX) * Math.min(1, delta * 10); remote.displayY += (remote.y - remote.displayY) * Math.min(1, delta * 10); });
  window.LanMultiplayer?.sendGhost({ x: game.player.x, y: game.player.y, vx: game.player.vx, vy: game.player.vy, progress: game.inventory.filter(id => mainUpgradeMap.has(id)).length / EclipseDepthsWorld.MAIN_UPGRADES.length, state: game.roomId })?.catch(() => {});
  if (game.elapsed >= game.nextAutosave) { game.nextAutosave = game.elapsed + 10; saveGame(); } updateHud();
}

function drawBackground(room, theme) {
  context.fillStyle = theme.background; context.fillRect(0, 0, game.layout.width, game.layout.height); context.fillStyle = theme.far;
  for (let index = 0; index < Math.ceil(game.layout.width / 94) + 1; index++) { const x = index * 94 + room.x * 17 % 70; const height = 85 + (index * 47 + room.y * 31) % Math.max(180, game.layout.height * 0.45); context.fillRect(x, game.layout.height - height, 46, height); }
  const architecture = game.layout.architecture || { ribs: 4, shafts: 1, damaged: false };
  context.strokeStyle = `${theme.detail}48`; context.lineWidth = 8;
  for (let index = 0; index < architecture.ribs; index++) { const x = (index + 0.5) * game.layout.width / architecture.ribs; context.beginPath(); context.moveTo(x, 0); context.lineTo(x + (index % 2 ? 24 : -24), game.layout.floorY); context.stroke(); }
  for (let index = 0; index < architecture.shafts; index++) { const x = game.layout.width * (index + 1) / (architecture.shafts + 1); const shaft = context.createLinearGradient(x - 75, 0, x + 75, 0); shaft.addColorStop(0, 'transparent'); shaft.addColorStop(0.5, `${theme.detail}18`); shaft.addColorStop(1, 'transparent'); context.fillStyle = shaft; context.fillRect(x - 75, 0, 150, game.layout.floorY); }
  if (architecture.damaged) { context.strokeStyle = '#02061788'; context.lineWidth = 5; for (let index = 0; index < 7; index++) { const x = 90 + (architecture.seed + index * 173) % Math.max(100, game.layout.width - 180); const y = 75 + (architecture.seed + index * 97) % Math.max(80, game.layout.floorY - 170); context.beginPath(); context.moveTo(x, y); context.lineTo(x + 15, y + 22); context.lineTo(x - 4, y + 39); context.stroke(); } }
  context.globalAlpha = 0.18; context.strokeStyle = theme.detail; for (let y = 50; y < game.layout.height; y += 72) { context.beginPath(); context.moveTo(0, y); context.lineTo(game.layout.width, y + Math.sin(y) * 8); context.stroke(); } context.globalAlpha = 1;
  context.fillStyle = `${theme.detail}44`; for (let index = 0; index < 28; index++) { const x = (index * 173 + game.elapsed * (10 + index % 3) + room.x * 41) % game.layout.width; const y = 35 + (index * 79 + room.y * 29) % Math.max(70, game.layout.height - 100); context.fillRect(x, y, 2 + index % 3, 2 + index % 2); }
}

function drawDoors(room, theme) {
  const lockActive = roomLocked(room.id);
  room.doors.forEach(door => { const position = doorPosition(door.side); const capabilityLocked = door.requires && !owned(door.requires); const opened = game.openedEdges.has(door.edgeId); const locked = lockActive || capabilityLocked; context.fillStyle = locked ? '#e11d48' : opened ? '#334155' : door.kind === 'returnShortcut' ? '#facc15' : theme.detail; context.fillRect(position.x, position.y, position.width, position.height); context.fillStyle = opened ? '#020617' : '#07121f'; context.fillRect(position.x + 7, position.y + 8, position.width - 14, position.height - 15); context.fillStyle = locked ? '#fecdd3' : '#fff'; context.font = '800 15px Arial'; context.textAlign = 'center'; context.fillText(lockActive ? '×' : opened ? ({ west: '←', east: '→', north: '↑', south: '↓' })[door.side] : '◎', position.x + position.width / 2, position.y + position.height / 2 + 4); if (!lockActive && capabilityLocked) { context.font = '11px Arial'; context.fillText(mainUpgradeMap.get(door.requires)?.icon || bonusUpgradeMap.get(door.requires)?.icon || '×', position.x + position.width / 2, position.y - 7); } });
}

function drawTraversalObstacles(theme) {
  activeObstacles().forEach(obstacle => {
    if (obstacle.type === 'phase') { context.fillStyle = '#fb718588'; for (let y = obstacle.y; y < obstacle.y + obstacle.height; y += 16) context.fillRect(obstacle.x, y, obstacle.width, 8); return; }
    const colors = { plasma: '#9f1239', charge: '#075985', missile: '#92400e', bomb: '#713f12', speed: '#4338ca' }; context.fillStyle = colors[obstacle.type] || theme.wall; context.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height); context.strokeStyle = ['plasma', 'charge', 'missile', 'bomb', 'speed'].includes(obstacle.type) ? '#fef08a' : theme.detail; context.lineWidth = 3; context.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    const icons = { plasma: 'Ω', charge: '◎', missile: '➤', bomb: '●', speed: '≫' }; if (icons[obstacle.type]) { context.fillStyle = '#fff'; context.font = '800 18px Arial'; context.textAlign = 'center'; context.fillText(icons[obstacle.type], obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2); }
  });
}

function drawPuzzle(runtime) {
  if (!runtime.puzzle) return;
  const order = runtime.puzzle.order || [0, 1, 2, 3]; runtime.puzzle.nodes.forEach(node => { context.fillStyle = node.active ? '#22c55e' : '#0f172a'; context.strokeStyle = node.order === order[runtime.puzzle.progress] ? '#fef08a' : '#67e8f9'; context.lineWidth = 5; context.beginPath(); context.arc(node.x, node.y, node.radius, 0, Math.PI * 2); context.fill(); context.stroke(); context.fillStyle = '#fff'; context.font = '900 15px Arial'; context.textAlign = 'center'; context.fillText(String(order.indexOf(node.order) + 1), node.x, node.y + 5); });
  if (runtime.puzzle.timer) { context.fillStyle = '#fef08a'; context.font = '900 18px Arial'; context.fillText(`${runtime.puzzle.timer.toFixed(1)} s`, game.layout.width / 2, game.layout.floorY - 125); }
}

function drawEnvironment(theme) {
  (game.layout.environment || []).forEach(item => { context.save(); context.translate(item.x, item.y); context.scale(item.scale, item.scale); context.globalAlpha = item.depth === 0 ? 0.55 : 0.85;
    if (item.type === 'pipe' || item.type === 'cable') { context.fillStyle = item.type === 'cable' ? '#111827' : theme.wall; context.fillRect(-9, -72, 18, 72); context.fillStyle = theme.platform; context.fillRect(-14, -75, 28, 9); }
    else if (item.type === 'crystal' || item.type === 'relic') { context.fillStyle = item.type === 'relic' ? '#fef08a' : theme.detail; context.beginPath(); context.moveTo(0, -55); context.lineTo(14, -18); context.lineTo(0, 0); context.lineTo(-14, -18); context.closePath(); context.fill(); }
    else if (item.type === 'terminal') { context.fillStyle = theme.wall; context.fillRect(-25, -58, 50, 58); context.fillStyle = '#67e8f9'; context.fillRect(-17, -49, 34, 21); context.fillStyle = '#f8fafc'; context.fillRect(-12, -19, 8, 5); context.fillRect(4, -19, 8, 5); }
    else if (item.type === 'lamp') { context.strokeStyle = theme.platform; context.lineWidth = 5; context.beginPath(); context.moveTo(0, 0); context.lineTo(0, -58); context.stroke(); context.fillStyle = '#fef08a'; context.shadowColor = '#facc15'; context.shadowBlur = 18; context.beginPath(); context.arc(0, -62, 9, 0, Math.PI * 2); context.fill(); context.shadowBlur = 0; }
    else if (item.type === 'reactor' || item.type === 'pillar') { context.fillStyle = theme.wall; context.fillRect(-22, -88, 44, 88); context.strokeStyle = item.type === 'reactor' ? '#fb7185' : theme.detail; context.lineWidth = 5; context.strokeRect(-15, -73, 30, 52); }
    else { context.strokeStyle = theme.detail; context.lineWidth = 4; context.beginPath(); context.arc(0, -25, 18, 0, Math.PI * 2); context.stroke(); for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2) { context.beginPath(); context.moveTo(0, -25); context.lineTo(Math.cos(angle + game.elapsed * 3) * 15, -25 + Math.sin(angle + game.elapsed * 3) * 15); context.stroke(); } }
    context.restore(); });
}

function drawEnemy(enemy) {
  context.save(); context.translate(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2); context.fillStyle = enemy.color; context.strokeStyle = enemy.boss ? '#fef08a' : '#e2e8f0'; context.lineWidth = enemy.boss ? 4 : 2; context.beginPath();
  if (enemy.style === 'flying') { context.moveTo(-enemy.width / 2, 0); context.lineTo(0, -enemy.height / 2); context.lineTo(enemy.width / 2, 0); context.lineTo(0, enemy.height / 2); }
  else if (enemy.boss) for (let index = 0; index < 12; index++) { const angle = index * Math.PI / 6; const radius = index % 2 ? enemy.width * 0.34 : enemy.width * 0.52; const x = Math.cos(angle) * radius; const y = Math.sin(angle) * radius; if (!index) context.moveTo(x, y); else context.lineTo(x, y); }
  else context.rect(-enemy.width / 2, -enemy.height / 2, enemy.width, enemy.height);
  context.closePath(); context.fill(); context.stroke();
  if (enemy.boss) { context.fillStyle = '#020617'; context.fillRect(-65, -enemy.height / 2 - 25, 130, 8); context.fillStyle = enemy.health < enemy.maxHealth / 2 ? '#f97316' : '#22c55e'; context.fillRect(-65, -enemy.height / 2 - 25, 130 * Math.max(0, enemy.health) / enemy.maxHealth, 8); context.fillStyle = '#fff'; context.font = '800 12px Arial'; context.fillText(enemy.label, 0, -enemy.height / 2 - 34); }
  context.restore();
}

function drawPlayer() {
  const player = game.player; if (player.invulnerable > 0 && Math.floor(player.invulnerable * 14) % 2) return; context.save(); context.translate(player.x, player.y);
  (player.afterimages || []).forEach(image => { const age = game.elapsed - image.time; context.save(); context.globalAlpha = Math.max(0, .36 - age); context.fillStyle = '#67e8f9'; if (image.morph) { context.beginPath(); context.arc(image.x - player.x + player.width / 2, image.y - player.y + player.height / 2, 11, 0, Math.PI * 2); context.fill(); } else context.fillRect(image.x - player.x + 4, image.y - player.y + 8, player.width - 8, player.normalHeight - 8); context.restore(); });
  context.fillStyle = player.dashTimer > 0 ? '#fef08a' : player.morph ? '#22d3ee' : '#e2e8f0'; if (player.morph) { context.beginPath(); context.arc(player.width / 2, player.height / 2, player.height / 2, 0, Math.PI * 2); context.fill(); } else { context.fillRect(4, 8, player.width - 8, player.height - 8); context.fillStyle = '#06b6d4'; context.fillRect(player.facing > 0 ? player.width - 4 : -7, 16, 11, 10); context.fillStyle = '#f43f5e'; context.fillRect(8, 0, player.width - 16, 12); }
  if (player.charge > 0) { context.strokeStyle = player.charge >= 0.62 ? '#fef08a' : '#67e8f9'; context.lineWidth = 3; context.beginPath(); context.arc(player.width / 2, player.height / 2, 22 + player.charge * 8, 0, Math.PI * 2); context.stroke(); } context.restore();
}

function draw() {
  if (!game) { context.fillStyle = '#07121f'; context.fillRect(0, 0, WIDTH, HEIGHT); context.fillStyle = '#cffafe'; context.font = '900 36px Arial'; context.textAlign = 'center'; context.fillText('PROFONDEURS DE L’ÉCLIPSE', WIDTH / 2, HEIGHT / 2); return; }
  const room = roomById(game.roomId); const theme = EclipseDepthsWorld.ZONE_THEMES[room.zoneIndex]; context.save(); context.translate(-game.camera.x, -game.camera.y); drawBackground(room, theme);
  game.layout.platforms.forEach(platform => { context.fillStyle = theme.wall; context.fillRect(platform.x, platform.y, platform.width, platform.height); context.fillStyle = theme.platform; context.fillRect(platform.x, platform.y, platform.width, 7); if (!platform.floor) { context.fillStyle = `${theme.detail}55`; context.fillRect(platform.x + 10, platform.y + 8, platform.width - 20, 4); context.strokeStyle = `${theme.detail}66`; context.lineWidth = 3; for (let x = platform.x + 18; x < platform.x + platform.width - 8; x += 42) { context.beginPath(); context.moveTo(x, platform.y + platform.height); context.lineTo(x + 11, Math.min(game.layout.floorY, platform.y + 68)); context.stroke(); } } });
  (game.layout.movingPlatforms || []).forEach(platform => { context.fillStyle = '#334155'; context.fillRect(platform.x, platform.y, platform.width, platform.height); context.fillStyle = '#fef08a'; context.fillRect(platform.x, platform.y, platform.width, 5); context.strokeStyle = '#94a3b8'; context.beginPath(); context.moveTo(platform.originX + platform.width / 2, platform.originY + platform.height / 2); context.lineTo(platform.x + platform.width / 2, platform.y + platform.height / 2); context.stroke(); }); drawEnvironment(theme);
  drawTraversalObstacles(theme);
  if (game.layout.hazard) { context.fillStyle = game.layout.hazard === 'lava' ? '#f97316' : game.layout.hazard === 'void' ? '#7e22ce' : '#e11d48'; for (let x = 80; x < game.layout.width - 80; x += 85) context.fillRect(x, game.layout.floorY - 10, 42, 6); }
  (game.layout.spikes || []).forEach(spike => { context.fillStyle = owned('spikeSuit') ? '#64748b' : '#f43f5e'; for (let x = spike.x; x < spike.x + spike.width; x += 18) { context.beginPath(); context.moveTo(x, spike.y + spike.height); context.lineTo(x + 9, spike.y); context.lineTo(x + 18, spike.y + spike.height); context.fill(); } });
  game.layout.anchors.forEach(anchor => { context.strokeStyle = '#e9d5ff'; context.lineWidth = 3; context.beginPath(); context.arc(anchor.x, anchor.y, 11, 0, Math.PI * 2); context.stroke(); });
  roomState(game.roomId).platformFeatures.forEach(feature => { if (feature.collected) return; context.save(); context.translate(feature.x, feature.y); context.shadowColor = feature.type === 'relay' ? '#22d3ee' : '#fde047'; context.shadowBlur = 13; context.fillStyle = feature.type === 'energy' ? '#22c55e' : feature.type === 'relay' ? '#22d3ee' : feature.type === 'archive' ? '#c084fc' : '#fde047'; context.beginPath(); context.moveTo(0, -12); context.lineTo(11, 0); context.lineTo(0, 12); context.lineTo(-11, 0); context.closePath(); context.fill(); context.shadowBlur = 0; context.restore(); });
  drawDoors(room, theme); drawPuzzle(roomState(game.roomId)); if (room.type === 'station') { context.fillStyle = '#67e8f9'; context.fillRect(game.layout.width / 2 - 46, game.layout.floorY - 70, 92, 70); context.fillStyle = '#07121f'; context.fillRect(game.layout.width / 2 - 30, game.layout.floorY - 58, 60, 45); }
  roomState(game.roomId).enemies.forEach(drawEnemy); roomState(game.roomId).drops.forEach(drop => { context.fillStyle = '#22c55e'; context.beginPath(); context.arc(drop.x + 7, drop.y + 7, 7, 0, Math.PI * 2); context.fill(); }); const pickup = availablePickup(); if (pickup) { const upgrade = mainUpgradeMap.get(pickup.id) || bonusUpgradeMap.get(pickup.id); context.fillStyle = upgrade?.color || '#facc15'; context.shadowColor = context.fillStyle; context.shadowBlur = 20; context.fillRect(pickup.x, pickup.y, pickup.width, pickup.height); context.shadowBlur = 0; context.fillStyle = '#07121f'; context.font = '900 23px Arial'; context.textAlign = 'center'; context.fillText(upgrade?.icon || '+', pickup.x + 18, pickup.y + 25); }
  game.projectiles.forEach(projectile => { context.fillStyle = projectile.missile ? '#f97316' : projectile.charged ? '#fef08a' : projectile.explosive ? '#f59e0b' : projectile.plasma ? '#fb7185' : '#67e8f9'; context.fillRect(projectile.x, projectile.y, projectile.width, projectile.height); }); game.enemyProjectiles.forEach(projectile => { context.fillStyle = '#f43f5e'; context.fillRect(projectile.x, projectile.y, projectile.width, projectile.height); }); game.bombs.forEach(bomb => { context.fillStyle = '#facc15'; context.beginPath(); context.arc(bomb.x + 8, bomb.y + 8, 8 + Math.sin(bomb.timer * 25) * 2, 0, Math.PI * 2); context.fill(); });
  game.particles.forEach(particle => { context.globalAlpha = Math.max(0, particle.life); context.fillStyle = particle.color; context.fillRect(particle.x, particle.y, 5, 5); }); context.globalAlpha = 1;
  remotePlayers.forEach(remote => { if (remote.state !== game.roomId) return; context.save(); context.globalAlpha = 0.35; context.fillStyle = '#f0abfc'; context.fillRect(remote.displayX, remote.displayY, 28, 44); context.restore(); }); drawPlayer();
  context.restore(); context.fillStyle = '#ffffffdd'; context.font = '800 16px Arial'; context.textAlign = 'left'; context.fillText(`${room.zone} · ${roomLabel(room)}`, 18, 28);
  drawMinimap(); if (showMap) drawExpandedMap();
}

function mapGeometry(target) {
  const bounds = game.world.bounds; const padding = 22; const scale = Math.min((target.canvas.width - padding * 2) / Math.max(1, bounds.maxX - bounds.minX + 1), (target.canvas.height - padding * 2) / Math.max(1, bounds.maxY - bounds.minY + 1));
  return { scale, x: room => padding + (room.x - bounds.minX) * scale, y: room => padding + (room.y - bounds.minY) * scale };
}

function drawMap(target, revealAll = false) {
  target.fillStyle = '#06111d'; target.fillRect(0, 0, target.canvas.width, target.canvas.height); const geometry = mapGeometry(target);
  game.world.edges.forEach(edge => { const first = roomById(edge.a); const second = roomById(edge.b); if (!revealAll && (!game.explored.has(first.id) || !game.explored.has(second.id))) return; const newlyAccessible = game.highlightAbility && edge.requires === game.highlightAbility && owned(game.highlightAbility); target.strokeStyle = newlyAccessible ? '#22d3ee' : edge.requires && !owned(edge.requires) ? '#e11d48' : edge.kind === 'returnShortcut' ? '#facc15' : '#64748b'; target.lineWidth = newlyAccessible ? 5 : 2; target.beginPath(); target.moveTo(geometry.x(first), geometry.y(first)); target.lineTo(geometry.x(second), geometry.y(second)); target.stroke(); });
  game.world.rooms.forEach(room => { if (!revealAll && !game.explored.has(room.id)) return; target.fillStyle = room.id === game.roomId ? '#fff' : game.clearedRooms.has(room.id) ? '#22c55e' : room.pickup && !game.collectedRooms.has(room.id) ? '#f59e0b' : room.bonus && !game.collectedRooms.has(room.id) ? '#c084fc' : '#64748b'; const size = room.type.includes('Boss') || room.type === 'boss' ? 7 : 5; target.fillRect(geometry.x(room) - size / 2, geometry.y(room) - size / 2, size, size); });
}

function drawMinimap() { drawMap(minimapContext, false); }
function drawExpandedMap() { context.save(); context.globalAlpha = 0.94; context.fillStyle = '#020617'; context.fillRect(70, 45, WIDTH - 140, HEIGHT - 90); context.globalAlpha = 1; const offscreen = document.createElement('canvas'); offscreen.width = WIDTH - 180; offscreen.height = HEIGHT - 130; const mapContext = offscreen.getContext('2d'); drawMap(mapContext, owned('mapChip') || game.scanUntil > performance.now()); context.drawImage(offscreen, 90, 65); context.fillStyle = '#fff'; context.font = '800 15px Arial'; context.textAlign = 'center'; const highlighted = mainUpgradeMap.get(game.highlightAbility) || bonusUpgradeMap.get(game.highlightAbility); context.fillText(`PLAN DE LA STATION · ${highlighted ? `accès ${highlighted.name} en cyan · ` : ''}M pour fermer`, WIDTH / 2, HEIGHT - 55); context.restore(); }

function renderInventory() {
  if (!game) return; const upgrades = [...EclipseDepthsWorld.MAIN_UPGRADES.map(upgrade => ({ ...upgrade, main: true })), ...EclipseDepthsWorld.BONUS_UPGRADES];
  document.getElementById('inventory').innerHTML = upgrades.map(upgrade => `<div class="upgrade ${upgrade.main ? 'main' : ''} ${owned(upgrade.id) ? '' : 'locked'}" data-help="${upgrade.effect || `Ouvre : ${upgrade.gate}`}"><b>${upgrade.icon}</b>${upgrade.name}</div>`).join('');
}

function updateObjective() {
  if (!game) return; const missingId = game.world.mainOrder.find(id => !owned(id)); const missing = mainUpgradeMap.get(missingId);
  const pickupRoom = game.world.rooms.find(room => room.pickup === missingId);
  document.getElementById('objective').textContent = missing ? `Localisez ${missing.name} dans ${pickupRoom?.zone || missing.zone}.` : gameModeSelect.value === 'completion' ? 'Neutralisez le cœur et récupérez tous les modules bonus.' : 'Atteignez le cœur de la station et neutralisez l’Esprit de l’Éclipse.';
  document.getElementById('eventLog').textContent = missing ? `${missing.icon} ${missing.gate} : cette capacité ouvrira le prochain secteur.` : 'Tous les verrous principaux peuvent être franchis.';
}

function updateHud() {
  if (!game) return; const room = roomById(game.roomId); document.getElementById('energy').textContent = `${'♥'.repeat(Math.max(0, Math.ceil(game.energy / 2)))}${'·'.repeat(Math.max(0, Math.ceil(game.maxEnergy / 2) - Math.ceil(game.energy / 2)))}`; document.getElementById('zone').textContent = room.zone; document.getElementById('rooms').textContent = `${game.explored.size} / ${game.world.rooms.length}`; const bonusRooms = game.world.bonusOrder.map(entry => entry.roomId); document.getElementById('bonuses').textContent = `${bonusRooms.filter(id => game.collectedRooms.has(id)).length} / ${bonusRooms.length}`; document.getElementById('time').textContent = `${Math.floor(game.elapsed / 60)}:${String(Math.floor(game.elapsed % 60)).padStart(2, '0')}`; document.getElementById('score').textContent = game.score.toLocaleString('fr-FR');
  if (hintsToggle.checked && nearbyDoor()) statusElement.textContent = game.openedEdges.has(nearbyDoor().edgeId) ? 'Appuyez sur E ou ACTION pour utiliser ce passage.' : 'Tirez sur la porte avant de l’utiliser.';
  if (owned('missileLauncher')) document.getElementById('eventLog').textContent = `Missiles ${game.missiles}/${game.maxMissiles} · ${game.player.speedBoost > 0 ? 'Boost actif' : game.player.charge >= 0.62 ? 'Rayon chargé' : 'Modules opérationnels'}.`;
}

function showOverlay(title, text, callback) { overlayTitle.textContent = title; overlayText.textContent = text; overlayCallback = callback; overlay.hidden = false; paused = true; }
function closeOverlay() { overlay.hidden = true; paused = false; overlayCallback = null; previousTime = performance.now(); }
document.getElementById('overlayAction').onclick = () => { const callback = overlayCallback; if (callback) callback(); else closeOverlay(); }; document.getElementById('overlaySecondary').onclick = closeOverlay;

function finishGame() {
  if (game.completed) return; game.completed = true; running = false; saveGame(); const timeText = `${Math.floor(game.elapsed / 60)}:${String(Math.floor(game.elapsed % 60)).padStart(2, '0')}`;
  if (gameModeSelect.value === 'speedrun') window.GameRecords?.finish({ score: Math.round(game.elapsed), scoreLabel: `${timeText} · station libérée`, won: true, lowerIsBetter: true });
  else window.GameRecords?.finish({ score: game.score, scoreLabel: `${game.score.toLocaleString('fr-FR')} points · ${timeText}`, won: true, lowerIsBetter: false });
  showOverlay('Station libérée', `L’Esprit de l’Éclipse est neutralisé. ${game.explored.size}/${game.world.rooms.length} salles découvertes.`, () => { closeOverlay(); draw(); });
}

function loop(now) { const delta = Math.min(0.034, Math.max(0, (now - previousTime) / 1000)); previousTime = now; if (running) update(delta); draw(); frame = requestAnimationFrame(loop); }
function togglePause(force) { if (!game || game.completed || !overlay.hidden) return; paused = force ?? !paused; controls.clear(); document.getElementById('pause').textContent = paused ? 'Reprendre' : 'Pause'; statusElement.textContent = paused ? 'Exploration en pause.' : 'Exploration reprise.'; if (!paused) previousTime = performance.now(); }
function toggleMap() { if (!game || paused) return; showMap = !showMap; if (showMap && owned('scanPulse')) { game.scanUntil = performance.now() + 4000; statusElement.textContent = 'Écho spectral actif : les embranchements cachés apparaissent brièvement.'; } controls.clear(); draw(); }

const keyMap = { ArrowLeft: 'left', q: 'left', a: 'left', ArrowRight: 'right', d: 'right', f: 'shoot', F: 'shoot' };
document.addEventListener('keydown', event => {
  if (event.target.matches('select,input,button,a')) return; const control = keyMap[event.key]; if (control) { event.preventDefault(); controls.add(control); if (control === 'shoot' && !owned('chargeBeam')) shoot(); updateControlHighlights(); return; } if (event.repeat) return;
  if (event.code === 'Space' || ['z', 'w'].includes(event.key.toLowerCase())) { event.preventDefault(); jump(); } else if (event.key.toLowerCase() === 'x' || event.key === 'Shift') activateAbility(); else if (event.key.toLowerCase() === 'r') fireMissile(); else if (event.key === 'ArrowDown' || event.key.toLowerCase() === 's') { event.preventDefault(); toggleMorph(); } else if (event.key.toLowerCase() === 'e') interact(); else if (event.key.toLowerCase() === 'm') toggleMap(); else if (event.key.toLowerCase() === 'p' || event.key === 'Escape') togglePause();
});
document.addEventListener('keyup', event => { const control = keyMap[event.key]; if (control) { controls.delete(control); if (control === 'shoot') releaseChargedShot(); updateControlHighlights(); } });
function updateControlHighlights() { document.querySelectorAll('[data-control]').forEach(button => button.classList.toggle('active', controls.has(button.dataset.control))); }
document.querySelectorAll('[data-control]').forEach(button => { const action = button.dataset.control; const release = () => { controls.delete(action); if (action === 'shoot') releaseChargedShot(); updateControlHighlights(); }; button.onpointerdown = event => { event.preventDefault(); if (['left', 'right', 'shoot'].includes(action)) controls.add(action); if (action === 'jump') jump(); else if (action === 'shoot' && !owned('chargeBeam')) shoot(); else if (action === 'ability') activateAbility(); else if (action === 'missile') fireMissile(); else if (action === 'morph') toggleMorph(); else if (action === 'map') toggleMap(); else if (action === 'interact') interact(); updateControlHighlights(); }; button.onpointerup = button.onpointercancel = button.onpointerleave = release; });
canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));
document.getElementById('start').onclick = () => startGame(); document.getElementById('continue').onclick = () => { const saved = loadSave(); if (saved) startGame(saved); }; document.getElementById('pause').onclick = () => togglePause();
window.addEventListener('blur', () => { controls.clear(); if (running && !paused && overlay.hidden) togglePause(true); }); document.addEventListener('visibilitychange', () => { if (document.hidden && running && !paused && overlay.hidden) togglePause(true); });
window.addEventListener('lan:start', () => startGame()); window.addEventListener('lan:pause', event => togglePause(Boolean(event.detail?.paused)));
window.addEventListener('lan:ghost', event => { const snapshot = event.detail; const previous = remotePlayers.get(snapshot.playerId); remotePlayers.set(snapshot.playerId, { ...snapshot, displayX: previous?.displayX ?? snapshot.x, displayY: previous?.displayY ?? snapshot.y }); });
window.addEventListener('lan:action', event => {
  const action = event.detail?.action; if (!game || !action) return;
  if (action.type === 'eclipse-enemy-damage' && action.roomId === game.roomId) { const enemy = roomState(game.roomId).enemies.find(candidate => candidate.id === action.enemyId); if (enemy) damageEnemy(enemy, Number(action.amount) || 0, false); }
  if (action.type === 'eclipse-room-cleared') { game.clearedRooms.add(action.roomId); const runtime = roomState(action.roomId); runtime.enemies = []; runtime.masterySolved = true; runtime.cleared = true; grantMasteryReward(roomById(action.roomId), action.roomId === game.roomId); checkVictory(); }
  if (action.type === 'eclipse-pickup' && !game.collectedRooms.has(action.roomId)) { const previousRoom = game.roomId; game.roomId = action.roomId; collectPickup({ id: action.pickupId, main: action.main }, false); game.roomId = previousRoom; game.layout = roomState(previousRoom).layout; }
  if (action.type === 'eclipse-door-open') game.openedEdges.add(action.edgeId);
});
window.addEventListener('beforeunload', saveGame);

window.EclipseDepthsTestAPI = {
  diagnostics() {
    const diagnosticSeed = new URLSearchParams(location.search).get('seed') || 'diagnostic';
    const generatedWorlds = Object.keys(EclipseDepthsWorld.SIZE_SETTINGS).map(size => EclipseDepthsWorld.generateWorld(diagnosticSeed, size));
    const worlds = generatedWorlds.map(world => ({ size: world.size, ...EclipseDepthsWorld.validateWorld(world) }));
    const sampleLayouts = generatedWorlds.flatMap(world => { const startLayout = EclipseDepthsWorld.generateRoomLayout(world, world.startRoom); const movingLayout = world.rooms.map(room => EclipseDepthsWorld.generateRoomLayout(world, room.id)).find(layout => layout.movingPlatforms.length); return movingLayout ? [startLayout, movingLayout] : [startLayout]; });
    return { canvas: WIDTH === 960 && HEIGHT === 540, worlds, mainUpgrades: EclipseDepthsWorld.MAIN_UPGRADES.length, bonusTypes: EclipseDepthsWorld.BONUS_UPGRADES.length, bossPatterns: new Set(Object.values(bossDefinitions).map(boss => boss.pattern)).size, mobileControls: document.querySelectorAll('[data-control]').length, variableRooms: sampleLayouts.some(layout => layout.width > WIDTH || layout.height > HEIGHT), movingRooms: sampleLayouts.some(layout => layout.movingPlatforms.length), purposefulPlatforms: generatedWorlds.every(world => world.rooms.every(room => EclipseDepthsWorld.validateRoomLayout(world, room.id).purposefulPlatforms)), platformFeatures: sampleLayouts.reduce((total, layout) => total + layout.platformFeatures.length, 0), wallJump: 'wallGrace' in createPlayer(), mapAbilityHighlight: true, shuffledBonusModules: generatedWorlds.every(world => world.bonusDistribution === 'seeded-shuffle'), saveVersion: 6 };
  },
  selfTest() {
    const first = EclipseDepthsWorld.generateWorld('repeatable', 'standard'); const second = EclipseDepthsWorld.generateWorld('repeatable', 'standard'); const validation = EclipseDepthsWorld.validateWorld(first);
    const orders = new Set(['ordre-a', 'ordre-b', 'ordre-c', 'ordre-d'].map(seed => EclipseDepthsWorld.generateWorld(seed, 'standard').mainOrder.join(',')));
    const masteryRooms = first.rooms.filter(room => room.type === 'mastery');
    const jumpGraphs = first.rooms.map(room => EclipseDepthsWorld.validateRoomLayout(first, room.id).jumpGraph);
    return { deterministic: JSON.stringify(first) === JSON.stringify(second), progression: validation.mainProgression, finalReachable: validation.valid, bonusesReachable: validation.bonusReachable, pickupPlacement: validation.pickupPlacementValid, layoutsValid: validation.validLayouts, jumpablePlatforms: jumpGraphs.every(result => result.valid && result.maximumRise <= EclipseDepthsWorld.JUMP_PHYSICS.maximumRise && result.maximumGap <= EclipseDepthsWorld.JUMP_PHYSICS.maximumGap), masteryMechanics: masteryRooms.length >= 5 && masteryRooms.every(room => EclipseDepthsWorld.validateRoomLayout(first, room.id).traversalMechanic), gatedRegions: validation.gatedMainRegions === EclipseDepthsWorld.MAIN_UPGRADES.length, traversalChallenges: validation.traversalRooms >= EclipseDepthsWorld.MAIN_UPGRADES.length, masteryChallenges: validation.masteryRooms >= 5, puzzleRooms: validation.puzzleRooms > 0, variableOrder: orders.size > 1, distinctBosses: new Set(Object.values(bossDefinitions).map(boss => boss.pattern)).size === 6 };
  }
};

window.GameRuleExamples = element => {
  const index = [...element.parentElement.children].indexOf(element); const examples = [
    { title: 'Progression principale', explanation: 'Le gardien remet une capacité, puis seulement les portes correspondantes deviennent traversables.', html: '<div style="display:flex;align-items:center;gap:15px;font-size:34px"><span>👾</span><strong>→</strong><span class="rule-example-cell highlight">⇈</span><strong>→</strong><span class="rule-example-cell">↑</span></div>' },
    { title: 'Branche bonus sûre', explanation: 'Un secret ne demande jamais un objet placé après son embranchement.', html: '<div style="display:grid;grid-template-columns:repeat(3,62px);gap:10px"><div class="rule-example-cell">●</div><div class="rule-example-cell highlight">◆</div><div class="rule-example-cell">♥</div></div>' },
    { title: 'Raccourci de retour', explanation: 'Une capacité tardive déverrouille une liaison vers une ancienne zone sans contourner le parcours principal.', html: '<div style="display:flex;gap:12px;font-size:32px"><span>●—●—●</span><span style="color:#facc15">↶</span></div>' },
    { title: 'Station', explanation: 'Le terminal restaure toute l’énergie et conserve la progression locale.', html: '<div class="rule-example-cell highlight" style="font-size:35px">▣ ♥</div>' },
    { title: 'Coopération', explanation: 'Les joueurs voient leurs armures dans une même salle et partagent dégâts et améliorations.', html: '<div style="display:flex;gap:20px;font-size:35px"><span>◉</span><span>◉</span><span>→ ◆</span></div>' }
  ]; return { text: element.textContent.trim(), ...(examples[index] || examples[0]) };
};

document.getElementById('continue').disabled = !loadSave(); try { localStorage.setItem('game-hub:last-game', 'eclipse-depths'); } catch {} game = createGame('preview'); game.layout = roomState(game.roomId).layout; game.player.y = game.layout.floorY - game.player.height; draw(); updateHud();
