'use strict';

const canvas = document.getElementById('screen');
const context = canvas.getContext('2d');
const fileInput = document.getElementById('imageFile');
const formatSelect = document.getElementById('format');
const shapeSelect = document.getElementById('shape');
const rotationToggle = document.getElementById('rotation');
const statusElement = document.getElementById('status');
const preview = document.getElementById('preview');
const BOARD = { x: 145, y: 80, w: 670, h: 500 };
const WORKSPACE = { x: -720, y: -520, w: 2400, h: 1720 };
const FORMATS = [[3, 2], [4, 3], [5, 4], [6, 4], [8, 6], [10, 8], [12, 9]];
const ZOOM = { minimum: 0.12, maximum: 4.5, step: 1.22 };

let image = new Image();
let game = null;
let frame = 0;
let drag = null;
let selected = null;
let interaction = null;
const pointers = new Map();
const view = { x: canvas.width / 2, y: canvas.height / 2, zoom: 1 };

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function createDefaultImage() {
  const source = document.createElement('canvas'); source.width = 1200; source.height = 800;
  const paint = source.getContext('2d'); const sky = paint.createLinearGradient(0, 0, 0, 800);
  sky.addColorStop(0, '#38bdf8'); sky.addColorStop(.58, '#dbeafe'); sky.addColorStop(.59, '#0f766e'); sky.addColorStop(1, '#064e3b');
  paint.fillStyle = sky; paint.fillRect(0, 0, 1200, 800); paint.fillStyle = '#fef3c7'; paint.beginPath(); paint.arc(180, 155, 82, 0, Math.PI * 2); paint.fill();
  for (let layer = 0; layer < 4; layer++) {
    paint.fillStyle = ['#14532d', '#166534', '#15803d', '#22c55e'][layer]; paint.beginPath(); paint.moveTo(0, 800);
    for (let x = 0; x <= 1200; x += 80) paint.lineTo(x, 470 + layer * 78 + Math.sin(x / 100 + layer) * 55);
    paint.lineTo(1200, 800); paint.fill();
  }
  paint.fillStyle = '#f8fafc'; paint.font = '900 82px Arial'; paint.textAlign = 'center'; paint.fillText('LUDOTHÈQUE', 600, 380);
  return source.toDataURL('image/png');
}

function recommend(width, height, target = 24) {
  const ratio = width / height;
  return FORMATS.map(([cols, rows]) => ({ cols, rows, error: Math.abs(cols / rows - ratio) + Math.abs(cols * rows - target) / target * .18 })).sort((left, right) => left.error - right.error)[0];
}

function selectedFormat() {
  if (formatSelect.value !== 'auto') { const [cols, rows] = formatSelect.value.split('x').map(Number); return { cols, rows }; }
  return recommend(image.naturalWidth || 1200, image.naturalHeight || 800);
}

function hashEdge(axis, row, col, salt = 0) {
  let value = Math.imul(row + 17, 73856093) ^ Math.imul(col + 23, 19349663) ^ Math.imul(axis.charCodeAt(0) + salt, 83492791);
  value ^= value >>> 13; value = Math.imul(value, 1274126177); return (value >>> 0) / 4294967295;
}

function edgeIdentity(row, col, side, rows, cols) {
  if (side === 0 && row === 0 || side === 1 && col === cols - 1 || side === 2 && row === rows - 1 || side === 3 && col === 0) return null;
  if (side === 0) return { axis: 'h', row, col };
  if (side === 2) return { axis: 'h', row: row + 1, col };
  if (side === 1) return { axis: 'v', row, col: col + 1 };
  return { axis: 'v', row, col };
}

function edgeDescriptor(row, col, side, rows, cols) {
  const identity = edgeIdentity(row, col, side, rows, cols); if (!identity) return { sign: 0, center: .5, spread: .18 };
  const sign = hashEdge(identity.axis, identity.row, identity.col) < .5 ? -1 : 1;
  const center = .42 + hashEdge(identity.axis, identity.row, identity.col, 7) * .16;
  const spread = shapeSelect.value === 'wild' ? .16 + hashEdge(identity.axis, identity.row, identity.col, 13) * .08 : .18;
  return { ...identity, sign, center, spread };
}

function edgeValue(row, col, side, rows, cols) { return edgeDescriptor(row, col, side, rows, cols).sign; }

function piecePath(piece, local = false) {
  const { x, y, w, h, row, col, rows, cols } = piece; const originX = local ? 0 : x; const originY = local ? 0 : y; const path = new Path2D();
  const descriptors = [0, 1, 2, 3].map(side => edgeDescriptor(row, col, side, rows, cols)); const tab = Math.min(w, h) * (shapeSelect.value === 'wild' ? .27 : .2);
  path.moveTo(originX, originY);
  function edge(x1, y1, x2, y2, descriptor, side) {
    if (!descriptor.sign) { path.lineTo(x2, y2); return; }
    const vertical = side === 1 || side === 3; const reverse = side === 2 || side === 3; const center = reverse ? 1 - descriptor.center : descriptor.center; const spread = descriptor.spread;
    const before = center - spread; const after = center + spread; const point = ratio => ({ x: x1 + (x2 - x1) * ratio, y: y1 + (y2 - y1) * ratio });
    const entry = point(before); const exit = point(after); const middle = point(center); path.lineTo(entry.x, entry.y);
    if (shapeSelect.value === 'mosaic') {
      const peakX = middle.x + (vertical ? tab * descriptor.sign : 0); const peakY = middle.y + (vertical ? 0 : tab * descriptor.sign);
      path.lineTo(peakX, peakY); path.lineTo(exit.x, exit.y);
    } else if (vertical) {
      path.bezierCurveTo(entry.x + tab * descriptor.sign, entry.y + (exit.y - entry.y) * .12, exit.x + tab * descriptor.sign, entry.y + (exit.y - entry.y) * .88, exit.x, exit.y);
    } else {
      path.bezierCurveTo(entry.x + (exit.x - entry.x) * .12, entry.y + tab * descriptor.sign, entry.x + (exit.x - entry.x) * .88, exit.y + tab * descriptor.sign, exit.x, exit.y);
    }
    path.lineTo(x2, y2);
  }
  edge(originX, originY, originX + w, originY, descriptors[0], 0);
  edge(originX + w, originY, originX + w, originY + h, descriptors[1], 1);
  edge(originX + w, originY + h, originX, originY + h, descriptors[2], 2);
  edge(originX, originY + h, originX, originY, descriptors[3], 3);
  path.closePath(); return path;
}

function scatterPosition(piece, index) {
  const side = index % 4; const margin = Math.max(piece.w, piece.h) * 1.2;
  if (side === 0) return { x: BOARD.x - 300 - Math.random() * 310, y: BOARD.y - 180 + Math.random() * (BOARD.h + 360) };
  if (side === 1) return { x: BOARD.x + BOARD.w + 70 + Math.random() * 420, y: BOARD.y - 180 + Math.random() * (BOARD.h + 360) };
  if (side === 2) return { x: BOARD.x - 120 + Math.random() * (BOARD.w + 240), y: BOARD.y - 390 - Math.random() * 210 };
  return { x: BOARD.x - 120 + Math.random() * (BOARD.w + 240), y: BOARD.y + BOARD.h + 90 + Math.random() * 330 };
}

function resetView(includeWorkspace = false) {
  const target = includeWorkspace ? WORKSPACE : { x: BOARD.x - 170, y: BOARD.y - 130, w: BOARD.w + 340, h: BOARD.h + 260 };
  view.x = target.x + target.w / 2; view.y = target.y + target.h / 2;
  view.zoom = clamp(Math.min(canvas.width / target.w, canvas.height / target.h) * .92, ZOOM.minimum, 1.15);
}

function createGame() {
  const { cols, rows } = selectedFormat(); const scale = Math.min(BOARD.w / image.naturalWidth, BOARD.h / image.naturalHeight); const imageW = image.naturalWidth * scale; const imageH = image.naturalHeight * scale;
  const boardX = BOARD.x + (BOARD.w - imageW) / 2; const boardY = BOARD.y + (BOARD.h - imageH) / 2; const w = imageW / cols; const h = imageH / rows; const pieces = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const piece = { id: row * cols + col, row, col, rows, cols, w, h, homeX: boardX + col * w, homeY: boardY + row * h, x: 0, y: 0, angle: rotationToggle.checked ? Math.floor(Math.random() * 4) * Math.PI / 2 : 0, placed: false, hint: 0 };
    Object.assign(piece, scatterPosition(piece, piece.id)); pieces.push(piece);
  }
  game = { cols, rows, pieces, moves: 0, started: performance.now(), elapsed: 0, completed: false, hints: 0, boardX, boardY, imageW, imageH };
  selected = null; drag = null; interaction = null; pointers.clear(); resetView(false); document.getElementById('overlay').hidden = true;
  statusElement.textContent = `${pieces.length} pièces mélangées. Molette ou pincement pour zoomer, glissez le fond pour vous déplacer.`; window.GameRecords?.reset(); updateHud();
}

function screenPoint(event) {
  const rectangle = canvas.getBoundingClientRect(); return { x: (event.clientX - rectangle.left) * canvas.width / rectangle.width, y: (event.clientY - rectangle.top) * canvas.height / rectangle.height };
}

function screenToWorld(point) { return { x: view.x + (point.x - canvas.width / 2) / view.zoom, y: view.y + (point.y - canvas.height / 2) / view.zoom }; }

function zoomAt(screen, nextZoom) {
  const anchor = screenToWorld(screen); view.zoom = clamp(nextZoom, ZOOM.minimum, ZOOM.maximum);
  view.x = anchor.x - (screen.x - canvas.width / 2) / view.zoom; view.y = anchor.y - (screen.y - canvas.height / 2) / view.zoom;
}

function localPoint(piece, x, y) {
  const centerX = piece.x + piece.w / 2; const centerY = piece.y + piece.h / 2; const cosine = Math.cos(-piece.angle); const sine = Math.sin(-piece.angle); const dx = x - centerX; const dy = y - centerY;
  return { x: dx * cosine - dy * sine + piece.w / 2, y: dx * sine + dy * cosine + piece.h / 2 };
}

function hitPiece(x, y) {
  return [...game.pieces].reverse().find(piece => {
    if (piece.placed) return false; const point = localPoint(piece, x, y); const path = piecePath({ ...piece, x: 0, y: 0 }, true);
    return context.isPointInPath(path, point.x, point.y);
  });
}

function rotatePiece(direction) {
  if (!selected || selected.placed || !rotationToggle.checked) return;
  selected.angle = (selected.angle + direction * Math.PI / 2) % (Math.PI * 2); game.moves++; trySnap(selected);
}

function trySnap(piece) {
  const normalized = (piece.angle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); const snapDistance = Math.max(24, Math.min(piece.w, piece.h) * .32); const distance = Math.hypot(piece.x - piece.homeX, piece.y - piece.homeY);
  if (distance >= snapDistance || Math.min(normalized, Math.PI * 2 - normalized) >= .08) return false;
  piece.x = piece.homeX; piece.y = piece.homeY; piece.angle = 0; piece.placed = true; selected = null; statusElement.textContent = 'Pièce aimantée : ses creux et tenons complètent exactement les pièces voisines.';
  if (game.pieces.every(item => item.placed)) finish(); return true;
}

function finish() {
  game.completed = true; const seconds = Math.round(game.elapsed); const score = Math.max(100, game.pieces.length * 1200 - seconds * 8 - game.moves * 4 - game.hints * 500);
  document.getElementById('result').textContent = `${game.pieces.length} pièces en ${seconds} secondes et ${game.moves} déplacements.`; document.getElementById('overlay').hidden = false;
  window.GameRecords?.finish({ score, scoreLabel: `${seconds} s · ${game.pieces.length} pièces`, won: true, lowerIsBetter: false, pieces: game.pieces.length });
}

function drawPiece(piece) {
  context.save(); context.translate(piece.x + piece.w / 2, piece.y + piece.h / 2); context.rotate(piece.angle); const local = { ...piece, x: -piece.w / 2, y: -piece.h / 2 }; const path = piecePath(local);
  if (!piece.placed) { context.shadowColor = selected === piece ? '#facc15' : '#020617'; context.shadowBlur = selected === piece ? 18 / view.zoom : 8 / view.zoom; }
  context.clip(path); context.drawImage(image, -piece.col * piece.w - piece.w / 2, -piece.row * piece.h - piece.h / 2, piece.w * piece.cols, piece.h * piece.rows); context.restore();
  context.save(); context.translate(piece.x + piece.w / 2, piece.y + piece.h / 2); context.rotate(piece.angle);
  context.strokeStyle = piece.hint > 0 ? '#22c55e' : selected === piece ? '#facc15' : piece.placed ? '#ffffff26' : '#f8fafcaa'; context.lineWidth = (selected === piece ? 4 : piece.placed ? .65 : 2) / view.zoom; context.stroke(piecePath(local)); context.restore();
}

function drawWorkspace() {
  context.save(); context.translate(canvas.width / 2, canvas.height / 2); context.scale(view.zoom, view.zoom); context.translate(-view.x, -view.y);
  context.fillStyle = '#0f172a0d'; context.fillRect(WORKSPACE.x, WORKSPACE.y, WORKSPACE.w, WORKSPACE.h);
  context.strokeStyle = '#64748b33'; context.lineWidth = 1 / view.zoom;
  for (let x = Math.floor(WORKSPACE.x / 100) * 100; x <= WORKSPACE.x + WORKSPACE.w; x += 100) { context.beginPath(); context.moveTo(x, WORKSPACE.y); context.lineTo(x, WORKSPACE.y + WORKSPACE.h); context.stroke(); }
  for (let y = Math.floor(WORKSPACE.y / 100) * 100; y <= WORKSPACE.y + WORKSPACE.h; y += 100) { context.beginPath(); context.moveTo(WORKSPACE.x, y); context.lineTo(WORKSPACE.x + WORKSPACE.w, y); context.stroke(); }
  context.fillStyle = '#0f172a1f'; context.fillRect(game.boardX, game.boardY, game.imageW, game.imageH); context.strokeStyle = '#315fc9'; context.lineWidth = 4 / view.zoom; context.strokeRect(game.boardX - 3, game.boardY - 3, game.imageW + 6, game.imageH + 6);
  context.globalAlpha = .08; context.drawImage(image, game.boardX, game.boardY, game.imageW, game.imageH); context.globalAlpha = 1;
  game.pieces.filter(piece => piece.placed).forEach(drawPiece); game.pieces.filter(piece => !piece.placed).forEach(drawPiece);
  if (game.completed) context.drawImage(image, game.boardX, game.boardY, game.imageW, game.imageH);
  context.restore();
}

function draw() {
  context.clearRect(0, 0, canvas.width, canvas.height); if (!game) return; drawWorkspace();
  context.fillStyle = '#0f172acc'; context.fillRect(12, canvas.height - 46, 188, 34); context.fillStyle = '#f8fafc'; context.font = '800 14px Arial'; context.textAlign = 'left'; context.fillText(`Zoom ${Math.round(view.zoom * 100)} %`, 24, canvas.height - 24);
}

function updateHud() {
  if (!game) return; const placed = game.pieces.filter(piece => piece.placed).length;
  document.getElementById('placed').textContent = `${placed} / ${game.pieces.length}`; document.getElementById('time').textContent = `${Math.floor(game.elapsed / 60)}:${String(Math.floor(game.elapsed % 60)).padStart(2, '0')}`;
  document.getElementById('moves').textContent = game.moves; document.getElementById('progress').textContent = `${Math.round(placed / game.pieces.length * 100)} %`;
}

function loop(now) {
  if (game && !game.completed) { game.elapsed = (now - game.started) / 1000; game.pieces.forEach(piece => { piece.hint = Math.max(0, piece.hint - .016); }); updateHud(); }
  draw(); frame = requestAnimationFrame(loop);
}

function beginPinch() {
  const values = [...pointers.values()]; if (values.length < 2) return;
  const midpoint = { x: (values[0].x + values[1].x) / 2, y: (values[0].y + values[1].y) / 2 };
  interaction = { type: 'pinch', distance: Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y), zoom: view.zoom, midpoint, anchor: screenToWorld(midpoint) }; drag = null;
}

canvas.addEventListener('pointerdown', event => {
  if (!game || game.completed) return; const screen = screenPoint(event); pointers.set(event.pointerId, screen); canvas.setPointerCapture(event.pointerId);
  if (pointers.size >= 2) { beginPinch(); return; }
  const world = screenToWorld(screen); const piece = event.button === 1 || event.shiftKey ? null : hitPiece(world.x, world.y);
  if (piece) { selected = piece; game.pieces.splice(game.pieces.indexOf(piece), 1); game.pieces.push(piece); drag = { piece, offsetX: world.x - piece.x, offsetY: world.y - piece.y }; interaction = { type: 'piece' }; }
  else { selected = null; interaction = { type: 'pan', start: screen, viewX: view.x, viewY: view.y }; }
});

canvas.addEventListener('pointermove', event => {
  if (!pointers.has(event.pointerId)) return; const screen = screenPoint(event); pointers.set(event.pointerId, screen);
  if (interaction?.type === 'pinch' && pointers.size >= 2) {
    const values = [...pointers.values()]; const midpoint = { x: (values[0].x + values[1].x) / 2, y: (values[0].y + values[1].y) / 2 }; const distance = Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
    view.zoom = clamp(interaction.zoom * distance / Math.max(1, interaction.distance), ZOOM.minimum, ZOOM.maximum); view.x = interaction.anchor.x - (midpoint.x - canvas.width / 2) / view.zoom; view.y = interaction.anchor.y - (midpoint.y - canvas.height / 2) / view.zoom; return;
  }
  if (interaction?.type === 'piece' && drag) { const world = screenToWorld(screen); drag.piece.x = world.x - drag.offsetX; drag.piece.y = world.y - drag.offsetY; }
  else if (interaction?.type === 'pan') { view.x = interaction.viewX - (screen.x - interaction.start.x) / view.zoom; view.y = interaction.viewY - (screen.y - interaction.start.y) / view.zoom; }
});

function endPointer(event) {
  const wasPiece = interaction?.type === 'piece' && drag; pointers.delete(event.pointerId);
  if (wasPiece) { game.moves++; trySnap(drag.piece); }
  drag = null; if (pointers.size === 1) { const remaining = [...pointers.values()][0]; interaction = { type: 'pan', start: remaining, viewX: view.x, viewY: view.y }; } else interaction = null;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
}

canvas.addEventListener('pointerup', endPointer); canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', event => { event.preventDefault(); const screen = screenPoint(event); zoomAt(screen, view.zoom * Math.exp(-event.deltaY * .0015)); }, { passive: false });
canvas.addEventListener('dblclick', event => { const world = screenToWorld(screenPoint(event)); selected = hitPiece(world.x, world.y) || selected; rotatePiece(1); });
canvas.addEventListener('contextmenu', event => { event.preventDefault(); const world = screenToWorld(screenPoint(event)); selected = hitPiece(world.x, world.y) || selected; rotatePiece(1); });
document.addEventListener('keydown', event => {
  if (!game || event.target.matches('input,select,button')) return; const center = { x: canvas.width / 2, y: canvas.height / 2 };
  if (['+', '='].includes(event.key)) { event.preventDefault(); zoomAt(center, view.zoom * ZOOM.step); }
  else if (event.key === '-') { event.preventDefault(); zoomAt(center, view.zoom / ZOOM.step); }
  else if (event.key === '0') { event.preventDefault(); resetView(false); }
  else if (event.key.toLowerCase() === 'r') { event.preventDefault(); rotatePiece(event.shiftKey ? -1 : 1); }
  else if (event.key.startsWith('Arrow')) { event.preventDefault(); const movement = 90 / view.zoom; if (event.key === 'ArrowLeft') view.x -= movement; if (event.key === 'ArrowRight') view.x += movement; if (event.key === 'ArrowUp') view.y -= movement; if (event.key === 'ArrowDown') view.y += movement; }
});

fileInput.onchange = () => {
  const file = fileInput.files?.[0]; if (!file) return; const reader = new FileReader();
  reader.onload = () => { image.onload = () => { preview.src = image.src; const suggestion = recommend(image.naturalWidth, image.naturalHeight); document.getElementById('suggestion').textContent = `Format conseillé : ${suggestion.cols} × ${suggestion.rows}`; createGame(); }; image.src = reader.result; };
  reader.readAsDataURL(file);
};

function installCameraButtons() {
  const actions = document.querySelector('.actions');
  const definitions = [['zoomOut', '− Dézoomer', () => zoomAt({ x: canvas.width / 2, y: canvas.height / 2 }, view.zoom / ZOOM.step)], ['zoomIn', '+ Zoomer', () => zoomAt({ x: canvas.width / 2, y: canvas.height / 2 }, view.zoom * ZOOM.step)], ['fitBoard', 'Cadrer puzzle', () => resetView(false)], ['fitWorkspace', 'Voir l’atelier', () => resetView(true)]];
  definitions.forEach(([id, label, action]) => { const button = document.createElement('button'); button.id = id; button.type = 'button'; button.textContent = label; button.dataset.help = id === 'fitWorkspace' ? 'Dézoome pour afficher la grande zone de travail autour du puzzle.' : 'Modifie la caméra sans déplacer les pièces.'; button.onclick = action; actions.appendChild(button); });
}

document.getElementById('newGame').onclick = createGame; document.getElementById('replay').onclick = createGame; document.getElementById('rotateLeft').onclick = () => rotatePiece(-1); document.getElementById('rotateRight').onclick = () => rotatePiece(1);
document.getElementById('shuffle').onclick = () => { if (!game) return; game.pieces.filter(piece => !piece.placed).forEach((piece, index) => { Object.assign(piece, scatterPosition(piece, index + Math.floor(Math.random() * 4))); if (rotationToggle.checked) piece.angle = Math.floor(Math.random() * 4) * Math.PI / 2; }); game.moves++; resetView(true); };
document.getElementById('hint').onclick = () => { const piece = game?.pieces.find(item => !item.placed); if (!piece) return; piece.hint = 2; game.hints++; selected = piece; view.x = piece.x + piece.w / 2; view.y = piece.y + piece.h / 2; view.zoom = Math.max(view.zoom, .75); statusElement.textContent = `Indice : cherchez la zone ligne ${piece.row + 1}, colonne ${piece.col + 1}.`; };

installCameraButtons();

window.PuzzleImageTestAPI = {
  diagnostics() {
    const suggestion = recommend(1600, 900); let complementaryEdges = true;
    for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
      if (col < 3) { const right = edgeDescriptor(row, col, 1, 3, 4); const left = edgeDescriptor(row, col + 1, 3, 3, 4); if (right.sign !== left.sign || right.center !== left.center || right.spread !== left.spread) complementaryEdges = false; }
      if (row < 2) { const bottom = edgeDescriptor(row, col, 2, 3, 4); const top = edgeDescriptor(row + 1, col, 0, 3, 4); if (bottom.sign !== top.sign || bottom.center !== top.center || bottom.spread !== top.spread) complementaryEdges = false; }
    }
    return { formats: FORMATS.length, rotation: rotationToggle.type === 'checkbox', shapeModes: [...shapeSelect.options].map(option => option.value), imageImport: fileInput.accept.includes('image'), recommendedLandscape: suggestion.cols / suggestion.rows > 1, pieces: game?.pieces.length || 0, complementaryEdges, zoomMinimum: ZOOM.minimum, zoomMaximum: ZOOM.maximum, pannableWorkspace: WORKSPACE.w > canvas.width * 2 && WORKSPACE.h > canvas.height * 2, cameraButtons: document.querySelectorAll('#zoomOut,#zoomIn,#fitBoard,#fitWorkspace').length, keyboardCamera: true, canvas: canvas.width === 960 && canvas.height === 680 };
  }
};

try { localStorage.setItem('game-hub:last-game', 'puzzle-image'); } catch {}
image.onload = () => { preview.src = image.src; createGame(); cancelAnimationFrame(frame); frame = requestAnimationFrame(loop); };
image.src = createDefaultImage();
