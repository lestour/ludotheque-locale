'use strict';

const canvas = document.getElementById('screen');
const context = canvas.getContext('2d');
const difficultySelect = document.getElementById('difficulty');
const modeSelect = document.getElementById('mode');
const handlingSelect = document.getElementById('handling');
const soundToggle = document.getElementById('sound');
const statusElement = document.getElementById('status');
const controls = new Set();
const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const difficultySettings = {
  easy: { speed: 0.78, count: 0.8, accuracy: 0.55, score: 0.8 },
  normal: { speed: 1, count: 1, accuracy: 0.75, score: 1 },
  hard: { speed: 1.2, count: 1.18, accuracy: 0.9, score: 1.45 },
  extreme: { speed: 1.45, count: 1.38, accuracy: 1.05, score: 2 }
};
let game = null;
let running = false;
let paused = false;
let frame = 0;
let lastTime = 0;
let audioContext = null;
const remoteGhosts = new Map();

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const wrap = object => { object.x = (object.x + WIDTH) % WIDTH; object.y = (object.y + HEIGHT) % HEIGHT; };
const distance = (left, right) => Math.hypot(left.x - right.x, left.y - right.y);
const random = () => game?.random?.() ?? Math.random();

function sound(kind) {
  if (!soundToggle.checked) return;
  try {
    audioContext ||= new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const frequency = { fire: 520, hit: 100, pickup: 820, thrust: 170, hyper: 980 }[kind] || 260;
    const duration = kind === 'hit' ? 0.18 : 0.07;
    oscillator.type = kind === 'hit' ? 'sawtooth' : 'square';
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(45, frequency * 0.55), audioContext.currentTime + duration);
    gain.gain.setValueAtTime(0.045, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
  } catch {}
}

function createShip() {
  return { x: WIDTH / 2, y: HEIGHT / 2, vx: 0, vy: 0, angle: -Math.PI / 2, radius: 14, cooldown: 0, hyperCooldown: 0, shield: 100, invulnerable: 2, rapid: 0, spread: 0 };
}

function createGame(seed = `${Date.now()}:${Math.random()}`) {
  return { random: window.GameRuntime?.createRandom(`vector:${seed}`) || Math.random, ship: createShip(), asteroids: [], bullets: [], enemyBullets: [], saucers: [], particles: [], pickups: [], stars: [], wave: 0, lives: 3, score: 0, elapsed: 0, timeLeft: 180, between: 0.5, completed: false, shots: 0, hits: 0 };
}

function makeAsteroid(size, x, y, vx, vy) {
  const radius = { 1: 15, 2: 29, 3: 51 }[size];
  return { size, x, y, vx, vy, radius, angle: random() * Math.PI * 2, spin: (random() - 0.5) * 1.4, vertices: Array.from({ length: 10 }, () => 0.72 + random() * 0.35), dead: false };
}

function safeSpawnPosition() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const point = { x: random() * WIDTH, y: random() * HEIGHT };
    if (distance(point, game.ship) > 190) return point;
  }
  return { x: 40, y: 40 };
}

function spawnWave() {
  game.wave++;
  if (modeSelect.value === 'expedition' && game.wave > 12) return finish(true, 'Expédition réussie', `Les douze secteurs sont sécurisés avec ${game.score.toLocaleString('fr-FR')} points.`);
  const settings = difficultySettings[difficultySelect.value];
  const amount = Math.min(14, Math.ceil((2.5 + game.wave * 0.65) * settings.count));
  for (let index = 0; index < amount; index++) {
    const point = safeSpawnPosition();
    const angle = random() * Math.PI * 2;
    const speed = (26 + random() * 38 + game.wave * 2.4) * settings.speed;
    game.asteroids.push(makeAsteroid(3, point.x, point.y, Math.cos(angle) * speed, Math.sin(angle) * speed));
  }
  if (game.wave >= 3 && game.wave % 2 === 1) spawnSaucer();
  game.between = 0;
  statusElement.textContent = `Secteur ${game.wave} : ${amount} astéroïdes détectés.`;
}

function spawnSaucer() {
  const side = random() < 0.5 ? -25 : WIDTH + 25;
  game.saucers.push({ x: side, y: 70 + random() * (HEIGHT - 140), vx: side < 0 ? 85 : -85, radius: 18, cooldown: 1.4, dead: false });
}

function startGame() {
  cancelAnimationFrame(frame);
  game = createGame(new URLSearchParams(location.search).get('seed'));
  game.stars = Array.from({ length: 90 }, () => ({ x: random() * WIDTH, y: random() * HEIGHT, size: 0.5 + random() * 1.8 }));
  running = true; paused = false; controls.clear();
  document.getElementById('overlay').hidden = true;
  document.getElementById('pause').textContent = 'Pause';
  window.GameRecords?.reset();
  spawnWave(); updateHud(); lastTime = performance.now(); frame = requestAnimationFrame(loop);
}

function shoot() {
  const ship = game.ship;
  if (ship.cooldown > 0) return;
  const count = ship.spread > 0 ? 3 : 1;
  for (let index = 0; index < count; index++) {
    const angle = ship.angle + (index - (count - 1) / 2) * 0.16;
    game.bullets.push({ x: ship.x + Math.cos(angle) * 18, y: ship.y + Math.sin(angle) * 18, vx: ship.vx + Math.cos(angle) * 520, vy: ship.vy + Math.sin(angle) * 520, radius: 3, life: 1.15, dead: false });
  }
  ship.cooldown = ship.rapid > 0 ? 0.11 : 0.22; game.shots++; sound('fire');
}

function hyperspace() {
  if (!game || !running || game.ship.hyperCooldown > 0) return;
  const point = safeSpawnPosition();
  Object.assign(game.ship, { x: point.x, y: point.y, vx: 0, vy: 0, hyperCooldown: 5, invulnerable: 1.2 });
  addParticles(point.x, point.y, '#a78bfa', 28); sound('hyper');
}

function addParticles(x, y, color, amount = 12) {
  for (let index = 0; index < amount; index++) { const angle = random() * Math.PI * 2; const speed = 45 + random() * 180; game.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.3 + random() * 0.6, color }); }
}

function splitAsteroid(asteroid) {
  asteroid.dead = true;
  if (asteroid.size > 1) for (let index = 0; index < 2; index++) { const angle = Math.atan2(asteroid.vy, asteroid.vx) + (index ? 0.9 : -0.9) + (random() - 0.5) * 0.35; const speed = Math.hypot(asteroid.vx, asteroid.vy) * 1.35 + 18; game.asteroids.push(makeAsteroid(asteroid.size - 1, asteroid.x, asteroid.y, Math.cos(angle) * speed, Math.sin(angle) * speed)); }
  game.score += Math.round(({ 1: 100, 2: 60, 3: 30 })[asteroid.size] * difficultySettings[difficultySelect.value].score * (1 + game.wave * 0.08));
  if (random() < 0.055) game.pickups.push({ x: asteroid.x, y: asteroid.y, radius: 10, type: ['shield', 'rapid', 'spread'][Math.floor(random() * 3)], life: 9 });
  addParticles(asteroid.x, asteroid.y, '#cbd5e1', asteroid.size * 8); sound('hit');
}

function damageShip() {
  const ship = game.ship;
  if (ship.invulnerable > 0) return;
  ship.shield -= 34;
  ship.invulnerable = 1.6;
  addParticles(ship.x, ship.y, '#fb7185', 24); sound('hit');
  if (ship.shield > 0) return;
  game.lives--;
  if (game.lives <= 0) return finish(false, 'Vaisseau perdu', `Score final : ${game.score.toLocaleString('fr-FR')} points.`);
  Object.assign(ship, createShip(), { shield: 100 });
  statusElement.textContent = `Vaisseau de secours engagé — ${game.lives} vie${game.lives > 1 ? 's' : ''}.`;
}

function updateShip(delta) {
  const ship = game.ship;
  const turn = (controls.has('right') ? 1 : 0) - (controls.has('left') ? 1 : 0);
  ship.angle += turn * 3.7 * delta;
  if (controls.has('thrust')) { ship.vx += Math.cos(ship.angle) * 245 * delta; ship.vy += Math.sin(ship.angle) * 245 * delta; if (Math.floor(game.elapsed * 18) % 2) addParticles(ship.x - Math.cos(ship.angle) * 16, ship.y - Math.sin(ship.angle) * 16, '#38bdf8', 1); }
  const damping = handlingSelect.value === 'assisted' ? Math.pow(0.28, delta) : Math.pow(0.82, delta);
  ship.vx *= damping; ship.vy *= damping;
  const maximum = handlingSelect.value === 'assisted' ? 285 : 390;
  const speed = Math.hypot(ship.vx, ship.vy);
  if (speed > maximum) { ship.vx = ship.vx / speed * maximum; ship.vy = ship.vy / speed * maximum; }
  ship.x += ship.vx * delta; ship.y += ship.vy * delta; wrap(ship);
  ship.cooldown = Math.max(0, ship.cooldown - delta); ship.hyperCooldown = Math.max(0, ship.hyperCooldown - delta); ship.invulnerable = Math.max(0, ship.invulnerable - delta); ship.rapid = Math.max(0, ship.rapid - delta); ship.spread = Math.max(0, ship.spread - delta);
  if (controls.has('fire')) shoot();
}

function update(delta) {
  if (!game || game.completed) return;
  game.elapsed += delta;
  if (modeSelect.value === 'timeAttack') { game.timeLeft -= delta; if (game.timeLeft <= 0) return finish(true, 'Temps écoulé', `Vous avez marqué ${game.score.toLocaleString('fr-FR')} points.`); }
  updateShip(delta);
  game.asteroids.forEach(asteroid => { asteroid.x += asteroid.vx * delta; asteroid.y += asteroid.vy * delta; asteroid.angle += asteroid.spin * delta; wrap(asteroid); });
  game.bullets.forEach(bullet => { bullet.x += bullet.vx * delta; bullet.y += bullet.vy * delta; bullet.life -= delta; wrap(bullet); });
  game.enemyBullets.forEach(bullet => { bullet.x += bullet.vx * delta; bullet.y += bullet.vy * delta; bullet.life -= delta; wrap(bullet); });
  game.saucers.forEach(saucer => { saucer.x += saucer.vx * delta; saucer.cooldown -= delta; if (saucer.cooldown <= 0) { const angle = Math.atan2(game.ship.y - saucer.y, game.ship.x - saucer.x) + (random() - 0.5) * (1 - difficultySettings[difficultySelect.value].accuracy) * 1.2; game.enemyBullets.push({ x: saucer.x, y: saucer.y, vx: Math.cos(angle) * 220, vy: Math.sin(angle) * 220, life: 3, radius: 4, dead: false }); saucer.cooldown = 1.5 + random(); } if (saucer.x < -45 || saucer.x > WIDTH + 45) saucer.dead = true; });
  for (const bullet of game.bullets) for (const asteroid of game.asteroids) if (!bullet.dead && !asteroid.dead && distance(bullet, asteroid) < bullet.radius + asteroid.radius) { bullet.dead = true; game.hits++; splitAsteroid(asteroid); }
  for (const bullet of game.bullets) for (const saucer of game.saucers) if (!bullet.dead && !saucer.dead && distance(bullet, saucer) < bullet.radius + saucer.radius) { bullet.dead = true; saucer.dead = true; game.score += 450; addParticles(saucer.x, saucer.y, '#f43f5e', 22); }
  game.asteroids.forEach(asteroid => { if (!asteroid.dead && distance(asteroid, game.ship) < asteroid.radius + game.ship.radius) { splitAsteroid(asteroid); damageShip(); } });
  game.enemyBullets.forEach(bullet => { if (!bullet.dead && distance(bullet, game.ship) < bullet.radius + game.ship.radius) { bullet.dead = true; damageShip(); } });
  game.pickups.forEach(pickup => { pickup.life -= delta; if (distance(pickup, game.ship) < pickup.radius + game.ship.radius) { pickup.dead = true; if (pickup.type === 'shield') game.ship.shield = Math.min(100, game.ship.shield + 55); else game.ship[pickup.type] = 12; document.getElementById('bonusStatus').textContent = `Capsule ${pickup.type === 'shield' ? 'bouclier' : pickup.type === 'rapid' ? 'cadence' : 'tir triple'} récupérée.`; sound('pickup'); } });
  game.particles.forEach(particle => { particle.x += particle.vx * delta; particle.y += particle.vy * delta; particle.life -= delta; wrap(particle); });
  remoteGhosts.forEach(ghost => { ghost.displayX += (ghost.x - ghost.displayX) * Math.min(1, delta * 10); ghost.displayY += (ghost.y - ghost.displayY) * Math.min(1, delta * 10); let difference = ((ghost.angle - ghost.displayAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI; ghost.displayAngle += difference * Math.min(1, delta * 10); });
  game && window.LanMultiplayer?.sendGhost({ x: game.ship.x, y: game.ship.y, vx: game.ship.vx, vy: game.ship.vy, angle: game.ship.angle, progress: modeSelect.value === 'expedition' ? Math.min(1, game.wave / 12) : Math.min(1, game.score / 30000), state: controls.has('thrust') ? 'thrust' : 'drift' })?.catch(() => {});
  game.asteroids = game.asteroids.filter(item => !item.dead); game.bullets = game.bullets.filter(item => !item.dead && item.life > 0); game.enemyBullets = game.enemyBullets.filter(item => !item.dead && item.life > 0); game.saucers = game.saucers.filter(item => !item.dead); game.pickups = game.pickups.filter(item => !item.dead && item.life > 0); game.particles = game.particles.filter(item => item.life > 0);
  if (!game.asteroids.length && !game.saucers.length) { game.between += delta; if (game.between > 1.2) spawnWave(); }
  updateHud();
}

function drawAsteroid(asteroid) { context.save(); context.translate(asteroid.x, asteroid.y); context.rotate(asteroid.angle); context.strokeStyle = '#d6deea'; context.lineWidth = 3; context.fillStyle = '#334155'; context.beginPath(); asteroid.vertices.forEach((scale, index) => { const angle = index / asteroid.vertices.length * Math.PI * 2; const x = Math.cos(angle) * asteroid.radius * scale; const y = Math.sin(angle) * asteroid.radius * scale; if (!index) context.moveTo(x, y); else context.lineTo(x, y); }); context.closePath(); context.fill(); context.stroke(); context.restore(); }
function drawRemoteShips() { const now = performance.now(); remoteGhosts.forEach((ghost, playerId) => { if (now - ghost.receivedAt > 2200) { remoteGhosts.delete(playerId); return; } context.save(); context.translate(ghost.displayX, ghost.displayY); context.rotate(ghost.displayAngle + Math.PI / 2); context.globalAlpha = 0.32; context.fillStyle = '#f0abfc'; context.strokeStyle = '#fae8ff'; context.lineWidth = 2; context.beginPath(); context.moveTo(0, -19); context.lineTo(13, 15); context.lineTo(0, 9); context.lineTo(-13, 15); context.closePath(); context.fill(); context.stroke(); context.restore(); }); }
function draw() { context.fillStyle = '#020617'; context.fillRect(0, 0, WIDTH, HEIGHT); if (!game) { context.fillStyle = '#dbeafe'; context.font = 'bold 28px Arial'; context.textAlign = 'center'; context.fillText('Démarrez pour entrer dans le champ.', WIDTH / 2, HEIGHT / 2); return; } game.stars.forEach(star => { context.fillStyle = '#dbeafe'; context.globalAlpha = 0.35 + star.size / 4; context.fillRect(star.x, star.y, star.size, star.size); }); context.globalAlpha = 1; game.asteroids.forEach(drawAsteroid); game.pickups.forEach(pickup => { context.fillStyle = ({ shield: '#38bdf8', rapid: '#facc15', spread: '#c084fc' })[pickup.type]; context.beginPath(); context.arc(pickup.x, pickup.y, pickup.radius, 0, Math.PI * 2); context.fill(); }); context.fillStyle = '#7dd3fc'; game.bullets.forEach(bullet => { context.beginPath(); context.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2); context.fill(); }); context.fillStyle = '#fb7185'; game.enemyBullets.forEach(bullet => { context.beginPath(); context.arc(bullet.x, bullet.y, 5, 0, Math.PI * 2); context.fill(); }); game.saucers.forEach(saucer => { context.fillStyle = '#f43f5e'; context.fillRect(saucer.x - 18, saucer.y - 6, 36, 12); context.fillStyle = '#fda4af'; context.beginPath(); context.arc(saucer.x, saucer.y - 5, 10, Math.PI, 0); context.fill(); }); game.particles.forEach(particle => { context.globalAlpha = Math.max(0, particle.life); context.fillStyle = particle.color; context.fillRect(particle.x, particle.y, 3, 3); }); context.globalAlpha = 1; drawRemoteShips(); const ship = game.ship; context.save(); context.translate(ship.x, ship.y); context.rotate(ship.angle + Math.PI / 2); if (ship.invulnerable > 0 && Math.floor(ship.invulnerable * 14) % 2) context.globalAlpha = 0.3; context.fillStyle = '#38bdf8'; context.beginPath(); context.moveTo(0, -19); context.lineTo(13, 15); context.lineTo(0, 9); context.lineTo(-13, 15); context.closePath(); context.fill(); if (controls.has('thrust')) { context.fillStyle = '#f59e0b'; context.beginPath(); context.moveTo(-6, 13); context.lineTo(0, 27); context.lineTo(6, 13); context.fill(); } context.restore(); }

function updateHud() { if (!game) return; document.getElementById('score').textContent = game.score.toLocaleString('fr-FR'); document.getElementById('wave').textContent = game.wave; document.getElementById('lives').textContent = game.lives; document.getElementById('time').textContent = modeSelect.value === 'timeAttack' ? `${Math.ceil(game.timeLeft)} s` : `${Math.floor(game.elapsed)} s`; const shield = clamp(game.ship.shield, 0, 100); document.getElementById('shieldMeter').style.width = `${shield}%`; document.getElementById('shieldLabel').textContent = `${Math.round(shield)} %`; }
function finish(won, title, text) { if (game?.completed) return; game.completed = true; running = false; controls.clear(); document.getElementById('overlayTitle').textContent = title; document.getElementById('overlayText').textContent = text; document.getElementById('overlay').hidden = false; statusElement.textContent = title; window.GameRecords?.finish({ score: game.score, scoreLabel: `${game.score.toLocaleString('fr-FR')} points · secteur ${game.wave}`, won, wave: game.wave }); draw(); }
function loop(now) { if (!running || paused) return; const delta = Math.min(0.035, (now - lastTime) / 1000); lastTime = now; update(delta); draw(); if (running) frame = requestAnimationFrame(loop); }
function togglePause(force) { if (!game || game.completed) return; const next = force ?? !paused; if (next === paused) return; paused = next; running = !paused; document.getElementById('pause').textContent = paused ? 'Reprendre' : 'Pause'; statusElement.textContent = paused ? 'Partie en pause.' : `Reprise du secteur ${game.wave}.`; if (!paused) { lastTime = performance.now(); frame = requestAnimationFrame(loop); } }

const keyMap = { ArrowLeft: 'left', q: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'thrust', z: 'thrust', w: 'thrust', ' ': 'fire', Shift: 'hyper' };
document.addEventListener('keydown', event => { if (event.target.matches('select,input')) return; const action = keyMap[event.key]; if (action) { event.preventDefault(); controls.add(action); if (action === 'fire' && game && running) shoot(); if (action === 'hyper') hyperspace(); updateControlHighlights(); } else if (event.key.toLowerCase() === 'p' || event.key === 'Escape') togglePause(); });
document.addEventListener('keyup', event => { controls.delete(keyMap[event.key]); updateControlHighlights(); });
function updateControlHighlights() { document.querySelectorAll('[data-control]').forEach(button => button.classList.toggle('active', controls.has(button.dataset.control))); }
document.querySelectorAll('[data-control]').forEach(button => { button.onpointerdown = event => { event.preventDefault(); controls.add(button.dataset.control); if (button.dataset.control === 'fire' && game && running) shoot(); if (button.dataset.control === 'hyper') hyperspace(); updateControlHighlights(); }; button.onpointerup = button.onpointercancel = button.onpointerleave = () => { controls.delete(button.dataset.control); updateControlHighlights(); }; });
document.getElementById('start').onclick = startGame; document.getElementById('replay').onclick = startGame; document.getElementById('pause').onclick = () => togglePause();
window.addEventListener('lan:start', startGame); window.addEventListener('lan:pause', event => togglePause(Boolean(event.detail?.paused)));
window.addEventListener('lan:ghost', event => { const snapshot = event.detail; const previous = remoteGhosts.get(snapshot.playerId); remoteGhosts.set(snapshot.playerId, { ...snapshot, displayX: previous?.displayX ?? snapshot.x, displayY: previous?.displayY ?? snapshot.y, displayAngle: previous?.displayAngle ?? snapshot.angle ?? 0 }); });
document.addEventListener('visibilitychange', () => { if (document.hidden && running) togglePause(); });
game = createGame('preview'); game.stars = Array.from({ length: 90 }, () => ({ x: random() * WIDTH, y: random() * HEIGHT, size: 0.5 + random() * 1.8 })); draw();
window.VectorDriftTestAPI = { diagnostics: () => ({ canvas: WIDTH === 900 && HEIGHT === 600, difficulties: Object.keys(difficultySettings), modes: [...modeSelect.options].map(option => option.value), handling: [...handlingSelect.options].map(option => option.value), mobileControls: document.querySelectorAll('[data-control]').length, asteroidSizes: 3 }), selfTest() { const previous = game; game = createGame('self-test'); const asteroid = makeAsteroid(3, 100, 100, 10, 0); game.asteroids.push(asteroid); splitAsteroid(asteroid); const split = game.asteroids.filter(item => item.size === 2).length === 2; const wrapped = { x: -2, y: HEIGHT + 3 }; wrap(wrapped); const wrapping = wrapped.x === WIDTH - 2 && wrapped.y === 3; game = previous; return { split, wrapping }; } };
try { localStorage.setItem('game-hub:last-game', 'vector-drift'); } catch {}
