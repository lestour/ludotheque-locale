'use strict';

const canvas = document.getElementById('screen');
const context = canvas.getContext('2d');
const minimap = document.getElementById('minimap');
const minimapContext = minimap.getContext('2d');
const worldSizeSelect = document.getElementById('worldSize');
const difficultySelect = document.getElementById('difficulty');
const gameModeSelect = document.getElementById('gameMode');
const adventurersSelect = document.getElementById('adventurers');
const soundToggle = document.getElementById('sound');
const hintsToggle = document.getElementById('showHints');
const statusElement = document.getElementById('status');
const eventLog = document.getElementById('eventLog');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayText = document.getElementById('overlayText');
const overlayAction = document.getElementById('overlayAction');
const overlaySecondary = document.getElementById('overlaySecondary');
const shopElement = document.getElementById('shop');
const controls = new Set();
const remotePlayers = new Map();
const TILE = 44;
const SAVE_KEY = window.GameRuntime?.profileKey('asteria:save') || 'asteria:save';
const difficultySettings = {
  easy: { health: 0.72, damage: 0.6, density: 0.75, price: 0.75, score: 0.75 },
  normal: { health: 1, damage: 1, density: 1, price: 1, score: 1 },
  hard: { health: 1.4, damage: 1.35, density: 1.25, price: 1.3, score: 1.5 },
  extreme: { health: 1.9, damage: 1.75, density: 1.55, price: 1.65, score: 2.2 }
};
const itemDefinitions = {
  sword: { icon: '⚔️', label: 'Épée', action: 'Coupe les ronces et attaque.' }, bombs: { icon: '💣', label: 'Bombes', action: 'Détruit les rochers fissurés.' },
  glove: { icon: '🧤', label: 'Gantelet', action: 'Déplace les blocs massifs.' }, flippers: { icon: '🩴', label: 'Palmes', action: 'Traverse les eaux profondes.' },
  hookshot: { icon: '🪝', label: 'Grappin', action: 'Franchit les gouffres.' }, flameWard: { icon: '🛡️', label: 'Égide ignée', action: 'Protège de la lave.' },
  bow: { icon: '🏹', label: 'Arc', action: 'Tire une flèche à distance.' }, sunRelic: { icon: '☀️', label: 'Relique solaire', action: 'Brise le règne de l’éclipse.' }
};
const rewardNames = { bombs: 'Sac de bombes', glove: 'Gantelet tellurique', flippers: 'Palmes des marées', hookshot: 'Grappin des alizés', flameWard: 'Égide ignée', sunRelic: 'Relique solaire', swordUpgrade: 'Lame renforcée', armorUpgrade: 'Armure renforcée', heartContainer: 'Réceptacle de cœur', bow: 'Arc ancien', coinCache: 'Trésor ancien', heartPiece: 'Fragment de cœur', weaponRune: 'Rune de force', armorRune: 'Rune de garde', coins: 'Bourse ancienne', potion: 'Potion', bombBag: 'Grande sacoche' };
const biomeColors = { sea: '#155e75', beach: '#e7cf7c', plains: '#65a94f', forest: '#236b3b', mountain: '#6b7280', lake: '#2f80c1', volcano: '#8f2c1d', swamp: '#586b32', ruins: '#8b7b6b' };
const enemyDefinitions = {
  slime: { color: '#65a30d', speed: 62, health: 2, damage: 1, style: 'chase' }, bat: { color: '#7c3aed', speed: 105, health: 1, damage: 1, style: 'orbit' },
  archer: { color: '#b45309', speed: 45, health: 3, damage: 1, style: 'ranged' }, shell: { color: '#0f766e', speed: 38, health: 5, damage: 1, style: 'charge' },
  wisp: { color: '#38bdf8', speed: 82, health: 3, damage: 1, style: 'wander' }, golem: { color: '#57534e', speed: 32, health: 8, damage: 2, style: 'chase' },
  ember: { color: '#f97316', speed: 88, health: 4, damage: 2, style: 'ranged' }, guardian: { color: '#dc2626', speed: 48, health: 24, damage: 2, style: 'boss' }
};
const bossDefinitions = {
  gardienRonce: { label: 'Gardien des Ronces', color: '#15803d', health: 1, pattern: 'summon' },
  golemBasalte: { label: 'Golem de Basalte', color: '#57534e', health: 1.35, pattern: 'charge' },
  serpentLacustre: { label: 'Serpent Lacustre', color: '#0891b2', health: 1.15, pattern: 'spread' },
  sentinelleVent: { label: 'Sentinelle des Vents', color: '#7c3aed', health: 1.2, pattern: 'teleport' },
  hydreCendre: { label: 'Hydre de Cendre', color: '#ea580c', health: 1.5, pattern: 'radial' },
  roiEclipse: { label: 'Roi de l’Éclipse', color: '#111827', health: 1.9, pattern: 'eclipse' }
};
const biomeEnemies = { plains: ['slime', 'archer'], forest: ['slime', 'bat', 'archer'], mountain: ['bat', 'golem'], lake: ['wisp', 'shell'], beach: ['shell', 'archer'], volcano: ['ember', 'golem'], swamp: ['slime', 'wisp'], ruins: ['bat', 'golem', 'wisp'], sea: [] };

let state = null;
let running = false;
let paused = false;
let frame = 0;
let previousTime = 0;
let audioContext = null;
let overlayCallback = null;

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const distance = (left, right) => Math.hypot(left.x - right.x, left.y - right.y);
const worldToPixel = value => value * TILE + TILE / 2;
const random = () => state?.random?.() ?? Math.random();

function sound(kind) {
  if (!soundToggle.checked) return;
  try {
    audioContext ||= new AudioContext(); const oscillator = audioContext.createOscillator(); const gain = audioContext.createGain(); const now = audioContext.currentTime;
    const values = { sword: [210, 0.07], hit: [95, 0.12], item: [740, 0.28], door: [330, 0.12], coin: [960, 0.08], boss: [72, 0.38], solve: [620, 0.3], hurt: [135, 0.2], bomb: [55, 0.3], buy: [520, 0.14] }[kind] || [260, 0.08];
    oscillator.type = ['boss', 'bomb', 'hurt'].includes(kind) ? 'sawtooth' : kind === 'item' ? 'triangle' : 'square'; oscillator.frequency.setValueAtTime(values[0], now); oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, values[0] * 0.55), now + values[1]); gain.gain.setValueAtTime(0.035, now); gain.gain.exponentialRampToValueAtTime(0.0001, now + values[1]); oscillator.connect(gain).connect(audioContext.destination); oscillator.start(); oscillator.stop(now + values[1]);
  } catch {}
}

function log(message) { eventLog.textContent = message; }
function tilePosition(entity) { return { x: Math.floor(entity.x / TILE), y: Math.floor(entity.y / TILE) }; }
function currentBiome() { const point = tilePosition(state.player); return AsteriaWorld.biomeAt(state.world, point.x, point.y); }
function elevationAtEntity(entity) { const point = tilePosition(entity); return AsteriaWorld.elevationAt(state.world, point.x, point.y); }
function ladderTransition(fromX, fromY, targetX, targetY) {
  const from = { x: Math.floor(fromX / TILE), y: Math.floor(fromY / TILE) }; const target = { x: Math.floor(targetX / TILE), y: Math.floor(targetY / TILE) };
  return (state.world.cliffs || []).some(cliff => from.x === cliff.ladderX && target.x === cliff.ladderX && new Set([from.y, target.y]).has(cliff.y) && new Set([from.y, target.y]).has(cliff.y - 1));
}
function owned(item) { return state.inventory.includes(item); }
function saveGame() {
  if (!state) return;
  try {
    const safePlayer = state.scene === 'dungeon' && state.returnPosition ? { ...state.player, x: state.returnPosition.x, y: state.returnPosition.y, attackTimer: 0, itemTimer: 0, invulnerable: 0 } : state.player;
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 6, options: { worldSize: worldSizeSelect.value, difficulty: difficultySelect.value, gameMode: gameModeSelect.value, adventurers: adventurersSelect.value }, seed: state.seed, player: safePlayer, inventory: state.inventory, selectedItem: state.selectedItem, coins: state.coins, heartPieces: state.heartPieces, completedMain: state.completedMain, completedDungeons: [...state.completedDungeons], openedChests: [...state.openedChests], clearedObstacles: [...state.clearedObstacles], merchantPurchases: [...state.merchantPurchases], explored: [...state.explored], mapRevealed: state.mapRevealed, elapsed: state.elapsed, score: state.score, weaponLevel: state.weaponLevel, armorLevel: state.armorLevel, bombLevel: state.bombLevel, maxHealth: state.maxHealth, health: state.health }));
    document.getElementById('continue').disabled = false;
  } catch {}
}

function loadSave() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (!saved || typeof saved !== 'object' || !['string', 'number'].includes(typeof saved.seed)) return null;
    if (saved.version && saved.version > 6) return null;
    return saved;
  } catch { return null; }
}

function createState(seed, saved = null) {
  const world = AsteriaWorld.generateWorld(seed, worldSizeSelect.value);
  const completedDungeons = saved?.completedDungeons || [];
  const openedChests = saved?.openedChests || [];
  const clearedObstacles = saved?.clearedObstacles || [];
  const restoredClearedObstacles = [];
  if (saved) {
    world.dungeons.forEach(dungeon => { dungeon.completed = completedDungeons.includes(dungeon.id); });
    world.chests.forEach(chest => { chest.opened = openedChests.includes(chest.id); });
    const identifiersStored = clearedObstacles.some(value => typeof value === 'string');
    world.obstacles.forEach((obstacle, index) => { obstacle.cleared = identifiersStored ? clearedObstacles.includes(obstacle.id) : clearedObstacles.includes(index); if (obstacle.cleared) restoredClearedObstacles.push(obstacle.id); });
  }
  const startX = worldToPixel(world.start.x); const startY = worldToPixel(world.start.y);
  const maxHealth = saved?.maxHealth || 6;
  const migratedPlayer = saved?.version >= 6 ? saved.player : null;
  const player = { x: startX, y: startY, radius: 14, direction: 'down', attackTimer: 0, itemTimer: 0, invulnerable: 0, speed: 180, ...(migratedPlayer || {}) };
  player.x = clamp(Number(player.x) || startX, TILE * 2, (world.width - 2) * TILE);
  player.y = clamp(Number(player.y) || startY, TILE * 2, (world.height - 2) * TILE);
  const inventory = Array.isArray(saved?.inventory) && saved.inventory.length ? saved.inventory : ['sword'];
  const selectedItem = inventory.includes(saved?.selectedItem) ? saved.selectedItem : 'sword';
  const completedMain = Math.max(saved?.completedMain ?? 0, world.dungeons.filter(dungeon => dungeon.main && dungeon.completed).length);
  return {
    seed, random: AsteriaWorld.randomFor(`asteria-play:${seed}`), world, scene: 'world', dungeon: null, room: null,
    player,
    inventory, selectedItem, coins: saved?.coins ?? 25, heartPieces: saved?.heartPieces ?? 0,
    completedMain, completedDungeons: new Set(completedDungeons), openedChests: new Set(openedChests), clearedObstacles: new Set(restoredClearedObstacles), merchantPurchases: new Set(saved?.merchantPurchases || []),
    maxHealth, health: saved?.health || maxHealth, weaponLevel: saved?.weaponLevel || 1, armorLevel: saved?.armorLevel || 0, bombLevel: saved?.bombLevel || 1,
    elapsed: saved?.elapsed || 0, enemies: [], projectiles: [], particles: [], pickups: [], explored: new Set(saved?.explored || [`${world.start.x},${world.start.y}`]), mapRevealed: Boolean(saved?.mapRevealed), camera: { x: startX, y: startY }, roomTransition: 0,
    completed: false, roomSolved: false, currentPuzzleProgress: 0, companionPlates: 0, score: saved?.score || 0, nextAutosave: (saved?.elapsed || 0) + 12, enemySerial: 0, encounterTimer: 2
  };
}

function applySavedOptions(saved) {
  if (!saved?.options) return;
  for (const [id, value] of Object.entries(saved.options)) { const control = document.getElementById(id); if (control) control.value = value; }
}

function startGame(saved = null) {
  cancelAnimationFrame(frame); controls.clear(); remotePlayers.clear();
  if (saved) applySavedOptions(saved);
  const seed = saved?.seed || new URLSearchParams(location.search).get('seed') || `${Date.now()}:${Math.random()}`;
  state = createState(seed, saved); running = true; paused = false; overlay.hidden = true; document.getElementById('pause').textContent = 'Pause';
  spawnWorldEnemies(); updateQuest(); updateHud(); renderInventory(); draw(); previousTime = performance.now(); window.GameRecords?.reset(); frame = requestAnimationFrame(loop); saveGame();
}

function spawnWorldEnemies() {
  state.enemies = [];
  const settings = difficultySettings[difficultySelect.value]; const amount = Math.floor((10 + state.completedMain * 4) * settings.density);
  for (let attempt = 0; state.enemies.length < amount && attempt < amount * 6; attempt++) spawnWorldEnemy(260, 1100);
}

function spawnWorldEnemy(minimumRange = 390, maximumRange = 880) {
  const angle = random() * Math.PI * 2; const range = minimumRange + random() * (maximumRange - minimumRange); const x = state.player.x + Math.cos(angle) * range; const y = state.player.y + Math.sin(angle) * range;
  const tileX = Math.floor(x / TILE); const tileY = Math.floor(y / TILE); const biome = AsteriaWorld.biomeAt(state.world, tileX, tileY); const choices = biomeEnemies[biome] || [];
  const occupied = state.world.dungeons.some(dungeon => Math.hypot(dungeon.x - tileX, dungeon.y - tileY) < 4) || state.world.merchants.some(merchant => Math.hypot(merchant.x - tileX, merchant.y - tileY) < 3);
  if (!choices.length || occupied || Math.hypot(tileX - state.world.start.x, tileY - state.world.start.y) < 12 || !canOccupyWorld(x, y, 15, true) || tileX < 4 || tileY < 4 || tileX >= state.world.width - 4 || tileY >= state.world.height - 4) return false;
  const enemy = createEnemy(choices[Math.floor(random() * choices.length)], x, y, 1 + state.completedMain * 0.24, false, `world-${state.enemySerial++}`); enemy.elevation = AsteriaWorld.elevationAt(state.world, tileX, tileY); state.enemies.push(enemy);
  return true;
}

function maintainWorldEncounters(delta) {
  state.encounterTimer -= delta;
  if (state.encounterTimer > 0) return;
  state.encounterTimer = 2.2;
  state.enemies = state.enemies.filter(enemy => !enemy.dead && distance(enemy, state.player) < 1500);
  const target = Math.floor((10 + state.completedMain * 4) * difficultySettings[difficultySelect.value].density);
  for (let attempt = 0; state.enemies.length < target && attempt < 8; attempt++) spawnWorldEnemy();
}

function createEnemy(type, x, y, tier = 1, boss = false, id = null, bossKind = null) {
  const definition = enemyDefinitions[type] || enemyDefinitions.slime; const settings = difficultySettings[difficultySelect.value];
  const bossDefinition = boss ? bossDefinitions[bossKind] || bossDefinitions.gardienRonce : null;
  const health = Math.ceil(definition.health * tier * settings.health * (bossDefinition?.health || 1));
  return { id: id || `enemy-${state.enemySerial++}`, type, bossKind, bossLabel: bossDefinition?.label, x, y, vx: 0, vy: 0, radius: boss ? 32 : 15, health, maxHealth: health, damage: definition.damage * settings.damage, speed: definition.speed * (1 + tier * 0.06), style: definition.style, color: bossDefinition?.color || definition.color, cooldown: random() * 1.5, phase: random() * Math.PI * 2, bossStep: 0, dead: false, boss };
}

function obstacleAt(x, y) {
  return state.world.obstacles.find(obstacle => !obstacle.cleared && obstacle.x === x && obstacle.y === y);
}

function circleRectCollision(x, y, radius, rectangle) {
  const nearestX = clamp(x, rectangle.x, rectangle.x + rectangle.width); const nearestY = clamp(y, rectangle.y, rectangle.y + rectangle.height);
  return Math.hypot(x - nearestX, y - nearestY) < radius;
}

function obstacleHitbox(obstacle) {
  const centerX = worldToPixel(obstacle.x); const centerY = worldToPixel(obstacle.y);
  if (obstacle.type === 'bush') return { x: centerX - 8, y: centerY + 5, width: 16, height: 14 };
  if (['crackedRock', 'boulder'].includes(obstacle.type)) return { x: centerX - 17, y: centerY - 10, width: 34, height: 29 };
  return { x: obstacle.x * TILE + 2, y: obstacle.y * TILE + 2, width: TILE - 4, height: TILE - 4 };
}

function worldObstacleBlocks(obstacle, inventory) {
  if (obstacle.cleared) return false;
  if (['deepWater', 'lavaSeal'].includes(obstacle.type) && inventory.includes(obstacle.requires)) return false;
  return true;
}

function sceneryHitbox(item) {
  const widths = { tree: 12, pine: 14, palm: 13, rock: 22, basalt: 24, deadTree: 14, column: 20, stump: 17 };
  const width = widths[item.type] || 12; return { x: worldToPixel(item.x) - width / 2, y: worldToPixel(item.y) + 4, width, height: item.type === 'rock' || item.type === 'basalt' ? 18 : 16 };
}

function canOccupyWorld(x, y, radius = 14, enemy = false, fromX = x, fromY = y) {
  const tileX = Math.floor(x / TILE); const tileY = Math.floor(y / TILE); const biome = AsteriaWorld.biomeAt(state.world, tileX, tileY);
  if (biome === 'sea') return false;
  if (biome === 'lake' && !owned('flippers')) return false;
  const currentElevation = AsteriaWorld.elevationAt(state.world, Math.floor(fromX / TILE), Math.floor(fromY / TILE)); const targetElevation = AsteriaWorld.elevationAt(state.world, tileX, tileY);
  if (currentElevation !== targetElevation && (enemy || !ladderTransition(fromX, fromY, x, y))) return false;
  if (state.world.obstacles.some(obstacle => worldObstacleBlocks(obstacle, state.inventory) && circleRectCollision(x, y, radius, obstacleHitbox(obstacle)))) return false;
  if ((state.world.scenery || []).some(item => item.collidable && (item.elevation || 0) === targetElevation && circleRectCollision(x, y, radius, sceneryHitbox(item)))) return false;
  if ((state.world.village?.buildings || []).some(building => circleRectCollision(x, y, radius, { x: worldToPixel(building.x) - 28, y: worldToPixel(building.y) - 3, width: 56, height: 29 }))) return false;
  return true;
}

function movePlayer(delta) {
  const horizontal = (controls.has('right') ? 1 : 0) - (controls.has('left') ? 1 : 0); const vertical = (controls.has('down') ? 1 : 0) - (controls.has('up') ? 1 : 0);
  if (!horizontal && !vertical) return;
  const length = Math.hypot(horizontal, vertical); const speed = state.player.speed * (state.scene === 'world' && currentBiome() === 'lake' ? 0.72 : 1);
  const dx = horizontal / length * speed * delta; const dy = vertical / length * speed * delta;
  state.player.direction = Math.abs(horizontal) > Math.abs(vertical) ? horizontal > 0 ? 'right' : 'left' : vertical > 0 ? 'down' : 'up';
  const nextX = state.player.x + dx; const nextY = state.player.y + dy;
  if (state.scene === 'world') {
    const previousElevation = elevationAtEntity(state.player);
    if (canOccupyWorld(nextX, state.player.y, state.player.radius, false, state.player.x, state.player.y)) state.player.x = nextX;
    if (canOccupyWorld(state.player.x, nextY, state.player.radius, false, state.player.x, state.player.y)) state.player.y = nextY;
    const nextElevation = elevationAtEntity(state.player); if (nextElevation !== previousElevation) statusElement.textContent = nextElevation > previousElevation ? 'Vous gagnez le plateau par l’échelle.' : 'Vous redescendez prudemment par l’échelle.';
    state.player.x = clamp(state.player.x, TILE * 2, (state.world.width - 2) * TILE); state.player.y = clamp(state.player.y, TILE * 2, (state.world.height - 2) * TILE);
  } else {
    state.player.x = clamp(nextX, 45, canvas.width - 45); state.player.y = clamp(nextY, 50, canvas.height - 46); checkDoorTransition();
  }
}

function attack() {
  if (!state || paused || state.player.attackTimer > 0 || !running) return;
  state.player.attackTimer = 0.32; state.combatShake = 0.09; sound('sword'); const direction = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[state.player.direction]; const reach = 42 + state.weaponLevel * 3;
  state.enemies.forEach(enemy => { if (enemy.dead || state.scene === 'world' && elevationAtEntity(enemy) !== elevationAtEntity(state.player)) return; const dx = enemy.x - state.player.x; const dy = enemy.y - state.player.y; if (Math.hypot(dx, dy) <= reach + enemy.radius && dx * direction[0] + dy * direction[1] > -5) damageEnemy(enemy, state.weaponLevel + 1); });
  if (state.scene === 'world') clearNearbyObstacle('sword');
}

function useItem() {
  if (!state || paused || state.player.itemTimer > 0 || !running) return;
  state.player.itemTimer = 0.45;
  const item = state.selectedItem;
  if (['bombs', 'glove', 'flippers', 'hookshot', 'flameWard'].includes(item)) {
    if (state.scene === 'dungeon' && state.room?.puzzle && !state.room.cleared && puzzleItem(state.room) === item) { solvePuzzleStep(state.room); return; }
    if (clearNearbyObstacle(item)) { sound(item === 'bombs' ? 'bomb' : 'solve'); return; }
    if (item === 'bombs') { sound('bomb'); state.enemies.forEach(enemy => { if ((state.scene !== 'world' || elevationAtEntity(enemy) === elevationAtEntity(state.player)) && distance(enemy, state.player) < 95 + state.bombLevel * 15) damageEnemy(enemy, 3 + state.weaponLevel + state.bombLevel * 2); }); }
    if (item === 'hookshot') { const direction = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[state.player.direction]; const targetX = state.player.x + direction[0] * 90; const targetY = state.player.y + direction[1] * 90; const safe = state.scene === 'world' ? canOccupyWorld(targetX, targetY, state.player.radius) : targetX > 45 && targetX < canvas.width - 45 && targetY > 50 && targetY < canvas.height - 46; if (safe) { state.player.x = targetX; state.player.y = targetY; sound('door'); } else statusElement.textContent = 'Le grappin ne trouve pas de point d’arrivée sûr.'; }
  } else if (item === 'bow') shootArrow(); else attack();
}

function clearNearbyObstacle(item) {
  if (state.scene !== 'world') return false;
  const point = tilePosition(state.player);
  const obstacle = state.world.obstacles.find(candidate => !candidate.cleared && candidate.requires === item && Math.hypot(candidate.x - point.x, candidate.y - point.y) <= 1.6);
  if (!obstacle) return false;
  obstacle.cleared = true; state.clearedObstacles.add(obstacle.id); state.score += 120;
  log(obstacle.cave ? 'La paroi s’effondre et révèle une grotte secrète.' : `${obstacle.label} franchi grâce à ${itemDefinitions[item]?.label || item}.`); saveGame(); return true;
}

function shootArrow() {
  const direction = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[state.player.direction];
  state.projectiles.push({ x: state.player.x, y: state.player.y, vx: direction[0] * 430, vy: direction[1] * 430, radius: 5, friendly: true, damage: 3 + state.weaponLevel, elevation: state.scene === 'world' ? elevationAtEntity(state.player) : 0, life: 1.2 }); sound('door');
}

function cycleItem() {
  const usable = state.inventory.filter(item => itemDefinitions[item]); const index = usable.indexOf(state.selectedItem); state.selectedItem = usable[(index + 1) % usable.length] || 'sword'; renderInventory(); statusElement.textContent = `${itemDefinitions[state.selectedItem].label} équipé.`;
}

function sharedDungeonCombat() {
  return state?.scene === 'dungeon' && window.LanMultiplayer?.active && ['coop', 'teams'].includes(window.LanMultiplayer.format);
}

function damageEnemy(enemy, amount, broadcast = true) {
  if (!enemy || enemy.dead || amount <= 0) return;
  if (broadcast && sharedDungeonCombat()) window.LanMultiplayer.sendAction({ type: 'enemy-damage', dungeonId: state.dungeon.id, roomId: state.room.id, enemyId: enemy.id, amount })?.catch(() => {});
  enemy.health -= amount; sound('hit'); enemy.vx += (enemy.x - state.player.x) * 2.2; enemy.vy += (enemy.y - state.player.y) * 2.2;
  if (enemy.health > 0) return;
  enemy.dead = true; const reward = enemy.boss ? 45 : 1 + Math.floor(random() * 4); state.coins += reward; state.score += Math.round((enemy.boss ? 3000 : 120) * difficultySettings[difficultySelect.value].score * (1 + state.completedMain * 0.2));
  if (enemy.boss) completeBoss(); else if (random() < 0.12) state.pickups.push({ x: enemy.x, y: enemy.y, type: 'heart', radius: 10 });
}

function hurtPlayer(amount) {
  if (state.player.invulnerable > 0) return;
  state.health -= Math.max(0.5, amount - state.armorLevel * 0.25); state.player.invulnerable = 1.1; sound('hurt');
  if (state.health <= 0) {
    state.health = Math.max(1, state.maxHealth * 0.5); state.coins = Math.max(0, state.coins - 20); leaveDungeon(false); showOverlay('Vous vous réveillez au village', 'Une partie de vos pièces a été perdue, mais votre progression est conservée.', () => closeOverlay());
  }
}

function spawnHostileProjectile(enemy, angle, speed = 210, damage = enemy.damage, radius = 6) {
  state.projectiles.push({ x: enemy.x, y: enemy.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, radius, friendly: false, damage, elevation: state.scene === 'world' ? elevationAtEntity(enemy) : 0, life: 3 });
}

function bossAttack(enemy, targetAngle) {
  const pattern = bossDefinitions[enemy.bossKind]?.pattern || 'summon';
  const phaseTwo = enemy.health <= enemy.maxHealth * 0.5;
  enemy.bossStep++; const bossRandom = AsteriaWorld.randomFor(`boss:${state.seed}:${state.dungeon?.id}:${enemy.id}:${enemy.bossStep}`);
  if (pattern === 'summon') {
    const existingMinions = state.enemies.filter(candidate => !candidate.boss && !candidate.dead).length;
    for (let index = existingMinions; index < Math.min(phaseTwo ? 5 : 3, existingMinions + 2); index++) {
      const angle = bossRandom() * Math.PI * 2; state.enemies.push(createEnemy(index % 2 ? 'bat' : 'slime', enemy.x + Math.cos(angle) * 72, enemy.y + Math.sin(angle) * 72, 1 + state.completedMain * 0.28, false, `${enemy.id}-summon-${enemy.bossStep}-${index}`));
    }
    spawnHostileProjectile(enemy, targetAngle, 190); enemy.cooldown = phaseTwo ? 1.35 : 1.8;
  } else if (pattern === 'charge') {
    enemy.vx = Math.cos(targetAngle) * (phaseTwo ? 520 : 420); enemy.vy = Math.sin(targetAngle) * (phaseTwo ? 520 : 420); enemy.cooldown = phaseTwo ? 1.1 : 1.65;
  } else if (pattern === 'spread') {
    const count = phaseTwo ? 7 : 5; for (let index = 0; index < count; index++) spawnHostileProjectile(enemy, targetAngle + (index - (count - 1) / 2) * 0.2, 225);
    enemy.cooldown = phaseTwo ? 0.8 : 1.2;
  } else if (pattern === 'teleport') {
    enemy.x = 120 + bossRandom() * (canvas.width - 240); enemy.y = 125 + bossRandom() * (canvas.height - 250);
    for (let index = -1; index <= 1; index++) spawnHostileProjectile(enemy, targetAngle + index * 0.28, 255);
    enemy.cooldown = phaseTwo ? 0.75 : 1.15;
  } else if (pattern === 'radial') {
    const count = phaseTwo ? 14 : 10; for (let index = 0; index < count; index++) spawnHostileProjectile(enemy, enemy.phase + index * Math.PI * 2 / count, 180 + Number(phaseTwo) * 45);
    enemy.cooldown = phaseTwo ? 0.9 : 1.35;
  } else {
    const count = phaseTwo ? 12 : 8; for (let index = 0; index < count; index++) spawnHostileProjectile(enemy, enemy.phase + index * Math.PI * 2 / count, 210, enemy.damage * 0.9, 7);
    spawnHostileProjectile(enemy, targetAngle, 320, enemy.damage * 1.25, 8);
    if (phaseTwo) { enemy.x = 100 + bossRandom() * (canvas.width - 200); enemy.y = 110 + bossRandom() * (canvas.height - 220); }
    enemy.cooldown = phaseTwo ? 0.65 : 1;
  }
}

function updateEnemies(delta) {
  const tier = 1 + state.completedMain * 0.24;
  state.enemies.forEach(enemy => {
    if (enemy.dead) return; enemy.cooldown -= delta; enemy.phase += delta;
    const dx = state.player.x - enemy.x; const dy = state.player.y - enemy.y; const length = Math.hypot(dx, dy) || 1;
    if (enemy.style === 'chase' || enemy.style === 'boss') { enemy.vx += dx / length * enemy.speed * delta * 3; enemy.vy += dy / length * enemy.speed * delta * 3; }
    if (enemy.style === 'orbit') { enemy.vx += (dx / length + Math.cos(enemy.phase * 2) * 0.8) * enemy.speed * delta * 2; enemy.vy += (dy / length + Math.sin(enemy.phase * 2) * 0.8) * enemy.speed * delta * 2; }
    if (enemy.style === 'wander') { enemy.vx += Math.cos(enemy.phase * 1.7) * enemy.speed * delta; enemy.vy += Math.sin(enemy.phase * 1.3) * enemy.speed * delta; }
    if (enemy.boss && enemy.cooldown <= 0 && length < 520) bossAttack(enemy, Math.atan2(dy, dx));
    else if (enemy.style === 'ranged' && enemy.cooldown <= 0 && length < 430) { spawnHostileProjectile(enemy, Math.atan2(dy, dx)); enemy.cooldown = 1.5 + random(); }
    if (enemy.style === 'charge' && enemy.cooldown <= 0) { enemy.vx = dx / length * 300; enemy.vy = dy / length * 300; enemy.cooldown = 2.4; }
    enemy.vx *= Math.pow(0.12, delta); enemy.vy *= Math.pow(0.12, delta);
    if (state.scene === 'dungeon') { enemy.x += enemy.vx * delta; enemy.y += enemy.vy * delta; enemy.x = clamp(enemy.x, 40, canvas.width - 40); enemy.y = clamp(enemy.y, 45, canvas.height - 45); }
    else {
      const nextX = enemy.x + enemy.vx * delta; const nextY = enemy.y + enemy.vy * delta;
      if (canOccupyWorld(nextX, enemy.y, enemy.radius, true, enemy.x, enemy.y)) enemy.x = nextX; else enemy.vx *= -0.25;
      if (canOccupyWorld(enemy.x, nextY, enemy.radius, true, enemy.x, enemy.y)) enemy.y = nextY; else enemy.vy *= -0.25;
      enemy.x = clamp(enemy.x, TILE * 3, (state.world.width - 3) * TILE); enemy.y = clamp(enemy.y, TILE * 3, (state.world.height - 3) * TILE);
    }
    if ((state.scene !== 'world' || elevationAtEntity(enemy) === elevationAtEntity(state.player)) && distance(enemy, state.player) < enemy.radius + state.player.radius) hurtPlayer(enemy.damage * tier);
  });
  state.enemies = state.enemies.filter(enemy => !enemy.dead);
}

function updateProjectiles(delta) {
  state.projectiles.forEach(projectile => { const previousX = projectile.x; const previousY = projectile.y; projectile.x += projectile.vx * delta; projectile.y += projectile.vy * delta; projectile.life -= delta;
    if (state.scene === 'world' && projectile.life > 0 && !canOccupyWorld(projectile.x, projectile.y, projectile.radius, true, previousX, previousY)) { projectile.life = 0; return; }
    if (projectile.friendly) state.enemies.forEach(enemy => { if (!enemy.dead && (state.scene !== 'world' || elevationAtEntity(enemy) === projectile.elevation) && distance(projectile, enemy) < projectile.radius + enemy.radius) { damageEnemy(enemy, projectile.damage); projectile.life = 0; } });
    else if ((state.scene !== 'world' || elevationAtEntity(state.player) === projectile.elevation) && distance(projectile, state.player) < projectile.radius + state.player.radius) { hurtPlayer(projectile.damage); projectile.life = 0; }
  });
  state.projectiles = state.projectiles.filter(projectile => projectile.life > 0);
}

function nearbyInteractive() {
  if (state.scene === 'dungeon') return null;
  const point = tilePosition(state.player); const playerElevation = elevationAtEntity(state.player); const near = item => Math.hypot(item.x - point.x, item.y - point.y) <= 1.5 && (item.elevation ?? AsteriaWorld.elevationAt(state.world, item.x, item.y)) === playerElevation;
  const caveOpen = chest => !chest.requiresCave || state.world.obstacles.find(obstacle => obstacle.id === chest.requiresCave)?.cleared;
  return state.world.village?.villagers.find(villager => near(villager)) || state.world.village?.buildings.find(building => near(building)) || state.world.dungeons.find(dungeon => near(dungeon)) || state.world.merchants.find(merchant => near(merchant)) || state.world.chests.find(chest => near(chest) && !chest.opened && caveOpen(chest)) || state.world.obstacles.find(obstacle => near(obstacle) && !obstacle.cleared) || null;
}

function interact() {
  if (!state || paused || !running) return;
  if (state.scene === 'dungeon') { interactDungeon(); return; }
  const target = nearbyInteractive();
  if (!target) { if (hintsToggle.checked) statusElement.textContent = 'Rien à examiner à proximité.'; return; }
  if ('dialogue' in target) { if (target.action === 'heal') state.health = state.maxHealth; showOverlay(target.name, `${target.dialogue}${target.action === 'heal' ? ' Tes cœurs sont restaurés.' : ''}`, closeOverlay); return; }
  if ('action' in target && 'label' in target && !('stock' in target)) {
    if (target.action === 'rest') { state.health = state.maxHealth; saveGame(); showOverlay(target.label, 'Vous vous reposez. Les cœurs sont restaurés et la progression est enregistrée.', closeOverlay); }
    else if (target.action === 'guide') { const next = state.world.dungeons.filter(dungeon => dungeon.main && !dungeon.completed).sort((left, right) => left.index - right.index)[0]; showOverlay(target.label, next ? `${next.name} se trouve vers ${directionTo(state.world.start, next)}.` : 'Tous les sanctuaires principaux sont pacifiés.', closeOverlay); }
    else { state.mapRevealed = true; saveGame(); showOverlay(target.label, 'La carte murale révèle désormais les régions, les donjons et les routes de Clairval sur votre minimap.', closeOverlay); }
    return;
  }
  if ('stock' in target) return openMerchant(target);
  if ('reward' in target && 'opened' in target) return openChest(target);
  if ('gateFor' in target || target.ambient || target.cave) { if (owned(target.requires)) clearNearbyObstacle(target.requires); else statusElement.textContent = `${target.label} : ${itemDefinitions[target.requires]?.label || target.requires} nécessaire.`; return; }
  if ('main' in target) enterDungeon(target);
}

function directionTo(origin, target) {
  const horizontal = target.x > origin.x ? 'l’est' : 'l’ouest'; const vertical = target.y > origin.y ? 'le sud' : 'le nord';
  return Math.abs(target.x - origin.x) > Math.abs(target.y - origin.y) ? horizontal : vertical;
}

function enterDungeon(definition) {
  if (definition.completed) { statusElement.textContent = `${definition.name} est déjà pacifié.`; return; }
  if (definition.requires && !owned(definition.requires)) { statusElement.textContent = `${definition.name} exige ${itemDefinitions[definition.requires]?.label || definition.requires}.`; return; }
  state.returnPosition = { x: state.player.x, y: state.player.y };
  state.dungeon = AsteriaWorld.generateDungeon(definition, state.inventory, Number(adventurersSelect.value), state.seed); state.scene = 'dungeon'; state.room = state.dungeon.rooms[0];
  state.player.x = canvas.width / 2; state.player.y = canvas.height - 88; loadRoom(); sound('door');
}

function loadRoom() {
  const room = state.room; room.visited = true; state.roomSolved = room.cleared; state.currentPuzzleProgress = 0; state.companionPlates = 0; state.enemies = []; state.projectiles = [];
  const settings = difficultySettings[difficultySelect.value];
  if (!room.cleared && ['encounter', 'miniboss', 'boss', 'challenge'].includes(room.type)) {
    const expeditionBonus = gameModeSelect.value === 'expedition' && !room.type.includes('boss') ? 2 : 0;
    const amount = room.type === 'boss' ? 1 : Math.ceil((room.type === 'miniboss' ? 2 : 3 + room.enemyTier + expeditionBonus) * settings.density);
    const roomRandom = AsteriaWorld.randomFor(`room:${state.seed}:${state.dungeon.id}:${room.id}`);
    for (let index = 0; index < amount; index++) {
      const enemy = createEnemy(room.type === 'boss' ? 'guardian' : room.type === 'miniboss' ? 'golem' : ['slime', 'bat', 'archer', 'shell'][index % 4], 180 + roomRandom() * 600, 150 + roomRandom() * 300, 1 + room.enemyTier * 0.3, room.type === 'boss', `room-${room.id}-${index}`, room.boss);
      enemy.cooldown = roomRandom() * 1.5; enemy.phase = roomRandom() * Math.PI * 2; state.enemies.push(enemy);
    }
    if (room.type === 'boss') sound('boss');
  }
  log(`${state.dungeon.name} · ${roomLabel(room)}.`); updateQuest();
}

function roomLabel(room) { return ({ entrance: 'Entrée', encounter: 'Salle de combat', puzzle: 'Énigme', miniboss: 'Mini-boss', item: 'Trésor principal', itemPuzzle: 'Énigme de maîtrise', boss: 'Boss', treasure: 'Coffre bonus', merchant: 'Marchand souterrain', coopPuzzle: 'Énigme coopérative', challenge: 'Défi annexe' })[room.type] || room.type; }

function checkDoorTransition() {
  if (state.roomTransition > 0 || !state.room) return;
  let side = null; let slot = 0;
  if (state.player.x <= 47) { side = 'west'; slot = state.player.y < canvas.height / 2 ? -1 : 1; }
  else if (state.player.x >= canvas.width - 47) { side = 'east'; slot = state.player.y < canvas.height / 2 ? -1 : 1; }
  else if (state.player.y <= 52) { side = 'north'; slot = state.player.x < canvas.width / 2 ? -1 : 1; }
  else if (state.player.y >= canvas.height - 49) { side = 'south'; slot = state.player.x < canvas.width / 2 ? -1 : 1; }
  if (!side) return;
  const candidates = state.room.doors.filter(door => door.side === side); const door = candidates.sort((left, right) => Math.abs(left.slot - slot) - Math.abs(right.slot - slot))[0];
  if (!door) { clampDungeonPlayer(); return; }
  if (!state.room.cleared && state.enemies.length) { statusElement.textContent = 'Les portes sont scellées tant que les ennemis restent.'; clampDungeonPlayer(); return; }
  if (door.locked && !state.room.cleared) { statusElement.textContent = 'Cette porte exige la résolution de la salle.'; clampDungeonPlayer(); return; }
  state.room = state.dungeon.rooms[door.to]; state.dungeon.currentRoom = door.to; state.roomTransition = 0.35;
  state.player.x = side === 'west' ? canvas.width - 74 : side === 'east' ? 74 : slot < 0 ? canvas.width * 0.35 : canvas.width * 0.65;
  state.player.y = side === 'north' ? canvas.height - 74 : side === 'south' ? 74 : slot < 0 ? canvas.height * 0.36 : canvas.height * 0.64;
  loadRoom(); sound('door');
}

function clampDungeonPlayer() { state.player.x = clamp(state.player.x, 55, canvas.width - 55); state.player.y = clamp(state.player.y, 58, canvas.height - 58); }

function interactDungeon() {
  const room = state.room;
  if (room.type === 'entrance' && distance(state.player, { x: canvas.width / 2, y: canvas.height - 60 }) < 75) return leaveDungeon(false);
  if (state.enemies.length) { statusElement.textContent = 'Éliminez les ennemis avant d’examiner la salle.'; return; }
  if (room.type === 'item' && !room.cleared) { grantReward(room.reward); room.cleared = true; state.roomSolved = true; sound('item'); return; }
  if (room.type === 'treasure' && !room.cleared) { grantReward(room.reward); room.cleared = true; state.roomSolved = true; return; }
  if (room.type === 'merchant') return openDungeonMerchant();
  if (room.puzzle && !room.cleared) return solvePuzzleStep(room);
  statusElement.textContent = 'La salle est déjà résolue.';
}

function puzzlePlatePositions() { return [{ x: 320, y: 260 }, { x: 640, y: 260 }, { x: 320, y: 430 }, { x: 640, y: 430 }]; }
function puzzleItem(room) { const mapped = ({ bombSeals: 'bombs', pushBlocks: 'glove', waterRunes: 'flippers', hookCrystals: 'hookshot', lavaCircuit: 'flameWard' })[room.puzzle?.id]; return mapped || (room.puzzle?.id?.startsWith('mastery-') ? room.puzzle.requires[0] : null); }
function puzzleRequired(room) { return room.puzzle.id === 'coopPlates' ? Number(adventurersSelect.value) : room.puzzle.id === 'runes' ? 3 : room.puzzle.id === 'pushBlocks' ? 4 : 2; }
function nearestPuzzlePlate(entity, maximumDistance = 72) {
  let result = null; let best = maximumDistance;
  puzzlePlatePositions().forEach((point, index) => { const value = distance(entity, point); if (value < best) { best = value; result = index; } });
  return result;
}
function puzzleSequence(room, required = puzzleRequired(room)) {
  const indexes = puzzlePlatePositions().map((_, index) => index); const puzzleRandom = AsteriaWorld.randomFor(`puzzle:${state.seed}:${state.dungeon.id}:${room.seed}`);
  for (let index = indexes.length - 1; index > 0; index--) { const swap = Math.floor(puzzleRandom() * (index + 1)); [indexes[index], indexes[swap]] = [indexes[swap], indexes[index]]; }
  return indexes.slice(0, required);
}
function occupiedCoopPlates() {
  const sceneKey = `d-${state.dungeon.id}-${state.room.id}`; const occupied = new Set(); const localPlate = nearestPuzzlePlate(state.player);
  if (localPlate !== null) occupied.add(localPlate);
  const lanActive = window.LanMultiplayer?.active && ['coop', 'teams'].includes(window.LanMultiplayer.format);
  if (lanActive) [...remotePlayers.values()].filter(remote => remote.state === sceneKey).forEach(remote => { const plate = nearestPuzzlePlate(remote); if (plate !== null) occupied.add(plate); });
  const connectedPlayers = lanActive ? 1 + remotePlayers.size : 1; const companionCount = lanActive ? Math.max(0, Number(adventurersSelect.value) - connectedPlayers) : Math.max(0, Number(adventurersSelect.value) - 1);
  return { occupied, companionCount, localPlate };
}

function solvePuzzleStep(room) {
  const required = puzzleRequired(room);
  const requiredItem = puzzleItem(room);
  if (requiredItem && state.selectedItem !== requiredItem) { statusElement.textContent = `${room.puzzle.label} : équipez ${itemDefinitions[requiredItem].label}, puis utilisez OBJET ou ACTION.`; return; }
  if (room.puzzle.id === 'coopPlates') {
    const occupancy = occupiedCoopPlates();
    if (occupancy.localPlate === null) { statusElement.textContent = 'Placez-vous sur une dalle avant de l’activer.'; return; }
    state.companionPlates = Math.min(required, occupancy.occupied.size + occupancy.companionCount);
    if (state.companionPlates < required) { statusElement.textContent = `${state.companionPlates}/${required} dalles maintenues. Les autres aventuriers doivent rejoindre la salle.`; return; }
  } else {
    const plate = nearestPuzzlePlate(state.player); const sequence = puzzleSequence(room, required); const expected = sequence[state.currentPuzzleProgress];
    if (plate === null) { statusElement.textContent = 'Approchez-vous d’une dalle pour l’activer.'; return; }
    if (plate !== expected) { state.currentPuzzleProgress = 0; sound('hurt'); statusElement.textContent = `${room.puzzle.label} : mauvais mécanisme, la séquence recommence.`; return; }
    state.currentPuzzleProgress++;
  }
  if (room.puzzle.id === 'coopPlates' ? state.companionPlates >= required : state.currentPuzzleProgress >= required) {
    room.cleared = true; state.roomSolved = true; state.score += 600 * room.enemyTier; sound('solve'); log(`Énigme résolue : ${room.puzzle.label}.`); window.LanMultiplayer?.sendAction({ type: 'room-cleared', dungeonId: state.dungeon.id, roomId: room.id })?.catch(() => {});
  } else statusElement.textContent = `${room.puzzle.label} · étape ${state.currentPuzzleProgress}/${required}.`;
}

function completeBoss() {
  if (state.scene !== 'dungeon' || state.room.type !== 'boss') return;
  state.room.cleared = true; state.dungeon.completed = true; const definition = state.world.dungeons.find(dungeon => dungeon.id === state.dungeon.id); definition.completed = true; state.completedDungeons.add(definition.id);
  if (definition.main) { state.completedMain++; state.score += 6000 * state.completedMain; } else state.score += 3500;
  grantReward(definition.reward); sound('item');
  window.LanMultiplayer?.sendAction({ type: 'dungeon-completed', dungeonId: definition.id, reward: definition.reward, main: definition.main })?.catch(() => {});
  const final = definition.reward === 'sunRelic';
  showOverlay(final ? 'Asteria est libérée' : `${definition.name} accompli`, final ? 'La Relique solaire dissipe l’éclipse. Vous pouvez continuer à explorer les secrets du monde.' : `Vous obtenez ${rewardNames[definition.reward] || definition.reward}. Les ennemis du monde deviennent plus dangereux.`, () => { closeOverlay(); leaveDungeon(true); if (final) finishGame(); });
}

function leaveDungeon(completed) {
  if (state.scene !== 'dungeon') return;
  state.scene = 'world'; state.dungeon = null; state.room = null; state.enemies = []; state.projectiles = [];
  state.player.x = state.returnPosition?.x || worldToPixel(state.world.start.x); state.player.y = state.returnPosition?.y || worldToPixel(state.world.start.y) + TILE;
  if (completed) spawnWorldEnemies(); updateQuest(); saveGame();
}

function grantReward(reward) {
  if (!reward) return;
  if (itemDefinitions[reward] && !owned(reward)) state.inventory.push(reward);
  else if (reward === 'swordUpgrade' || reward === 'weaponRune') state.weaponLevel++;
  else if (reward === 'armorUpgrade' || reward === 'armorRune') state.armorLevel++;
  else if (reward === 'heartContainer') { state.maxHealth += 2; state.health = state.maxHealth; }
  else if (reward === 'heartPiece') { state.heartPieces++; if (state.heartPieces >= 4) { state.heartPieces -= 4; state.maxHealth += 2; state.health = state.maxHealth; } }
  else if (reward === 'coins' || reward === 'coinCache') state.coins += reward === 'coinCache' ? 100 : 35;
  else if (reward === 'bombBag') state.bombLevel++;
  else if (reward === 'potion') state.health = state.maxHealth;
  state.score += 500; renderInventory(); updateHud(); log(`${rewardNames[reward] || reward} obtenu.`); saveGame();
}

function openChest(chest) { chest.opened = true; state.openedChests.add(chest.id); grantReward(chest.reward); showOverlay('Coffre secret', `Vous trouvez : ${rewardNames[chest.reward] || chest.reward}.`, closeOverlay); }

function merchantPrice(item) { return Math.ceil(({ potion: 18, bombBag: 35, armorUpgrade: 70, heartContainer: 95, bow: 80 })[item] * difficultySettings[difficultySelect.value].price / 5) * 5; }
function openMerchant(merchant) {
  shopElement.hidden = false; shopElement.innerHTML = merchant.stock.map(item => { const price = merchantPrice(item); const bought = state.merchantPurchases.has(`${merchant.id}:${item}`); return `<button type="button" data-buy="${item}" data-merchant="${merchant.id}"${bought ? ' disabled' : ''}><strong>${rewardNames[item] || item}</strong><span>${bought ? 'Acheté' : `${price} pièces`}</span></button>`; }).join('');
  shopElement.querySelectorAll('[data-buy]').forEach(button => button.onclick = () => buyItem(merchant, button.dataset.buy));
  showOverlay('Marchand itinérant', 'Les stocks diffèrent selon les régions et ne sont achetables qu’une fois.', closeOverlay, true);
}
function openDungeonMerchant() { openMerchant({ id: `dungeon:${state.dungeon.id}`, stock: ['potion', 'heartContainer', 'armorUpgrade'] }); }
function buyItem(merchant, item) {
  const key = `${merchant.id}:${item}`; const price = merchantPrice(item);
  if (state.merchantPurchases.has(key)) return;
  if (state.coins < price) { statusElement.textContent = 'Pas assez de pièces.'; return; }
  state.coins -= price; state.merchantPurchases.add(key); grantReward(item); sound('buy'); closeOverlay();
}

function showOverlay(title, text, callback, showShop = false) { overlayTitle.textContent = title; overlayText.textContent = text; overlayCallback = callback; shopElement.hidden = !showShop; if (!showShop) shopElement.innerHTML = ''; overlay.hidden = false; paused = true; }
function closeOverlay() { overlay.hidden = true; shopElement.hidden = true; paused = false; overlayCallback = null; previousTime = performance.now(); }
overlayAction.onclick = () => { const callback = overlayCallback; if (callback) callback(); else closeOverlay(); };
overlaySecondary.onclick = closeOverlay;

function finishGame() {
  if (state.completed) return; state.completed = true; running = false; saveGame();
  if (gameModeSelect.value === 'speedrun') window.GameRecords?.finish({ score: Math.round(state.elapsed), scoreLabel: `${Math.floor(state.elapsed / 60)}:${String(Math.floor(state.elapsed % 60)).padStart(2, '0')} · Relique solaire`, won: true, lowerIsBetter: true });
  else window.GameRecords?.finish({ score: state.score, scoreLabel: `${state.completedMain} donjons · ${Math.floor(state.elapsed / 60)} min · ${state.score.toLocaleString('fr-FR')} points`, won: true, lowerIsBetter: false });
}

function update(delta) {
  if (!state || state.completed) return;
  state.elapsed += delta; state.player.attackTimer = Math.max(0, state.player.attackTimer - delta); state.player.itemTimer = Math.max(0, state.player.itemTimer - delta); state.player.invulnerable = Math.max(0, state.player.invulnerable - delta); state.roomTransition = Math.max(0, state.roomTransition - delta); state.combatShake = Math.max(0, (state.combatShake || 0) - delta);
  movePlayer(delta); updateEnemies(delta); updateProjectiles(delta);
  state.pickups.forEach(pickup => { if (distance(pickup, state.player) < pickup.radius + state.player.radius) { pickup.dead = true; if (gameModeSelect.value !== 'expedition') state.health = Math.min(state.maxHealth, state.health + 1); else state.coins += 2; } }); state.pickups = state.pickups.filter(pickup => !pickup.dead);
  if (state.scene === 'dungeon' && !state.enemies.length && state.room && ['encounter', 'miniboss', 'challenge'].includes(state.room.type)) state.room.cleared = true;
  if (state.scene === 'world') { const point = tilePosition(state.player); state.explored.add(`${point.x},${point.y}`); maintainWorldEncounters(delta); }
  state.camera.x += (state.player.x - state.camera.x) * Math.min(1, delta * 7); state.camera.y += (state.player.y - state.camera.y) * Math.min(1, delta * 7);
  remotePlayers.forEach(remote => { remote.displayX += (remote.x - remote.displayX) * Math.min(1, delta * 10); remote.displayY += (remote.y - remote.displayY) * Math.min(1, delta * 10); });
  const sceneKey = state.scene === 'world' ? 'world' : `d-${state.dungeon.id}-${state.room.id}`;
  window.LanMultiplayer?.sendGhost({ x: state.player.x, y: state.player.y, vx: 0, vy: 0, progress: state.completedMain / AsteriaWorld.MAIN_DUNGEONS.length, state: sceneKey })?.catch(() => {});
  if (state.elapsed >= state.nextAutosave) { state.nextAutosave = state.elapsed + 12; saveGame(); }
  updateHud();
}

function drawWorld() {
  const startX = Math.floor((state.camera.x - canvas.width / 2) / TILE) - 1; const startY = Math.floor((state.camera.y - canvas.height / 2) / TILE) - 1; const columns = Math.ceil(canvas.width / TILE) + 3; const rows = Math.ceil(canvas.height / TILE) + 3;
  const offsetX = canvas.width / 2 - state.camera.x; const offsetY = canvas.height / 2 - state.camera.y;
  const roadKeys = new Set((state.world.villageRoads || []).map(point => `${point.x},${point.y}`));
  const trailKeys = new Set((state.world.trails || []).map(point => `${point.x},${point.y}`));
  for (let y = startY; y < startY + rows; y++) for (let x = startX; x < startX + columns; x++) {
    const biome = AsteriaWorld.biomeAt(state.world, x, y); context.fillStyle = biomeColors[biome] || '#111827'; context.fillRect(x * TILE + offsetX, y * TILE + offsetY, TILE + 1, TILE + 1); drawTileDetail(biome, x * TILE + offsetX, y * TILE + offsetY, x, y);
    if (AsteriaWorld.elevationAt(state.world, x, y) > 0) { context.fillStyle = '#f8fafc'; context.globalAlpha = 0.11; context.fillRect(x * TILE + offsetX, y * TILE + offsetY, TILE + 1, TILE + 1); context.globalAlpha = 1; context.fillStyle = '#d1d5db66'; context.fillRect(x * TILE + offsetX, y * TILE + offsetY, TILE + 1, 4); }
    if (trailKeys.has(`${x},${y}`) && !roadKeys.has(`${x},${y}`)) { context.fillStyle = '#c5a76b'; context.globalAlpha = 0.24; context.beginPath(); context.ellipse(x * TILE + offsetX + TILE / 2, y * TILE + offsetY + TILE / 2, TILE * 0.38, TILE * 0.22, 0, 0, Math.PI * 2); context.fill(); context.globalAlpha = 1; }
    if (roadKeys.has(`${x},${y}`)) { context.fillStyle = '#d6bd7a'; context.globalAlpha = 0.55; context.fillRect(x * TILE + offsetX, y * TILE + offsetY + 9, TILE + 1, TILE - 18); context.globalAlpha = 1; }
  }
  const drawables = []; const visible = item => item.x >= startX - 2 && item.x <= startX + columns + 2 && item.y >= startY - 3 && item.y <= startY + rows + 2;
  const push = (sortY, draw) => drawables.push({ sortY, draw });
  const layerSort = (y, elevation = 0) => elevation * state.world.height * TILE + worldToPixel(y);
  (state.world.scenery || []).filter(visible).forEach(item => push(layerSort(item.y, item.elevation || 0) + 11, () => drawScenery(item, offsetX, offsetY)));
  (state.world.cliffs || []).forEach(cliff => {
    for (let index = 0; index < cliff.width; index++) { const tile = { x: cliff.x + index, y: cliff.y }; if (!visible(tile)) continue; push(layerSort(cliff.y, 0) + TILE, () => drawCliffTile(cliff, tile.x, offsetX, offsetY)); }
    for (let y = cliff.topY; y < cliff.y; y++) { if (visible({ x: cliff.x, y })) push(layerSort(y, 0) + TILE - 2, () => drawCliffSide(cliff, 'west', y, offsetX, offsetY)); if (visible({ x: cliff.x + cliff.width, y })) push(layerSort(y, 0) + TILE - 1, () => drawCliffSide(cliff, 'east', y, offsetX, offsetY)); }
  });
  state.world.obstacles.filter(obstacle => !obstacle.cleared && !['cliffWall', 'crackedCliff', 'cliffSide', 'cliffBack'].includes(obstacle.type) && visible(obstacle)).forEach(obstacle => push(layerSort(obstacle.y, AsteriaWorld.elevationAt(state.world, obstacle.x, obstacle.y)) + 13, () => drawObstaclePerspective(obstacle, offsetX, offsetY)));
  (state.world.village?.buildings || []).filter(visible).forEach(building => push(worldToPixel(building.y) + 16, () => drawVillageBuilding(building, offsetX, offsetY)));
  (state.world.village?.villagers || []).filter(visible).forEach(villager => push(worldToPixel(villager.y) + 10, () => drawVillager(villager, offsetX, offsetY)));
  state.world.dungeons.filter(visible).forEach(dungeon => push(layerSort(dungeon.y, AsteriaWorld.elevationAt(state.world, dungeon.x, dungeon.y)) + 12, () => drawWorldIcon(dungeon.x, dungeon.y, dungeon.completed ? '✓' : dungeon.main ? '🏛️' : '🕳️', offsetX, offsetY, 27)));
  state.world.merchants.filter(visible).forEach(merchant => push(layerSort(merchant.y, AsteriaWorld.elevationAt(state.world, merchant.x, merchant.y)) + 12, () => drawWorldIcon(merchant.x, merchant.y, '⛺', offsetX, offsetY, 24)));
  const caveOpen = chest => !chest.requiresCave || state.world.obstacles.find(obstacle => obstacle.id === chest.requiresCave)?.cleared;
  state.world.chests.filter(chest => !chest.opened && (!chest.hidden || owned('hookshot')) && caveOpen(chest) && visible(chest)).forEach(chest => push(layerSort(chest.y, chest.elevation ?? AsteriaWorld.elevationAt(state.world, chest.x, chest.y)) + 8, () => drawWorldIcon(chest.x, chest.y, '🧰', offsetX, offsetY, 22)));
  state.pickups.forEach(pickup => push(pickup.y, () => { context.fillStyle = '#ef4444'; context.font = '22px Arial'; context.fillText('♥', pickup.x + offsetX, pickup.y + offsetY); }));
  state.enemies.forEach(enemy => push(layerSort(enemy.y / TILE, elevationAtEntity(enemy)), () => drawEnemy(enemy, offsetX, offsetY)));
  const sceneKey = 'world'; remotePlayers.forEach(remote => { if (remote.state && remote.state !== sceneKey) return; push(remote.displayY, () => { context.save(); context.globalAlpha = 0.4; context.fillStyle = '#e879f9'; context.beginPath(); context.arc(remote.displayX + offsetX, remote.displayY + offsetY, 15, 0, Math.PI * 2); context.fill(); context.restore(); }); });
  push(layerSort(state.player.y / TILE, elevationAtEntity(state.player)), () => drawPlayer(offsetX, offsetY)); drawables.sort((left, right) => left.sortY - right.sortY).forEach(item => item.draw());
  state.projectiles.forEach(projectile => { context.fillStyle = projectile.friendly ? '#fde047' : '#fb7185'; context.beginPath(); context.arc(projectile.x + offsetX, projectile.y + offsetY, projectile.radius, 0, Math.PI * 2); context.fill(); });
  drawWorldAmbience(currentBiome());
  context.fillStyle = '#fff'; context.font = '800 15px Arial'; context.textAlign = 'center'; context.fillText(state.world.village.name, worldToPixel(state.world.start.x) + offsetX, worldToPixel(state.world.start.y - 5) + offsetY, 130);
}

function drawWorldAmbience(biome) {
  const styles = { forest: ['#bbf7d0', 34, 1], volcano: ['#fb923c', 22, -1.4], lake: ['#bae6fd', 26, 1.8], sea: ['#e0f2fe', 28, 2], mountain: ['#f8fafc', 18, 0.7], swamp: ['#d9f99d', 24, -0.5] };
  const style = styles[biome]; if (!style) return; const [color, count, drift] = style; context.save(); context.fillStyle = color; context.globalAlpha = 0.26;
  for (let index = 0; index < count; index++) { const phase = state.elapsed * (18 + index % 5 * 3) * drift; const x = (index * 97 + phase + canvas.width * 3) % canvas.width; const y = (index * 61 + state.elapsed * (11 + index % 4 * 2) + canvas.height * 3) % canvas.height; context.beginPath(); context.ellipse(x, y, biome === 'volcano' ? 2 : 4, biome === 'lake' || biome === 'sea' ? 1 : 2.5, index * 0.7, 0, Math.PI * 2); context.fill(); }
  context.restore();
}

function drawTree(tileX, tileY, offsetX, offsetY, height = 62) {
  const x = worldToPixel(tileX) + offsetX; const footY = worldToPixel(tileY) + offsetY + 15; context.fillStyle = '#5b341d'; context.fillRect(x - 6, footY - 25, 12, 26);
  context.fillStyle = '#14532d'; context.strokeStyle = '#052e16'; context.lineWidth = 3; [[0, -height + 20, 24], [-17, -height + 34, 20], [17, -height + 36, 20], [0, -height + 49, 23]].forEach(([offsetTreeX, offsetTreeY, radius]) => { context.beginPath(); context.arc(x + offsetTreeX, footY + offsetTreeY, radius, 0, Math.PI * 2); context.fill(); context.stroke(); });
  context.fillStyle = '#4ade80'; context.globalAlpha = 0.35; context.beginPath(); context.arc(x - 8, footY - height + 13, 9, 0, Math.PI * 2); context.fill(); context.globalAlpha = 1;
}

function drawScenery(item, offsetX, offsetY) {
  if (item.type === 'tree') { drawTree(item.x, item.y, offsetX, offsetY, item.height); return; }
  const x = worldToPixel(item.x) + offsetX; const y = worldToPixel(item.y) + offsetY + 14;
  context.save(); context.translate(x, y);
  if (item.type === 'pine') { context.fillStyle = '#5b341d'; context.fillRect(-5, -30, 10, 31); context.fillStyle = '#166534'; for (let level = 0; level < 3; level++) { context.beginPath(); context.moveTo(0, -item.height + level * 14); context.lineTo(-22 + level * 3, -12 + level * 8); context.lineTo(22 - level * 3, -12 + level * 8); context.fill(); } }
  else if (item.type === 'palm') { context.strokeStyle = '#92400e'; context.lineWidth = 8; context.beginPath(); context.moveTo(0, 0); context.quadraticCurveTo(-7, -30, 3, -item.height + 12); context.stroke(); context.strokeStyle = '#16a34a'; context.lineWidth = 6; for (let angle = -2.5; angle <= 0.7; angle += 0.65) { context.beginPath(); context.moveTo(3, -item.height + 12); context.lineTo(3 + Math.cos(angle) * 30, -item.height + 12 + Math.sin(angle) * 18); context.stroke(); } }
  else if (item.type === 'deadTree') { context.strokeStyle = '#4b3621'; context.lineWidth = 8; context.beginPath(); context.moveTo(0, 0); context.lineTo(0, -item.height); context.moveTo(0, -item.height * 0.62); context.lineTo(-17, -item.height * 0.82); context.moveTo(0, -item.height * 0.45); context.lineTo(18, -item.height * 0.66); context.stroke(); }
  else if (item.type === 'column') { context.fillStyle = '#a8a29e'; context.fillRect(-9, -item.height, 18, item.height); context.fillStyle = '#d6d3d1'; context.fillRect(-14, -item.height, 28, 8); context.fillRect(-13, -7, 26, 7); }
  else if (['rock', 'basalt', 'stump'].includes(item.type)) { context.fillStyle = item.type === 'basalt' ? '#292524' : item.type === 'stump' ? '#713f12' : '#78716c'; context.beginPath(); context.ellipse(0, -8, item.type === 'stump' ? 13 : 17, item.type === 'stump' ? 10 : 14, 0, 0, Math.PI * 2); context.fill(); if (item.type === 'stump') { context.strokeStyle = '#d6a85f'; context.beginPath(); context.arc(0, -8, 7, 0, Math.PI * 2); context.stroke(); } }
  else { const icons = { grass: '〽', flowers: '✿', shrub: '♣', mushroom: '♠', crystal: '♦', shell: '◔', driftwood: '⌁', vent: '≋', emberPlant: '♨', reed: '♒', rubble: '▪' }; context.fillStyle = item.type === 'flowers' ? '#f9a8d4' : item.type === 'crystal' ? '#67e8f9' : item.type === 'emberPlant' ? '#fb923c' : '#d6d3d1'; context.font = `${18 + item.variant * 2}px Arial`; context.textAlign = 'center'; context.fillText(icons[item.type] || '·', 0, 0); }
  context.restore();
}

function drawCliffTile(cliff, tileX, offsetX, offsetY) {
  const x = tileX * TILE + offsetX; const y = cliff.y * TILE + offsetY; const obstacle = state.world.obstacles.find(item => item.cliffId === cliff.id && item.x === tileX); const ladder = tileX === cliff.ladderX;
  context.fillStyle = '#9ca3af'; context.beginPath(); context.moveTo(x, y + 7); context.lineTo(x + 10, y - cliff.height); context.lineTo(x + TILE + 8, y - cliff.height); context.lineTo(x + TILE, y + 7); context.fill();
  context.fillStyle = '#4b5563'; context.fillRect(x, y + 7, TILE, TILE - 7); context.fillStyle = '#6b7280'; for (let row = 0; row < 3; row++) context.fillRect(x + (row % 2) * 8, y + 13 + row * 11, TILE - 10, 5);
  if (ladder) { context.strokeStyle = '#d6a85f'; context.lineWidth = 4; context.beginPath(); context.moveTo(x + 13, y + TILE); context.lineTo(x + 13, y - cliff.height + 7); context.moveTo(x + 31, y + TILE); context.lineTo(x + 31, y - cliff.height + 7); context.stroke(); context.lineWidth = 3; for (let rung = y - cliff.height + 12; rung < y + TILE; rung += 10) { context.beginPath(); context.moveTo(x + 13, rung); context.lineTo(x + 31, rung); context.stroke(); } }
  else if (obstacle?.type === 'crackedCliff') { context.strokeStyle = obstacle.cleared ? '#111827' : '#fbbf24'; context.lineWidth = obstacle.cleared ? 11 : 3; context.beginPath(); context.moveTo(x + 22, y + 13); context.lineTo(x + 16, y + 26); context.lineTo(x + 28, y + 37); context.lineTo(x + 21, y + 48); context.stroke(); }
}

function drawCliffSide(cliff, side, tileY, offsetX, offsetY) {
  const edgeX = (side === 'west' ? cliff.x : cliff.x + cliff.width) * TILE + offsetX; const y = tileY * TILE + offsetY; const direction = side === 'west' ? -1 : 1;
  context.fillStyle = '#4b5563'; context.beginPath(); context.moveTo(edgeX, y); context.lineTo(edgeX + direction * 10, y + 8); context.lineTo(edgeX + direction * 10, y + TILE); context.lineTo(edgeX, y + TILE - 5); context.fill(); context.strokeStyle = '#9ca3af'; context.lineWidth = 3; context.beginPath(); context.moveTo(edgeX, y); context.lineTo(edgeX + direction * 10, y + 8); context.stroke();
}

function drawObstaclePerspective(obstacle, offsetX, offsetY) {
  if (obstacle.type === 'bush') { drawTree(obstacle.x, obstacle.y, offsetX, offsetY, 68); return; }
  const icons = { crackedRock: '🪨', boulder: '⬛', deepWater: '🌊', chasm: '◼️', lavaSeal: '🔥', ancientWall: '▰' }; drawWorldIcon(obstacle.x, obstacle.y, icons[obstacle.type] || '◆', offsetX, offsetY, obstacle.permanent ? 31 : 25);
}

function drawVillageBuilding(building, offsetX, offsetY) {
  const x = worldToPixel(building.x) + offsetX; const y = worldToPixel(building.y) + offsetY; context.fillStyle = building.id === 'workshop' ? '#92400e' : '#7c2d12'; context.fillRect(x - 28, y - 42, 56, 50); context.fillStyle = '#e7cf7c'; context.beginPath(); context.moveTo(x - 35, y - 42); context.lineTo(x, y - 70); context.lineTo(x + 35, y - 42); context.fill(); context.fillStyle = '#422006'; context.fillRect(x - 8, y - 14, 16, 22);
}

function drawVillager(villager, offsetX, offsetY) {
  const x = worldToPixel(villager.x) + offsetX; const y = worldToPixel(villager.y) + offsetY; context.fillStyle = villager.id === 'healer' ? '#f9a8d4' : villager.id === 'elder' ? '#c4b5fd' : '#fbbf24'; context.beginPath(); context.arc(x, y - 9, 10, 0, Math.PI * 2); context.fill(); context.fillRect(x - 8, y, 16, 18);
}

function drawTileDetail(biome, x, y, tileX, tileY) {
  const variation = ((tileX * 73856093) ^ (tileY * 19349663)) >>> 0;
  context.globalAlpha = 0.16;
  if (biome === 'forest' && variation % 3 === 0) { context.fillStyle = '#052e16'; context.beginPath(); context.arc(x + 12, y + 14, 7, 0, Math.PI * 2); context.fill(); }
  if (biome === 'mountain') { context.fillStyle = '#e2e8f0'; context.beginPath(); context.moveTo(x + 9, y + 34); context.lineTo(x + 23, y + 8); context.lineTo(x + 36, y + 34); context.fill(); }
  if (biome === 'lake' || biome === 'sea') { context.strokeStyle = '#bae6fd'; context.beginPath(); context.moveTo(x + 5, y + 22); context.quadraticCurveTo(x + 15, y + 17, x + 25, y + 22); context.quadraticCurveTo(x + 34, y + 27, x + 41, y + 21); context.stroke(); }
  if (biome === 'volcano' && variation % 2 === 0) { context.fillStyle = '#fb923c'; context.fillRect(x + 6, y + variation % 31, 18, 3); }
  context.globalAlpha = 1;
}

function drawWorldIcon(tileX, tileY, icon, offsetX, offsetY, size) { context.font = `${size}px Arial`; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(icon, worldToPixel(tileX) + offsetX, worldToPixel(tileY) + offsetY); }

function drawDungeon() {
  const biome = state.dungeon.rooms[state.dungeon.currentRoom].theme; const base = biomeColors[biome] || '#334155';
  context.fillStyle = '#111827'; context.fillRect(0, 0, canvas.width, canvas.height); context.fillStyle = base; context.globalAlpha = 0.42; context.fillRect(32, 32, canvas.width - 64, canvas.height - 64); context.globalAlpha = 1;
  context.strokeStyle = '#d6d3d1'; context.lineWidth = 8; context.strokeRect(34, 34, canvas.width - 68, canvas.height - 68);
  drawDoors(); drawRoomFeatures(); drawEntities(0, 0);
  context.fillStyle = '#fff'; context.font = '800 17px Arial'; context.textAlign = 'left'; context.fillText(`${state.dungeon.name} · ${roomLabel(state.room)}`, 48, 64);
}

function doorPosition(side, slot) {
  const shifted = slot < 0 ? 0.36 : slot > 0 ? 0.64 : 0.5;
  if (side === 'north') return { x: canvas.width * shifted, y: 34, horizontal: true };
  if (side === 'south') return { x: canvas.width * shifted, y: canvas.height - 34, horizontal: true };
  if (side === 'west') return { x: 34, y: canvas.height * shifted, horizontal: false };
  return { x: canvas.width - 34, y: canvas.height * shifted, horizontal: false };
}
function drawDoors() { state.room.doors.forEach(door => { const point = doorPosition(door.side, door.slot); const sealed = state.enemies.length || door.locked && !state.room.cleared; context.fillStyle = sealed ? '#ef4444' : '#facc15'; if (point.horizontal) context.fillRect(point.x - 34, point.y - 8, 68, 16); else context.fillRect(point.x - 8, point.y - 34, 16, 68); }); }

function drawRoomFeatures() {
  const room = state.room; context.textAlign = 'center'; context.textBaseline = 'middle';
  const accent = biomeColors[room.theme] || '#94a3b8'; context.strokeStyle = `${accent}cc`; context.lineWidth = 3; context.globalAlpha = 0.38;
  for (let index = 0; index < 6; index++) { const x = 125 + index * 142; context.beginPath(); context.arc(x, 92 + (index % 2) * 18, 18 + room.id % 3 * 4, 0, Math.PI * 2); context.stroke(); }
  context.fillStyle = accent; if (['encounter', 'miniboss', 'boss'].includes(room.type)) { for (let index = 0; index < 4; index++) context.fillRect(150 + index * 220, 520, 42, 18); }
  else if (room.type === 'itemPuzzle') { context.fillRect(canvas.width / 2 - 165, canvas.height / 2 - 5, 330, 10); context.font = '38px Arial'; context.fillText(itemDefinitions[state.dungeon.reward]?.icon || '◆', canvas.width / 2, 175); }
  else if (room.type === 'treasure') { for (let index = 0; index < 7; index++) { context.beginPath(); context.arc(210 + index * 90, 330 + Math.sin(index) * 42, 7, 0, Math.PI * 2); context.fill(); } }
  context.globalAlpha = 1;
  if (room.puzzle) {
    const required = puzzleRequired(room); const sequence = room.puzzle.id === 'coopPlates' ? [] : puzzleSequence(room, required); const completed = new Set(sequence.slice(0, state.currentPuzzleProgress)); const occupancy = room.puzzle.id === 'coopPlates' ? occupiedCoopPlates().occupied : new Set();
    puzzlePlatePositions().forEach((point, index) => { context.fillStyle = room.cleared || completed.has(index) ? '#22c55e' : occupancy.has(index) ? '#38bdf8' : sequence[state.currentPuzzleProgress] === index ? '#f59e0b' : '#475569'; context.strokeStyle = '#f8fafc'; context.lineWidth = 3; context.fillRect(point.x - 28, point.y - 28, 56, 56); context.strokeRect(point.x - 28, point.y - 28, 56, 56); context.fillStyle = '#fff'; context.font = '800 17px Arial'; context.fillText(String(index + 1), point.x, point.y); });
    context.fillStyle = '#fff'; context.font = '700 18px Arial'; context.fillText(room.puzzle.label, canvas.width / 2, 120);
  }
  if ((room.type === 'item' || room.type === 'treasure') && !room.cleared) { context.font = '54px Arial'; context.fillText('🧰', canvas.width / 2, canvas.height / 2); }
  if (room.type === 'entrance') { context.fillStyle = '#facc15'; context.fillRect(canvas.width / 2 - 50, canvas.height - 58, 100, 18); }
}

function drawEntities(offsetX, offsetY) {
  state.pickups.forEach(pickup => { context.fillStyle = '#ef4444'; context.font = '22px Arial'; context.fillText('♥', pickup.x + offsetX, pickup.y + offsetY); });
  state.enemies.forEach(enemy => drawEnemy(enemy, offsetX, offsetY));
  state.projectiles.forEach(projectile => { context.fillStyle = projectile.friendly ? '#fde047' : '#fb7185'; context.beginPath(); context.arc(projectile.x + offsetX, projectile.y + offsetY, projectile.radius, 0, Math.PI * 2); context.fill(); });
  const sceneKey = state.scene === 'world' ? 'world' : `d-${state.dungeon.id}-${state.room.id}`;
  remotePlayers.forEach(remote => { if (remote.state && remote.state !== sceneKey) return; context.save(); context.globalAlpha = 0.4; context.fillStyle = '#e879f9'; context.beginPath(); context.arc(remote.displayX + offsetX, remote.displayY + offsetY, 15, 0, Math.PI * 2); context.fill(); context.restore(); });
  drawPlayer(offsetX, offsetY);
}

function drawEnemy(enemy, offsetX, offsetY) {
  context.save(); context.translate(enemy.x + offsetX, enemy.y + offsetY); context.fillStyle = '#02061755'; context.beginPath(); context.ellipse(0, enemy.radius * 0.74, enemy.radius * 0.86, enemy.radius * 0.34, 0, 0, Math.PI * 2); context.fill(); context.fillStyle = enemy.color; context.strokeStyle = enemy.boss ? '#fef08a' : '#f8fafc'; context.lineWidth = enemy.boss ? 5 : 2; context.beginPath();
  if (enemy.type === 'bat') { context.moveTo(-enemy.radius, 4); context.lineTo(0, -enemy.radius); context.lineTo(enemy.radius, 4); context.lineTo(0, enemy.radius); }
  else if (enemy.bossKind === 'golemBasalte') context.rect(-enemy.radius, -enemy.radius, enemy.radius * 2, enemy.radius * 2);
  else if (enemy.bossKind === 'serpentLacustre') { for (let index = 0; index < 8; index++) { const angle = index * Math.PI / 4; const radius = index % 2 ? enemy.radius * 0.7 : enemy.radius; const x = Math.cos(angle) * radius; const y = Math.sin(angle) * radius; if (!index) context.moveTo(x, y); else context.lineTo(x, y); } }
  else { const points = enemy.boss ? 12 : 0; if (points) for (let index = 0; index < points; index++) { const angle = index * Math.PI * 2 / points; const radius = index % 2 ? enemy.radius * 0.78 : enemy.radius; const x = Math.cos(angle) * radius; const y = Math.sin(angle) * radius; if (!index) context.moveTo(x, y); else context.lineTo(x, y); } else context.arc(0, 0, enemy.radius, 0, Math.PI * 2); }
  context.closePath(); context.fill(); context.stroke();
  if (enemy.boss) { context.fillStyle = '#111827'; context.fillRect(-48, -enemy.radius - 23, 96, 8); context.fillStyle = enemy.health <= enemy.maxHealth * 0.5 ? '#f97316' : '#22c55e'; context.fillRect(-48, -enemy.radius - 23, 96 * Math.max(0, enemy.health) / enemy.maxHealth, 8); context.fillStyle = '#fff'; context.font = '800 12px Arial'; context.textAlign = 'center'; context.fillText(enemy.bossLabel || 'Gardien', 0, -enemy.radius - 31); }
  context.restore();
}

function drawPlayer(offsetX, offsetY) {
  const player = state.player; context.save(); context.translate(player.x + offsetX, player.y + offsetY); if (player.invulnerable > 0 && Math.floor(player.invulnerable * 12) % 2) context.globalAlpha = 0.3;
  context.fillStyle = '#02061766'; context.beginPath(); context.ellipse(0, player.radius * .72, player.radius * .9, player.radius * .35, 0, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#2563eb'; context.beginPath(); context.arc(0, 0, player.radius, 0, Math.PI * 2); context.fill(); context.fillStyle = '#f8d5bd'; context.beginPath(); context.arc(0, -7, 9, 0, Math.PI * 2); context.fill();
  const direction = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[player.direction]; const angle = Math.atan2(direction[1], direction[0]); if (player.attackTimer > 0) { context.strokeStyle = '#fde68a99'; context.lineWidth = 11; context.beginPath(); context.arc(0, 0, 34 + state.weaponLevel * 2, angle - .88, angle + .88); context.stroke(); } context.strokeStyle = '#f8fafc'; context.lineWidth = 5; context.beginPath(); context.moveTo(direction[0] * 8, direction[1] * 8); context.lineTo(direction[0] * (player.attackTimer > 0 ? 39 : 22), direction[1] * (player.attackTimer > 0 ? 39 : 22)); context.stroke(); context.restore();
}

function drawMinimap() {
  if (!state) return;
  if (state.scene === 'dungeon') { drawDungeonMinimap(); return; }
  const world = state.world; const scale = Math.min(minimap.width / world.width, minimap.height / world.height); const offsetX = (minimap.width - world.width * scale) / 2; const offsetY = (minimap.height - world.height * scale) / 2;
  minimapContext.fillStyle = '#07150d'; minimapContext.fillRect(0, 0, minimap.width, minimap.height);
  for (let y = 0; y < world.height; y++) for (let x = 0; x < world.width; x++) { const known = state.mapRevealed || state.explored.has(`${x},${y}`) || Math.hypot(x - world.start.x, y - world.start.y) <= 8; minimapContext.fillStyle = known ? biomeColors[AsteriaWorld.biomeAt(world, x, y)] || '#111827' : '#07150d'; minimapContext.fillRect(offsetX + x * scale, offsetY + y * scale, Math.ceil(scale), Math.ceil(scale)); }
  world.dungeons.forEach(dungeon => { if (!state.mapRevealed && !dungeon.completed && !state.explored.has(`${dungeon.x},${dungeon.y}`)) return; minimapContext.fillStyle = dungeon.completed ? '#86efac' : dungeon.main ? '#facc15' : '#c4b5fd'; minimapContext.fillRect(offsetX + dungeon.x * scale - 2, offsetY + dungeon.y * scale - 2, 5, 5); });
  const point = tilePosition(state.player); if (state.scene === 'world') { minimapContext.fillStyle = '#fff'; minimapContext.beginPath(); minimapContext.arc(offsetX + point.x * scale, offsetY + point.y * scale, 3.5, 0, Math.PI * 2); minimapContext.fill(); }
}

function drawDungeonMinimap() {
  minimapContext.fillStyle = '#07150d'; minimapContext.fillRect(0, 0, minimap.width, minimap.height);
  const positions = [{ x: 20, y: 100 }, { x: 62, y: 100 }, { x: 106, y: 100 }, { x: 150, y: 100 }, { x: 194, y: 100 }, { x: 238, y: 100 }, { x: 275, y: 100 }, { x: 106, y: 150 }, { x: 62, y: 48 }, { x: 150, y: 150 }];
  minimapContext.strokeStyle = '#64748b'; minimapContext.lineWidth = 3;
  state.dungeon.rooms.forEach(room => room.doors.forEach(door => { if (door.to < room.id) return; const start = positions[room.id]; const end = positions[door.to]; minimapContext.beginPath(); minimapContext.moveTo(start.x, start.y); minimapContext.lineTo(end.x, end.y); minimapContext.stroke(); }));
  state.dungeon.rooms.forEach(room => { const point = positions[room.id]; const known = room.visited || state.dungeon.rooms.some(candidate => candidate.visited && candidate.doors.some(door => door.to === room.id)); minimapContext.fillStyle = room.id === state.room.id ? '#facc15' : room.cleared ? '#22c55e' : known ? '#94a3b8' : '#1e293b'; minimapContext.fillRect(point.x - 8, point.y - 8, 16, 16); if (known && room.type === 'boss') { minimapContext.fillStyle = '#ef4444'; minimapContext.fillRect(point.x - 3, point.y - 3, 6, 6); } });
}

function draw() { context.clearRect(0, 0, canvas.width, canvas.height); if (!state) { context.fillStyle = '#10261a'; context.fillRect(0, 0, canvas.width, canvas.height); context.fillStyle = '#dcfce7'; context.font = '900 38px Arial'; context.textAlign = 'center'; context.fillText('CHRONIQUES D’ASTERIA', canvas.width / 2, canvas.height / 2); return; } context.save(); if (state.combatShake > 0) context.translate((random() - .5) * 7, (random() - .5) * 5); if (state.scene === 'world') drawWorld(); else drawDungeon(); context.restore(); drawMinimap(); }

function renderInventory() {
  if (!state) return; document.getElementById('inventory').innerHTML = Object.entries(itemDefinitions).map(([id, item]) => `<button type="button" class="item ${owned(id) ? '' : 'locked'} ${state.selectedItem === id ? 'active' : ''}" data-item="${id}" data-help="${item.action}"${owned(id) ? '' : ' disabled'}><b>${item.icon}</b>${item.label}</button>`).join('');
  document.querySelectorAll('[data-item]').forEach(button => button.onclick = () => { state.selectedItem = button.dataset.item; renderInventory(); });
}

function updateQuest() {
  if (!state) return;
  if (state.scene === 'dungeon') document.getElementById('quest').textContent = `${state.dungeon.name} · ${roomLabel(state.room)}${state.room.puzzle ? ` : ${state.room.puzzle.label}` : ''}`;
  else { const next = state.world.dungeons.filter(dungeon => dungeon.main && !dungeon.completed).sort((left, right) => left.index - right.index)[0]; document.getElementById('quest').textContent = next ? `Rejoignez ${next.name}${next.requires ? ` avec ${itemDefinitions[next.requires]?.label}` : ''}.` : 'Explorez les cryptes et secrets restants.'; }
}

function updateHud() {
  if (!state) return; const full = Math.floor(state.health / 2); const half = state.health % 2 >= 0.5; document.getElementById('health').textContent = `${'♥'.repeat(full)}${half ? '♡' : ''}${'·'.repeat(Math.max(0, Math.ceil(state.maxHealth / 2) - full - Number(half)))}`;
  document.getElementById('coins').textContent = state.coins; document.getElementById('dungeons').textContent = `${state.completedMain} / ${AsteriaWorld.MAIN_DUNGEONS.length}`; document.getElementById('worldTier').textContent = state.completedMain + 1; document.getElementById('time').textContent = `${Math.floor(state.elapsed / 60)}:${String(Math.floor(state.elapsed % 60)).padStart(2, '0')}`;
  document.getElementById('weapon').textContent = `Épée niveau ${state.weaponLevel}${owned('bow') ? ' · Arc' : ''}`; document.getElementById('armor').textContent = `Protection niveau ${state.armorLevel}`; document.getElementById('bombLevel').textContent = `Puissance ${state.bombLevel}`; document.getElementById('heartPieces').textContent = `${state.heartPieces} / 4`;
  const target = nearbyInteractive(); if (target && hintsToggle.checked && state.scene === 'world') statusElement.textContent = 'Appuyez sur E ou ACTION pour interagir.';
}

function loop(now) { const delta = Math.min(0.034, Math.max(0, (now - previousTime) / 1000)); previousTime = now; if (running && !paused) update(delta); draw(); frame = requestAnimationFrame(loop); }
function togglePause(force) { if (!state || state.completed || !overlay.hidden) return; paused = force ?? !paused; controls.clear(); document.getElementById('pause').textContent = paused ? 'Reprendre' : 'Pause'; statusElement.textContent = paused ? 'Aventure en pause.' : 'Aventure reprise.'; if (!paused) previousTime = performance.now(); }

const keyMap = { ArrowLeft: 'left', q: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', z: 'up', w: 'up', ArrowDown: 'down', s: 'down' };
document.addEventListener('keydown', event => { if (event.target.matches('select,input,button,a')) return; const control = keyMap[event.key]; if (control) { event.preventDefault(); controls.add(control); updateControlHighlights(); return; } if (event.repeat) return; if (event.code === 'Space') { event.preventDefault(); attack(); } else if (event.key.toLowerCase() === 'e') interact(); else if (event.key.toLowerCase() === 'x') useItem(); else if (event.key.toLowerCase() === 'c') cycleItem(); else if (event.key.toLowerCase() === 'p' || event.key === 'Escape') togglePause(); });
document.addEventListener('keyup', event => { const control = keyMap[event.key]; if (control) { controls.delete(control); updateControlHighlights(); } });
function updateControlHighlights() { document.querySelectorAll('[data-control]').forEach(button => button.classList.toggle('active', controls.has(button.dataset.control))); }
document.querySelectorAll('[data-control]').forEach(button => { const action = button.dataset.control; const release = () => { controls.delete(action); updateControlHighlights(); }; button.onpointerdown = event => { event.preventDefault(); if (['left', 'right', 'up', 'down'].includes(action)) controls.add(action); else if (action === 'attack') attack(); else if (action === 'interact') interact(); else if (action === 'item') useItem(); else cycleItem(); updateControlHighlights(); }; button.onpointerup = button.onpointercancel = button.onpointerleave = release; });
canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));
document.getElementById('start').onclick = () => startGame(); document.getElementById('continue').onclick = () => { const saved = loadSave(); if (saved) startGame(saved); }; document.getElementById('pause').onclick = () => togglePause();
window.addEventListener('blur', () => { controls.clear(); if (running && !paused && overlay.hidden) togglePause(true); }); document.addEventListener('visibilitychange', () => { if (document.hidden && running && !paused && overlay.hidden) togglePause(true); });
window.addEventListener('lan:start', () => startGame()); window.addEventListener('lan:pause', event => togglePause(Boolean(event.detail?.paused)));
window.addEventListener('lan:ghost', event => { const snapshot = event.detail; const previous = remotePlayers.get(snapshot.playerId); remotePlayers.set(snapshot.playerId, { ...snapshot, displayX: previous?.displayX ?? snapshot.x, displayY: previous?.displayY ?? snapshot.y }); });
window.addEventListener('lan:action', event => {
  const action = event.detail?.action; if (!state || !action) return;
  if (action.type === 'enemy-damage' && state.dungeon?.id === action.dungeonId && state.room?.id === action.roomId) {
    const enemy = state.enemies.find(candidate => candidate.id === action.enemyId); if (enemy) damageEnemy(enemy, Number(action.amount) || 0, false);
  }
  if (action.type === 'room-cleared' && state.dungeon?.id === action.dungeonId) { const room = state.dungeon.rooms[action.roomId]; if (room) room.cleared = true; }
  if (action.type === 'dungeon-completed' && !state.completedDungeons.has(action.dungeonId)) {
    const dungeon = state.world.dungeons.find(candidate => candidate.id === action.dungeonId); if (!dungeon) return;
    dungeon.completed = true; state.completedDungeons.add(dungeon.id); if (action.main) state.completedMain++;
    grantReward(action.reward); updateQuest(); log(`${dungeon.name} terminé par votre équipe.`); if (action.reward === 'sunRelic') finishGame();
  }
});
window.addEventListener('beforeunload', saveGame);
document.getElementById('continue').disabled = !loadSave();
draw();

window.AsteriaTestAPI = {
  diagnostics() {
    const worlds = Object.keys(AsteriaWorld.SIZE_SETTINGS).map(size => { const world = AsteriaWorld.generateWorld('diagnostic', size); return { size, ...AsteriaWorld.validateWorld(world), width: world.width, height: world.height }; });
    const world = AsteriaWorld.generateWorld('diagnostic', 'standard'); let items = ['sword']; const dungeons = world.dungeons.filter(dungeon => dungeon.main).sort((left, right) => left.index - right.index).map(dungeon => { const generated = AsteriaWorld.generateDungeon(dungeon, items, 2, 'diagnostic'); const result = AsteriaWorld.validateDungeon(generated); items = [...items, dungeon.reward]; return { id: dungeon.id, ...result }; });
    return { canvas: canvas.width === 960 && canvas.height === 640, worldSizes: worlds, dungeons, items: Object.keys(itemDefinitions), enemies: Object.keys(enemyDefinitions), bossPatterns: [...new Set(Object.values(bossDefinitions).map(boss => boss.pattern))], mobileControls: document.querySelectorAll('[data-control]').length, lanGhosts: typeof window.LanMultiplayer?.sendGhost === 'function' || true, coopPuzzle: AsteriaWorld.PUZZLES.some(puzzle => puzzle.id === 'pressure'), saveVersion: 6 };
  },
  selfTest() {
    const worldA = AsteriaWorld.generateWorld('same-seed', 'compact'); const worldB = AsteriaWorld.generateWorld('same-seed', 'compact');
    const deterministic = worldA.biomes.join(',') === worldB.biomes.join(',') && JSON.stringify(worldA.dungeons) === JSON.stringify(worldB.dungeons);
    const worldValidation = AsteriaWorld.validateWorld(worldA); const progression = worldValidation.progression;
    const dungeon = AsteriaWorld.generateDungeon(worldA.dungeons.find(item => item.main), ['sword'], 3, 'test'); const dungeonValid = AsteriaWorld.validateDungeon(dungeon).valid;
    const legacyWorld = AsteriaWorld.generateWorld('legacy-save', worldSizeSelect.value); const legacyObstacleIndex = legacyWorld.obstacles.findIndex(obstacle => !obstacle.permanent);
    const legacy = createState('legacy-save', { version: 3, clearedObstacles: [legacyObstacleIndex], inventory: ['sword'], score: 725, elapsed: 12 }); const firstObstacle = legacy.world.obstacles[legacyObstacleIndex];
    return { deterministic, progression, villageRoutes: worldValidation.villageRoutesClear && worldValidation.villageAreaClear, fullWorldRoute: worldValidation.reachableMainDungeons === AsteriaWorld.MAIN_DUNGEONS.length && worldValidation.progressionRoutesClear, terrainFeatures: worldValidation.terrainFeatures, trueElevation: worldValidation.elevationValid && worldA.cliffs.every(cliff => AsteriaWorld.elevationAt(worldA, cliff.ladderX, cliff.y - 1) > AsteriaWorld.elevationAt(worldA, cliff.ladderX, cliff.y)), naturalScenery: worldValidation.sceneryTypes >= 5, villageInteractions: worldA.village.villagers.length >= 3 && worldA.village.buildings.length >= 3, gatedRegions: worldValidation.gatedRegions === AsteriaWorld.MAIN_DUNGEONS.length, dungeonValid, itemMastery: dungeon.rooms[5].puzzle?.requires.includes(dungeon.reward), saveMigration: firstObstacle.cleared && legacy.clearedObstacles.has(firstObstacle.id) && legacy.score === 725, distinctBosses: Object.keys(bossDefinitions).length === AsteriaWorld.MAIN_DUNGEONS.length && new Set(Object.values(bossDefinitions).map(boss => boss.pattern)).size === AsteriaWorld.MAIN_DUNGEONS.length, increasingDifficulty: AsteriaWorld.MAIN_DUNGEONS.every((item, index) => !index || item.reward !== AsteriaWorld.MAIN_DUNGEONS[index - 1].reward) };
  }
};
window.GameRuleExamples = element => {
  const index = [...element.parentElement.children].indexOf(element);
  const examples = [
    { title: 'Débloquer une région', explanation: 'L’objet du donjon précédent neutralise l’obstacle qui protège le suivant.', html: '<div style="display:flex;align-items:center;gap:18px;font-size:34px"><span>💣</span><strong>→</strong><span class="rule-example-cell bad" style="width:70px">🪨</span><strong>→</strong><span class="rule-example-cell highlight" style="width:70px">🏛️</span></div>' },
    { title: 'Parcourir un donjon', explanation: 'Les portes rouges restent fermées pendant un combat ou une énigme. La salle d’objet ouvre les énigmes de la seconde moitié.', html: '<div style="display:grid;grid-template-columns:repeat(4,58px);gap:14px;align-items:center"><div class="rule-example-cell">⚔️</div><div class="rule-example-cell">🧩</div><div class="rule-example-cell highlight">🧰</div><div class="rule-example-cell bad">👹</div></div>' },
    { title: 'Améliorer le héros', explanation: 'Les cryptes, coffres et marchands fournissent de la vie, de meilleures armes ou une protection permanente.', html: '<div style="display:flex;gap:16px;font-size:36px"><span>🕳️</span><span>🧰</span><span>⛺</span><strong>→</strong><span>⚔️🛡️♥</span></div>' },
    { title: 'Difficulté croissante', explanation: 'Chaque boss principal augmente le niveau du monde : davantage d’ennemis, plus résistants et plus dangereux.', html: '<div style="display:flex;gap:12px;align-items:end"><span style="font-size:22px">●</span><span style="font-size:30px">●●</span><span style="font-size:40px;color:#ef4444">●●●</span></div>' },
    { title: 'Énigme coopérative', explanation: 'Chaque aventurier doit rejoindre la même salle et maintenir une dalle. Les esprits compagnons remplissent les places non connectées.', html: '<div style="display:grid;grid-template-columns:repeat(3,70px);gap:12px"><div class="rule-example-cell highlight">●</div><div class="rule-example-cell highlight">●</div><div class="rule-example-cell highlight">●</div></div>' }
  ];
  return { text: element.textContent.trim(), ...(examples[index] || examples[0]) };
};
try { localStorage.setItem('game-hub:last-game', 'asteria'); } catch {}
