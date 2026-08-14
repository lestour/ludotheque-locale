'use strict';

const canvas = document.getElementById('screen');
const context = canvas.getContext('2d');
const difficultySelect = document.getElementById('difficulty');
const gameModeSelect = document.getElementById('gameMode');
const shipClassSelect = document.getElementById('shipClass');
const fireModeSelect = document.getElementById('fireMode');
const soundEnabled = document.getElementById('soundEnabled');
const statusElement = document.getElementById('status');
const upgradeOverlay = document.getElementById('upgradeOverlay');
const upgradeChoices = document.getElementById('upgradeChoices');
const messageOverlay = document.getElementById('messageOverlay');
const eventLog = document.getElementById('eventLog');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const pressed = new Set();
const hudCache = new Map();
const difficultySettings = {
  easy: { health: 0.78, speed: 0.82, fire: 0.72, damage: 0.72, score: 0.82, drop: 1.28 },
  normal: { health: 1, speed: 1, fire: 1, damage: 1, score: 1, drop: 1 },
  hard: { health: 1.32, speed: 1.18, fire: 1.25, damage: 1.25, score: 1.45, drop: 0.88 },
  extreme: { health: 1.72, speed: 1.42, fire: 1.58, damage: 1.58, score: 2.05, drop: 0.76 }
};
const enemyDefinitions = {
  scout: { name: 'Éclaireur', health: 20, speed: 66, radius: 14, color: '#38bdf8', score: 80, cooldown: 2.3, attack: 'direct' },
  bomber: { name: 'Bombardier', health: 42, speed: 42, radius: 18, color: '#fb923c', score: 150, cooldown: 3.8, attack: 'bomb' },
  bubbler: { name: 'Méduse', health: 34, speed: 48, radius: 18, color: '#c084fc', score: 140, cooldown: 3.1, attack: 'bubble' },
  laser: { name: 'Prisme', health: 48, speed: 38, radius: 19, color: '#f43f5e', score: 190, cooldown: 5.1, attack: 'laser' },
  hunter: { name: 'Chasseur', health: 40, speed: 58, radius: 17, color: '#22c55e', score: 180, cooldown: 4.2, attack: 'missile' },
  gunner: { name: 'Artilleur', health: 52, speed: 45, radius: 19, color: '#facc15', score: 210, cooldown: 3.5, attack: 'spread' },
  tank: { name: 'Cuirassé', health: 105, speed: 27, radius: 23, color: '#94a3b8', score: 320, cooldown: 2.8, attack: 'cross' },
  boss: { name: 'Noyau ennemi', health: 900, speed: 25, radius: 52, color: '#ef4444', score: 3000, cooldown: 1.5, attack: 'boss' }
};
const movementPatterns = ['sweep', 'sine', 'zigzag', 'orbit', 'dive', 'convoy'];
const formationPatterns = ['grid', 'wedge', 'ring', 'columns', 'swarm', 'pincer'];
const projectileTypes = ['direct', 'bomb', 'bubble', 'laser', 'missile', 'diagonal', 'horizontal'];
const shipClasses = {
  balanced: { label: 'Polyvalent', health: 100, shield: 50, damage: 12, fireInterval: 0.21, shots: 1, spread: 0.14, speed: 320, dashInterval: 3.4 },
  interceptor: { label: 'Intercepteur', health: 82, shield: 38, damage: 10, fireInterval: 0.15, shots: 1, spread: 0.12, speed: 410, dashInterval: 2.35 },
  fortress: { label: 'Forteresse', health: 155, shield: 92, damage: 13, fireInterval: 0.27, shots: 1, spread: 0.14, speed: 255, dashInterval: 4.1 },
  artillery: { label: 'Artillerie', health: 95, shield: 44, damage: 18, fireInterval: 0.34, shots: 2, spread: 0.11, speed: 282, dashInterval: 3.7 }
};

const upgrades = [
  { id: 'damage', title: 'Canons renforcés', description: '+25 % de dégâts permanents.', eligible: player => player.damage < 90, apply: player => { player.damage *= 1.25; } },
  { id: 'rate', title: 'Refroidissement', description: '+18 % de cadence de tir.', eligible: player => player.fireInterval > 0.075, apply: player => { player.fireInterval *= 0.82; } },
  { id: 'multishot', title: 'Canons latéraux', description: 'Ajoute un projectile à chaque salve.', eligible: player => player.shots < 5, apply: player => { player.shots++; } },
  { id: 'spread', title: 'Convergence', description: 'Réduit l’écart des tirs multiples.', eligible: player => player.spread > 0.055, apply: player => { player.spread *= 0.82; } },
  { id: 'pierce', title: 'Munitions perforantes', description: 'Les tirs traversent un ennemi supplémentaire.', eligible: player => player.pierce < 3, apply: player => { player.pierce++; } },
  { id: 'health', title: 'Blindage', description: '+25 coque maximale et réparation immédiate.', eligible: player => player.maxHealth < 240, apply: player => { player.maxHealth += 25; player.health = Math.min(player.maxHealth, player.health + 25); } },
  { id: 'shield', title: 'Condensateur', description: '+30 bouclier maximal et recharge immédiate.', eligible: player => player.maxShield < 180, apply: player => { player.maxShield += 30; player.shield = Math.min(player.maxShield, player.shield + 30); } },
  { id: 'speed', title: 'Propulseurs', description: '+12 % de vitesse de déplacement.', eligible: player => player.speed < 520, apply: player => { player.speed *= 1.12; } },
  { id: 'magnet', title: 'Champ magnétique', description: 'Attire les bonus depuis une distance supérieure.', eligible: player => player.magnet < 230, apply: player => { player.magnet += 55; } },
  { id: 'drone', title: 'Drone d’escorte', description: 'Ajoute un drone qui tire avec vous.', eligible: player => player.drones < 2, apply: player => { player.drones++; } },
  { id: 'critical', title: 'Viseur quantique', description: '+8 % de chance de doubler les dégâts.', eligible: player => player.critical < 0.4, apply: player => { player.critical += 0.08; } },
  { id: 'dash', title: 'Distorsion', description: 'Réduit de 20 % le délai du dash.', eligible: player => player.dashInterval > 1.1, apply: player => { player.dashInterval *= 0.8; } }
];

let state = null;
let running = false;
let paused = false;
let animationFrame = 0;
let lastTime = 0;
let audioContext = null;
const remoteGhosts = new Map();
let pointerActive = false;

function range(length) { return Array.from({ length }, (_, index) => index); }
function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
function distance(first, second) { return Math.hypot(first.x - second.x, first.y - second.y); }
function difficulty() { return difficultySettings[difficultySelect.value]; }
function random() { return state?.random?.() ?? Math.random(); }
function shuffle(values) {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [output[index], output[other]] = [output[other], output[index]];
  }
  return output;
}
function setText(id, value) {
  const text = String(value);
  if (hudCache.get(id) === text) return;
  hudCache.set(id, text);
  document.getElementById(id).textContent = text;
}
function setMeter(id, percentage) {
  const value = `${clamp(percentage, 0, 100).toFixed(1)}%`;
  if (hudCache.get(id) === value) return;
  hudCache.set(id, value);
  document.getElementById(id).style.width = value;
}

function sound(kind, intensity = 1) {
  if (!soundEnabled.checked) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;
    const settings = {
      shoot: ['square', 540, 0.035, 0.025], enemy: ['sawtooth', 170, 0.05, 0.07], explosion: ['sawtooth', 75, 0.11, 0.13],
      hit: ['square', 105, 0.09, 0.12], pickup: ['sine', 740, 0.08, 0.09], level: ['triangle', 980, 0.14, 0.17], dash: ['sawtooth', 310, 0.05, 0.08]
    }[kind] || ['sine', 300, 0.05, 0.08];
    oscillator.type = settings[0];
    oscillator.frequency.setValueAtTime(settings[1], now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, settings[1] * (kind === 'explosion' ? 0.35 : 1.25)), now + settings[3]);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.min(0.16, settings[2] * intensity), now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + settings[3]);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + settings[3] + 0.02);
  } catch {}
}

function makePlayer() {
  const player = {
    x: WIDTH / 2, y: HEIGHT - 58, radius: 16, health: 100, maxHealth: 100, shield: 25, maxShield: 50,
    damage: 12, fireInterval: 0.21, fireCooldown: 0, shots: 1, spread: 0.14, pierce: 0, speed: 320,
    level: 1, experience: 0, nextExperience: 100, pendingLevels: 0, dashInterval: 3.4, dashCooldown: 0,
    dashTimer: 0, invulnerability: 0, magnet: 65, drones: 0, critical: 0.05, rapidTimer: 0, powerTimer: 0,
    bonusShots: 0, special: 0, maxSpecial: 100, shipClass: 'balanced', lastDirection: { x: 0, y: -1 }
  };
  const classId = shipClasses[shipClassSelect?.value] ? shipClassSelect.value : 'balanced';
  const selected = shipClasses[classId];
  player.shipClass = classId;
  player.health = player.maxHealth = selected.health;
  player.shield = player.maxShield = selected.shield;
  Object.assign(player, { damage: selected.damage, fireInterval: selected.fireInterval, shots: selected.shots, spread: selected.spread, speed: selected.speed, dashInterval: selected.dashInterval });
  return player;
}

function createState(seed) {
  const seeded = window.GameRuntime?.createRandom(seed) || Math.random;
  return {
    random: seeded, player: makePlayer(), enemies: [], playerBullets: [], enemyBullets: [], lasers: [], explosions: [],
    pickups: [], particles: [], stars: range(110).map(() => ({ x: seeded() * WIDTH, y: seeded() * HEIGHT, speed: 12 + seeded() * 48, size: 0.5 + seeded() * 1.8 })),
    wave: 0, waveActive: false, spawnQueue: [], betweenWaves: 0.6, score: 0, combo: 0, comboTimer: 0,
    elapsed: 0, kills: 0, bosses: 0, shots: 0, hits: 0, shake: 0, completed: false, upgrading: false,
    log: 'Préparation de la première vague…', hudTimer: 0, wavePattern: '', movementPattern: ''
  };
}

function startGame() {
  cancelAnimationFrame(animationFrame);
  const seed = new URLSearchParams(location.search).get('seed') || `${Date.now()}:${Math.random()}`;
  state = createState(`stellar:${seed}:${difficultySelect.value}:${gameModeSelect.value}`);
  pressed.clear();
  running = true;
  paused = false;
  upgradeOverlay.hidden = true;
  messageOverlay.hidden = true;
  statusElement.textContent = 'Lancement de la première vague.';
  window.GameRecords?.reset();
  lastTime = performance.now();
  updateHud(true);
  animationFrame = requestAnimationFrame(loop);
}

function wavePlan(wave, mode = gameModeSelect.value) {
  const boss = mode === 'bossRush' || wave % 5 === 0;
  const unlocked = ['scout'];
  if (wave >= 2) unlocked.push('bomber');
  if (wave >= 3) unlocked.push('bubbler');
  if (wave >= 4) unlocked.push('gunner');
  if (wave >= 5) unlocked.push('laser');
  if (wave >= 6) unlocked.push('hunter');
  if (wave >= 8) unlocked.push('tank');
  return {
    boss,
    count: boss ? 1 + Math.min(8, Math.floor(wave / 3)) : Math.min(34, 7 + wave * 2),
    types: unlocked,
    formation: formationPatterns[(wave * 3 + Math.floor(random() * formationPatterns.length)) % formationPatterns.length],
    movement: movementPatterns[(wave * 5 + Math.floor(random() * movementPatterns.length)) % movementPatterns.length]
  };
}

function formationPositions(pattern, count) {
  const positions = [];
  if (pattern === 'grid') {
    const columns = Math.min(9, Math.ceil(Math.sqrt(count * 1.7)));
    for (let index = 0; index < count; index++) positions.push({ x: WIDTH / 2 + (index % columns - (columns - 1) / 2) * 78, y: 95 + Math.floor(index / columns) * 60 });
  } else if (pattern === 'wedge') {
    for (let index = 0; index < count; index++) {
      const row = Math.floor(Math.sqrt(index));
      const position = index - row * row;
      positions.push({ x: WIDTH / 2 + (position - row) * 66, y: 80 + row * 58 });
    }
  } else if (pattern === 'ring') {
    for (let index = 0; index < count; index++) {
      const angle = index / count * Math.PI * 2;
      positions.push({ x: WIDTH / 2 + Math.cos(angle) * Math.min(300, 120 + count * 7), y: 180 + Math.sin(angle) * 95 });
    }
  } else if (pattern === 'columns') {
    for (let index = 0; index < count; index++) positions.push({ x: 130 + index % 5 * 175, y: 75 + Math.floor(index / 5) * 54 });
  } else if (pattern === 'pincer') {
    for (let index = 0; index < count; index++) {
      const side = index % 2 ? 1 : -1;
      positions.push({ x: WIDTH / 2 + side * (120 + Math.floor(index / 2) * 42), y: 90 + Math.floor(index / 4) * 58 });
    }
  } else {
    for (let index = 0; index < count; index++) positions.push({ x: 85 + random() * (WIDTH - 170), y: 65 + random() * 190 });
  }
  return positions.map(position => ({ x: clamp(position.x, 55, WIDTH - 55), y: clamp(position.y, 55, 310) }));
}

function spawnWave() {
  state.wave++;
  const mode = gameModeSelect.value;
  const campaignLimit = 15;
  if (mode === 'campaign' && state.wave > campaignLimit) return finishGame(true, 'Secteur libéré', `Vous avez survécu aux ${campaignLimit} vagues de la campagne.`);
  const plan = wavePlan(state.wave, mode);
  state.wavePattern = plan.formation;
  state.movementPattern = plan.movement;
  const positions = plan.boss ? [{ x: WIDTH / 2, y: 125 }] : formationPositions(plan.formation, plan.count);
  state.spawnQueue = [];
  if (plan.boss) {
    state.spawnQueue.push({ delay: 0.4, type: 'boss', position: positions[0], movement: state.wave % 10 === 0 ? 'orbit' : 'sweep' });
    const escorts = Math.min(8, 2 + Math.floor(state.wave / 3));
    formationPositions('wedge', escorts).forEach((position, index) => state.spawnQueue.push({ delay: 1.2 + index * 0.13, type: plan.types[index % plan.types.length], position, movement: plan.movement }));
    state.log = `BOSS · ${enemyDefinitions.boss.name} · attaques combinées`;
    sound('level');
  } else {
    positions.forEach((position, index) => {
      const progressionBias = Math.min(plan.types.length - 1, Math.floor(random() * (1 + plan.types.length * 0.8)));
      state.spawnQueue.push({ delay: 0.12 + index * 0.065, type: plan.types[progressionBias], position, movement: plan.movement });
    });
    state.log = `Vague ${state.wave} · formation ${plan.formation} · mouvement ${plan.movement}`;
  }
  state.waveActive = true;
  eventLog.textContent = state.log;
  statusElement.textContent = plan.boss ? `Alerte boss — vague ${state.wave}` : `Vague ${state.wave} en approche.`;
}

function createEnemy(type, position, movement) {
  const definition = enemyDefinitions[type];
  const waveHealth = 1 + Math.max(0, state.wave - 1) * (type === 'boss' ? 0.1 : 0.075);
  const health = definition.health * waveHealth * difficulty().health;
  return {
    type, x: position.x, y: -70 - random() * 120, targetX: position.x, targetY: position.y, baseX: position.x, baseY: position.y,
    radius: definition.radius, health, maxHealth: health, speed: definition.speed * difficulty().speed * (1 + state.wave * 0.018),
    cooldown: definition.cooldown * (0.55 + random() * 0.75) / difficulty().fire, age: 0, phase: random() * Math.PI * 2,
    movement, entered: false, flash: 0, diving: false, dead: false
  };
}

function spawnEnemyProjectile(enemy, type = enemyDefinitions[enemy.type].attack) {
  const player = state.player;
  const damage = (enemy.type === 'boss' ? 18 : 10) * difficulty().damage * (1 + state.wave * 0.025);
  if (type === 'direct') {
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    state.enemyBullets.push({ type: 'direct', x: enemy.x, y: enemy.y, vx: Math.cos(angle) * 190, vy: Math.sin(angle) * 190, radius: 5, damage, life: 6 });
  } else if (type === 'bomb') {
    state.enemyBullets.push({ type: 'bomb', x: enemy.x, y: enemy.y, vx: 0, vy: 82, radius: 10, damage: damage * 1.45, timer: 1.75, life: 5 });
  } else if (type === 'bubble') {
    state.enemyBullets.push({ type: 'bubble', x: enemy.x, y: enemy.y, vx: (random() - 0.5) * 120, vy: 70, radius: 13, damage: damage * 0.82, turn: 0.35, life: 8 });
  } else if (type === 'laser') {
    state.lasers.push({ x: player.x, sourceY: enemy.y, width: enemy.type === 'boss' ? 36 : 22, charge: enemy.type === 'boss' ? 0.68 : 1.05, duration: 0.48, damage: damage * 1.4, hit: false });
  } else if (type === 'missile') {
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    state.enemyBullets.push({ type: 'missile', x: enemy.x, y: enemy.y, vx: Math.cos(angle) * 105, vy: Math.sin(angle) * 105, radius: 8, damage: damage * 1.25, life: 7, speed: 145 });
  } else if (type === 'spread') {
    [-0.62, -0.3, 0, 0.3, 0.62].forEach(offset => state.enemyBullets.push({ type: 'diagonal', x: enemy.x, y: enemy.y, vx: Math.sin(offset) * 205, vy: Math.cos(offset) * 205, radius: 5, damage: damage * 0.72, life: 5 }));
  } else if (type === 'cross') {
    const fromLeft = random() < 0.5;
    state.enemyBullets.push({ type: 'horizontal', x: fromLeft ? -12 : WIDTH + 12, y: clamp(player.y + (random() - 0.5) * 100, 350, HEIGHT - 25), vx: fromLeft ? 270 : -270, vy: 0, radius: 7, damage, life: 5 });
    spawnEnemyProjectile(enemy, random() < 0.5 ? 'direct' : 'spread');
  }
  sound('enemy', 0.55);
}

function bossAttack(enemy) {
  const phase = Math.floor(enemy.age / 2.4) % 5;
  if (phase === 0) {
    range(12).forEach(index => {
      const angle = index / 12 * Math.PI * 2 + enemy.age;
      state.enemyBullets.push({ type: 'diagonal', x: enemy.x, y: enemy.y, vx: Math.cos(angle) * 150, vy: Math.sin(angle) * 150, radius: 6, damage: 10 * difficulty().damage, life: 7 });
    });
  } else if (phase === 1) {
    spawnEnemyProjectile(enemy, 'laser');
    state.lasers.push({ x: clamp(state.player.x - 140, 30, WIDTH - 30), sourceY: enemy.y, width: 25, charge: 0.82, duration: 0.55, damage: 20 * difficulty().damage, hit: false });
    state.lasers.push({ x: clamp(state.player.x + 140, 30, WIDTH - 30), sourceY: enemy.y, width: 25, charge: 0.82, duration: 0.55, damage: 20 * difficulty().damage, hit: false });
  } else if (phase === 2) {
    range(3).forEach(() => spawnEnemyProjectile(enemy, 'missile'));
  } else if (phase === 3) {
    range(3).forEach(index => state.enemyBullets.push({ type: 'bomb', x: enemy.x + (index - 1) * 70, y: enemy.y, vx: 0, vy: 72, radius: 11, damage: 22 * difficulty().damage, timer: 1.55 + index * 0.18, life: 5 }));
  } else {
    spawnEnemyProjectile(enemy, 'spread');
    spawnEnemyProjectile(enemy, 'bubble');
  }
  sound('enemy', 0.8);
}

function updateEnemy(enemy, delta) {
  enemy.age += delta;
  enemy.flash = Math.max(0, enemy.flash - delta);
  if (!enemy.entered) {
    enemy.y += Math.max(90, enemy.speed * 2.1) * delta;
    enemy.x += (enemy.targetX - enemy.x) * Math.min(1, delta * 3.5);
    if (enemy.y >= enemy.targetY) { enemy.y = enemy.targetY; enemy.entered = true; enemy.baseX = enemy.x; enemy.baseY = enemy.y; }
    return;
  }
  const amplitude = enemy.type === 'boss' ? 250 : 65 + Math.min(80, state.wave * 3);
  if (enemy.movement === 'sweep') enemy.x = enemy.baseX + Math.sin(enemy.age * 0.85 + enemy.phase) * amplitude;
  else if (enemy.movement === 'sine') { enemy.x = enemy.baseX + Math.sin(enemy.age * 1.8 + enemy.phase) * amplitude; enemy.y = enemy.baseY + Math.sin(enemy.age * 0.8 + enemy.phase) * 24; }
  else if (enemy.movement === 'zigzag') enemy.x += Math.sign(Math.sin(enemy.age * 2.3 + enemy.phase)) * enemy.speed * delta;
  else if (enemy.movement === 'orbit') { enemy.x = WIDTH / 2 + Math.cos(enemy.age * 0.58 + enemy.phase) * amplitude; enemy.y = 165 + Math.sin(enemy.age * 0.9 + enemy.phase) * 80; }
  else if (enemy.movement === 'convoy') { enemy.x += Math.sin(enemy.age * 1.1 + enemy.phase) * 35 * delta; enemy.y += Math.max(2, state.wave * 0.32) * delta; }
  else if (enemy.movement === 'dive' && enemy.age > 3.2 + enemy.phase % 2.5) {
    enemy.diving = true;
    enemy.y += enemy.speed * 1.9 * delta;
    enemy.x += Math.sign(state.player.x - enemy.x) * enemy.speed * 0.42 * delta;
  }
  enemy.x = clamp(enemy.x, enemy.radius + 4, WIDTH - enemy.radius - 4);
  enemy.cooldown -= delta;
  if (enemy.cooldown <= 0 && enemy.y > 15 && enemy.y < HEIGHT - 150) {
    if (enemy.type === 'boss') bossAttack(enemy);
    else spawnEnemyProjectile(enemy);
    const definition = enemyDefinitions[enemy.type];
    enemy.cooldown = definition.cooldown * (0.65 + random() * 0.75) / difficulty().fire / (1 + state.wave * 0.018);
  }
  if (enemy.y > HEIGHT + 60) {
    enemy.dead = true;
    damagePlayer(18 * difficulty().damage, enemy.x, HEIGHT - 20);
  }
}

function firePlayer() {
  const player = state.player;
  if (player.fireCooldown > 0) return;
  const shots = player.shots + player.bonusShots;
  const damageMultiplier = player.powerTimer > 0 ? 1.65 : 1;
  for (let index = 0; index < shots; index++) {
    const offset = index - (shots - 1) / 2;
    const angle = -Math.PI / 2 + offset * player.spread;
    const critical = random() < player.critical;
    state.playerBullets.push({ x: player.x + offset * 7, y: player.y - 20, vx: Math.cos(angle) * 620, vy: Math.sin(angle) * 620, radius: critical ? 5 : 4, damage: player.damage * damageMultiplier * (critical ? 2 : 1), pierce: player.pierce, critical });
  }
  range(player.drones).forEach(index => {
    const side = index ? 1 : -1;
    state.playerBullets.push({ x: player.x + side * 34, y: player.y - 5, vx: side * 30, vy: -560, radius: 3, damage: player.damage * 0.52, pierce: 0 });
  });
  state.shots += shots;
  player.fireCooldown = player.fireInterval * (player.rapidTimer > 0 ? 0.48 : 1);
  sound('shoot', 0.5);
}

function addParticles(x, y, color, amount = 10, speed = 150) {
  for (let index = 0; index < amount; index++) {
    const angle = random() * Math.PI * 2;
    const velocity = speed * (0.3 + random() * 0.8);
    state.particles.push({ x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity, life: 0.3 + random() * 0.7, maxLife: 1, color, size: 1 + random() * 4 });
  }
}

function gainExperience(amount) {
  const player = state.player;
  player.experience += amount;
  while (player.experience >= player.nextExperience) {
    player.experience -= player.nextExperience;
    player.level++;
    player.nextExperience = Math.round(player.nextExperience * 1.24 + 18);
    player.pendingLevels++;
  }
  if (player.pendingLevels && !state.upgrading) openUpgrade();
}

function dropPickup(enemy) {
  const guaranteed = enemy.type === 'boss';
  if (!guaranteed && random() > 0.13 * difficulty().drop) return;
  const types = enemy.type === 'boss' ? ['heal', 'shield', 'rapid', 'power', 'multi', 'core'] : ['heal', 'shield', 'rapid', 'power', 'multi', 'core', 'core'];
  const type = types[Math.floor(random() * types.length)];
  state.pickups.push({ type, x: enemy.x, y: enemy.y, vy: 72, radius: 11, life: 10, phase: random() * Math.PI * 2 });
}

function destroyEnemy(enemy) {
  if (enemy.dead) return;
  enemy.dead = true;
  const definition = enemyDefinitions[enemy.type];
  const multiplier = 1 + Math.min(3, state.combo * 0.045);
  state.score += Math.round(definition.score * difficulty().score * (1 + state.wave * 0.055) * multiplier);
  state.combo++;
  state.comboTimer = 4.2;
  state.kills++;
  state.player.special = Math.min(state.player.maxSpecial, state.player.special + (enemy.type === 'boss' ? 38 : Math.min(9, 2 + definition.score / 60)));
  if (enemy.type === 'boss') state.bosses++;
  gainExperience(definition.score * 0.13 + state.wave * 2);
  dropPickup(enemy);
  addParticles(enemy.x, enemy.y, definition.color, enemy.type === 'boss' ? 65 : 14, enemy.type === 'boss' ? 280 : 160);
  state.shake = Math.max(state.shake, enemy.type === 'boss' ? 16 : 5);
  sound('explosion', enemy.type === 'boss' ? 1.25 : 0.65);
}

function damagePlayer(amount, sourceX, sourceY) {
  const player = state.player;
  if (player.invulnerability > 0 || state.completed) return;
  let remaining = amount;
  if (player.shield > 0) {
    const absorbed = Math.min(player.shield, remaining);
    player.shield -= absorbed;
    remaining -= absorbed;
  }
  player.health -= remaining;
  player.invulnerability = 0.7;
  state.combo = 0;
  state.comboTimer = 0;
  state.shake = Math.max(state.shake, 11);
  addParticles(sourceX ?? player.x, sourceY ?? player.y, '#fb7185', 18, 190);
  sound('hit');
  if (player.health <= 0) finishGame(false, 'Vaisseau détruit', `Vous avez atteint la vague ${state.wave} avec ${Math.floor(state.score).toLocaleString('fr-FR')} points.`);
}

function collectPickup(pickup) {
  const player = state.player;
  if (pickup.type === 'heal') player.health = Math.min(player.maxHealth, player.health + 28);
  else if (pickup.type === 'shield') player.shield = Math.min(player.maxShield, player.shield + 38);
  else if (pickup.type === 'rapid') player.rapidTimer = Math.max(player.rapidTimer, 9);
  else if (pickup.type === 'power') player.powerTimer = Math.max(player.powerTimer, 9);
  else if (pickup.type === 'multi') { player.bonusShots = 2; pickup.bonusDuration = true; }
  else gainExperience(45 + state.wave * 5);
  if (pickup.type === 'multi') player.multiTimer = Math.max(player.multiTimer || 0, 9);
  pickup.dead = true;
  state.score += Math.round(60 * difficulty().score);
  addParticles(pickup.x, pickup.y, pickupColor(pickup.type), 12, 110);
  eventLog.textContent = `Bonus récupéré : ${pickupName(pickup.type)}.`;
  sound('pickup');
}

function pickupName(type) { return ({ heal: 'réparation', shield: 'bouclier', rapid: 'tir rapide', power: 'surcharge', multi: 'multi-tir', core: 'noyau d’expérience' })[type]; }
function pickupColor(type) { return ({ heal: '#4ade80', shield: '#38bdf8', rapid: '#facc15', power: '#fb7185', multi: '#c084fc', core: '#a78bfa' })[type]; }

function openUpgrade() {
  const player = state.player;
  const eligible = shuffle(upgrades.filter(upgrade => upgrade.eligible(player))).slice(0, 3);
  if (!eligible.length) { player.pendingLevels = 0; return; }
  state.upgrading = true;
  running = false;
  upgradeChoices.replaceChildren(...eligible.map(upgrade => {
    const button = document.createElement('button');
    button.className = 'upgrade-choice';
    button.innerHTML = `<strong>${upgrade.title}</strong><span>${upgrade.description}</span>`;
    button.onclick = () => {
      upgrade.apply(player);
      player.pendingLevels--;
      state.upgrading = false;
      upgradeOverlay.hidden = true;
      eventLog.textContent = `Amélioration installée : ${upgrade.title}.`;
      sound('level');
      if (player.pendingLevels > 0) openUpgrade();
      else if (!state.completed) { running = true; lastTime = performance.now(); animationFrame = requestAnimationFrame(loop); }
      updateHud(true);
    };
    return button;
  }));
  upgradeOverlay.hidden = false;
  statusElement.textContent = `Niveau ${player.level} : choisissez une amélioration.`;
  sound('level');
}

function finishGame(won, title, text) {
  if (!state || state.completed) return;
  state.completed = true;
  running = false;
  paused = false;
  pressed.clear();
  document.getElementById('messageTitle').textContent = title;
  document.getElementById('messageText').textContent = text;
  messageOverlay.hidden = false;
  statusElement.textContent = title;
  window.GameRecords?.finish({ score: Math.floor(state.score), scoreLabel: `${Math.floor(state.score).toLocaleString('fr-FR')} points · vague ${state.wave}`, won, wave: state.wave, level: state.player.level, kills: state.kills });
  draw();
}

function updatePlayer(delta) {
  const player = state.player;
  const horizontal = (pressed.has('ArrowRight') ? 1 : 0) - (pressed.has('ArrowLeft') ? 1 : 0);
  const vertical = (pressed.has('ArrowDown') ? 1 : 0) - (pressed.has('ArrowUp') ? 1 : 0);
  const length = Math.hypot(horizontal, vertical) || 1;
  if (horizontal || vertical) player.lastDirection = { x: horizontal / length, y: vertical / length };
  const dashMultiplier = player.dashTimer > 0 ? 3.4 : 1;
  player.x = clamp(player.x + horizontal / length * player.speed * dashMultiplier * delta, 22, WIDTH - 22);
  player.y = clamp(player.y + vertical / length * player.speed * dashMultiplier * delta, HEIGHT * 0.42, HEIGHT - 24);
  player.fireCooldown = Math.max(0, player.fireCooldown - delta);
  player.dashCooldown = Math.max(0, player.dashCooldown - delta);
  player.dashTimer = Math.max(0, player.dashTimer - delta);
  player.invulnerability = Math.max(0, player.invulnerability - delta);
  player.rapidTimer = Math.max(0, player.rapidTimer - delta);
  player.powerTimer = Math.max(0, player.powerTimer - delta);
  player.multiTimer = Math.max(0, (player.multiTimer || 0) - delta);
  if (!player.multiTimer) player.bonusShots = 0;
  if (fireModeSelect.value === 'auto' || pressed.has('fire')) firePlayer();
}

function activateDash() {
  if (!state || !running || state.player.dashCooldown > 0) return;
  const player = state.player;
  player.dashTimer = 0.2;
  player.invulnerability = Math.max(player.invulnerability, 0.28);
  player.dashCooldown = player.dashInterval;
  addParticles(player.x, player.y, '#67e8f9', 16, 220);
  sound('dash');
}

function activateSpecial() {
  if (!state || !running || state.player.special < state.player.maxSpecial) return;
  const player = state.player;
  player.special = 0;
  state.enemyBullets.length = 0;
  state.lasers.length = 0;
  state.explosions.length = 0;
  [...state.enemies].forEach(enemy => {
    enemy.health -= enemy.type === 'boss' ? Math.max(220, enemy.maxHealth * 0.28) : Math.max(90, enemy.maxHealth);
    enemy.flash = 0.2;
    if (enemy.health <= 0) destroyEnemy(enemy);
  });
  addParticles(player.x, player.y, '#fef08a', 80, 430);
  state.shake = Math.max(state.shake, 18);
  eventLog.textContent = 'Surcharge tactique : projectiles neutralisés et flotte ennemie frappée.';
  statusElement.textContent = 'Surcharge tactique déclenchée.';
  sound('level', 1.4);
  updateHud(true);
}

function updateProjectiles(delta) {
  state.playerBullets.forEach(bullet => { bullet.x += bullet.vx * delta; bullet.y += bullet.vy * delta; });
  state.playerBullets = state.playerBullets.filter(bullet => bullet.y > -30 && bullet.x > -30 && bullet.x < WIDTH + 30 && !bullet.dead);
  for (const bullet of state.enemyBullets) {
    bullet.life -= delta;
    if (bullet.type === 'bomb') {
      bullet.timer -= delta;
      bullet.vy += 34 * delta;
      if (bullet.timer <= 0) {
        state.explosions.push({ x: bullet.x, y: bullet.y, radius: 8, maximum: 78, life: 0.46, damage: bullet.damage, hit: false });
        bullet.dead = true;
        state.shake = Math.max(state.shake, 7);
        sound('explosion', 0.7);
      }
    } else if (bullet.type === 'bubble') {
      bullet.turn -= delta;
      if (bullet.turn <= 0) { bullet.vx += (random() - 0.5) * 150; bullet.vx = clamp(bullet.vx, -145, 145); bullet.turn = 0.25 + random() * 0.55; }
      if (bullet.x < bullet.radius || bullet.x > WIDTH - bullet.radius) bullet.vx *= -1;
    } else if (bullet.type === 'missile') {
      const desired = Math.atan2(state.player.y - bullet.y, state.player.x - bullet.x);
      const current = Math.atan2(bullet.vy, bullet.vx);
      let difference = ((desired - current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      const next = current + clamp(difference, -2.1 * delta, 2.1 * delta);
      bullet.vx = Math.cos(next) * bullet.speed;
      bullet.vy = Math.sin(next) * bullet.speed;
    }
    bullet.x += bullet.vx * delta;
    bullet.y += bullet.vy * delta;
  }
  state.enemyBullets = state.enemyBullets.filter(bullet => !bullet.dead && bullet.life > 0 && bullet.x > -60 && bullet.x < WIDTH + 60 && bullet.y > -60 && bullet.y < HEIGHT + 60);
  state.lasers.forEach(laser => {
    if (laser.charge > 0) laser.charge -= delta;
    else {
      laser.duration -= delta;
      if (!laser.hit && Math.abs(state.player.x - laser.x) < laser.width / 2 + state.player.radius && state.player.y >= laser.sourceY) {
        laser.hit = true;
        damagePlayer(laser.damage, laser.x, state.player.y);
      }
    }
  });
  state.lasers = state.lasers.filter(laser => laser.duration > 0);
  state.explosions.forEach(explosion => {
    explosion.life -= delta;
    explosion.radius += (explosion.maximum - explosion.radius) * Math.min(1, delta * 12);
    if (!explosion.hit && distance(explosion, state.player) < explosion.radius + state.player.radius) { explosion.hit = true; damagePlayer(explosion.damage, explosion.x, explosion.y); }
  });
  state.explosions = state.explosions.filter(explosion => explosion.life > 0);
}

function resolveCollisions() {
  for (const bullet of state.playerBullets) {
    if (bullet.dead) continue;
    for (const enemy of state.enemies) {
      if (enemy.dead || distance(bullet, enemy) > bullet.radius + enemy.radius) continue;
      enemy.health -= bullet.damage;
      enemy.flash = 0.07;
      state.hits++;
      addParticles(bullet.x, bullet.y, bullet.critical ? '#fef08a' : '#7dd3fc', bullet.critical ? 6 : 3, 70);
      if (bullet.pierce > 0) bullet.pierce--;
      else bullet.dead = true;
      if (enemy.health <= 0) destroyEnemy(enemy);
      break;
    }
  }
  for (const bullet of state.enemyBullets) {
    if (!bullet.dead && distance(bullet, state.player) <= bullet.radius + state.player.radius) { bullet.dead = true; damagePlayer(bullet.damage, bullet.x, bullet.y); }
  }
  for (const enemy of state.enemies) {
    if (!enemy.dead && distance(enemy, state.player) <= enemy.radius + state.player.radius) { enemy.dead = true; damagePlayer(enemy.type === 'boss' ? 45 : 24, enemy.x, enemy.y); }
  }
}

function updatePickups(delta) {
  const player = state.player;
  state.pickups.forEach(pickup => {
    pickup.life -= delta;
    pickup.phase += delta * 4;
    pickup.y += pickup.vy * delta;
    const currentDistance = distance(pickup, player);
    if (currentDistance < player.magnet) {
      const force = 220 + (player.magnet - currentDistance) * 3;
      pickup.x += (player.x - pickup.x) / Math.max(1, currentDistance) * force * delta;
      pickup.y += (player.y - pickup.y) / Math.max(1, currentDistance) * force * delta;
    }
    if (currentDistance < pickup.radius + player.radius + 4) collectPickup(pickup);
  });
  state.pickups = state.pickups.filter(pickup => !pickup.dead && pickup.life > 0 && pickup.y < HEIGHT + 30);
}

function updateEffects(delta) {
  state.stars.forEach(star => { star.y += star.speed * delta; if (star.y > HEIGHT) { star.y = -3; star.x = random() * WIDTH; } });
  state.particles.forEach(particle => { particle.life -= delta; particle.x += particle.vx * delta; particle.y += particle.vy * delta; particle.vx *= 0.98; particle.vy *= 0.98; });
  state.particles = state.particles.filter(particle => particle.life > 0);
  state.shake = Math.max(0, state.shake - delta * 30);
  state.comboTimer = Math.max(0, state.comboTimer - delta);
  if (!state.comboTimer) state.combo = Math.max(0, state.combo - delta * 4);
}

function updateWave(delta) {
  state.spawnQueue.forEach(entry => { entry.delay -= delta; });
  const ready = state.spawnQueue.filter(entry => entry.delay <= 0);
  state.spawnQueue = state.spawnQueue.filter(entry => entry.delay > 0);
  ready.forEach(entry => state.enemies.push(createEnemy(entry.type, entry.position, entry.movement)));
  state.enemies.forEach(enemy => updateEnemy(enemy, delta));
  state.enemies = state.enemies.filter(enemy => !enemy.dead);
  if (state.waveActive && !state.enemies.length && !state.spawnQueue.length) {
    state.waveActive = false;
    state.betweenWaves = 1.8;
    state.player.shield = Math.min(state.player.maxShield, state.player.shield + 8);
    state.score += Math.round(250 * state.wave * difficulty().score);
    statusElement.textContent = `Vague ${state.wave} nettoyée.`;
  }
  if (!state.waveActive) {
    state.betweenWaves -= delta;
    if (state.betweenWaves <= 0) spawnWave();
  }
}

function update(delta) {
  if (!state || state.completed) return;
  state.elapsed += delta;
  updateEffects(delta);
  updatePlayer(delta);
  updateWave(delta);
  updateProjectiles(delta);
  resolveCollisions();
  updatePickups(delta);
  remoteGhosts.forEach(ghost => { ghost.displayX += (ghost.x - ghost.displayX) * Math.min(1, delta * 12); ghost.displayY += (ghost.y - ghost.displayY) * Math.min(1, delta * 12); });
  window.LanMultiplayer?.sendGhost({ x: state.player.x, y: state.player.y, vx: state.player.lastDirection.x * state.player.speed, vy: state.player.lastDirection.y * state.player.speed, progress: gameModeSelect.value === 'campaign' ? Math.min(1, state.wave / 15) : Math.min(1, state.score / 50000), state: state.player.dashTimer > 0 ? 'dash' : 'flight' })?.catch(() => {});
  state.hudTimer -= delta;
  if (state.hudTimer <= 0) { state.hudTimer = 0.08; updateHud(); }
}

function updateHud(force = false) {
  if (!state) return;
  if (force) hudCache.clear();
  const player = state.player;
  setText('score', Math.floor(state.score).toLocaleString('fr-FR'));
  setText('wave', state.wave || '—');
  setText('level', player.level);
  setText('combo', `×${(1 + Math.min(3, state.combo * 0.045)).toFixed(2).replace('.', ',')}`);
  setMeter('healthMeter', player.health / player.maxHealth * 100);
  setMeter('shieldMeter', player.shield / player.maxShield * 100);
  setMeter('experienceMeter', player.experience / player.nextExperience * 100);
  setMeter('specialMeter', player.special / player.maxSpecial * 100);
  setText('classStat', shipClasses[player.shipClass]?.label || 'Polyvalent');
  setText('damageStat', player.damage.toFixed(1));
  setText('rateStat', `${(1 / player.fireInterval).toFixed(1)}/s`);
  setText('shotStat', player.shots + player.bonusShots);
  setText('speedStat', Math.round(player.speed));
  setText('dashStat', player.dashCooldown <= 0 ? 'Prêt' : `${player.dashCooldown.toFixed(1)} s`);
  setText('specialStat', player.special >= player.maxSpecial ? 'PRÊT' : `${Math.floor(player.special)} %`);
}

function drawShip(player) {
  context.save();
  context.translate(player.x, player.y);
  if (player.invulnerability > 0 && Math.floor(player.invulnerability * 18) % 2) context.globalAlpha = 0.35;
  context.fillStyle = '#38bdf8';
  context.beginPath(); context.moveTo(0, -22); context.lineTo(17, 18); context.lineTo(0, 11); context.lineTo(-17, 18); context.closePath(); context.fill();
  context.fillStyle = '#e0f2fe'; context.beginPath(); context.moveTo(0, -13); context.lineTo(6, 7); context.lineTo(-6, 7); context.closePath(); context.fill();
  context.fillStyle = player.dashTimer > 0 ? '#fef08a' : '#fb7185'; context.beginPath(); context.moveTo(-7, 16); context.lineTo(0, 35 + Math.sin((state?.elapsed || 0) * 31) * 4); context.lineTo(7, 16); context.closePath(); context.fill();
  range(player.drones).forEach(index => { const side = index ? 1 : -1; context.fillStyle = '#a78bfa'; context.fillRect(side * 31 - 6, -1, 12, 12); });
  context.restore();
}

function drawRemoteShips() {
  const now = performance.now();
  remoteGhosts.forEach((ghost, playerId) => {
    if (now - ghost.receivedAt > 2200) { remoteGhosts.delete(playerId); return; }
    context.save(); context.translate(ghost.displayX, ghost.displayY); context.globalAlpha = 0.3;
    context.fillStyle = '#f0abfc'; context.strokeStyle = '#fae8ff'; context.lineWidth = 2;
    context.beginPath(); context.moveTo(0, -22); context.lineTo(17, 18); context.lineTo(0, 11); context.lineTo(-17, 18); context.closePath(); context.fill(); context.stroke();
    context.restore();
  });
}

function drawEnemy(enemy) {
  const definition = enemyDefinitions[enemy.type];
  context.save();
  context.translate(enemy.x, enemy.y);
  context.fillStyle = enemy.flash > 0 ? '#fff' : definition.color;
  context.strokeStyle = '#f8fafc';
  context.lineWidth = enemy.type === 'boss' ? 4 : 2;
  context.beginPath();
  if (enemy.type === 'scout') { context.moveTo(0, enemy.radius); context.lineTo(enemy.radius, -enemy.radius); context.lineTo(0, -enemy.radius / 2); context.lineTo(-enemy.radius, -enemy.radius); }
  else if (enemy.type === 'bomber') context.rect(-enemy.radius, -enemy.radius, enemy.radius * 2, enemy.radius * 2);
  else if (enemy.type === 'bubbler') context.arc(0, 0, enemy.radius, 0, Math.PI * 2);
  else if (enemy.type === 'laser') { context.moveTo(0, -enemy.radius); context.lineTo(enemy.radius, 0); context.lineTo(0, enemy.radius); context.lineTo(-enemy.radius, 0); }
  else if (enemy.type === 'hunter') { context.moveTo(0, enemy.radius); context.lineTo(enemy.radius * 0.75, -enemy.radius); context.lineTo(0, -enemy.radius * 0.45); context.lineTo(-enemy.radius * 0.75, -enemy.radius); }
  else if (enemy.type === 'gunner') { range(8).forEach(index => { const angle = index / 8 * Math.PI * 2; const radius = index % 2 ? enemy.radius * 0.52 : enemy.radius; const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius; if (!index) context.moveTo(x, y); else context.lineTo(x, y); }); }
  else { range(enemy.type === 'boss' ? 12 : 6).forEach(index => { const count = enemy.type === 'boss' ? 12 : 6; const angle = index / count * Math.PI * 2; const radius = enemy.radius * (index % 2 && enemy.type === 'boss' ? 0.72 : 1); const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius; if (!index) context.moveTo(x, y); else context.lineTo(x, y); }); }
  context.closePath(); context.fill(); context.stroke();
  if (enemy.type === 'bomber') { context.fillStyle = '#422006'; context.beginPath(); context.arc(0, 0, 7, 0, Math.PI * 2); context.fill(); }
  if (enemy.type === 'bubbler') { context.globalAlpha = 0.45; context.fillStyle = '#fff'; context.beginPath(); context.arc(-6, -7, 5, 0, Math.PI * 2); context.fill(); }
  if (enemy.health < enemy.maxHealth || enemy.type === 'boss') {
    context.fillStyle = '#1e293b'; context.fillRect(-enemy.radius, -enemy.radius - 11, enemy.radius * 2, 5);
    context.fillStyle = enemy.type === 'boss' ? '#f43f5e' : '#4ade80'; context.fillRect(-enemy.radius, -enemy.radius - 11, enemy.radius * 2 * enemy.health / enemy.maxHealth, 5);
  }
  context.restore();
}

function drawProjectile(bullet) {
  context.save(); context.translate(bullet.x, bullet.y);
  if (bullet.type === 'bomb') { context.fillStyle = '#fb923c'; context.beginPath(); context.arc(0, 0, bullet.radius, 0, Math.PI * 2); context.fill(); context.strokeStyle = '#fef08a'; context.stroke(); }
  else if (bullet.type === 'bubble') { context.fillStyle = '#c084fc55'; context.strokeStyle = '#e9d5ff'; context.lineWidth = 3; context.beginPath(); context.arc(0, 0, bullet.radius, 0, Math.PI * 2); context.fill(); context.stroke(); }
  else if (bullet.type === 'missile') { context.rotate(Math.atan2(bullet.vy, bullet.vx) + Math.PI / 2); context.fillStyle = '#4ade80'; context.fillRect(-5, -10, 10, 20); context.fillStyle = '#fb7185'; context.fillRect(-3, 10, 6, 8); }
  else { context.fillStyle = bullet.type === 'horizontal' ? '#facc15' : '#fb7185'; context.beginPath(); context.arc(0, 0, bullet.radius, 0, Math.PI * 2); context.fill(); }
  context.restore();
}

function drawPickup(pickup) {
  const pulse = 1 + Math.sin(pickup.phase) * 0.16;
  context.save(); context.translate(pickup.x, pickup.y); context.scale(pulse, pulse); context.fillStyle = pickupColor(pickup.type); context.strokeStyle = '#fff'; context.lineWidth = 2; context.beginPath();
  range(8).forEach(index => { const angle = index / 8 * Math.PI * 2; const radius = index % 2 ? pickup.radius * 0.55 : pickup.radius; const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius; if (!index) context.moveTo(x, y); else context.lineTo(x, y); });
  context.closePath(); context.fill(); context.stroke(); context.fillStyle = '#17243a'; context.font = 'bold 10px Arial'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(({ heal: '+', shield: 'S', rapid: 'R', power: 'P', multi: 'M', core: 'XP' })[pickup.type], 0, 0); context.restore();
}

function draw() {
  context.save();
  const shakeX = state ? Math.sin(state.elapsed * 73) * state.shake * 0.5 : 0;
  const shakeY = state ? Math.cos(state.elapsed * 91) * state.shake * 0.5 : 0;
  context.translate(shakeX, shakeY);
  const gradient = context.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, '#020617'); gradient.addColorStop(0.55, '#071a35'); gradient.addColorStop(1, '#111827');
  context.fillStyle = gradient; context.fillRect(-20, -20, WIDTH + 40, HEIGHT + 40);
  if (!state) {
    context.fillStyle = '#dbeafe'; context.font = 'bold 30px Arial'; context.textAlign = 'center'; context.fillText('Démarrez pour défendre le secteur.', WIDTH / 2, HEIGHT / 2);
    context.restore(); return;
  }
  state.stars.forEach(star => { context.fillStyle = `rgba(219,234,254,${0.35 + star.size / 3})`; context.fillRect(star.x, star.y, star.size, star.size * 2.3); });
  state.lasers.forEach(laser => {
    if (laser.charge > 0) { context.strokeStyle = `rgba(248,113,113,${0.35 + Math.sin(laser.charge * 35) * 0.25})`; context.lineWidth = 3; context.setLineDash([9, 8]); }
    else { context.strokeStyle = '#f43f5e'; context.lineWidth = laser.width; context.shadowBlur = 18; context.shadowColor = '#fb7185'; context.setLineDash([]); }
    context.beginPath(); context.moveTo(laser.x, laser.sourceY); context.lineTo(laser.x, HEIGHT + 20); context.stroke(); context.shadowBlur = 0; context.setLineDash([]);
  });
  state.enemies.forEach(drawEnemy);
  context.fillStyle = '#7dd3fc'; state.playerBullets.forEach(bullet => { context.fillStyle = bullet.critical ? '#fef08a' : '#7dd3fc'; context.fillRect(bullet.x - bullet.radius / 2, bullet.y - 8, bullet.radius, 16); });
  state.enemyBullets.forEach(drawProjectile);
  state.explosions.forEach(explosion => { context.fillStyle = `rgba(251,146,60,${Math.max(0, explosion.life * 1.8)})`; context.strokeStyle = '#fef08a'; context.lineWidth = 3; context.beginPath(); context.arc(explosion.x, explosion.y, explosion.radius, 0, Math.PI * 2); context.fill(); context.stroke(); });
  state.pickups.forEach(drawPickup);
  state.particles.forEach(particle => { context.globalAlpha = particle.life; context.fillStyle = particle.color; context.fillRect(particle.x, particle.y, particle.size, particle.size); context.globalAlpha = 1; });
  drawRemoteShips();
  drawShip(state.player);
  if (!state.waveActive && !state.completed) { context.fillStyle = '#e0f2fe'; context.font = 'bold 22px Arial'; context.textAlign = 'center'; context.fillText(`Vague suivante dans ${Math.max(0, state.betweenWaves).toFixed(1)} s`, WIDTH / 2, 56); }
  context.restore();
}

function loop(now) {
  if (!running || paused || !state) return;
  const delta = Math.min(0.035, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  update(delta);
  draw();
  if (running) animationFrame = requestAnimationFrame(loop);
}

function togglePause(force) {
  if (!state || state.completed || state.upgrading) return;
  paused = force ?? !paused;
  running = !paused;
  statusElement.textContent = paused ? 'Partie en pause.' : `Reprise — vague ${state.wave}.`;
  document.getElementById('pause').textContent = paused ? 'Reprendre' : 'Pause';
  if (!paused) { lastTime = performance.now(); animationFrame = requestAnimationFrame(loop); }
  draw();
}

const normalizeKey = key => ({ z: 'ArrowUp', w: 'ArrowUp', s: 'ArrowDown', q: 'ArrowLeft', a: 'ArrowLeft', d: 'ArrowRight', ' ': 'fire', Shift: 'dash', e: 'special', E: 'special' })[key] || key;
document.addEventListener('keydown', event => {
  if (event.target.matches('select,input,textarea')) return;
  const key = normalizeKey(event.key);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'fire', 'dash', 'special'].includes(key)) {
    event.preventDefault();
    pressed.add(key);
    if (key === 'dash') activateDash();
    if (key === 'special') activateSpecial();
    if (key === 'fire' && fireModeSelect.value === 'manual' && state && running) firePlayer();
    updateControlHighlights();
  } else if (event.key.toLowerCase() === 'p' || event.key === 'Escape') { event.preventDefault(); togglePause(); }
});
document.addEventListener('keyup', event => { pressed.delete(normalizeKey(event.key)); updateControlHighlights(); });

function updateControlHighlights() {
  document.querySelectorAll('[data-control]').forEach(button => button.classList.toggle('active', pressed.has(({ left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', fire: 'fire', dash: 'dash', special: 'special' })[button.dataset.control])));
}
document.querySelectorAll('[data-control]').forEach(button => {
  const key = ({ left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', fire: 'fire', dash: 'dash', special: 'special' })[button.dataset.control];
  button.onpointerdown = event => { event.preventDefault(); pressed.add(key); if (key === 'dash') activateDash(); if (key === 'special') activateSpecial(); if (key === 'fire' && fireModeSelect.value === 'manual' && state && running) firePlayer(); updateControlHighlights(); };
  button.onpointerup = button.onpointercancel = button.onpointerleave = () => { pressed.delete(key); updateControlHighlights(); };
});

function pointerPosition(event) {
  const box = canvas.getBoundingClientRect();
  return { x: (event.clientX - box.left) / box.width * WIDTH, y: (event.clientY - box.top) / box.height * HEIGHT };
}
canvas.addEventListener('pointerdown', event => { if (!state || !running) return; event.preventDefault(); pointerActive = true; canvas.setPointerCapture?.(event.pointerId); const point = pointerPosition(event); state.player.x = clamp(point.x, 22, WIDTH - 22); state.player.y = clamp(point.y, HEIGHT * 0.42, HEIGHT - 24); if (fireModeSelect.value === 'manual') firePlayer(); });
canvas.addEventListener('pointermove', event => { if (!pointerActive || !state || !running) return; event.preventDefault(); const point = pointerPosition(event); state.player.x = clamp(point.x, 22, WIDTH - 22); state.player.y = clamp(point.y, HEIGHT * 0.42, HEIGHT - 24); });
canvas.addEventListener('pointerup', event => { pointerActive = false; canvas.releasePointerCapture?.(event.pointerId); });
canvas.addEventListener('pointercancel', () => { pointerActive = false; });

document.getElementById('start').onclick = startGame;
document.getElementById('pause').onclick = () => togglePause();
document.getElementById('messageAction').onclick = startGame;
[difficultySelect, gameModeSelect, shipClassSelect, fireModeSelect].forEach(control => control.onchange = () => { if (state && !state.completed) statusElement.textContent = 'Option modifiée : elle sera appliquée à la prochaine partie.'; });
window.addEventListener('lan:start', startGame);
window.addEventListener('lan:pause', event => togglePause(Boolean(event.detail?.paused)));
window.addEventListener('lan:ghost', event => { const snapshot = event.detail; const previous = remoteGhosts.get(snapshot.playerId); remoteGhosts.set(snapshot.playerId, { ...snapshot, displayX: previous?.displayX ?? snapshot.x, displayY: previous?.displayY ?? snapshot.y }); });
document.addEventListener('visibilitychange', () => { if (document.hidden && running) togglePause(true); });
window.addEventListener('blur', () => { if (running && !state?.upgrading) togglePause(true); });

draw();
window.GameRuleExamples = element => {
  const index = [...element.parentElement.children].indexOf(element);
  const examples = [
    { title: 'Nettoyer une vague', explanation: 'La formation entière doit être éliminée. Un ennemi qui franchit la ligne basse endommage directement la coque.', html: '<div style="position:relative;width:360px;height:180px;background:#071a35;border-radius:12px;overflow:hidden"><div style="position:absolute;inset:22px 35px auto;display:flex;justify-content:space-between;color:#fb7185;font-size:30px">◆ ● ▲ ■</div><div style="position:absolute;left:30px;right:30px;bottom:42px;border-top:3px dashed #ef4444"></div><div style="position:absolute;bottom:9px;left:164px;color:#38bdf8;font-size:34px">▲</div></div>' },
    { title: 'Récupérer un bonus', explanation: 'Les bonus colorés descendent après certaines destructions. Le champ magnétique les attire lorsque le vaisseau s’en approche.', html: '<div style="display:flex;align-items:center;gap:30px;font-size:42px"><span style="color:#fb7185">◆</span><strong>→</strong><span style="color:#a78bfa">✦ XP</span><strong>→</strong><span style="color:#38bdf8">▲</span></div>' },
    { title: 'Choisir une amélioration', explanation: 'À chaque niveau, le combat s’arrête et trois améliorations compatibles sont proposées. Le choix est permanent pour cette partie.', html: '<div style="display:grid;grid-template-columns:repeat(3,110px);gap:9px"><div class="rule-example-cell highlight" style="width:110px">Dégâts</div><div class="rule-example-cell" style="width:110px">Cadence</div><div class="rule-example-cell" style="width:110px">Drone</div></div>' },
    { title: 'Affronter un boss', explanation: 'Toutes les cinq vagues, le noyau rouge combine lasers, missiles, bombes et tirs circulaires. Sa barre verte indique sa vie restante.', html: '<div style="text-align:center"><div style="font-size:76px;color:#ef4444">✹</div><div style="width:260px;height:13px;background:#334155;border-radius:9px;overflow:hidden"><i style="display:block;width:62%;height:100%;background:#4ade80"></i></div><div style="margin-top:14px;color:#fca5a5">┃ 🚀 💣 ✣</div></div>' },
    { title: 'Entretenir le combo', explanation: 'Chaque ennemi détruit sans subir de dégâts augmente le multiplicateur. Un impact remet le combo à zéro.', html: '<div style="display:flex;align-items:center;gap:20px;font-size:28px"><span>◆ × 5</span><strong style="color:#22c55e">→ ×1,23</strong><span class="rule-example-cell bad" style="width:60px;height:60px">Impact</span><strong>→ ×1</strong></div>' }
  ];
  return { text: element.textContent.trim(), ...(examples[index] || examples[0]) };
};
window.StellarAssaultTestAPI = {
  diagnostics() {
    const settings = Object.values(difficultySettings);
    return {
      canvas: canvas.width === 960 && canvas.height === 640,
      enemies: Object.keys(enemyDefinitions),
      projectiles: projectileTypes,
      movements: movementPatterns,
      formations: formationPatterns,
      upgrades: upgrades.map(upgrade => upgrade.id),
      difficultyScaling: settings.every((setting, index) => !index || setting.health > settings[index - 1].health),
      campaignWaves: 15,
      mobileControls: document.querySelectorAll('[data-control]').length,
      shipClasses: Object.keys(shipClasses),
      specialAvailable: typeof activateSpecial === 'function',
      modes: [...gameModeSelect.options].map(option => option.value)
    };
  },
  preview(seed = 'diagnostic', wave = 10) {
    const previous = state;
    state = createState(`preview:${seed}`);
    state.wave = wave - 1;
    const plan = wavePlan(wave, 'campaign');
    state = previous;
    return plan;
  },
  selfTest() {
    const previousState = state;
    const previousRunning = running;
    const previousSound = soundEnabled.checked;
    soundEnabled.checked = false;
    state = createState('stellar:self-test');
    state.wave = 6;
    const enemy = createEnemy('scout', { x: 480, y: 180 }, 'sweep');
    enemy.x = 480;
    enemy.y = 180;
    enemy.entered = true;
    enemy.health = 1;
    state.enemies.push(enemy);
    state.playerBullets.push({ x: 480, y: 180, vx: 0, vy: -1, radius: 5, damage: 10, pierce: 0 });
    resolveCollisions();
    const collisionDestroys = enemy.dead && state.score > 0 && state.kills === 1;
    const attackEnemy = createEnemy('tank', { x: 480, y: 180 }, 'sweep');
    attackEnemy.x = 480;
    attackEnemy.y = 180;
    ['direct', 'bomb', 'bubble', 'laser', 'missile', 'spread', 'cross'].forEach(type => spawnEnemyProjectile(attackEnemy, type));
    const producedThreats = new Set([...state.enemyBullets.map(bullet => bullet.type), ...state.lasers.map(() => 'laser')]);
    const attacksGenerated = ['direct', 'bomb', 'bubble', 'laser', 'missile', 'diagonal', 'horizontal'].every(type => producedThreats.has(type));
    const upgradeApplies = (() => { const before = state.player.damage; upgrades.find(upgrade => upgrade.id === 'damage').apply(state.player); return state.player.damage > before; })();
    state = previousState;
    running = previousRunning;
    soundEnabled.checked = previousSound;
    return { collisionDestroys, attacksGenerated, upgradeApplies };
  }
};
try { localStorage.setItem('game-hub:last-game', 'stellar-assault'); } catch {}
