'use strict';

const canvas = document.getElementById('screen');
const context = canvas.getContext('2d');
const difficultySelect = document.getElementById('difficulty');
const lengthSelect = document.getElementById('length');
const themeSelect = document.getElementById('theme');
const modeSelect = document.getElementById('mode');
const statusElement = document.getElementById('status');
const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const controls = new Set();
const difficultySettings = {
  easy: { gap: 72, enemies: 0.45, speed: 0.72, lives: 5, checkpoints: 1050, score: 0.8 },
  normal: { gap: 96, enemies: 0.65, speed: 0.88, lives: 3, checkpoints: 1450, score: 1 },
  hard: { gap: 116, enemies: 0.82, speed: 1.05, lives: 3, checkpoints: 1850, score: 1.45 },
  extreme: { gap: 132, enemies: 0.95, speed: 1.22, lives: 2, checkpoints: 2300, score: 2 }
};
const lengthSettings = { short: 3600, normal: 6200, long: 9400 };
const themeSettings = {
  meadow: { sky: '#7dd3fc', far: '#60a5fa', ground: '#4d7c0f', top: '#a3e635', detail: '#fef08a' },
  cavern: { sky: '#111827', far: '#312e81', ground: '#475569', top: '#94a3b8', detail: '#c084fc' },
  sunset: { sky: '#fb7185', far: '#7c3aed', ground: '#7c2d12', top: '#fb923c', detail: '#fde68a' }
};
const PLATFORM_PHYSICS = Object.freeze({ jumpSpeed: 440, gravity: 1180, runSpeed: 235, safety: 0.78, maximumRise: 64 });
let game = null;
let running = false;
let paused = false;
let frame = 0;
let lastTime = 0;
const remoteGhosts = new Map();

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const overlaps = (left, right) => left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y;
const random = () => game?.random?.() ?? Math.random();

function createPlayer() { return { x: 80, y: 390, width: 28, height: 38, vx: 0, vy: 0, grounded: false, coyote: 0, jumpBuffer: 0, facing: 1, dash: 0, dashCooldown: 0, invulnerable: 0, power: 'small', fireCooldown: 0 }; }

function horizontalGap(first, second) {
  if (first.x + first.width < second.x) return second.x - first.x - first.width;
  if (second.x + second.width < first.x) return first.x - second.x - second.width;
  return 0;
}

function maximumJumpGap(rise) {
  const discriminant = PLATFORM_PHYSICS.jumpSpeed ** 2 - 2 * PLATFORM_PHYSICS.gravity * Math.max(0, rise);
  if (discriminant < 0) return 0;
  const flight = (PLATFORM_PHYSICS.jumpSpeed + Math.sqrt(discriminant)) / PLATFORM_PHYSICS.gravity;
  return PLATFORM_PHYSICS.runSpeed * flight * PLATFORM_PHYSICS.safety;
}

function canJumpBetween(first, second) {
  const rise = first.y - second.y; return rise <= PLATFORM_PHYSICS.maximumRise && horizontalGap(first, second) <= maximumJumpGap(rise);
}

function validateLevel(level) {
  const reachable = new Set([0]); let changed = true;
  while (changed) { changed = false; level.platforms.forEach((target, index) => { if (!reachable.has(index) && [...reachable].some(source => canJumpBetween(level.platforms[source], target))) { reachable.add(index); changed = true; } }); }
  const bounds = [...level.platforms, ...level.movingPlatforms].every(platform => platform.x >= 0 && platform.y >= 0 && platform.x + platform.width <= level.width && platform.y < HEIGHT);
  const safePipes = level.pipes.every(pipe => pipe.destination && level.platforms.includes(pipe.destination));
  return { valid: reachable.size === level.platforms.length && bounds && safePipes, reachable: reachable.size, platforms: level.platforms.length, bounds, safePipes };
}

function generateLevel(seed = `${Date.now()}:${Math.random()}`) {
  const seeded = window.GameRuntime?.createRandom(`pocket:${seed}:${difficultySelect.value}:${lengthSelect.value}:${themeSelect.value}`) || Math.random;
  const settings = difficultySettings[difficultySelect.value];
  const targetWidth = lengthSettings[lengthSelect.value];
  const platforms = [{ x: 0, y: 470, width: 430, height: 70 }];
  const gems = [];
  const enemies = [];
  const checkpoints = [];
  const movingPlatforms = [];
  const springs = [];
  const hazards = [];
  const blocks = [];
  const pipes = [];
  let x = 430;
  let y = 470;
  let nextCheckpoint = settings.checkpoints;
  let previousPlatform = platforms[0]; let maximumGap = 0;
  while (x < targetWidth - 650) {
    const width = 130 + seeded() * 210;
    const rise = (seeded() - 0.5) * 130;
    y = Math.max(previousPlatform.y - PLATFORM_PHYSICS.maximumRise, clamp(y + rise, 255, 475)); const upwardRise = previousPlatform.y - y;
    const requestedGap = 34 + seeded() * settings.gap; const gap = Math.min(requestedGap, Math.max(54, maximumJumpGap(upwardRise) - 8)); maximumGap = Math.max(maximumGap, gap);
    x += gap;
    const platform = { x, y, width, height: HEIGHT - y + 50, routeIndex: platforms.length };
    platforms.push(platform);
    const gemCount = 1 + (seeded() < 0.35 ? 1 : 0);
    for (let index = 0; index < gemCount; index++) gems.push({ x: x + width * (index + 1) / (gemCount + 1), y: y - 28 - (index % 2) * 18, radius: 9, collected: false });
    if (width > 190 && seeded() < settings.enemies) { const type = seeded() < 0.24 ? 'jumper' : seeded() < 0.28 ? 'flyer' : 'walker'; enemies.push({ type, x: x + 45 + seeded() * (width - 90), y: type === 'flyer' ? y - 100 : y - 27, width: 28, height: 27, left: x + 15, right: x + width - 43, vx: (seeded() < 0.5 ? -1 : 1) * 48 * settings.speed, vy: 0, phase: seeded() * Math.PI * 2, dead: false }); }
    if (width > 250 && seeded() < 0.3) springs.push({ x: x + 35 + seeded() * (width - 70), y: y - 15, width: 32, height: 15 });
    if (width > 280 && seeded() < 0.32) hazards.push({ x: x + width * 0.42, y: y - 16, width: Math.min(90, width * 0.25), height: 16 });
    if (seeded() < 0.42) blocks.push({ x: x + width * 0.48, y: y - 95 - seeded() * 45, width: 34, height: 34, hit: false, reward: seeded() < 0.5 ? 'grow' : 'fire' });
    if (gap > 82 && seeded() < 0.75) movingPlatforms.push({ x: x - gap + gap * 0.2, y: Math.min(y - 50, 410), width: Math.max(68, gap * 0.52), height: 15, originX: x - gap + gap * 0.2, range: Math.max(35, gap * 0.26), phase: seeded() * Math.PI * 2, speed: 0.8 + seeded(), moving: true, deltaX: 0 });
    if (width > 300 && seeded() < 0.12) pipes.push({ x: x + width - 85, y: y - 48, width: 48, height: 48, bonus: 350, sourceIndex: platforms.length - 1, destination: null });
    if (x >= nextCheckpoint) { checkpoints.push({ x: x + 26, y: y - 48, platformY: y, active: false }); nextCheckpoint += settings.checkpoints; }
    x += width; previousPlatform = platform;
  }
  if (!movingPlatforms.length) movingPlatforms.push({ x: 445, y: 390, width: 86, height: 15, originX: 445, range: 42, phase: 0, speed: 1, moving: true, deltaX: 0 });
  if (!springs.length) springs.push({ x: 270, y: 455, width: 32, height: 15 });
  if (!hazards.length && platforms[1]) hazards.push({ x: platforms[1].x + platforms[1].width * 0.52, y: platforms[1].y - 16, width: 48, height: 16 });
  if (!blocks.length) blocks.push({ x: 320, y: 360, width: 34, height: 34, hit: false, reward: 'grow' });
  const finalY = clamp(previousPlatform.y + (seeded() - 0.5) * 80, 360, 455); const finalRise = previousPlatform.y - finalY; const finalGap = Math.min(72, maximumJumpGap(finalRise) - 12); const finalPlatform = { x: previousPlatform.x + previousPlatform.width + finalGap, y: finalY, width: 430, height: HEIGHT - finalY + 50, routeIndex: platforms.length, final: true };
  platforms.push(finalPlatform); maximumGap = Math.max(maximumGap, finalGap); const levelWidth = Math.max(targetWidth, finalPlatform.x + finalPlatform.width);
  pipes.forEach(pipe => { const targetIndex = Math.min(platforms.length - 1, pipe.sourceIndex + 2 + Math.floor(seeded() * 2)); pipe.destination = platforms[targetIndex]; });
  return { random: seeded, width: levelWidth, platforms, movingPlatforms, springs, hazards, blocks, pipes, gems, enemies, checkpoints, exit: { x: finalPlatform.x + finalPlatform.width - 105, y: finalPlatform.y - 70, width: 45, height: 70 }, maxGeneratedGap: maximumGap };
}

function createGame(seed) {
  const level = generateLevel(seed);
  return { ...level, player: createPlayer(), particles: [], projectiles: [], powerUps: [], camera: 0, score: 0, collected: 0, combo: 0, comboTimer: 0, lives: difficultySettings[difficultySelect.value].lives, elapsed: 0, checkpoint: { x: 80, y: 390, label: 'Départ', power: 'small' }, completed: false };
}

function startGame() {
  cancelAnimationFrame(frame);
  game = createGame(new URLSearchParams(location.search).get('seed') || `${Date.now()}:${Math.random()}`);
  running = true; paused = false; controls.clear();
  document.getElementById('overlay').hidden = true; document.getElementById('pause').textContent = 'Pause';
  statusElement.textContent = 'Le portail se trouve au bout du niveau.';
  window.GameRecords?.reset(); updateHud(); lastTime = performance.now(); frame = requestAnimationFrame(loop);
}

function jump() { if (!game || !running) return; game.player.jumpBuffer = 0.12; }
function dash() { if (!game || !running || game.player.dashCooldown > 0) return; const player = game.player; player.dash = 0.16; player.dashCooldown = 1.15; player.vx = player.facing * 570; player.vy *= 0.25; addParticles(player.x, player.y + 18, '#fef08a', 12); }
function fire() { if (!game || !running || game.player.power !== 'fire' || game.player.fireCooldown > 0) return; const player = game.player; player.fireCooldown = 0.28; game.projectiles.push({ x: player.x + player.width / 2, y: player.y + 16, vx: player.facing * 450, width: 12, height: 8, life: 2 }); addParticles(player.x, player.y + 15, '#fb923c', 4); }
function addParticles(x, y, color, count) { for (let index = 0; index < count; index++) game.particles.push({ x, y, vx: (random() - 0.5) * 180, vy: -30 - random() * 150, life: 0.3 + random() * 0.5, color }); }

function respawn() {
  game.lives--;
  if (game.lives <= 0) return finish(false, 'Aventure terminée', `Vous avez récupéré ${game.collected} gemmes.`);
  Object.assign(game.player, createPlayer(), { x: game.checkpoint.x, y: game.checkpoint.y, power: game.checkpoint.power || 'small', invulnerable: 1.4 });
  statusElement.textContent = `Retour au point de reprise — ${game.lives} vie${game.lives > 1 ? 's' : ''}.`;
}

function hurtPlayer(reason = 'Touché par un danger.') {
  const player = game.player; if (player.invulnerable > 0) return;
  if (player.power !== 'small') { player.power = player.power === 'fire' ? 'large' : 'small'; player.invulnerable = 1.4; player.vx = -player.facing * 230; player.vy = -260; statusElement.textContent = `${reason} Le pouvoir a absorbé le choc.`; return; }
  game.lives--; player.invulnerable = 1.1; player.vx = -player.facing * 230; player.vy = -260; statusElement.textContent = reason; if (game.lives <= 0) finish(false, 'Aventure terminée', `Score final : ${game.score.toLocaleString('fr-FR')}.`);
}

function updatePlayer(delta) {
  const player = game.player;
  if (player.grounded && player.groundPlatform?.moving) player.x += player.groundPlatform.deltaX || 0;
  const direction = (controls.has('right') ? 1 : 0) - (controls.has('left') ? 1 : 0);
  if (direction) player.facing = direction;
  const acceleration = player.grounded ? 1750 : 980;
  const target = direction * 235;
  player.vx += clamp(target - player.vx, -acceleration * delta, acceleration * delta);
  if (!direction && player.grounded) player.vx *= Math.pow(0.002, delta);
  player.jumpBuffer = Math.max(0, player.jumpBuffer - delta); player.coyote = player.grounded ? 0.11 : Math.max(0, player.coyote - delta);
  if (player.jumpBuffer > 0 && player.coyote > 0) { player.vy = -440; player.grounded = false; player.coyote = 0; player.jumpBuffer = 0; addParticles(player.x + 14, player.y + player.height, '#e2e8f0', 6); }
  if (!controls.has('jump') && player.vy < -150) player.vy += 900 * delta;
  player.vy += 1180 * delta;
  player.dash = Math.max(0, player.dash - delta); player.dashCooldown = Math.max(0, player.dashCooldown - delta); player.invulnerable = Math.max(0, player.invulnerable - delta); player.fireCooldown = Math.max(0, player.fireCooldown - delta);
  const previousBottom = player.y + player.height;
  player.x += player.vx * delta;
  player.y += player.vy * delta;
  player.grounded = false; player.groundPlatform = null;
  if (player.vy >= 0) for (const platform of [...game.platforms, ...game.movingPlatforms]) {
    const nextBottom = player.y + player.height;
    if (player.x + player.width > platform.x && player.x < platform.x + platform.width && previousBottom <= platform.y + 4 && nextBottom >= platform.y) { player.y = platform.y - player.height; player.vy = 0; player.grounded = true; player.groundPlatform = platform; break; }
  }
  game.springs.forEach(spring => { if (player.vy >= 0 && overlaps(player, spring) && player.y + player.height <= spring.y + spring.height + 8) { player.y = spring.y - player.height; player.vy = -610; player.grounded = false; addParticles(spring.x + spring.width / 2, spring.y, '#22d3ee', 10); } });
  game.blocks.forEach(block => { if (block.hit || player.vy >= 0 || !overlaps(player, block) || player.y < block.y + block.height - 12) return; block.hit = true; player.vy = 90; game.powerUps.push({ x: block.x + 5, y: block.y - 26, width: 24, height: 24, type: block.reward, vx: 45 }); game.score += 80; });
  game.hazards.forEach(hazard => { if (overlaps(player, hazard)) hurtPlayer('Les pics ont touché le héros.'); });
  player.x = clamp(player.x, 0, game.width - player.width);
  if (player.y > HEIGHT + 100) respawn();
}

function update(delta) {
  if (!game || game.completed) return;
  game.elapsed += delta; game.comboTimer = Math.max(0, game.comboTimer - delta); if (!game.comboTimer) game.combo = 0; game.movingPlatforms.forEach(platform => { const previousX = platform.x; platform.x = platform.originX + Math.sin(game.elapsed * platform.speed + platform.phase) * platform.range; platform.deltaX = platform.x - previousX; }); updatePlayer(delta);
  const player = game.player;
  game.gems.forEach(gem => { if (!gem.collected && Math.hypot(player.x + player.width / 2 - gem.x, player.y + player.height / 2 - gem.y) < 30) { gem.collected = true; game.collected++; game.combo++; game.comboTimer = 2.2; game.score += Math.round(100 * (1 + Math.min(8, game.combo - 1) * .18) * difficultySettings[difficultySelect.value].score); addParticles(gem.x, gem.y, '#fef08a', 10); if (game.combo >= 4) statusElement.textContent = `Chaîne de gemmes ×${game.combo} !`; } });
  game.checkpoints.forEach((checkpoint, index) => { if (!checkpoint.active && player.x > checkpoint.x) { checkpoint.active = true; game.checkpoint = { x: checkpoint.x, y: checkpoint.platformY - player.height, label: `${index + 1}`, power: player.power }; game.score += 180; statusElement.textContent = `Point de reprise ${index + 1} activé.`; } });
  game.enemies.forEach(enemy => { if (enemy.dead) return; enemy.phase += delta; enemy.x += enemy.vx * delta; if (enemy.type === 'flyer') enemy.y += Math.sin(enemy.phase * 3) * 35 * delta; if (enemy.type === 'jumper') { enemy.vy += 900 * delta; enemy.y += enemy.vy * delta; const floor = game.platforms.find(platform => enemy.x > platform.x && enemy.x < platform.x + platform.width); if (floor && enemy.y + enemy.height >= floor.y) { enemy.y = floor.y - enemy.height; enemy.vy = -330; } } if (enemy.x < enemy.left || enemy.x > enemy.right) { enemy.x = clamp(enemy.x, enemy.left, enemy.right); enemy.vx *= -1; } if (!overlaps(player, enemy) || player.invulnerable > 0) return; if (player.vy > 80 && player.y + player.height - enemy.y < 17) { enemy.dead = true; player.vy = -300; game.combo++; game.comboTimer = 2.2; game.score += Math.round(220 * (1 + Math.min(6, game.combo - 1) * .2) * difficultySettings[difficultySelect.value].score); addParticles(enemy.x, enemy.y, '#fb7185', 12); } else hurtPlayer('Touché par une créature.'); });
  game.projectiles.forEach(projectile => { projectile.x += projectile.vx * delta; projectile.life -= delta; game.enemies.forEach(enemy => { if (!enemy.dead && projectile.life > 0 && overlaps(projectile, enemy)) { enemy.dead = true; projectile.life = 0; game.score += 240; addParticles(enemy.x, enemy.y, '#fb923c', 12); } }); }); game.projectiles = game.projectiles.filter(projectile => projectile.life > 0);
  game.powerUps.forEach(powerUp => { powerUp.x += powerUp.vx * delta; if (overlaps(player, powerUp)) { powerUp.collected = true; player.power = powerUp.type === 'fire' ? 'fire' : player.power === 'small' ? 'large' : player.power; game.score += 300; statusElement.textContent = player.power === 'fire' ? 'Pouvoir solaire : utilisez TIR.' : 'Le héros résiste désormais à un choc.'; } }); game.powerUps = game.powerUps.filter(powerUp => !powerUp.collected);
  game.pipes.forEach(pipe => { if (!pipe.used && overlaps(player, pipe) && controls.has('down')) { pipe.used = true; game.score += pipe.bonus; const destination = pipe.destination; player.x = destination.x + Math.min(70, destination.width * 0.25); player.y = destination.y - player.height; player.vx = 0; player.vy = 0; player.grounded = true; addParticles(player.x, player.y, '#86efac', 20); statusElement.textContent = 'Passage secret découvert : arrivée sécurisée.'; } });
  if (overlaps(player, game.exit)) { if (modeSelect.value === 'gemRush' && game.collected < game.gems.length) statusElement.textContent = `Le portail exige encore ${game.gems.length - game.collected} gemme(s).`; else finish(true, 'Niveau terminé', `${game.collected} gemmes en ${game.elapsed.toFixed(1).replace('.', ',')} secondes.`); }
  game.particles.forEach(particle => { particle.x += particle.vx * delta; particle.y += particle.vy * delta; particle.vy += 420 * delta; particle.life -= delta; }); game.particles = game.particles.filter(particle => particle.life > 0);
  const targetCamera = clamp(player.x - WIDTH * 0.34, 0, game.width - WIDTH); game.camera += (targetCamera - game.camera) * Math.min(1, delta * 7);
  remoteGhosts.forEach(ghost => { ghost.displayX += (ghost.x - ghost.displayX) * Math.min(1, delta * 11); ghost.displayY += (ghost.y - ghost.displayY) * Math.min(1, delta * 11); });
  window.LanMultiplayer?.sendGhost({ x: player.x, y: player.y, vx: player.vx, vy: player.vy, progress: player.x / Math.max(1, game.width - player.width), state: player.grounded ? 'grounded' : 'air' })?.catch(() => {});
  updateHud();
}

function drawBackground(theme) {
  const gradient = context.createLinearGradient(0, 0, 0, HEIGHT); gradient.addColorStop(0, theme.sky); gradient.addColorStop(1, theme.far); context.fillStyle = gradient; context.fillRect(0, 0, WIDTH, HEIGHT);
  context.globalAlpha = 0.28; context.fillStyle = '#fff'; for (let index = 0; index < 6; index++) { const x = (index * 210 - game.camera * 0.08 + 1200) % 1260 - 140; const y = 72 + index % 3 * 54; context.beginPath(); context.arc(x, y, 28, 0, Math.PI * 2); context.arc(x + 30, y - 8, 23, 0, Math.PI * 2); context.arc(x + 55, y + 2, 25, 0, Math.PI * 2); context.fill(); } context.globalAlpha = 1;
  context.fillStyle = theme.far; for (let index = -1; index < 8; index++) { const x = index * 180 - (game.camera * 0.18) % 180; context.beginPath(); context.moveTo(x, HEIGHT); context.lineTo(x + 95, 235 + (index % 2) * 55); context.lineTo(x + 205, HEIGHT); context.fill(); }
  context.globalAlpha = 0.28; context.fillStyle = theme.detail; for (let index = -1; index < 14; index++) { const x = index * 92 - (game.camera * 0.32) % 92; context.beginPath(); context.arc(x, 430 + index % 2 * 16, 70, Math.PI, Math.PI * 2); context.fill(); } context.globalAlpha = 1;
}
function drawGhosts() { const now = performance.now(); remoteGhosts.forEach((ghost, playerId) => { if (now - ghost.receivedAt > 2200) { remoteGhosts.delete(playerId); return; } context.save(); context.globalAlpha = 0.34; context.fillStyle = '#67e8f9'; context.strokeStyle = '#ecfeff'; context.lineWidth = 2; context.fillRect(ghost.displayX, ghost.displayY + 8, 28, 30); context.strokeRect(ghost.displayX, ghost.displayY, 28, 38); context.restore(); }); }
function draw() {
  const theme = themeSettings[themeSelect.value]; drawBackground(theme); if (!game) return; context.save(); context.translate(-game.camera, 0);
  game.platforms.forEach(platform => { context.fillStyle = theme.ground; context.fillRect(platform.x, platform.y, platform.width, platform.height); context.fillStyle = theme.top; context.fillRect(platform.x, platform.y, platform.width, 8); context.fillStyle = '#ffffff16'; context.fillRect(platform.x, platform.y + 11, platform.width, 5); for (let x = platform.x + 14; x < platform.x + platform.width; x += 34) { context.fillStyle = '#ffffff18'; context.fillRect(x, platform.y + 22, 16, 7); context.fillStyle = '#00000016'; context.fillRect(x + 9, platform.y + 40, 21, 6); } if (!platform.final) { context.strokeStyle = theme.top; context.lineWidth = 2; for (let x = platform.x + 18; x < platform.x + platform.width - 10; x += 54) { context.beginPath(); context.moveTo(x, platform.y); context.lineTo(x - 4, platform.y - 7); context.moveTo(x, platform.y); context.lineTo(x + 5, platform.y - 5); context.stroke(); } } });
  game.movingPlatforms.forEach(platform => { context.fillStyle = '#475569'; context.fillRect(platform.x, platform.y, platform.width, platform.height); context.fillStyle = '#67e8f9'; context.fillRect(platform.x, platform.y, platform.width, 5); });
  game.springs.forEach(spring => { context.fillStyle = '#ef4444'; context.fillRect(spring.x, spring.y, spring.width, spring.height); context.fillStyle = '#fef08a'; for (let x = spring.x + 3; x < spring.x + spring.width; x += 8) context.fillRect(x, spring.y + 3, 4, spring.height - 5); });
  game.hazards.forEach(hazard => { context.fillStyle = '#dc2626'; for (let x = hazard.x; x < hazard.x + hazard.width; x += 16) { context.beginPath(); context.moveTo(x, hazard.y + hazard.height); context.lineTo(x + 8, hazard.y); context.lineTo(x + 16, hazard.y + hazard.height); context.fill(); } });
  game.blocks.forEach(block => { context.fillStyle = block.hit ? '#64748b' : '#f59e0b'; context.fillRect(block.x, block.y, block.width, block.height); context.fillStyle = '#fff'; context.font = '900 20px Arial'; context.textAlign = 'center'; context.fillText(block.hit ? '·' : '?', block.x + block.width / 2, block.y + 24); });
  game.pipes.forEach(pipe => { context.fillStyle = pipe.used ? '#166534' : '#22c55e'; context.fillRect(pipe.x, pipe.y, pipe.width, pipe.height); context.fillStyle = '#86efac'; context.fillRect(pipe.x - 5, pipe.y, pipe.width + 10, 10); });
  game.gems.forEach(gem => { if (gem.collected) return; context.fillStyle = theme.detail; context.save(); context.translate(gem.x, gem.y); context.rotate(Math.PI / 4); context.fillRect(-7, -7, 14, 14); context.restore(); });
  game.checkpoints.forEach(checkpoint => { context.strokeStyle = '#f8fafc'; context.lineWidth = 4; context.beginPath(); context.moveTo(checkpoint.x, checkpoint.platformY); context.lineTo(checkpoint.x, checkpoint.platformY - 52); context.stroke(); context.fillStyle = checkpoint.active ? '#22c55e' : '#e2e8f0'; context.fillRect(checkpoint.x, checkpoint.platformY - 52, 27, 17); });
  context.save(); context.shadowColor = '#c4b5fd'; context.shadowBlur = 14 + Math.sin(game.elapsed * 4) * 5; context.fillStyle = '#7c3aed'; context.fillRect(game.exit.x, game.exit.y, game.exit.width, game.exit.height); context.fillStyle = '#ede9fe'; context.fillRect(game.exit.x + 9, game.exit.y + 10, game.exit.width - 18, game.exit.height - 10); context.restore();
  game.enemies.forEach(enemy => { if (enemy.dead) return; context.fillStyle = enemy.type === 'flyer' ? '#a855f7' : enemy.type === 'jumper' ? '#f97316' : '#ef4444'; context.fillRect(enemy.x, enemy.y + 7, enemy.width, enemy.height - 7); context.fillStyle = '#fef2f2'; context.fillRect(enemy.x + 5, enemy.y + 11, 5, 5); context.fillRect(enemy.x + 18, enemy.y + 11, 5, 5); });
  game.powerUps.forEach(powerUp => { context.fillStyle = powerUp.type === 'fire' ? '#fb923c' : '#22c55e'; context.beginPath(); context.arc(powerUp.x + 12, powerUp.y + 12, 12, 0, Math.PI * 2); context.fill(); }); game.projectiles.forEach(projectile => { context.fillStyle = '#fb923c'; context.beginPath(); context.arc(projectile.x + 6, projectile.y + 4, 7, 0, Math.PI * 2); context.fill(); });
  game.particles.forEach(particle => { context.globalAlpha = Math.max(0, particle.life); context.fillStyle = particle.color; context.fillRect(particle.x, particle.y, 5, 5); }); context.globalAlpha = 1; drawGhosts();
  const player = game.player; if (!(player.invulnerable > 0 && Math.floor(player.invulnerable * 12) % 2)) { context.fillStyle = player.power === 'fire' ? '#f97316' : player.power === 'large' ? '#7c3aed' : '#2563eb'; context.fillRect(player.x, player.y + 8, player.width, player.height - 8); context.fillStyle = '#f8d5bd'; context.fillRect(player.x + 5, player.y, 18, 15); context.fillStyle = '#fef08a'; context.fillRect(player.facing > 0 ? player.x + 19 : player.x + 4, player.y + 5, 4, 4); } context.restore();
  if (game.combo > 1) { context.fillStyle = '#fff7ae'; context.shadowColor = '#f59e0b'; context.shadowBlur = 12; context.font = '900 25px Arial'; context.textAlign = 'right'; context.fillText(`COMBO ×${game.combo}`, WIDTH - 22, 38); context.shadowBlur = 0; }
}

function updateHud() { if (!game) return; document.getElementById('score').textContent = game.score.toLocaleString('fr-FR'); document.getElementById('gems').textContent = `${game.collected} / ${game.gems.length}`; document.getElementById('lives').textContent = game.lives; document.getElementById('time').textContent = `${game.elapsed.toFixed(1).replace('.', ',')} s`; document.getElementById('checkpoint').textContent = game.checkpoint.label; document.getElementById('distance').textContent = `${Math.floor(game.player.x / Math.max(1, game.width - game.player.width) * 100)} %`; document.getElementById('dashState').textContent = game.player.dashCooldown <= 0 ? 'Prêt' : `${game.player.dashCooldown.toFixed(1)} s`; document.getElementById('powerState').textContent = ({ small: 'Normal', large: 'Renforcé', fire: 'Solaire' })[game.player.power]; }
function finish(won, title, text) { if (game?.completed) return; game.completed = true; running = false; controls.clear(); document.getElementById('overlayTitle').textContent = title; document.getElementById('overlayText').textContent = text; document.getElementById('overlay').hidden = false; statusElement.textContent = title; const timeBonus = Math.max(0, 5000 - game.elapsed * 20); game.score += Math.round(timeBonus * difficultySettings[difficultySelect.value].score); window.GameRecords?.finish({ score: game.score, scoreLabel: `${game.score.toLocaleString('fr-FR')} points · ${game.elapsed.toFixed(1)} s`, won, gems: game.collected }); draw(); }
function loop(now) { if (!running || paused) return; const delta = Math.min(0.034, (now - lastTime) / 1000); lastTime = now; update(delta); draw(); if (running) frame = requestAnimationFrame(loop); }
function togglePause(force) { if (!game || game.completed) return; const next = force ?? !paused; if (next === paused) return; paused = next; running = !paused; document.getElementById('pause').textContent = paused ? 'Reprendre' : 'Pause'; statusElement.textContent = paused ? 'Partie en pause.' : 'Aventure reprise.'; if (!paused) { lastTime = performance.now(); frame = requestAnimationFrame(loop); } }

const keyMap = { ArrowLeft: 'left', q: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowDown: 'down', s: 'down', ArrowUp: 'jump', z: 'jump', w: 'jump', ' ': 'jump', Shift: 'dash', f: 'fire', F: 'fire' };
document.addEventListener('keydown', event => { if (event.target.matches('select,input')) return; const action = keyMap[event.key]; if (action) { event.preventDefault(); if (!controls.has(action) && action === 'jump') jump(); if (action === 'dash') dash(); if (action === 'fire') fire(); controls.add(action); updateControlHighlights(); } else if (event.key.toLowerCase() === 'p' || event.key === 'Escape') togglePause(); });
document.addEventListener('keyup', event => { controls.delete(keyMap[event.key]); updateControlHighlights(); });
function updateControlHighlights() { document.querySelectorAll('[data-control]').forEach(button => button.classList.toggle('active', controls.has(button.dataset.control))); }
document.querySelectorAll('[data-control]').forEach(button => { button.onpointerdown = event => { event.preventDefault(); const action = button.dataset.control; if (action === 'jump') jump(); if (action === 'dash') dash(); if (action === 'fire') fire(); controls.add(action); updateControlHighlights(); }; button.onpointerup = button.onpointercancel = button.onpointerleave = () => { controls.delete(button.dataset.control); updateControlHighlights(); }; });
document.getElementById('start').onclick = startGame; document.getElementById('replay').onclick = startGame; document.getElementById('pause').onclick = () => togglePause(); document.addEventListener('visibilitychange', () => { if (document.hidden && running) togglePause(); });
window.addEventListener('lan:start', startGame); window.addEventListener('lan:pause', event => togglePause(Boolean(event.detail?.paused)));
window.addEventListener('lan:ghost', event => { const snapshot = event.detail; const previous = remoteGhosts.get(snapshot.playerId); remoteGhosts.set(snapshot.playerId, { ...snapshot, displayX: previous?.displayX ?? snapshot.x, displayY: previous?.displayY ?? snapshot.y }); });
game = createGame('preview'); draw(); updateHud();
window.PocketPlatformerTestAPI = { diagnostics: () => ({ canvas: WIDTH === 960 && HEIGHT === 540, difficulties: Object.keys(difficultySettings), lengths: Object.keys(lengthSettings), themes: Object.keys(themeSettings), modes: [...modeSelect.options].map(option => option.value), mobileControls: document.querySelectorAll('[data-control]').length, platforms: game.platforms.length, movingPlatforms: game.movingPlatforms.length, springs: game.springs.length, hazards: game.hazards.length, blocks: game.blocks.length, gems: game.gems.length, route: validateLevel(game) }), selfTest() { const previous = game; const previousDifficulty = difficultySelect.value; const levels = ['easy-route', 'normal-route', 'hard-route', 'extreme-route'].map((seed, index) => { difficultySelect.value = Object.keys(difficultySettings)[index]; return generateLevel(seed); }); difficultySelect.value = 'normal'; game = createGame('self-test'); const generated = game.platforms.length > 8 && game.exit.x > game.platforms[0].width && game.gems.length > 5; const validations = levels.map(validateLevel); const jumpable = validations.every(result => result.valid); const hasCheckpoints = game.checkpoints.length >= 1; const mechanics = game.movingPlatforms.length + game.springs.length + game.blocks.length > 2; const safeSecrets = game.pipes.every(pipe => pipe.destination && pipe.destination.y < HEIGHT); game = previous; difficultySelect.value = previousDifficulty; return { generated, jumpable, safeSecrets, hasCheckpoints, mechanics }; } };
try { localStorage.setItem('game-hub:last-game', 'pocket-platformer'); } catch {}
