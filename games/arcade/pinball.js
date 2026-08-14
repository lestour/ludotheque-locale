'use strict';

const canvas = document.getElementById('screen');
const context = canvas.getContext('2d');
const difficultySelect = document.getElementById('difficulty');
const modeSelect = document.getElementById('mode');
const themeSelect = document.getElementById('theme');
const flipperStyleSelect = document.getElementById('flipperStyle');
const soundToggle = document.getElementById('sound');
const effectsToggle = document.getElementById('effects');
const hapticsToggle = document.getElementById('haptics');
const statusElement = document.getElementById('status');
const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const BALL_RADIUS = 11;
const FIXED_STEP = 1 / 180;
const controls = new Set();
const canvasPointers = new Map();
const remoteGhosts = new Map();

const difficultySettings = {
  easy: { gravity: 420, restitution: 0.82, bumper: 620, saver: 12, gap: 0.86, score: 0.8 },
  normal: { gravity: 480, restitution: 0.8, bumper: 670, saver: 8, gap: 1, score: 1 },
  hard: { gravity: 535, restitution: 0.77, bumper: 720, saver: 5, gap: 1.13, score: 1.4 },
  extreme: { gravity: 590, restitution: 0.74, bumper: 770, saver: 3, gap: 1.25, score: 2 }
};

const flipperSettings = {
  accessible: { length: 132, attack: 40, returnSpeed: 25, impulse: 0.7 },
  classic: { length: 116, attack: 35, returnSpeed: 22, impulse: 0.62 },
  powerful: { length: 116, attack: 43, returnSpeed: 25, impulse: 0.82 },
  simulation: { length: 108, attack: 30, returnSpeed: 19, impulse: 0.5 }
};

const themes = {
  nova: { field: '#10133b', field2: '#25124b', rail: '#8b5cf6', railGlow: '#c4b5fd', accent: '#22d3ee', bumper: '#f43f5e', bumperCore: '#facc15', text: '#f8fafc', target: '#38bdf8' },
  retro: { field: '#2c190d', field2: '#5b2b12', rail: '#f59e0b', railGlow: '#fde68a', accent: '#fef3c7', bumper: '#dc2626', bumperCore: '#fff7ed', text: '#fffbeb', target: '#22c55e' },
  abyss: { field: '#052f36', field2: '#083344', rail: '#14b8a6', railGlow: '#99f6e4', accent: '#67e8f9', bumper: '#8b5cf6', bumperCore: '#f0abfc', text: '#ecfeff', target: '#2dd4bf' }
};

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const distance = (left, right) => Math.hypot(left.x - right.x, left.y - right.y);
let audioContext = null;
let game = null;
let running = false;
let paused = false;
let animationFrame = 0;
let previousTime = 0;
let accumulator = 0;
let launchHeld = false;
let launchedAt = 0;

function vibrate(pattern) {
  if (!hapticsToggle.checked || !navigator.vibrate) return;
  try { navigator.vibrate(pattern); } catch {}
}

function sound(kind, strength = 1) {
  if (!soundToggle.checked) return;
  try {
    audioContext ||= new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const settings = {
      flipper: [115, 0.045, 'square'], bumper: [540, 0.08, 'sine'], target: [830, 0.075, 'square'],
      launch: [165, 0.2, 'sawtooth'], drain: [95, 0.35, 'sawtooth'], jackpot: [980, 0.38, 'triangle'],
      tilt: [55, 0.5, 'sawtooth'], rollover: [690, 0.12, 'sine'], extra: [1180, 0.45, 'triangle']
    }[kind] || [260, 0.08, 'sine'];
    const now = audioContext.currentTime;
    oscillator.type = settings[2];
    oscillator.frequency.setValueAtTime(settings[0] * (0.95 + Math.random() * 0.1), now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, settings[0] * (kind === 'jackpot' || kind === 'extra' ? 1.55 : 0.58)), now + settings[1]);
    gain.gain.setValueAtTime(0.035 * clamp(strength, 0.3, 1.8), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + settings[1]);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now); oscillator.stop(now + settings[1]);
  } catch {}
}

function segment(x1, y1, x2, y2, type = 'rail', strength = 1) {
  return { x1, y1, x2, y2, type, strength };
}

function buildTable() {
  const gapFactor = difficultySettings[difficultySelect.value].gap;
  const innerGap = 118 * gapFactor;
  const leftFlipperX = WIDTH / 2 - innerGap;
  const rightFlipperX = WIDTH / 2 + innerGap;
  const flipperConfig = flipperSettings[flipperStyleSelect.value];
  const walls = [
    segment(50, 86, 585, 86), segment(50, 86, 50, 925), segment(670, 84, 670, 1000), segment(617, 952, 663, 952),
    segment(50, 925, leftFlipperX - 33, 979), segment(607, 220, 607, 925), segment(607, 925, rightFlipperX + 33, 979),
    segment(607, 220, 578, 180), segment(50, 705, 192, 820, 'guide'), segment(602, 705, 528, 820, 'guide'),
    segment(123, 652, leftFlipperX - 12, 812, 'guide'), segment(597, 652, rightFlipperX + 12, 812, 'guide'),
    segment(116, 415, 196, 505, 'rail'), segment(604, 415, 524, 505, 'rail'),
    segment(136, 545, 235, 610, 'rail'), segment(584, 545, 485, 610, 'rail')
  ];
  return {
    walls,
    flippers: [
      { side: 'left', pivotX: leftFlipperX, pivotY: 880, length: flipperConfig.length, radius: 15, rest: 0.2, active: -0.53, angle: 0.2, angularVelocity: 0 },
      { side: 'right', pivotX: rightFlipperX, pivotY: 880, length: flipperConfig.length, radius: 15, rest: Math.PI - 0.2, active: Math.PI + 0.53, angle: Math.PI - 0.2, angularVelocity: 0 }
    ],
    bumpers: [
      { x: 215, y: 265, radius: 37, value: 900, pulse: 0 },
      { x: 360, y: 205, radius: 39, value: 1200, pulse: 0 },
      { x: 505, y: 275, radius: 37, value: 900, pulse: 0 },
      { x: 360, y: 410, radius: 31, value: 1500, pulse: 0 }
    ],
    slings: [
      { x: 205, y: 725, radius: 42, value: 350, pulse: 0 },
      { x: 515, y: 725, radius: 42, value: 350, pulse: 0 }
    ],
    targets: [255, 325, 395, 465].map((x, index) => ({ x, y: 540 + Math.abs(1.5 - index) * 9, radius: 17, lit: false, pulse: 0 })),
    lanes: [180, 360, 540].map((x, index) => ({ x, y: 132, radius: 23, letter: 'ABC'[index], lit: false })),
    ramps: [{ x: 134, y: 475, side: 'left' }, { x: 586, y: 475, side: 'right' }],
    spinner: { x: 360, y: 472, halfWidth: 37, angle: 0, speed: 0, pulse: 0 },
    saucer: { x: 105, y: 338, radius: 27, pulse: 0 }
  };
}

function initialBalls() {
  return { classic: 3, timed: 99, survival: 1, arcade: 5 }[modeSelect.value];
}

function createBall(x = 641, y = 905, shooter = true) {
  return { x, y, previousX: x, previousY: y, vx: 0, vy: 0, radius: BALL_RADIUS, inShooter: shooter, alive: true, trail: [], rampCooldown: 0, laneCooldown: 0, spinnerCooldown: 0, saucerCooldown: 0, launchStrength: 0, skillShotChecked: false, id: `${Date.now()}:${Math.random()}` };
}

function createGame(seed = `${Date.now()}:${Math.random()}`) {
  const random = window.GameRuntime?.createRandom(`pinball:${seed}`) || Math.random;
  const table = buildTable();
  return {
    random, table, balls: [createBall()], ballsLeft: initialBalls(), score: 0, multiplier: 1, bonus: 0,
    elapsed: 0, timeLeft: modeSelect.value === 'timed' ? 180 : Infinity, saver: difficultySettings[difficultySelect.value].saver,
    launchCharge: 0, targetBanks: 0, jackpot: 25000, combo: 0, comboTimer: 0, tilted: 0,
    nudges: [], particles: [], popups: [], completed: false, extraBallAwarded: false, mission: 0,
    missionNames: ['Allumez les trois couloirs orbitaux.', 'Abattez les quatre balises Nova.', 'Touchez les rampes gauche et droite.', 'Faites tourner dix fois le spinner.', 'Verrouillez deux billes dans la soucoupe.', 'Récoltez le jackpot sur une rampe.'],
    rampLights: { left: false, right: false }, spinnerHits: 0, lockReady: false, lockedBalls: 0, kickbackLit: false,
    jackpotReady: false, flash: 0, shake: 0, skillShots: 0, missionsCompleted: 0, overdrive: 0, overdriveJackpotReady: false, superJackpot: 100000
  };
}

function startGame() {
  cancelAnimationFrame(animationFrame);
  game = createGame(new URLSearchParams(location.search).get('seed'));
  running = true; paused = false; launchHeld = false; controls.clear(); accumulator = 0;
  document.getElementById('overlay').hidden = true;
  document.getElementById('pause').textContent = 'Pause';
  statusElement.textContent = 'Maintenez puis relâchez Espace pour lancer la bille.';
  window.GameRecords?.reset(); updateHud(); draw(); previousTime = performance.now(); animationFrame = requestAnimationFrame(loop);
}

function addScore(points, label, x, y, color = '#facc15') {
  if (!game || game.tilted > 0) return;
  const awarded = Math.round(points * game.multiplier * difficultySettings[difficultySelect.value].score * (game.overdrive > 0 ? 2 : 1));
  game.score += awarded; game.bonus += Math.max(1, Math.round(points / 100));
  if (label) game.popups.push({ x, y, text: `${label} +${awarded.toLocaleString('fr-FR')}`, color, life: 1.25 });
  if (!game.extraBallAwarded && game.score >= 250000 && modeSelect.value !== 'timed') {
    game.extraBallAwarded = true; game.ballsLeft++; sound('extra'); statusElement.textContent = 'Bille supplémentaire gagnée à 250 000 points !';
  }
}

function addParticles(x, y, color, amount = 14) {
  if (!effectsToggle.checked) return;
  for (let index = 0; index < amount; index++) {
    const angle = game.random() * Math.PI * 2; const speed = 35 + game.random() * 150;
    game.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, color, life: 0.35 + game.random() * 0.5 });
  }
}

function closestPoint(ball, item) {
  const dx = item.x2 - item.x1; const dy = item.y2 - item.y1;
  const lengthSquared = dx * dx + dy * dy;
  const amount = lengthSquared ? clamp(((ball.x - item.x1) * dx + (ball.y - item.y1) * dy) / lengthSquared, 0, 1) : 0;
  return { x: item.x1 + dx * amount, y: item.y1 + dy * amount, amount };
}

function collideSegment(ball, item, restitution = difficultySettings[difficultySelect.value].restitution) {
  const point = closestPoint(ball, item);
  let dx = ball.x - point.x; let dy = ball.y - point.y;
  let length = Math.hypot(dx, dy);
  if (length >= ball.radius || !Number.isFinite(length)) return false;
  if (length < 0.001) { dx = -(item.y2 - item.y1); dy = item.x2 - item.x1; length = Math.hypot(dx, dy) || 1; }
  const nx = dx / length; const ny = dy / length;
  ball.x += nx * (ball.radius - length + 0.25); ball.y += ny * (ball.radius - length + 0.25);
  const speed = ball.vx * nx + ball.vy * ny;
  if (speed < 0) { ball.vx -= (1 + restitution) * speed * nx; ball.vy -= (1 + restitution) * speed * ny; }
  return true;
}

function collideCircle(ball, obstacle, impulse, onHit) {
  let dx = ball.x - obstacle.x; let dy = ball.y - obstacle.y;
  let length = Math.hypot(dx, dy);
  const minimum = ball.radius + obstacle.radius;
  if (length >= minimum) return false;
  if (length < 0.001) { dx = 0; dy = 1; length = 1; }
  const nx = dx / length; const ny = dy / length;
  ball.x += nx * (minimum - length + 0.5); ball.y += ny * (minimum - length + 0.5);
  const toward = ball.vx * nx + ball.vy * ny;
  if (toward < impulse * 0.25) { ball.vx += nx * (impulse - toward); ball.vy += ny * (impulse - toward); }
  onHit?.();
  return true;
}

function collideFlipper(ball, flipper) {
  const tipX = flipper.pivotX + Math.cos(flipper.angle) * flipper.length;
  const tipY = flipper.pivotY + Math.sin(flipper.angle) * flipper.length;
  const point = closestPoint(ball, { x1: flipper.pivotX, y1: flipper.pivotY, x2: tipX, y2: tipY });
  let dx = ball.x - point.x; let dy = ball.y - point.y; let length = Math.hypot(dx, dy);
  const minimum = ball.radius + flipper.radius;
  if (length >= minimum) return false;
  if (length < 0.001) { dx = -Math.sin(flipper.angle); dy = Math.cos(flipper.angle); length = 1; }
  const nx = dx / length; const ny = dy / length;
  ball.x += nx * (minimum - length + 0.4); ball.y += ny * (minimum - length + 0.4);
  const armX = point.x - flipper.pivotX; const armY = point.y - flipper.pivotY;
  const surfaceVx = -armY * flipper.angularVelocity; const surfaceVy = armX * flipper.angularVelocity;
  const relative = (ball.vx - surfaceVx) * nx + (ball.vy - surfaceVy) * ny;
  if (relative < 0) {
    ball.vx -= 1.72 * relative * nx; ball.vy -= 1.72 * relative * ny;
    if (Math.abs(flipper.angularVelocity) > 2) { const impulse = flipperSettings[flipperStyleSelect.value].impulse; ball.vx += surfaceVx * impulse; ball.vy += surfaceVy * impulse; }
  }
  return true;
}

function updateFlippers(delta) {
  const flipperConfig = flipperSettings[flipperStyleSelect.value];
  for (const flipper of game.table.flippers) {
    const pressed = controls.has(flipper.side) && game.tilted <= 0;
    const target = pressed ? flipper.active : flipper.rest;
    const previous = flipper.angle;
    const responsiveness = pressed ? flipperConfig.attack : flipperConfig.returnSpeed;
    flipper.angle += (target - flipper.angle) * Math.min(1, responsiveness * delta);
    flipper.angularVelocity = (flipper.angle - previous) / Math.max(delta, 0.0001);
  }
}

function hitBumper(ball, bumper) {
  if (bumper.pulse > 0.08) return;
  bumper.pulse = 0.24; game.combo = game.comboTimer > 0 ? game.combo + 1 : 1; game.comboTimer = 2.2;
  addScore(bumper.value * (1 + Math.min(5, game.combo - 1) * 0.2), game.combo > 2 ? `COMBO ×${game.combo}` : 'BUMPER', bumper.x, bumper.y);
  addParticles(bumper.x, bumper.y, themes[themeSelect.value].bumperCore, 18); sound('bumper', 1 + game.combo * 0.04); vibrate(14);
}

function hitTarget(ball, target, index) {
  if (target.pulse > 0.08) return;
  target.pulse = 0.3; addScore(target.lit ? 250 : 1250, target.lit ? 'BALISE' : `BALISE ${index + 1}`, target.x, target.y, '#7dd3fc');
  target.lit = true; sound('target'); vibrate(9); addParticles(target.x, target.y, '#38bdf8', 12);
  if (game.table.targets.every(item => item.lit)) completeTargetBank();
}

function completeTargetBank() {
  game.targetBanks++; game.table.targets.forEach(target => { target.lit = false; });
  addScore(6000 * game.targetBanks, 'BANQUE COMPLÈTE', 360, 505, '#a7f3d0');
  game.lockReady = true; game.kickbackLit = true;
  if (game.mission === 1) advanceMission();
  statusElement.textContent = 'Verrouillage et kickback chargés : visez la soucoupe à gauche.';
}

function startMultiball(origin = game.table.saucer) {
  game.balls = game.balls.filter(ball => ball.alive && !ball.inShooter);
  for (let index = 0; index < 3; index++) {
    const spread = (index - 1) * 0.58;
    game.balls.push({ ...createBall(origin.x + (index - 1) * 8, origin.y, false), vx: Math.cos(-0.7 + spread) * (360 + game.random() * 90), vy: Math.sin(-0.7 + spread) * (360 + game.random() * 90) - 210 });
  }
  game.lockedBalls = 0;
  game.jackpotReady = true; game.flash = 0.8; sound('jackpot');
  vibrate([35, 25, 55]);
  statusElement.textContent = 'MULTIBILLE ! Touchez une rampe allumée pour le jackpot.';
}

function hitSpinner(ball) {
  if (ball.spinnerCooldown > 0) return;
  const spinner = game.table.spinner;
  const turns = clamp(Math.floor(Math.hypot(ball.vx, ball.vy) / 180), 1, 5);
  ball.spinnerCooldown = 0.22; spinner.speed = Math.sign(ball.vy || 1) * (13 + turns * 4); spinner.pulse = 0.3;
  game.spinnerHits += turns; addScore(450 * turns, `SPINNER ×${turns}`, spinner.x, spinner.y, '#f9a8d4'); sound('rollover');
  if (game.mission === 3 && game.spinnerHits >= 10) advanceMission();
}

function captureSaucer(ball) {
  if (ball.saucerCooldown > 0 || ball.inShooter) return;
  const saucer = game.table.saucer; saucer.pulse = 0.5;
  if (game.overdrive > 0 && game.overdriveJackpotReady) { game.overdriveJackpotReady = false; addScore(game.superJackpot, 'SUPER JACKPOT', saucer.x, saucer.y, '#fde047'); game.superJackpot += 50000; game.flash = 1; sound('extra'); }
  if (!game.lockReady) {
    ball.saucerCooldown = 2; ball.x = saucer.x + 34; ball.y = saucer.y + 6; ball.vx = 430; ball.vy = -380;
    addScore(2500, 'SOUCOUPE', saucer.x, saucer.y, '#c4b5fd'); sound('target'); return;
  }
  ball.alive = false; game.lockReady = false; game.lockedBalls++;
  addScore(7500 * game.lockedBalls, `BILLE VERROUILLÉE ${game.lockedBalls}/2`, saucer.x, saucer.y, '#86efac');
  sound('jackpot'); vibrate([25, 20, 25]);
  if (game.lockedBalls >= 2) {
    if (game.mission === 4) advanceMission();
    startMultiball(saucer);
  } else {
    game.balls.push(createBall()); game.saver = Math.max(game.saver, 5);
    statusElement.textContent = 'Première bille verrouillée. Rechargez le verrou avec la banque de cibles.';
  }
}

function hitLane(ball, lane, index) {
  if (ball.laneCooldown > 0 || lane.lit) return;
  lane.lit = true; ball.laneCooldown = 0.45; addScore(1800, `COULOIR ${lane.letter}`, lane.x, lane.y, '#fde047'); sound('rollover');
  if (game.table.lanes.every(item => item.lit)) {
    game.multiplier = Math.min(6, game.multiplier + 1); game.table.lanes.forEach(item => { item.lit = false; });
    game.jackpot += 10000; addScore(5000, `MULTIPLICATEUR ×${game.multiplier}`, 360, 160, '#fde047');
    if (game.mission === 0) advanceMission();
  }
}

function hitRamp(ball, ramp) {
  if (ball.rampCooldown > 0) return;
  ball.rampCooldown = 0.8; game.rampLights[ramp.side] = true;
  if (game.overdrive > 0 && game.overdriveJackpotReady) { game.overdriveJackpotReady = false; addScore(game.superJackpot, 'SUPER JACKPOT', ramp.x, ramp.y, '#fde047'); game.superJackpot += 50000; game.flash = 1; sound('extra'); }
  if (game.jackpotReady) {
    addScore(game.jackpot, 'JACKPOT', ramp.x, ramp.y, '#f0abfc'); game.jackpot += 15000; game.jackpotReady = false; sound('jackpot');
    if (game.mission === 5) advanceMission();
  } else addScore(3200, `RAMPE ${ramp.side === 'left' ? 'GAUCHE' : 'DROITE'}`, ramp.x, ramp.y, '#67e8f9');
  if (game.rampLights.left && game.rampLights.right && game.mission === 2) advanceMission();
}

function advanceMission() {
  const completedMission = game.mission;
  game.mission = (game.mission + 1) % game.missionNames.length;
  game.missionsCompleted++;
  if (game.mission === 0) { game.rampLights.left = false; game.rampLights.right = false; game.table.lanes.forEach(lane => { lane.lit = false; }); }
  if (game.mission === 2) game.rampLights = { left: false, right: false };
  if (game.mission === 3) game.spinnerHits = 0;
  if (game.mission === 4) game.lockedBalls = 0;
  game.flash = 0.55; addScore(10000, 'MISSION ACCOMPLIE', 360, 330, '#86efac');
  if (completedMission === game.missionNames.length - 1) startOverdrive();
  else statusElement.textContent = `Mission accomplie ! ${game.missionNames[game.mission]}`;
}

function startOverdrive() {
  game.overdrive = 28; game.overdriveJackpotReady = true; game.jackpotReady = true; game.flash = 1; game.shake = .35;
  const origin = { x: 360, y: 350 }; const live = game.balls.filter(ball => ball.alive && !ball.inShooter).length;
  for (let index = live; index < 3; index++) game.balls.push({ ...createBall(origin.x + (index - 1) * 15, origin.y, false), vx: (index - 1) * 220, vy: -320 - index * 80 });
  sound('extra'); vibrate([50,30,80,30,100]); statusElement.textContent = 'OVERDRIVE NOVA ! Score doublé, multibille et super jackpot pendant 28 secondes.';
}

function updateBall(ball, delta) {
  ball.previousX = ball.x; ball.previousY = ball.y;
  ball.rampCooldown = Math.max(0, ball.rampCooldown - delta); ball.laneCooldown = Math.max(0, ball.laneCooldown - delta); ball.spinnerCooldown = Math.max(0, ball.spinnerCooldown - delta); ball.saucerCooldown = Math.max(0, ball.saucerCooldown - delta);
  if (ball.inShooter && launchHeld) {
    game.launchCharge = Math.min(1, game.launchCharge + delta * 0.72);
    ball.y = 905 + Math.sin(game.elapsed * 7) * game.launchCharge * 5; ball.vx = 0; ball.vy = 0; return;
  }
  ball.vy += difficultySettings[difficultySelect.value].gravity * delta;
  ball.vx *= Math.pow(0.9985, delta * 60); ball.vy *= Math.pow(0.999, delta * 60);
  ball.x += ball.vx * delta; ball.y += ball.vy * delta;
  if (ball.inShooter && ball.y < 125) {
    ball.inShooter = false; ball.x = 590; ball.vx = -190; ball.vy = Math.max(60, Math.abs(ball.vy) * 0.12);
    if (!ball.skillShotChecked) {
      ball.skillShotChecked = true;
      if (ball.launchStrength >= 0.5 && ball.launchStrength <= 0.7) { game.skillShots++; addScore(12000 * game.skillShots, 'SKILL SHOT', 565, 112, '#fde047'); sound('extra'); statusElement.textContent = `Skill shot réussi ×${game.skillShots} !`; }
    }
  }
  for (const wall of game.table.walls) collideSegment(ball, wall, wall.type === 'guide' ? 0.9 : undefined);
  for (const flipper of game.table.flippers) collideFlipper(ball, flipper);
  for (const bumper of game.table.bumpers) collideCircle(ball, bumper, difficultySettings[difficultySelect.value].bumper, () => hitBumper(ball, bumper));
  for (const sling of game.table.slings) collideCircle(ball, sling, 520, () => { if (sling.pulse <= 0.08) { sling.pulse = 0.22; addScore(sling.value, 'FRONDE', sling.x, sling.y); sound('flipper'); } });
  game.table.targets.forEach((target, index) => collideCircle(ball, target, 390, () => hitTarget(ball, target, index)));
  game.table.lanes.forEach((lane, index) => { if (ball.previousY >= lane.y + 22 && ball.y < lane.y + 22 && Math.abs(ball.x - lane.x) < lane.radius) hitLane(ball, lane, index); });
  game.table.ramps.forEach(ramp => { if (ball.previousY >= ramp.y && ball.y < ramp.y && Math.abs(ball.x - ramp.x) < 52) hitRamp(ball, ramp); });
  const spinner = game.table.spinner;
  if ((ball.previousY - spinner.y) * (ball.y - spinner.y) <= 0 && Math.abs(ball.x - spinner.x) <= spinner.halfWidth) hitSpinner(ball);
  const saucer = game.table.saucer;
  if (distance(ball, saucer) < saucer.radius - 2 && Math.hypot(ball.vx, ball.vy) > 90) captureSaucer(ball);
  const leftOutlaneLimit = game.table.flippers[0].pivotX - 34;
  if (ball.alive && game.kickbackLit && ball.y > 940 && ball.x < leftOutlaneLimit) {
    game.kickbackLit = false; ball.x = 105; ball.y = 900; ball.vx = 260; ball.vy = -820;
    addScore(3000, 'KICKBACK', 110, 885, '#86efac'); sound('extra'); vibrate(25); statusElement.textContent = 'Kickback ! La bille revient en jeu.';
  }
  if (ball.x < 24) { ball.x = 24; ball.vx = Math.abs(ball.vx) * 0.75; }
  if (ball.x > WIDTH - 24) { ball.x = WIDTH - 24; ball.vx = -Math.abs(ball.vx) * 0.75; }
  ball.trail.push({ x: ball.x, y: ball.y }); if (ball.trail.length > 9) ball.trail.shift();
  if (ball.y > HEIGHT + 35) drainBall(ball);
}

function collideBalls() {
  for (let first = 0; first < game.balls.length; first++) for (let second = first + 1; second < game.balls.length; second++) {
    const left = game.balls[first]; const right = game.balls[second]; if (!left.alive || !right.alive) continue;
    const dx = right.x - left.x; const dy = right.y - left.y; const length = Math.hypot(dx, dy); const minimum = left.radius + right.radius;
    if (!length || length >= minimum) continue;
    const nx = dx / length; const ny = dy / length; const overlap = (minimum - length) / 2;
    left.x -= nx * overlap; left.y -= ny * overlap; right.x += nx * overlap; right.y += ny * overlap;
    const relative = (right.vx - left.vx) * nx + (right.vy - left.vy) * ny;
    if (relative < 0) { left.vx += relative * nx; left.vy += relative * ny; right.vx -= relative * nx; right.vy -= relative * ny; }
  }
}

function drainBall(ball) {
  if (!ball.alive) return;
  ball.alive = false; sound('drain');
  const survivors = game.balls.filter(item => item.alive);
  if (survivors.length) { statusElement.textContent = `${survivors.length} bille${survivors.length > 1 ? 's' : ''} encore en jeu.`; return; }
  if (game.saver > 0) {
    statusElement.textContent = 'Sauve-bille actif : relance gratuite.'; game.balls = [createBall()]; game.launchCharge = 0; return;
  }
  const bonusScore = game.bonus * 100 * game.multiplier; game.score += bonusScore;
  if (bonusScore) game.popups.push({ x: 360, y: 830, text: `BONUS +${bonusScore.toLocaleString('fr-FR')}`, color: '#fde047', life: 1.8 });
  game.bonus = 0; game.multiplier = Math.max(1, game.multiplier - 1); game.ballsLeft--;
  if (modeSelect.value !== 'timed' && game.ballsLeft <= 0) return finishGame(false, 'Toutes les billes sont perdues.');
  game.balls = [createBall()]; game.launchCharge = 0; game.saver = difficultySettings[difficultySelect.value].saver;
  statusElement.textContent = `Bille suivante. Bonus encaissé : ${bonusScore.toLocaleString('fr-FR')} points.`;
}

function releaseLauncher() {
  if (!game || !running || paused) return;
  const shooterBall = game.balls.find(ball => ball.alive && ball.inShooter);
  if (!shooterBall) return;
  const charge = Math.max(0.18, game.launchCharge);
  shooterBall.vy = -(900 + charge * 760); shooterBall.vx = -4 + game.random() * 8; shooterBall.launchStrength = charge; shooterBall.skillShotChecked = false;
  game.launchCharge = 0; launchedAt = game.elapsed; sound('launch', charge); statusElement.textContent = charge > 0.8 ? 'Lancement maximal !' : 'Bille en jeu.';
}

function nudge(direction = 0) {
  if (!game || !running || paused) return;
  const now = game.elapsed; game.nudges = game.nudges.filter(time => now - time < 2.2); game.nudges.push(now);
  const horizontal = direction || (game.random() < 0.5 ? -1 : 1);
  game.balls.forEach(ball => { ball.vx += horizontal * 90; ball.vy -= 45; }); game.shake = 0.18; vibrate(18);
  if (game.nudges.length >= 3) { game.tilted = 4; game.nudges = []; statusElement.textContent = 'TILT ! Batteurs neutralisés pendant quatre secondes.'; sound('tilt'); }
  else statusElement.textContent = `Table secouée · avertissement ${game.nudges.length}/3.`;
}

function update(delta) {
  if (!game || game.completed) return;
  game.elapsed += delta; game.saver = Math.max(0, game.saver - delta); game.comboTimer = Math.max(0, game.comboTimer - delta);
  if (!game.comboTimer) game.combo = 0;
  game.tilted = Math.max(0, game.tilted - delta); game.flash = Math.max(0, game.flash - delta); game.shake = Math.max(0, game.shake - delta); const overdriveBefore = game.overdrive; game.overdrive = Math.max(0, game.overdrive - delta); if (overdriveBefore > 0 && !game.overdrive) { game.overdriveJackpotReady = false; statusElement.textContent = `Overdrive terminé. ${game.missionNames[game.mission]}`; }
  if (modeSelect.value === 'timed') { game.timeLeft -= delta; if (game.timeLeft <= 0) return finishGame(true, 'Les trois minutes sont écoulées.'); }
  updateFlippers(delta);
  game.table.bumpers.forEach(item => { item.pulse = Math.max(0, item.pulse - delta); });
  game.table.slings.forEach(item => { item.pulse = Math.max(0, item.pulse - delta); });
  game.table.targets.forEach(item => { item.pulse = Math.max(0, item.pulse - delta); });
  game.table.spinner.angle += game.table.spinner.speed * delta; game.table.spinner.speed *= Math.pow(0.05, delta); game.table.spinner.pulse = Math.max(0, game.table.spinner.pulse - delta);
  game.table.saucer.pulse = Math.max(0, game.table.saucer.pulse - delta);
  for (const ball of game.balls) if (ball.alive) updateBall(ball, delta);
  collideBalls(); game.balls = game.balls.filter(ball => ball.alive);
  game.particles.forEach(particle => { particle.x += particle.vx * delta; particle.y += particle.vy * delta; particle.vy += 90 * delta; particle.life -= delta; });
  game.popups.forEach(popup => { popup.y -= 32 * delta; popup.life -= delta; });
  game.particles = game.particles.filter(item => item.life > 0); game.popups = game.popups.filter(item => item.life > 0);
  remoteGhosts.forEach(ghost => { ghost.displayX += (ghost.x - ghost.displayX) * Math.min(1, delta * 11); ghost.displayY += (ghost.y - ghost.displayY) * Math.min(1, delta * 11); });
  const leadBall = game.balls.find(ball => ball.alive && !ball.inShooter) || game.balls[0];
  if (leadBall) window.LanMultiplayer?.sendGhost({ x: leadBall.x, y: leadBall.y, vx: leadBall.vx, vy: leadBall.vy, progress: Math.min(1, game.score / 500000), state: game.balls.length > 1 ? 'multiball' : leadBall.inShooter ? 'launcher' : 'play' })?.catch(() => {});
}

function finishGame(won, reason) {
  if (!game || game.completed) return;
  game.completed = true; running = false; controls.clear(); launchHeld = false;
  const title = game.score >= 500000 ? 'Maître de la Nova' : game.score >= 150000 ? 'Table maîtrisée' : 'Partie terminée';
  document.getElementById('overlayTitle').textContent = title;
  document.getElementById('overlayText').textContent = `${reason} Score final : ${game.score.toLocaleString('fr-FR')} points.`;
  document.getElementById('overlay').hidden = false;
  window.GameRecords?.finish({ score: game.score, scoreLabel: `${game.score.toLocaleString('fr-FR')} points`, won: won || game.score > 0 });
  draw();
}

function updateHud() {
  if (!game) return;
  document.getElementById('score').textContent = game.score.toLocaleString('fr-FR');
  document.getElementById('balls').textContent = modeSelect.value === 'timed' ? '∞' : Math.max(0, game.ballsLeft);
  document.getElementById('multiplier').textContent = `×${game.multiplier}`;
  document.getElementById('time').textContent = modeSelect.value === 'timed' ? `${Math.max(0, game.timeLeft).toFixed(1).replace('.', ',')} s` : `${Math.floor(game.elapsed / 60)}:${String(Math.floor(game.elapsed % 60)).padStart(2, '0')}`;
  document.getElementById('targets').textContent = `${game.table.targets.filter(target => target.lit).length} / 4`;
  document.getElementById('spinner').textContent = game.spinnerHits.toLocaleString('fr-FR');
  document.getElementById('locks').textContent = `${game.lockedBalls} / 2${game.lockReady ? ' · prêt' : ''}`;
  document.getElementById('locks').classList.toggle('ready', game.lockReady);
  document.getElementById('kickback').textContent = game.kickbackLit ? 'Chargé' : 'Éteint';
  document.getElementById('kickback').classList.toggle('ready', game.kickbackLit);
  document.getElementById('jackpot').textContent = game.jackpot.toLocaleString('fr-FR');
  document.getElementById('bonus').textContent = (game.bonus * 100).toLocaleString('fr-FR');
  document.getElementById('overdrive').textContent = game.overdrive > 0 ? `${game.overdrive.toFixed(1).replace('.', ',')} s · ×2` : `${game.missionsCompleted % game.missionNames.length} / ${game.missionNames.length}`;
  document.getElementById('overdrive').classList.toggle('ready', game.overdrive > 0);
  game.table.lanes.forEach((lane, index) => document.getElementById(`lane${'ABC'[index]}`).classList.toggle('on', lane.lit));
  document.getElementById('missionText').textContent = game.missionNames[game.mission];
  let progress = 0; let maximum = 1;
  if (game.mission === 0) { progress = game.table.lanes.filter(lane => lane.lit).length; maximum = 3; }
  if (game.mission === 1) { progress = game.table.targets.filter(target => target.lit).length; maximum = 4; }
  if (game.mission === 2) { progress = Number(game.rampLights.left) + Number(game.rampLights.right); maximum = 2; }
  if (game.mission === 3) { progress = Math.min(10, game.spinnerHits); maximum = 10; }
  if (game.mission === 4) { progress = game.lockedBalls; maximum = 2; }
  if (game.mission === 5) { progress = Number(game.jackpotReady); maximum = 1; }
  document.getElementById('missionProgress').textContent = `${progress} / ${maximum}`;
  document.getElementById('missionMeter').style.width = `${progress / maximum * 100}%`;
}

function drawRoundedRect(x, y, width, height, radius) {
  context.beginPath(); context.roundRect(x, y, width, height, radius); context.fill(); context.stroke();
}

function drawTable() {
  const theme = themes[themeSelect.value];
  const gradient = context.createLinearGradient(0, 0, WIDTH, HEIGHT); gradient.addColorStop(0, theme.field2); gradient.addColorStop(0.52, theme.field); gradient.addColorStop(1, '#050816');
  context.fillStyle = gradient; context.fillRect(0, 0, WIDTH, HEIGHT);
  context.save(); context.globalAlpha = 0.18; context.strokeStyle = theme.accent; context.lineWidth = 2;
  for (let radius = 100; radius < 620; radius += 68) { context.beginPath(); context.arc(360, 350, radius, Math.PI * 1.05, Math.PI * 1.95); context.stroke(); }
  context.restore();
  context.fillStyle = '#02061799'; context.fillRect(611, 95, 55, 850);
  if (game.overdrive > 0) { const pulse = .12 + Math.sin(game.elapsed * 12) * .05; context.fillStyle = `rgba(250,204,21,${pulse})`; context.fillRect(52, 88, 553, 835); context.strokeStyle = '#fde047'; context.lineWidth = 5; context.strokeRect(57, 93, 543, 825); context.fillStyle = '#fef08a'; context.font = '900 20px Arial'; context.textAlign = 'center'; context.fillText(`OVERDRIVE ${game.overdrive.toFixed(1)} s · SUPER ${game.superJackpot.toLocaleString('fr-FR')}`, 360, 116); }
  context.fillStyle = theme.text; context.globalAlpha = 0.18; context.font = '900 72px Arial'; context.textAlign = 'center'; context.fillText(themeSelect.value === 'retro' ? 'ORBIT 79' : themeSelect.value === 'abyss' ? 'ABYSS' : 'NOVA', 360, 660); context.globalAlpha = 1;
  context.lineCap = 'round'; context.lineJoin = 'round';
  game.table.walls.forEach(wall => { context.strokeStyle = wall.type === 'guide' ? theme.accent : theme.rail; context.shadowColor = theme.railGlow; context.shadowBlur = wall.type === 'guide' ? 7 : 11; context.lineWidth = wall.type === 'guide' ? 8 : 9; context.beginPath(); context.moveTo(wall.x1, wall.y1); context.lineTo(wall.x2, wall.y2); context.stroke(); }); context.shadowBlur = 0;
  game.table.ramps.forEach(ramp => { const lit = game.rampLights[ramp.side]; context.strokeStyle = lit ? '#facc15' : theme.accent; context.lineWidth = 6; context.beginPath(); context.arc(ramp.x, ramp.y + 7, 49, Math.PI * 1.15, Math.PI * 1.85); context.stroke(); context.fillStyle = lit ? '#fef08a' : theme.text; context.font = '800 15px Arial'; context.fillText(ramp.side === 'left' ? 'RAMPE L' : 'RAMPE R', ramp.x, ramp.y + 45); });
  const spinner = game.table.spinner; context.save(); context.translate(spinner.x, spinner.y); context.rotate(spinner.angle); context.shadowColor = '#f472b6'; context.shadowBlur = spinner.pulse ? 22 : 7; context.fillStyle = '#f9a8d4'; context.strokeStyle = '#fff1f2'; context.lineWidth = 3; drawRoundedRect(-spinner.halfWidth, -7, spinner.halfWidth * 2, 14, 6); context.restore(); context.shadowBlur = 0;
  const saucer = game.table.saucer; context.save(); context.translate(saucer.x, saucer.y); context.shadowColor = game.lockReady ? '#22c55e' : theme.rail; context.shadowBlur = 12 + saucer.pulse * 35; context.fillStyle = '#020617'; context.strokeStyle = game.lockReady ? '#86efac' : theme.railGlow; context.lineWidth = 6; context.beginPath(); context.arc(0, 0, saucer.radius, 0, Math.PI * 2); context.fill(); context.stroke(); context.fillStyle = game.lockReady ? '#86efac' : theme.text; context.font = '900 11px Arial'; context.textAlign = 'center'; context.fillText(game.lockReady ? 'LOCK' : 'NOVA', 0, 4); context.restore(); context.shadowBlur = 0;
  for (let index = 0; index < 2; index++) { context.fillStyle = index < game.lockedBalls ? '#22c55e' : '#334155'; context.strokeStyle = '#bbf7d0'; context.lineWidth = 2; context.beginPath(); context.arc(78 + index * 20, 382, 7, 0, Math.PI * 2); context.fill(); context.stroke(); }
  context.strokeStyle = game.kickbackLit ? '#22c55e' : '#475569'; context.shadowColor = '#22c55e'; context.shadowBlur = game.kickbackLit ? 14 : 0; context.lineWidth = 7; context.beginPath(); context.moveTo(78, 790); context.lineTo(106, 890); context.stroke(); context.shadowBlur = 0; context.fillStyle = game.kickbackLit ? '#86efac' : '#94a3b8'; context.font = '900 12px Arial'; context.fillText('KICK', 93, 776);
  game.table.lanes.forEach(lane => { context.fillStyle = lane.lit ? '#facc15' : '#334155'; context.strokeStyle = lane.lit ? '#fef08a' : theme.railGlow; context.lineWidth = 3; context.beginPath(); context.arc(lane.x, lane.y, lane.radius, 0, Math.PI * 2); context.fill(); context.stroke(); context.fillStyle = lane.lit ? '#422006' : theme.text; context.font = '900 22px Arial'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(lane.letter, lane.x, lane.y + 1); });
  game.table.bumpers.forEach(bumper => { const scale = 1 + bumper.pulse * 0.65; context.save(); context.translate(bumper.x, bumper.y); context.scale(scale, scale); context.shadowColor = theme.bumper; context.shadowBlur = 18 + bumper.pulse * 45; context.fillStyle = theme.bumper; context.strokeStyle = theme.bumperCore; context.lineWidth = 7; context.beginPath(); context.arc(0, 0, bumper.radius, 0, Math.PI * 2); context.fill(); context.stroke(); context.fillStyle = theme.bumperCore; context.beginPath(); context.arc(0, 0, bumper.radius * 0.42, 0, Math.PI * 2); context.fill(); context.restore(); }); context.shadowBlur = 0;
  game.table.slings.forEach((sling, index) => { context.fillStyle = sling.pulse ? '#facc15cc' : `${theme.rail}88`; context.strokeStyle = theme.railGlow; context.lineWidth = 4; context.beginPath(); const direction = index ? -1 : 1; context.moveTo(sling.x - direction * 32, sling.y - 44); context.lineTo(sling.x + direction * 48, sling.y + 32); context.lineTo(sling.x - direction * 35, sling.y + 18); context.closePath(); context.fill(); context.stroke(); });
  game.table.targets.forEach((target, index) => { context.save(); context.translate(target.x, target.y); context.rotate((index - 1.5) * 0.045); context.fillStyle = target.lit ? '#22c55e' : theme.target; context.strokeStyle = target.pulse ? '#fff' : theme.railGlow; context.lineWidth = 3 + target.pulse * 8; drawRoundedRect(-16, -25, 32, 50, 7); context.fillStyle = '#07111f'; context.font = '900 16px Arial'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(index + 1, 0, 1); context.restore(); });
  context.fillStyle = game.saver > 0 ? '#22c55e' : '#ef4444'; context.font = '800 14px Arial'; context.textAlign = 'center'; context.fillText(game.saver > 0 ? `SAUVE-BILLE ${game.saver.toFixed(1)} s` : 'DRAIN OUVERT', 360, 964);
  if (game.tilted > 0) { context.fillStyle = '#ef4444'; context.font = '900 48px Arial'; context.fillText('TILT', 360, 790); }
}

function drawFlippers() {
  const theme = themes[themeSelect.value];
  for (const flipper of game.table.flippers) {
    const tipX = flipper.pivotX + Math.cos(flipper.angle) * flipper.length; const tipY = flipper.pivotY + Math.sin(flipper.angle) * flipper.length;
    context.strokeStyle = game.tilted > 0 ? '#64748b' : theme.accent; context.shadowColor = theme.accent; context.shadowBlur = 12; context.lineWidth = flipper.radius * 2; context.beginPath(); context.moveTo(flipper.pivotX, flipper.pivotY); context.lineTo(tipX, tipY); context.stroke();
    context.strokeStyle = theme.text; context.shadowBlur = 0; context.lineWidth = 4; context.beginPath(); context.moveTo(flipper.pivotX, flipper.pivotY); context.lineTo(tipX, tipY); context.stroke();
  }
}

function drawBall(ball, alpha = 1, tint = null) {
  context.save(); context.globalAlpha = alpha;
  if (effectsToggle.checked) ball.trail?.forEach((point, index) => { context.globalAlpha = alpha * index / Math.max(1, ball.trail.length) * 0.22; context.fillStyle = tint || '#dbeafe'; context.beginPath(); context.arc(point.x, point.y, BALL_RADIUS * 0.72, 0, Math.PI * 2); context.fill(); });
  context.globalAlpha = alpha; const gradient = context.createRadialGradient(ball.x - 4, ball.y - 5, 1, ball.x, ball.y, BALL_RADIUS); gradient.addColorStop(0, '#fff'); gradient.addColorStop(0.35, tint || '#dbeafe'); gradient.addColorStop(1, tint ? '#7e22ce' : '#475569'); context.fillStyle = gradient; context.shadowColor = tint || '#fff'; context.shadowBlur = 9; context.beginPath(); context.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2); context.fill(); context.restore();
}

function drawLauncher() {
  const theme = themes[themeSelect.value]; const charge = game.launchCharge;
  context.fillStyle = '#0f172a'; context.fillRect(622, 828, 38, 120);
  context.fillStyle = theme.accent; context.fillRect(630, 937 - charge * 92, 22, 6 + charge * 92);
  context.strokeStyle = theme.railGlow; context.lineWidth = 3; context.strokeRect(630, 839, 22, 98);
  context.fillStyle = '#facc1544'; context.fillRect(627, 937 - 0.7 * 92, 28, 0.2 * 92); context.strokeStyle = '#fde047'; context.lineWidth = 2; context.strokeRect(627, 937 - 0.7 * 92, 28, 0.2 * 92);
}

function drawEffects() {
  game.particles.forEach(particle => { context.globalAlpha = clamp(particle.life * 2, 0, 1); context.fillStyle = particle.color; context.fillRect(particle.x - 2, particle.y - 2, 5, 5); });
  context.globalAlpha = 1; context.textAlign = 'center'; context.textBaseline = 'middle'; context.font = '900 18px Arial';
  game.popups.forEach(popup => { context.globalAlpha = clamp(popup.life, 0, 1); context.fillStyle = popup.color; context.shadowColor = '#000'; context.shadowBlur = 5; context.fillText(popup.text, popup.x, popup.y); }); context.globalAlpha = 1; context.shadowBlur = 0;
  if (effectsToggle.checked && game.flash > 0) { context.fillStyle = `rgba(255,255,255,${game.flash * 0.22})`; context.fillRect(0, 0, WIDTH, HEIGHT); }
}

function drawGhosts() {
  const now = performance.now();
  remoteGhosts.forEach((ghost, playerId) => {
    if (now - ghost.receivedAt > 2200) { remoteGhosts.delete(playerId); return; }
    drawBall({ x: ghost.displayX, y: ghost.displayY, trail: [] }, 0.34, '#e879f9');
  });
}

function draw() {
  context.save();
  if (effectsToggle.checked && game?.shake > 0) context.translate((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 7);
  if (!game) { context.fillStyle = '#080d20'; context.fillRect(0, 0, WIDTH, HEIGHT); context.fillStyle = '#e9d5ff'; context.font = '900 34px Arial'; context.textAlign = 'center'; context.fillText('FLIPPER NOVA', WIDTH / 2, HEIGHT / 2); context.restore(); return; }
  drawTable(); drawLauncher(); drawGhosts(); game.balls.forEach(ball => drawBall(ball)); drawFlippers(); drawEffects(); context.restore();
}

function loop(now) {
  const elapsed = Math.min(0.05, Math.max(0, (now - previousTime) / 1000)); previousTime = now;
  if (running && !paused) {
    accumulator = Math.min(0.1, accumulator + elapsed);
    while (accumulator >= FIXED_STEP) { update(FIXED_STEP); accumulator -= FIXED_STEP; }
    updateHud();
  }
  draw(); animationFrame = requestAnimationFrame(loop);
}

function setControl(control, pressed) {
  if (!game || !running || paused) return;
  if (control === 'launch') {
    if (pressed) launchHeld = true;
    else if (launchHeld) { launchHeld = false; releaseLauncher(); }
    return;
  }
  if (control.startsWith('nudge')) { if (pressed) nudge(control === 'nudgeLeft' ? -1 : control === 'nudgeRight' ? 1 : 0); return; }
  const wasPressed = controls.has(control);
  if (pressed) controls.add(control); else controls.delete(control);
  if (pressed && !wasPressed && (control === 'left' || control === 'right')) { sound('flipper'); vibrate(6); }
}

function keyboardControl(event) {
  if (event.target.matches('select,input,button,a')) return;
  const key = event.key.toLowerCase();
  if (key === 'p' && event.type === 'keydown' && !event.repeat) { togglePause(); event.preventDefault(); return; }
  const control = event.code === 'Space' ? 'launch' : event.key === 'ArrowLeft' || key === 'q' ? 'left' : event.key === 'ArrowRight' || key === 'd' ? 'right' : key === 'a' ? 'nudgeLeft' : key === 'e' ? 'nudgeRight' : event.key === 'ArrowUp' || key === 'z' ? 'nudge' : null;
  if (!control) return;
  event.preventDefault();
  if (event.type === 'keydown' && event.repeat && control === 'nudge') return;
  setControl(control, event.type === 'keydown');
}

function togglePause() {
  if (!game || game.completed) return;
  paused = !paused; controls.clear(); launchHeld = false; document.getElementById('pause').textContent = paused ? 'Reprendre' : 'Pause';
  statusElement.textContent = paused ? 'Partie en pause.' : 'Partie reprise.';
  if (!paused) { previousTime = performance.now(); accumulator = 0; }
}

document.addEventListener('keydown', keyboardControl);
document.addEventListener('keyup', keyboardControl);
window.addEventListener('blur', () => { controls.clear(); canvasPointers.clear(); launchHeld = false; });
document.getElementById('start').addEventListener('click', startGame);
document.getElementById('replay').addEventListener('click', startGame);
document.getElementById('pause').addEventListener('click', togglePause);
themeSelect.addEventListener('change', draw);
effectsToggle.addEventListener('change', draw);
flipperStyleSelect.addEventListener('change', () => {
  if (running && !game?.completed) statusElement.textContent = 'Le réglage des batteurs sera appliqué à la prochaine partie.';
  else { game = createGame('preview'); updateHud(); draw(); }
});
canvas.addEventListener('pointerdown', event => {
  canvas.focus({ preventScroll: true });
  if (!running || paused) return;
  event.preventDefault(); canvas.setPointerCapture?.(event.pointerId);
  const bounds = canvas.getBoundingClientRect(); const control = event.clientX - bounds.left < bounds.width / 2 ? 'left' : 'right';
  canvasPointers.set(event.pointerId, control); setControl(control, true);
});
const releaseCanvasPointer = event => {
  const control = canvasPointers.get(event.pointerId); if (!control) return;
  event.preventDefault(); canvasPointers.delete(event.pointerId);
  if (![...canvasPointers.values()].includes(control)) setControl(control, false);
};
canvas.addEventListener('pointerup', releaseCanvasPointer); canvas.addEventListener('pointercancel', releaseCanvasPointer); canvas.addEventListener('lostpointercapture', releaseCanvasPointer);
document.querySelectorAll('[data-control]').forEach(button => {
  const control = button.dataset.control;
  const release = event => { event.preventDefault(); button.classList.remove('active'); setControl(control, false); };
  button.addEventListener('pointerdown', event => { event.preventDefault(); button.setPointerCapture?.(event.pointerId); button.classList.add('active'); setControl(control, true); });
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
});
window.addEventListener('lan:ghost', event => { const snapshot = event.detail; const previous = remoteGhosts.get(snapshot.playerId); remoteGhosts.set(snapshot.playerId, { ...snapshot, displayX: previous?.displayX ?? snapshot.x, displayY: previous?.displayY ?? snapshot.y }); });
window.addEventListener('lan:pause', event => { if (game && paused !== Boolean(event.detail?.paused)) togglePause(); });
window.addEventListener('lan:start', startGame);
document.addEventListener('visibilitychange', () => { if (document.hidden && running && !paused) togglePause(); });
game = createGame('preview'); updateHud();
window.PinballTestAPI = {
  diagnostics: () => ({ canvas: WIDTH === 720 && HEIGHT === 1000, difficulties: Object.keys(difficultySettings), modes: [...modeSelect.options].map(option => option.value), themes: Object.keys(themes), flipperStyles: Object.keys(flipperSettings), mobileControls: document.querySelectorAll('[data-control]').length, directTouchFlippers: getComputedStyle(canvas).touchAction === 'none' && canvas.hasAttribute('tabindex'), bumpers: game.table.bumpers.length, targets: game.table.targets.length, lanes: game.table.lanes.length, flippers: game.table.flippers.length, spinner: Boolean(game.table.spinner), saucer: Boolean(game.table.saucer) }),
  selfTest() {
    const testBall = { x: 100, y: 95, vx: 0, vy: -200, radius: BALL_RADIUS };
    const bounced = collideSegment(testBall, segment(50, 86, 585, 86)) && testBall.vy > 0;
    const table = buildTable();
    const previousGame = game;
    const previousStatus = statusElement.textContent;
    const previousSound = soundToggle.checked; const previousHaptics = hapticsToggle.checked;
    soundToggle.checked = false; hapticsToggle.checked = false;
    const previousLaunchHeld = launchHeld; launchHeld = false;
    game = createGame('launcher-test');
    const launchedBall = game.balls[0]; launchedBall.vy = -1500;
    for (let step = 0; step < 360 && launchedBall.inShooter; step++) updateBall(launchedBall, FIXED_STEP);
    const launchesIntoPlayfield = !launchedBall.inShooter && launchedBall.x < 608 && Number.isFinite(launchedBall.vx + launchedBall.vy);
    game = createGame('mechanics-test');
    const spinnerBall = { ...createBall(360, 472, false), vx: 40, vy: -720 }; hitSpinner(spinnerBall);
    const spinnerScores = game.spinnerHits >= 4 && game.score > 0;
    const skillBall = { ...createBall(641, 120, true), vy: -200, launchStrength: 0.6 }; game.balls = [skillBall]; updateBall(skillBall, FIXED_STEP);
    const skillShotScores = game.skillShots === 1;
    const firstLock = createBall(game.table.saucer.x, game.table.saucer.y, false); game.balls = [firstLock]; game.lockReady = true; captureSaucer(firstLock);
    const firstBallLocks = game.lockedBalls === 1 && game.balls.some(ball => ball.inShooter);
    const secondLock = createBall(game.table.saucer.x, game.table.saucer.y, false); game.balls = [secondLock]; game.lockReady = true; captureSaucer(secondLock);
    const multiballStarts = game.balls.filter(ball => ball.alive && !ball.inShooter).length === 3 && game.jackpotReady;
    game = previousGame; launchHeld = previousLaunchHeld; statusElement.textContent = previousStatus; soundToggle.checked = previousSound; hapticsToggle.checked = previousHaptics;
    return { bounced, launchesIntoPlayfield, spinnerScores, skillShotScores, firstBallLocks, multiballStarts, launcherFloor: table.walls.some(wall => wall.y1 === 952 && wall.y2 === 952), symmetricFlippers: Math.abs((table.flippers[0].pivotX + table.flippers[1].pivotX) - WIDTH) < 0.01 };
  }
};
try { localStorage.setItem('game-hub:last-game', 'pinball'); } catch {}
draw();
