'use strict';

const canvas = document.getElementById('screen');
const context = canvas.getContext('2d');
const difficultySelect = document.getElementById('difficulty');
const courseSelect = document.getElementById('course');
const goalSelect = document.getElementById('goal');
const statusElement = document.getElementById('status');
goalSelect.value = 'endless';
const COLS = 12;
const VISIBLE_ROWS = 13;
const CELL = 60;
const SECTOR_ROWS = 12;
const directions = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] };
const keyMap = { ArrowUp: 'up', z: 'up', w: 'up', ArrowDown: 'down', s: 'down', ArrowLeft: 'left', q: 'left', a: 'left', ArrowRight: 'right', d: 'right' };
const difficulties = {
  easy: { speed: 0.62, clearance: 4.2, lives: 7, moveSpeed: 7.2, hitbox: 0.2 },
  normal: { speed: 0.86, clearance: 3.45, lives: 5, moveSpeed: 7.6, hitbox: 0.23 },
  hard: { speed: 1.08, clearance: 2.85, lives: 4, moveSpeed: 8, hitbox: 0.25 },
  extreme: { speed: 1.28, clearance: 2.35, lives: 3, moveSpeed: 8.4, hitbox: 0.27 }
};

let game = null;
let running = false;
let paused = false;
let frame = 0;
let last = 0;
const heldDirections = new Set();

function randomFor(seed) { return window.GameRuntime?.createRandom(`crossing:${seed}`) || Math.random; }
function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }

function laneKind(worldRow, random) {
  if (worldRow % 6 === 0) return 'safe';
  const phase = Math.floor(worldRow / 6);
  if (courseSelect.value === 'city') return random() < Math.min(0.28, 0.08 + phase * 0.008) ? 'river' : 'road';
  if (courseSelect.value === 'delta') return random() < Math.max(0.18, 0.78 - phase * 0.006) ? 'river' : 'road';
  return (phase + worldRow) % 2 ? 'road' : 'river';
}

function createLane(worldRow, random) {
  const kind = laneKind(worldRow, random);
  const sector = Math.floor(worldRow / SECTOR_ROWS) + 1;
  if (kind === 'safe') return { kind, worldRow, direction: 0, speed: 0, items: [], clearance: Infinity, checkpoint: worldRow > 0 && worldRow % SECTOR_ROWS === 0, biome: sector % 4 };
  const settings = difficulties[difficultySelect.value];
  const direction = random() < 0.5 ? -1 : 1;
  const type = kind === 'river' ? ['log', 'raft', 'lily', 'barge'][Math.floor(random() * 4)] : ['car', 'truck', 'bike', 'bus', 'convoy'][Math.floor(random() * 5)];
  const width = kind === 'river' ? ({ raft: 3.7, lily: 1.55, barge: 4.5 }[type] || 2.5 + Math.floor(random() * 2)) : ({ truck: 2.25, bus: 2.8, bike: 0.82, convoy: 3.35 }[type] || 1.35);
  const clearance = Math.max(2.25, settings.clearance - Math.min(0.8, sector * 0.035) + random() * 1.15);
  const baseSpeed = (31 + random() * 30 + Math.min(38, sector * 2.1)) * settings.speed;
  const speed = baseSpeed * (type === 'bike' ? 1.24 : ['bus', 'raft', 'barge', 'convoy'].includes(type) ? 0.8 : 1);
  const spacing = width + clearance;
  const offset = random() * spacing;
  const items = [];
  for (let x = -spacing + offset; x < COLS + spacing; x += spacing) items.push({ x, width, type, variant: Math.floor(random() * 4) });
  return { kind, worldRow, direction, speed, items, clearance, type, biome: sector % 4 };
}

function ensureRows(minimum, maximum) {
  for (let row = Math.max(0, minimum); row <= maximum; row++) if (!game.lanes.has(row)) game.lanes.set(row, createLane(row, game.random));
  for (const row of game.lanes.keys()) if (row < minimum - 3) game.lanes.delete(row);
}

function makePlayer(worldY = 0, invincible = 0.9) {
  return { x: 6, worldY, move: null, queued: null, invincible, collisionGrace: 0.3 };
}

function createGame(seed = `${Date.now()}:${Math.random()}`) {
  const random = randomFor(seed);
  const state = {
    random, lanes: new Map(), player: makePlayer(), cameraY: 0, checkpoint: 0, maximumRow: 0,
    score: 0, sectors: 0, lives: difficulties[difficultySelect.value].lives, combo: 1, time: 0, slow: 0,
    particles: [], completed: false, lastInput: -Infinity, bonus: null
  };
  game = state; ensureRows(0, VISIBLE_ROWS + 5); spawnBonus(); return state;
}

function spawnBonus() {
  const candidates = [...game.lanes.values()].filter(lane => lane.kind === 'safe' && lane.worldRow > game.player.worldY + 2 && lane.worldRow <= game.player.worldY + VISIBLE_ROWS);
  const lane = candidates[Math.floor(game.random() * candidates.length)];
  game.bonus = lane ? { x: 1.5 + Math.floor(game.random() * 9), worldY: lane.worldRow, active: true } : null;
}

function start() {
  cancelAnimationFrame(frame); game = createGame(new URLSearchParams(location.search).get('seed') || undefined);
  running = true; paused = false; heldDirections.clear(); document.getElementById('overlay').hidden = true;
  document.getElementById('pause').textContent = 'Pause'; statusElement.textContent = 'Montez aussi loin que possible : le parcours se génère au-dessus de vous.';
  window.GameRecords?.reset(); last = performance.now(); updateHud(); draw(); canvas.focus(); frame = requestAnimationFrame(loop);
}

function beginMove(direction) {
  if (!game || paused || game.completed || game.player.move) return false;
  const [dx, dy] = directions[direction]; const targetX = game.player.x + dx; const targetY = game.player.worldY + dy;
  if (targetX < 0.5 || targetX > COLS - 0.5 || targetY < game.checkpoint || targetY < 0) return false;
  ensureRows(Math.floor(game.cameraY) - 2, Math.ceil(targetY) + VISIBLE_ROWS + 4);
  game.player.move = { direction, fromX: game.player.x, fromY: game.player.worldY, toX: targetX, toY: targetY, t: 0 };
  game.player.queued = null; return true;
}

function requestMove(direction) {
  if (!game || !running) start();
  if (!game || paused || game.completed) return;
  if (!beginMove(direction)) game.player.queued = direction;
  game.lastInput = game.time;
}

function resetPlayer(message) {
  game.lives--; game.combo = 1; statusElement.textContent = `${message} Reprise au dernier refuge.`;
  if (game.lives <= 0) { finish(false, 'Vous n’avez plus de véhicules de secours.'); return; }
  game.player = makePlayer(game.checkpoint, 1.4); game.cameraY = Math.max(0, game.checkpoint - 2); ensureRows(game.checkpoint - 2, game.checkpoint + VISIBLE_ROWS + 5);
}

function reachRow(row) {
  if (row <= game.maximumRow) return;
  const gained = row - game.maximumRow; game.maximumRow = row; game.score += Math.round(gained * 115 * game.combo + Math.min(350, row * 3));
  if (row > 0 && row % SECTOR_ROWS === 0) {
    game.checkpoint = row; game.sectors = row / SECTOR_ROWS; game.combo = Math.min(10, game.combo + 1); game.score += 1500 * game.combo;
    game.particles.push({ x: game.player.x, worldY: row, text: `REFUGE ${game.sectors} · ×${game.combo}`, life: 1.6 }); statusElement.textContent = `Refuge ${game.sectors} atteint : reprise sécurisée ici.`; spawnBonus();
    const target = goalSelect.value === 'endless' ? Infinity : Number(goalSelect.value); if (game.sectors >= target) finish(true, `Objectif de ${target} secteur(s) atteint.`);
  }
}

function itemOverlap(item, playerX, radius, inset = 0) { return playerX + radius > item.x + inset && playerX - radius < item.x + item.width - inset; }
function supportingPlatform(lane, playerX) { const radius = difficulties[difficultySelect.value].hitbox; return lane.items.find(item => playerX - radius >= item.x - 0.08 && playerX + radius <= item.x + item.width + 0.08); }

function update(delta) {
  if (!game || game.completed) return;
  game.time += delta; game.slow = Math.max(0, game.slow - delta); game.player.invincible = Math.max(0, game.player.invincible - delta); game.player.collisionGrace = Math.max(0, game.player.collisionGrace - delta);
  ensureRows(Math.floor(game.cameraY) - 2, Math.ceil(game.cameraY) + VISIBLE_ROWS + 7);
  const slowFactor = game.slow ? 0.5 : 1;
  for (const lane of game.lanes.values()) for (const item of lane.items) {
    item.x += lane.direction * lane.speed * slowFactor * delta / CELL; const margin = item.width + lane.clearance;
    if (item.x > COLS + margin) item.x = -margin; if (item.x + item.width < -margin) item.x = COLS + margin;
  }
  if (game.player.move) {
    const move = game.player.move; move.t = Math.min(1, move.t + delta * difficulties[difficultySelect.value].moveSpeed); const eased = move.t < 0.5 ? 2 * move.t * move.t : 1 - (-2 * move.t + 2) ** 2 / 2;
    game.player.x = move.fromX + (move.toX - move.fromX) * eased; game.player.worldY = move.fromY + (move.toY - move.fromY) * eased;
    if (move.t >= 1) { game.player.x = move.toX; game.player.worldY = move.toY; game.player.move = null; game.player.collisionGrace = 0.12; reachRow(Math.floor(game.player.worldY)); if (game.player.queued) beginMove(game.player.queued); }
  } else {
    const repeated = [...heldDirections].at(-1); if (repeated && game.time - game.lastInput > 0.15) { beginMove(repeated); game.lastInput = game.time; }
  }
  if (!game.player.move) {
    const row = Math.round(game.player.worldY); const lane = game.lanes.get(row); const radius = difficulties[difficultySelect.value].hitbox;
    if (lane?.kind === 'road' && game.player.invincible <= 0 && game.player.collisionGrace <= 0 && lane.items.some(item => itemOverlap(item, game.player.x, radius, 0.1))) resetPlayer('Collision avec un véhicule !');
    else if (lane?.kind === 'river') { const support = supportingPlatform(lane, game.player.x); if (!support && game.player.invincible <= 0 && game.player.collisionGrace <= 0) resetPlayer('Le courant vous emporte !'); else if (support) { game.player.x += lane.direction * lane.speed * slowFactor * delta / CELL; if (game.player.x < 0.25 || game.player.x > COLS - 0.25) resetPlayer('La plateforme quitte l’écran.'); } }
  }
  if (game.bonus?.active && Math.hypot(game.player.x - game.bonus.x, game.player.worldY - game.bonus.worldY) < 0.48) { game.bonus.active = false; game.slow = 8; game.score += 600; statusElement.textContent = 'Capsule temporelle : trafic ralenti !'; }
  const cameraTarget = Math.max(0, game.player.worldY - 4); game.cameraY += (cameraTarget - game.cameraY) * Math.min(1, delta * 5.5);
  game.particles.forEach(particle => { particle.life -= delta; }); game.particles = game.particles.filter(particle => particle.life > 0); updateHud();
}

function finish(won, reason) {
  game.completed = true; running = false; document.getElementById('overlayTitle').textContent = won ? 'Étape accomplie' : 'Fin de l’ascension';
  document.getElementById('overlayText').textContent = `${reason} Distance : ${game.maximumRow * 10} m · score ${game.score.toLocaleString('fr-FR')}.`; document.getElementById('overlay').hidden = false;
  window.GameRecords?.finish({ score: game.score, scoreLabel: `${game.score.toLocaleString('fr-FR')} points · ${game.maximumRow * 10} m`, won, distance: game.maximumRow * 10 });
}

function updateHud() {
  document.getElementById('score').textContent = game.score.toLocaleString('fr-FR'); document.getElementById('crossings').textContent = `${game.maximumRow * 10} m`;
  document.getElementById('lives').textContent = game.lives; document.getElementById('combo').textContent = `×${game.combo}`;
}

function screenY(worldY) { return canvas.height - (worldY - game.cameraY + 1) * CELL; }
function roundedRect(x, y, width, height, radius) { context.beginPath(); context.roundRect(x, y, width, height, radius); context.fill(); }

function drawLane(lane) {
  const y = screenY(lane.worldRow); if (y < -CELL || y > canvas.height) return;
  if (lane.kind === 'safe') { const colors = ['#166534', '#14532d', '#3f6212', '#0f766e']; context.fillStyle = colors[lane.biome]; context.fillRect(0, y, canvas.width, CELL); context.fillStyle = '#ffffff18'; for (let x = (lane.worldRow * 37) % 70; x < canvas.width; x += 70) context.fillRect(x, y + 12 + x % 17, 18, 3); if (lane.checkpoint) { context.fillStyle = '#facc1544'; context.fillRect(0, y + 5, canvas.width, CELL - 10); context.fillStyle = '#fef08a'; context.font = '900 14px Arial'; context.textAlign = 'left'; context.fillText(`REFUGE ${lane.worldRow / SECTOR_ROWS}`, 14, y + 23); } }
  else if (lane.kind === 'road') { context.fillStyle = lane.biome === 2 ? '#3f3f46' : '#273445'; context.fillRect(0, y, canvas.width, CELL); context.strokeStyle = '#f8fafc66'; context.setLineDash([22, 20]); context.beginPath(); context.moveTo(0, y + CELL / 2); context.lineTo(canvas.width, y + CELL / 2); context.stroke(); context.setLineDash([]); }
  else { const water = context.createLinearGradient(0, y, 0, y + CELL); water.addColorStop(0, lane.biome === 3 ? '#0f766e' : '#075985'); water.addColorStop(1, '#0e7490'); context.fillStyle = water; context.fillRect(0, y, canvas.width, CELL); context.strokeStyle = '#67e8f933'; for (let wave = 10; wave < CELL; wave += 18) { context.beginPath(); context.moveTo(0, y + wave); context.lineTo(canvas.width, y + wave); context.stroke(); } }
  for (const item of lane.items) {
    const x = item.x * CELL; const width = item.width * CELL;
    if (lane.kind === 'road') { const colors = { car: '#fb7185', truck: '#f59e0b', bike: '#38bdf8', bus: '#a78bfa', convoy: '#ef4444' }; context.fillStyle = colors[item.type]; context.shadowColor = '#000'; context.shadowBlur = 6; roundedRect(x + 5, y + (item.type === 'bike' ? 19 : 11), width - 10, CELL - (item.type === 'bike' ? 38 : 22), item.type === 'bus' ? 5 : 9); context.shadowBlur = 0; context.fillStyle = '#dbeafe'; context.fillRect(x + width * 0.22, y + 16, Math.max(7, width * (item.type === 'bus' ? 0.5 : 0.28)), CELL - 32); }
    else if (item.type === 'lily') { context.fillStyle = '#4ade80'; context.beginPath(); context.arc(x + width / 2, y + CELL / 2, Math.min(width, CELL) * 0.38, 0.2, Math.PI * 2 - 0.2); context.lineTo(x + width / 2, y + CELL / 2); context.fill(); }
    else { context.fillStyle = ['raft', 'barge'].includes(item.type) ? '#a16207' : '#854d0e'; roundedRect(x, y + 10, width, CELL - 20, item.type === 'log' ? 15 : 4); context.strokeStyle = '#facc1548'; for (let mark = 18; mark < width; mark += 28) { context.beginPath(); context.moveTo(x + mark, y + 13); context.lineTo(x + mark, y + CELL - 13); context.stroke(); } }
  }
}

function draw() {
  context.fillStyle = '#071b16'; context.fillRect(0, 0, canvas.width, canvas.height); if (!game) return;
  [...game.lanes.values()].sort((left, right) => right.worldRow - left.worldRow).forEach(drawLane);
  if (game.bonus?.active) { context.fillStyle = '#e879f9'; context.shadowColor = '#f0abfc'; context.shadowBlur = 14; context.beginPath(); context.arc(game.bonus.x * CELL, screenY(game.bonus.worldY) + CELL / 2, 14 + Math.sin(game.time * 5) * 2, 0, Math.PI * 2); context.fill(); context.shadowBlur = 0; }
  const x = game.player.x * CELL; const y = screenY(game.player.worldY) + CELL / 2; context.save(); context.translate(x, y); context.globalAlpha = game.player.invincible > 0 && Math.floor(game.time * 12) % 2 ? 0.4 : 1; context.fillStyle = '#f8fafc'; context.shadowColor = '#4ade80'; context.shadowBlur = 12; context.beginPath(); context.arc(0, 0, 18, 0, Math.PI * 2); context.fill(); context.fillStyle = '#16a34a'; context.beginPath(); context.arc(-6, -3, 4.5, 0, Math.PI * 2); context.arc(6, -3, 4.5, 0, Math.PI * 2); context.fill(); context.fillRect(-13, 7, 26, 6); context.restore();
  game.particles.forEach(particle => { context.globalAlpha = particle.life; context.fillStyle = '#fef08a'; context.font = '900 25px Arial'; context.textAlign = 'center'; context.fillText(particle.text, particle.x * CELL, screenY(particle.worldY) + CELL / 2); }); context.globalAlpha = 1;
  context.fillStyle = '#052e2dcc'; context.fillRect(canvas.width - 150, 10, 138, 54); context.fillStyle = '#fff'; context.font = '800 14px Arial'; context.textAlign = 'center'; context.fillText(`${game.maximumRow * 10} m`, canvas.width - 81, 32); context.fillText(`Refuge ${game.sectors}`, canvas.width - 81, 52);
  if (paused) { context.fillStyle = '#021710bb'; context.fillRect(0, 0, canvas.width, canvas.height); context.fillStyle = '#fff'; context.font = '900 52px Arial'; context.textAlign = 'center'; context.fillText('PAUSE', canvas.width / 2, canvas.height / 2); }
}

function loop(time) { const delta = Math.min(0.035, (time - last) / 1000 || 0); last = time; if (running && !paused) update(delta); draw(); frame = requestAnimationFrame(loop); }
function togglePause() { if (!game || game.completed) return; paused = !paused; document.getElementById('pause').textContent = paused ? 'Reprendre' : 'Pause'; }

document.addEventListener('keydown', event => { const direction = keyMap[event.key] || keyMap[event.key.toLowerCase?.()]; if (direction) { event.preventDefault(); if (!event.repeat) requestMove(direction); heldDirections.add(direction); } if (event.key === 'p' || event.key === 'Escape') togglePause(); });
document.addEventListener('keyup', event => { const direction = keyMap[event.key] || keyMap[event.key.toLowerCase?.()]; if (direction) heldDirections.delete(direction); });
document.querySelectorAll('[data-dir]').forEach(button => { button.addEventListener('pointerdown', event => { event.preventDefault(); heldDirections.add(button.dataset.dir); requestMove(button.dataset.dir); }); button.addEventListener('pointerup', () => heldDirections.delete(button.dataset.dir)); button.addEventListener('pointercancel', () => heldDirections.delete(button.dataset.dir)); });
canvas.addEventListener('pointerdown', event => { const rectangle = canvas.getBoundingClientRect(); const x = event.clientX - rectangle.left - rectangle.width / 2; const y = event.clientY - rectangle.top - rectangle.height / 2; requestMove(Math.abs(x) > Math.abs(y) ? x < 0 ? 'left' : 'right' : y < 0 ? 'up' : 'down'); });
document.getElementById('start').onclick = start; document.getElementById('replay').onclick = start; document.getElementById('pause').onclick = togglePause;

window.TraverseeTestAPI = { diagnostics() { const sample = createGame('diagnostic'); ensureRows(0, 50); const lanes = [...sample.lanes.values()]; const startY = sample.player.worldY; beginMove('up'); sample.player.move.t = 1; update(0); return { visibleRows: VISIBLE_ROWS, generatedRows: lanes.length, road: lanes.some(lane => lane.kind === 'road'), river: lanes.some(lane => lane.kind === 'river'), obstacleTypes: new Set(lanes.flatMap(lane => lane.items.map(item => item.type))).size, safeSpacing: lanes.filter(lane => lane.kind === 'safe').every(lane => lane.worldRow % 6 === 0), continuousAdvance: sample.player.worldY > startY && sample.checkpoint === 0, scrollingCamera: 'cameraY' in sample, checkpointInterval: SECTOR_ROWS, minimumClearance: Math.min(...lanes.filter(lane => lane.kind !== 'safe').map(lane => lane.clearance)), bufferedInput: 'queued' in sample.player, hitbox: difficulties[difficultySelect.value].hitbox, difficulties: Object.keys(difficulties), goals: [...goalSelect.options].map(option => option.value), endless: [...goalSelect.options].some(option => option.value === 'endless'), canvas: canvas.width === 720 && canvas.height === 760 }; } };
try { localStorage.setItem('game-hub:last-game', 'traversee-turbo'); } catch {}
game = createGame('preview'); updateHud(); draw(); frame = requestAnimationFrame(loop);
