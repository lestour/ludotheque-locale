'use strict';

const canvas = document.getElementById('screen');
const context = canvas.getContext('2d');
const modeSelect = document.getElementById('mode');
const difficultySelect = document.getElementById('difficulty');
const arenaSelect = document.getElementById('arena');
const bonusSelect = document.getElementById('bonus');
const statusElement = document.getElementById('status');
const scoreElement = document.getElementById('score');
const titleElement = document.getElementById('gameTitle');
const descriptionElement = document.getElementById('description');
const controlsElement = document.getElementById('controls');
const rulesElement = document.getElementById('rules');
const pad = document.querySelector('.pad');

const definitions = {
  snake: { title: 'Serpent', description: 'Ramassez les orbes sans toucher un mur ni votre trace.', controls: 'Flèches, ZQSD/WASD ou glissement tactile. Le bouton central met en pause.', rules: ['Chaque orbe allonge le serpent et accélère la partie.', 'Le contour visible est mortel, sauf avec la variante traversée.', 'Une direction opposée immédiate est refusée.'] },
  breaker: { title: 'Casse-briques', description: 'Renvoyez la balle et videz le tableau.', controls: 'Maintenez gauche ou droite, ou glissez horizontalement.', rules: ['La balle rebondit selon son point de contact avec la raquette.', 'Le format change le nombre de lignes et colonnes.', 'Vous perdez une vie si la balle atteint le bas.'] },
  maze: { title: 'Labyrinthe', description: 'Trouvez une nouvelle sortie dans un labyrinthe aléatoire.', controls: 'Flèches, ZQSD/WASD ou glissement tactile.', rules: ['Chaque format génère un labyrinthe de dimensions différentes.', 'Les étoiles facultatives ajoutent du temps.', 'Atteignez la porte verte avant la fin du chronomètre.'] },
  racer: { title: 'Course express', description: 'Évitez les véhicules jusqu’à la ligne d’arrivée.', controls: 'Gauche/droite pour changer de voie ; bouton central pour le turbo.', rules: ['Le format change le nombre de voies et la distance.', 'La difficulté accélère les obstacles.', 'Le turbo rapporte plus de points mais augmente aussi la vitesse.'] }
};

const formats = {
  compact: { snake: [22, 17], maze: [11, 9], bricks: [6, 4], lanes: 3, target: 900 },
  standard: { snake: [28, 22], maze: [13, 11], bricks: [8, 5], lanes: 4, target: 1500 },
  large: { snake: [34, 25], maze: [17, 13], bricks: [10, 6], lanes: 5, target: 2300 }
};

let frame = 0;
let running = false;
let score = 0;
let game = null;
let last = 0;
let pointerStart = null;
let finishedGame = false;
let randomGenerator = Math.random;
const pressed = new Set();
const random = () => randomGenerator();
const difficulty = () => ({ easy: 0.76, normal: 1, hard: 1.28, extreme: 1.58 })[difficultySelect.value];
const format = () => formats[arenaSelect.value];

function shuffle(values) {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [output[index], output[other]] = [output[other], output[index]];
  }
  return output;
}

function info() {
  const definition = definitions[modeSelect.value];
  titleElement.textContent = definition.title;
  descriptionElement.textContent = definition.description;
  controlsElement.textContent = definition.controls;
  rulesElement.replaceChildren(...definition.rules.map(text => {
    const item = document.createElement('li');
    item.textContent = text;
    return item;
  }));
  updatePad();
}

function updatePad() {
  const mode = modeSelect.value;
  pad.querySelectorAll('[data-key]').forEach(button => {
    const key = button.dataset.key;
    const used = mode === 'snake' || mode === 'maze' || (['breaker', 'racer'].includes(mode) && ['ArrowLeft', 'ArrowRight'].includes(key)) || (mode === 'racer' && key === ' ');
    button.style.visibility = used ? 'visible' : 'hidden';
  });
}

function point(x, y, color, radius = 12) {
  context.fillStyle = color;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

function background() {
  context.fillStyle = '#0f172a';
  context.fillRect(0, 0, canvas.width, canvas.height);
}

function generateMaze(width, height) {
  const cells = Array.from({ length: height }, () => Array(width).fill('1'));
  const visit = (x, y) => {
    cells[y][x] = '0';
    for (const [xOffset, yOffset] of shuffle([[2, 0], [-2, 0], [0, 2], [0, -2]])) {
      const nextX = x + xOffset;
      const nextY = y + yOffset;
      if (nextX > 0 && nextX < width - 1 && nextY > 0 && nextY < height - 1 && cells[nextY][nextX] === '1') {
        cells[y + yOffset / 2][x + xOffset / 2] = '0';
        visit(nextX, nextY);
      }
    }
  };
  visit(1, 1);
  cells[height - 2][width - 2] = '0';
  return cells.map(row => row.join(''));
}

function start() {
  score = 0;
  frame = 0;
  finishedGame = false;
  pressed.clear();
  const sharedSeed = new URLSearchParams(location.search).get('seed') || Date.now();
  randomGenerator = window.GameRuntime?.createRandom(`${sharedSeed}:${modeSelect.value}:${difficultySelect.value}:${arenaSelect.value}:${bonusSelect.value}`) || Math.random;
  running = true;
  last = performance.now();
  const mode = modeSelect.value;
  const selectedFormat = format();
  if (mode === 'snake') {
    const [width, height] = selectedFormat.snake;
    game = { width, height, body: [{ x: Math.floor(width / 2), y: Math.floor(height / 2) }, { x: Math.floor(width / 2) - 1, y: Math.floor(height / 2) }, { x: Math.floor(width / 2) - 2, y: Math.floor(height / 2) }], direction: { x: 1, y: 0 }, next: { x: 1, y: 0 }, food: { x: width - 4, y: Math.floor(height / 2) }, tick: 0, wrap: bonusSelect.value === 'on' };
  } else if (mode === 'breaker') {
    const [columns, rows] = selectedFormat.bricks;
    const gap = 5;
    const brickWidth = (560 - gap * (columns - 1)) / columns;
    game = { ball: { x: 320, y: 390, xSpeed: 3, ySpeed: -4 }, paddle: 270, paddleWidth: 100, bricks: Array.from({ length: columns * rows }, (_, index) => ({ x: 40 + (index % columns) * (brickWidth + gap), y: 50 + Math.floor(index / columns) * 31, width: brickWidth, height: 22, alive: true })), lives: bonusSelect.value === 'on' ? 4 : 3 };
  } else if (mode === 'maze') {
    const [width, height] = selectedFormat.maze;
    const layout = generateMaze(width, height);
    const open = [];
    layout.forEach((row, y) => [...row].forEach((cell, x) => { if (cell === '0' && !(x === 1 && y === 1) && !(x === width - 2 && y === height - 2)) open.push(`${x},${y}`); }));
    game = { width, height, player: { x: 1, y: 1 }, stars: new Set(shuffle(open).slice(0, bonusSelect.value === 'on' ? Math.ceil(width / 3) : 0)), time: (width * height * 0.45) / difficulty(), layout, exit: { x: width - 2, y: height - 2 } };
  } else {
    game = { lane: Math.floor(selectedFormat.lanes / 2), lanes: selectedFormat.lanes, target: selectedFormat.target, obstacles: [], turbo: 0, spawn: 0, grace: 90 };
  }
  statusElement.textContent = 'Partie en cours.';
  window.GameRecords?.reset();
  draw();
  requestAnimationFrame(loop);
}

function finish(message, won = false) {
  if (finishedGame) return;
  running = false;
  finishedGame = true;
  pressed.clear();
  statusElement.textContent = `${message} Utilisez « Démarrer » pour une nouvelle partie.`;
  window.GameRecords?.finish({ score: Math.floor(score), scoreLabel: 'Points', won });
  draw();
}

function handleInput(key) {
  if (!game || finishedGame) return;
  if (key === ' ') {
    if (modeSelect.value === 'racer' && running) game.turbo = bonusSelect.value === 'on' ? 90 : 55;
    else {
      running = !running;
      statusElement.textContent = running ? 'Reprise.' : 'Pause.';
      last = performance.now();
      if (running) requestAnimationFrame(loop);
    }
    return;
  }
  const vectors = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  if (modeSelect.value === 'snake' && vectors[key]) {
    const [x, y] = vectors[key];
    if (x !== -game.direction.x || y !== -game.direction.y) game.next = { x, y };
  } else if (modeSelect.value === 'maze' && vectors[key]) {
    const [xOffset, yOffset] = vectors[key];
    const x = game.player.x + xOffset;
    const y = game.player.y + yOffset;
    if (game.layout[y]?.[x] === '0') game.player = { x, y };
  } else if (modeSelect.value === 'racer' && ['ArrowLeft', 'ArrowRight'].includes(key)) {
    game.lane = Math.max(0, Math.min(game.lanes - 1, game.lane + (key === 'ArrowLeft' ? -1 : 1)));
  }
  draw();
}

function updateSnake() {
  game.tick++;
  const interval = Math.max(2, 10 - Math.floor(score / 35)) / difficulty();
  if (game.tick < interval) return;
  game.tick = 0;
  game.direction = game.next;
  const head = { x: game.body[0].x + game.direction.x, y: game.body[0].y + game.direction.y };
  if (game.wrap) {
    head.x = (head.x + game.width) % game.width;
    head.y = (head.y + game.height) % game.height;
  }
  if (head.x < 0 || head.y < 0 || head.x >= game.width || head.y >= game.height || game.body.some(part => part.x === head.x && part.y === head.y)) return finish('Le serpent a rencontré un obstacle.');
  game.body.unshift(head);
  if (head.x === game.food.x && head.y === game.food.y) {
    score += 10;
    do game.food = { x: Math.floor(random() * game.width), y: Math.floor(random() * game.height) };
    while (game.body.some(part => part.x === game.food.x && part.y === game.food.y));
  } else game.body.pop();
}

function updateBreaker() {
  const ball = game.ball;
  ball.x += ball.xSpeed * difficulty();
  ball.y += ball.ySpeed * difficulty();
  if (ball.x < 9 || ball.x > canvas.width - 9) { ball.xSpeed *= -1; ball.x = Math.max(9, Math.min(canvas.width - 9, ball.x)); }
  if (ball.y < 9) { ball.ySpeed = Math.abs(ball.ySpeed); ball.y = 9; }
  if (ball.y + 8 >= 470 && ball.y < 484 && ball.x >= game.paddle && ball.x <= game.paddle + game.paddleWidth && ball.ySpeed > 0) {
    ball.ySpeed = -Math.abs(ball.ySpeed);
    ball.xSpeed += (ball.x - (game.paddle + game.paddleWidth / 2)) / 28;
  }
  for (const brick of game.bricks) if (brick.alive && ball.x + 8 >= brick.x && ball.x - 8 <= brick.x + brick.width && ball.y + 8 >= brick.y && ball.y - 8 <= brick.y + brick.height) {
    brick.alive = false;
    ball.ySpeed *= -1;
    score += 5;
    break;
  }
  if (!game.bricks.some(brick => brick.alive)) return finish('Tableau nettoyé !', true);
  if (ball.y > canvas.height + 12) {
    game.lives--;
    if (!game.lives) return finish('Plus de balle.');
    game.ball = { x: 320, y: 390, xSpeed: 3, ySpeed: -4 };
  }
}

function updateMaze(delta) {
  game.time -= delta / 1000;
  const position = `${game.player.x},${game.player.y}`;
  if (game.stars.delete(position)) { score += 25; game.time += 7; }
  if (game.player.x === game.exit.x && game.player.y === game.exit.y) return finish('Sortie atteinte !', true);
  if (game.time <= 0) finish('Le temps est écoulé.');
}

function updateRacer() {
  game.spawn++;
  if (game.spawn > Math.max(24, 65 - score / 55) / difficulty()) {
    game.spawn = 0;
    const occupied = new Set(game.obstacles.filter(obstacle => obstacle.y < 125).map(obstacle => obstacle.lane));
    const lanes = range(game.lanes).filter(lane => !occupied.has(lane));
    game.obstacles.push({ lane: lanes[Math.floor(random() * lanes.length)] ?? Math.floor(random() * game.lanes), y: -90 });
  }
  const speed = 3.1 * difficulty() * (game.turbo ? 1.42 : 1);
  game.obstacles.forEach(obstacle => { obstacle.y += speed; });
  game.obstacles = game.obstacles.filter(obstacle => obstacle.y < canvas.height + 100);
  if (game.grace-- <= 0 && game.obstacles.some(obstacle => obstacle.lane === game.lane && obstacle.y > 392 && obstacle.y < 510)) return finish('Collision !');
  score += game.turbo ? 1.7 : 1;
  game.turbo = Math.max(0, game.turbo - 1);
  if (score >= game.target) finish('Ligne d’arrivée franchie !', true);
}

function draw() {
  background();
  if (!game) {
    context.fillStyle = '#e2e8f0';
    context.font = '28px Arial';
    context.fillText('Choisissez un mode puis démarrez.', 120, 260);
    return;
  }
  const mode = modeSelect.value;
  if (mode === 'snake') {
    const cell = Math.floor(Math.min(610 / game.width, 490 / game.height));
    const offsetX = (canvas.width - game.width * cell) / 2;
    const offsetY = (canvas.height - game.height * cell) / 2;
    context.strokeStyle = '#e2e8f0';
    context.lineWidth = 3;
    context.strokeRect(offsetX, offsetY, game.width * cell, game.height * cell);
    game.body.forEach((part, index) => {
      context.fillStyle = index ? '#34d399' : '#facc15';
      context.fillRect(offsetX + part.x * cell + 2, offsetY + part.y * cell + 2, cell - 3, cell - 3);
    });
    point(offsetX + game.food.x * cell + cell / 2, offsetY + game.food.y * cell + cell / 2, '#fb7185', Math.max(5, cell / 3));
  } else if (mode === 'breaker') {
    context.fillStyle = '#e2e8f0';
    context.fillRect(game.paddle, 470, game.paddleWidth, 12);
    point(game.ball.x, game.ball.y, '#facc15', 8);
    game.bricks.forEach((brick, index) => {
      if (!brick.alive) return;
      context.fillStyle = ['#38bdf8', '#818cf8', '#f472b6', '#fb923c', '#4ade80'][index % 5];
      context.fillRect(brick.x, brick.y, brick.width, brick.height);
    });
    context.fillStyle = '#e2e8f0';
    context.font = '18px Arial';
    context.fillText(`Vies : ${game.lives}`, 16, 505);
  } else if (mode === 'maze') {
    const scale = Math.floor(Math.min(570 / game.width, 450 / game.height));
    const offsetX = (canvas.width - game.width * scale) / 2;
    const offsetY = 22;
    game.layout.forEach((row, y) => [...row].forEach((cell, x) => {
      context.fillStyle = cell === '1' ? '#334155' : '#dbeafe';
      context.fillRect(offsetX + x * scale, offsetY + y * scale, scale - 1, scale - 1);
    }));
    game.stars.forEach(id => { const [x, y] = id.split(',').map(Number); point(offsetX + x * scale + scale / 2, offsetY + y * scale + scale / 2, '#facc15', Math.max(4, scale / 5)); });
    context.fillStyle = '#22c55e';
    context.fillRect(offsetX + game.exit.x * scale + 4, offsetY + game.exit.y * scale + 4, scale - 8, scale - 8);
    point(offsetX + game.player.x * scale + scale / 2, offsetY + game.player.y * scale + scale / 2, '#f472b6', Math.max(6, scale / 3));
    context.fillStyle = '#e2e8f0';
    context.fillText(`Temps : ${Math.ceil(game.time)} s`, 20, 505);
  } else {
    const roadWidth = Math.min(480, game.lanes * 92);
    const laneWidth = roadWidth / game.lanes;
    const roadX = (canvas.width - roadWidth) / 2;
    context.fillStyle = '#475569';
    context.fillRect(roadX, 0, roadWidth, canvas.height);
    context.strokeStyle = '#e2e8f0';
    context.lineWidth = 4;
    context.setLineDash([24, 18]);
    for (let lane = 1; lane < game.lanes; lane++) {
      context.beginPath();
      context.moveTo(roadX + lane * laneWidth, 0);
      context.lineTo(roadX + lane * laneWidth, canvas.height);
      context.stroke();
    }
    context.setLineDash([]);
    game.obstacles.forEach(obstacle => {
      context.fillStyle = '#fb7185';
      context.fillRect(roadX + obstacle.lane * laneWidth + laneWidth * 0.17, obstacle.y, laneWidth * 0.66, 86);
    });
    context.fillStyle = game.turbo ? '#facc15' : '#38bdf8';
    context.fillRect(roadX + game.lane * laneWidth + laneWidth * 0.17, 420, laneWidth * 0.66, 86);
  }
  scoreElement.textContent = `Score : ${Math.floor(score)}`;
  document.querySelectorAll('[data-key]').forEach(button => button.classList.toggle('primary', pressed.has(button.dataset.key)));
}

function loop(now) {
  if (!running) return;
  const delta = Math.min(50, now - last);
  last = now;
  frame++;
  const direction = (pressed.has('ArrowLeft') ? -1 : 0) + (pressed.has('ArrowRight') ? 1 : 0);
  if (modeSelect.value === 'breaker' && direction) game.paddle = Math.max(0, Math.min(canvas.width - game.paddleWidth, game.paddle + direction * 7));
  if (modeSelect.value === 'snake') updateSnake();
  else if (modeSelect.value === 'breaker') updateBreaker();
  else if (modeSelect.value === 'maze') updateMaze(delta);
  else updateRacer();
  draw();
  if (running) requestAnimationFrame(loop);
}

function range(length) { return Array.from({ length }, (_, index) => index); }
const normalizeKey = value => ({ z: 'ArrowUp', q: 'ArrowLeft', s: 'ArrowDown', d: 'ArrowRight', w: 'ArrowUp', a: 'ArrowLeft' })[value.toLowerCase()] || value;
document.addEventListener('keydown', event => {
  const input = normalizeKey(event.key);
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(input)) return;
  event.preventDefault();
  if (!pressed.has(input)) { pressed.add(input); handleInput(input); }
});
document.addEventListener('keyup', event => { pressed.delete(normalizeKey(event.key)); draw(); });
document.querySelectorAll('[data-key]').forEach(button => {
  button.onpointerdown = event => { event.preventDefault(); pressed.add(button.dataset.key); handleInput(button.dataset.key); };
  button.onpointerup = button.onpointercancel = () => { pressed.delete(button.dataset.key); draw(); };
});
canvas.addEventListener('pointerdown', event => { pointerStart = { x: event.clientX, y: event.clientY }; });
canvas.addEventListener('pointerup', event => {
  if (!pointerStart) return;
  const xOffset = event.clientX - pointerStart.x;
  const yOffset = event.clientY - pointerStart.y;
  pointerStart = null;
  if (Math.max(Math.abs(xOffset), Math.abs(yOffset)) < 12) return handleInput(' ');
  handleInput(Math.abs(xOffset) > Math.abs(yOffset) ? (xOffset > 0 ? 'ArrowRight' : 'ArrowLeft') : (yOffset > 0 ? 'ArrowDown' : 'ArrowUp'));
});
document.getElementById('start').onclick = start;
document.getElementById('pause').onclick = () => handleInput(' ');
modeSelect.onchange = () => { game = null; running = false; finishedGame = false; pressed.clear(); info(); draw(); };
[difficultySelect, arenaSelect, bonusSelect].forEach(control => { control.onchange = () => { if (game) statusElement.textContent = 'Option modifiée : démarrez une nouvelle manche pour l’appliquer.'; }; });
info();
draw();
window.ArcadeTestAPI = { diagnostics: () => ({ modes: Object.keys(definitions), canvas: canvas.width === 640 && canvas.height === 520, controls: document.querySelectorAll('[data-key]').length === 5, formats: arenaSelect.options.length, mazeFormats: new Set(Object.values(formats).map(value => value.maze.join('x'))).size, appliedOptions: Object.values(formats).every(value => value.snake && value.maze && value.bricks && value.lanes && value.target), difficultyFactors: ['easy','normal','hard','extreme'].map(value => ({easy:.76,normal:1,hard:1.28,extreme:1.58})[value]), bonuses: { snake:'wrap', breaker:'extra-life', maze:'stars', racer:'turbo' } }) };
try { localStorage.setItem('game-hub:last-game', 'arcade'); } catch {}
