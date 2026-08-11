const boardElement = document.getElementById('board');
const titleElement = document.getElementById('title');
const statusElement = document.getElementById('status');
const rulesElement = document.getElementById('rules');
const scoreElement = document.getElementById('score');
const historyElement = document.getElementById('history');
const typeSelect = document.getElementById('gameType');
const difficultySelect = document.getElementById('difficulty');
const ruleVariantSelect = document.getElementById('ruleVariant');
const boardSizeSelect = document.getElementById('boardSize');
const boardSizeLabel = document.getElementById('boardSizeLabel');
const promotionSelect = document.getElementById('promotionPiece');
const promotionLabel = document.getElementById('promotionLabel');
const chainCaptures = document.getElementById('chainCaptures');
const chainLabel = document.getElementById('chainLabel');
const undoButton = document.getElementById('undoMove');
const redoButton = document.getElementById('redoMove');
const glyphs = { wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙', bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟' };
const values = { p: 1, n: 3.2, b: 3.35, r: 5, q: 9, k: 100 };
let game;
let botTimer;
const motionDuration = 440;

function reducedMotion() { return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; }
function cellAt(position) {
  return position ? boardElement.querySelector(`[data-row="${position[0]}"][data-column="${position[1]}"]`) : null;
}

function visualCloneAt(position, className) {
  const cell = cellAt(position);
  const visual = cell?.querySelector('.piece, .checker');
  if (!cell || !visual) return null;
  const rect = cell.getBoundingClientRect();
  const layer = document.createElement('div');
  layer.className = `board-motion-overlay ${className}`;
  layer.style.left = `${rect.left}px`;
  layer.style.top = `${rect.top}px`;
  layer.style.width = `${rect.width}px`;
  layer.style.height = `${rect.height}px`;
  layer.style.fontSize = `${rect.width * .7}px`;
  layer.style.setProperty('--cell-size', `${rect.width}px`);
  layer.appendChild(visual.cloneNode(true));
  document.body.appendChild(layer);
  return { layer, rect };
}

function animateVisualMove(from, to, className = 'moving') {
  if (reducedMotion()) return;
  const origin = visualCloneAt(from, className);
  const destination = cellAt(to)?.getBoundingClientRect();
  if (!origin || !destination) return;
  const deltaX = destination.left - origin.rect.left;
  const deltaY = destination.top - origin.rect.top;
  const animation = origin.layer.animate([
    { transform: 'translate(0, 0) scale(1)', filter: 'drop-shadow(0 3px 3px #0005)' },
    { transform: `translate(${deltaX * .82}px, ${deltaY * .82}px) scale(1.09)`, offset: .72, filter: 'drop-shadow(0 10px 8px #0007)' },
    { transform: `translate(${deltaX}px, ${deltaY}px) scale(1)`, filter: 'drop-shadow(0 2px 2px #0004)' }
  ], { duration: motionDuration, easing: 'cubic-bezier(.2,.78,.2,1)', fill: 'forwards' });
  animation.finished.then(() => origin.layer.remove()).catch(() => origin.layer.remove());
}

function animateVisualCapture(position) {
  if (reducedMotion()) return;
  const captured = visualCloneAt(position, 'captured');
  if (!captured) return;
  const animation = captured.layer.animate([
    { transform: 'scale(1) rotate(0)', opacity: 1, filter: 'drop-shadow(0 0 0 #ef444400)' },
    { transform: 'scale(1.22) rotate(-5deg)', opacity: 1, filter: 'drop-shadow(0 0 10px #ef4444)', offset: .35 },
    { transform: 'scale(.12) rotate(24deg)', opacity: 0, filter: 'drop-shadow(0 0 14px #ef4444)' }
  ], { duration: motionDuration, easing: 'ease-in', fill: 'forwards' });
  animation.finished.then(() => captured.layer.remove()).catch(() => captured.layer.remove());
}

function animateBoardMove(move) {
  const capturePosition = game.type === 'checkers' ? move.capture : move.enPassantCapture || (at(...move.to) ? move.to : null);
  if (capturePosition) animateVisualCapture(capturePosition);
  animateVisualMove(move.from, move.to);
  if (move.castle) animateVisualMove(move.castle.rookFrom, move.castle.rookTo, 'castling');
  game.motion = { to: [...move.to], until: Date.now() + motionDuration + 80, captured: Boolean(capturePosition) };
  setTimeout(() => { if (game?.motion?.until <= Date.now()) game.motion = null; }, motionDuration + 100);
}

function finishResult(text, outcome) {
  game.over = true;
  game.outcome = outcome;
  statusElement.textContent = text;
  window.GameEffects?.play(outcome === 'win' ? 'win' : outcome === 'loss' ? 'error' : 'draw');
  window.GameRecords?.finish({ score: outcome === 'win' ? 1 : 0, scoreLabel: outcome === 'draw' ? 'Partie nulle' : outcome === 'win' ? 'Victoire' : 'Défaite', won: outcome === 'win' });
  return true;
}

function inBoard(row, column, size = game.size) { return row >= 0 && row < size && column >= 0 && column < size; }
function at(row, column) { return game.board[row]?.[column] || null; }
function atBoard(board, row, column) { return inBoard(row, column, board.length) ? board[row][column] : { blocked: true }; }
function cloneBoard(board) { return board.map(row => row.map(piece => piece ? { ...piece } : null)); }
function other(color) { return color === 'w' ? 'b' : 'w'; }
function label(row, column) { return `${String.fromCharCode(97 + column)}${game.size - row}`; }
function columnsBetween(from, to) {
  const direction = to >= from ? 1 : -1;
  return Array.from({ length: Math.abs(to - from) + 1 }, (_, index) => from + index * direction);
}

function snapshotState() {
  return {
    board: cloneBoard(game.board),
    turn: game.turn,
    selected: game.selected ? [...game.selected] : null,
    legal: game.legal.map(move => ({ ...move, from: [...move.from], to: [...move.to], capture: Array.isArray(move.capture) ? [...move.capture] : move.capture, enPassantCapture: move.enPassantCapture ? [...move.enPassantCapture] : null, castle: move.castle ? { rookFrom: [...move.castle.rookFrom], rookTo: [...move.castle.rookTo] } : null })),
    forced: game.forced ? [...game.forced] : null,
    over: game.over,
    outcome: game.outcome,
    log: game.log.slice(),
    enPassant: game.enPassant ? { ...game.enPassant } : null,
    halfmove: game.halfmove,
    repetitions: [...game.repetitions.entries()],
    checks: { ...game.checks },
    status: statusElement.textContent
  };
}

function restoreState(state) {
  Object.assign(game, {
    board: cloneBoard(state.board),
    turn: state.turn,
    selected: state.selected ? [...state.selected] : null,
    legal: state.legal.map(move => ({ ...move, from: [...move.from], to: [...move.to], capture: Array.isArray(move.capture) ? [...move.capture] : move.capture, enPassantCapture: move.enPassantCapture ? [...move.enPassantCapture] : null, castle: move.castle ? { rookFrom: [...move.castle.rookFrom], rookTo: [...move.castle.rookTo] } : null })),
    forced: state.forced ? [...state.forced] : null,
    over: state.over,
    outcome: state.outcome,
    motion: null,
    log: state.log.slice(),
    enPassant: state.enPassant ? { ...state.enPassant } : null,
    halfmove: state.halfmove,
    repetitions: new Map(state.repetitions),
    checks: { ...state.checks }
  });
  statusElement.textContent = state.status;
}

function chess960BackRank() {
  const back = Array(8).fill(null);
  const dark = [0, 2, 4, 6][Math.floor(Math.random() * 4)];
  const light = [1, 3, 5, 7][Math.floor(Math.random() * 4)];
  back[dark] = 'b'; back[light] = 'b';
  const empty = () => back.map((piece, index) => piece ? -1 : index).filter(index => index >= 0);
  const queenPlaces = empty(); back[queenPlaces[Math.floor(Math.random() * queenPlaces.length)]] = 'q';
  for (let count = 0; count < 2; count += 1) { const places = empty(); back[places[Math.floor(Math.random() * places.length)]] = 'n'; }
  const remaining = empty(); back[remaining[0]] = 'r'; back[remaining[1]] = 'k'; back[remaining[2]] = 'r';
  return back;
}

function initialChess() {
  const back = ruleVariantSelect.value === 'chess960' ? chess960BackRank() : ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  return Array.from({ length: 8 }, (_, row) => Array.from({ length: 8 }, (_, column) => {
    if (row === 0 || row === 1) return { c: 'b', t: row === 1 ? 'p' : back[column] };
    if (row === 6 || row === 7) return { c: 'w', t: row === 6 ? 'p' : back[column] };
    return null;
  }));
}

function initialCheckers(size) {
  const occupiedRows = size / 2 - 1;
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, column) =>
    (row < occupiedRows || row >= size - occupiedRows) && (row + column) % 2 ? { c: row < occupiedRows ? 'b' : 'w', k: false } : null));
}

function chessPseudo(board, row, column, attacks = false, enPassant = null) {
  const piece = board[row][column];
  if (!piece) return [];
  const moves = [];
  const add = (nextRow, nextColumn) => {
    if (!inBoard(nextRow, nextColumn, board.length)) return false;
    const target = board[nextRow][nextColumn];
    if (!target || target.c !== piece.c) moves.push({ from: [row, column], to: [nextRow, nextColumn], capture: Boolean(target) });
    return !target;
  };
  if (piece.t === 'p') {
    const direction = piece.c === 'w' ? -1 : 1;
    if (attacks) [-1, 1].forEach(offset => add(row + direction, column + offset));
    else {
      if (!atBoard(board, row + direction, column)) moves.push({ from: [row, column], to: [row + direction, column], capture: false });
      const start = piece.c === 'w' ? board.length - 2 : 1;
      if (row === start && !atBoard(board, row + direction, column) && !atBoard(board, row + direction * 2, column)) moves.push({ from: [row, column], to: [row + direction * 2, column], capture: false });
      [-1, 1].forEach(offset => {
        const target = board[row + direction]?.[column + offset];
        if (target && target.c !== piece.c) moves.push({ from: [row, column], to: [row + direction, column + offset], capture: true });
        else if (enPassant && enPassant.row === row + direction && enPassant.column === column + offset && enPassant.color !== piece.c) moves.push({ from: [row, column], to: [enPassant.row, enPassant.column], capture: true, enPassantCapture: [row, column + offset] });
      });
    }
    return moves;
  }
  if (piece.t === 'n') { [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr, dc]) => add(row + dr, column + dc)); return moves; }
  if (piece.t === 'k') {
    [-1,0,1].forEach(dr => [-1,0,1].forEach(dc => { if (dr || dc) add(row + dr, column + dc); }));
    if (!attacks && !piece.m && !chessAttacked(board, row, column, other(piece.c))) {
      const rooks = board[row].map((candidate, rookColumn) => candidate?.c === piece.c && candidate.t === 'r' && !candidate.m ? rookColumn : -1).filter(rookColumn => rookColumn >= 0);
      rooks.forEach(rookColumn => {
        const kingSide = rookColumn > column;
        const kingTarget = kingSide ? 6 : 2;
        const rookTarget = kingSide ? 5 : 3;
        const mustBeEmpty = new Set([...columnsBetween(column, kingTarget), ...columnsBetween(rookColumn, rookTarget)]);
        mustBeEmpty.delete(column);
        mustBeEmpty.delete(rookColumn);
        if ([...mustBeEmpty].some(pathColumn => board[row][pathColumn])) return;
        if (columnsBetween(column, kingTarget).some(pathColumn => chessAttacked(board, row, pathColumn, other(piece.c)))) return;
        moves.push({ from: [row, column], to: [row, kingTarget], capture: false, castle: { rookFrom: [row, rookColumn], rookTo: [row, rookTarget] } });
      });
    }
    return moves;
  }
  const directions = piece.t === 'b' ? [[-1,-1],[-1,1],[1,-1],[1,1]] : piece.t === 'r' ? [[-1,0],[1,0],[0,-1],[0,1]] : [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]];
  directions.forEach(([dr, dc]) => { for (let step = 1; step < board.length && add(row + dr * step, column + dc * step); step += 1) {} });
  return moves;
}

function chessAttacked(board, row, column, byColor) {
  return board.some((line, currentRow) => line.some((piece, currentColumn) => piece?.c === byColor && chessPseudo(board, currentRow, currentColumn, true).some(move => move.to[0] === row && move.to[1] === column)));
}

function chessMovesFor(board, color, row, column, enPassant = board === game.board ? game.enPassant : null) {
  const piece = board[row]?.[column];
  if (!piece || piece.c !== color) return [];
  return chessPseudo(board, row, column, false, enPassant).filter(move => {
    const next = applyMoveToBoard(board, move, 'chess');
    const king = next.flatMap((line, kingRow) => line.map((item, kingColumn) => item?.c === color && item.t === 'k' ? [kingRow, kingColumn] : null)).find(Boolean);
    return king && !chessAttacked(next, king[0], king[1], other(color));
  });
}

function checkerRawMoves(board, row, column, capturesOnly = false) {
  const piece = board[row]?.[column];
  if (!piece) return [];
  const directions = [[-1,-1],[-1,1],[1,-1],[1,1]];
  const forward = piece.c === 'w' ? -1 : 1;
  const captures = [];
  const simple = [];
  directions.forEach(([dr, dc]) => {
    if (piece.k) {
      let step = 1;
      while (inBoard(row + dr * step, column + dc * step, board.length) && !board[row + dr * step][column + dc * step]) {
        simple.push({ from: [row, column], to: [row + dr * step, column + dc * step], capture: null });
        step += 1;
      }
      const enemy = board[row + dr * step]?.[column + dc * step];
      if (enemy && enemy.c !== piece.c) {
        let landing = step + 1;
        while (inBoard(row + dr * landing, column + dc * landing, board.length) && !board[row + dr * landing][column + dc * landing]) {
          captures.push({ from: [row, column], to: [row + dr * landing, column + dc * landing], capture: [row + dr * step, column + dc * step] });
          landing += 1;
        }
      }
      return;
    }
    const middle = board[row + dr]?.[column + dc];
    const targetRow = row + dr * 2;
    const targetColumn = column + dc * 2;
    if (middle && middle.c !== piece.c && inBoard(targetRow, targetColumn, board.length) && !board[targetRow][targetColumn]) captures.push({ from: [row, column], to: [targetRow, targetColumn], capture: [row + dr, column + dc] });
    else if (dr === forward && !middle && inBoard(row + dr, column + dc, board.length)) simple.push({ from: [row, column], to: [row + dr, column + dc], capture: null });
  });
  return capturesOnly ? captures : [...captures, ...simple];
}

function moveOnBoard(board, move, type = game.type, promote = true) {
  const piece = board[move.from[0]][move.from[1]];
  const rook = type === 'chess' && move.castle ? board[move.castle.rookFrom[0]][move.castle.rookFrom[1]] : null;
  board[move.from[0]][move.from[1]] = null;
  if (type === 'chess' && move.castle) board[move.castle.rookFrom[0]][move.castle.rookFrom[1]] = null;
  board[move.to[0]][move.to[1]] = piece;
  if (type === 'chess' && move.castle) {
    board[move.castle.rookTo[0]][move.castle.rookTo[1]] = rook;
    if (rook) rook.m = true;
  }
  if (type === 'chess' && move.enPassantCapture) board[move.enPassantCapture[0]][move.enPassantCapture[1]] = null;
  if (type === 'checkers' && move.capture) board[move.capture[0]][move.capture[1]] = null;
  if (promote && type === 'checkers' && piece && ((piece.c === 'w' && move.to[0] === 0) || (piece.c === 'b' && move.to[0] === board.length - 1))) piece.k = true;
  if (type === 'chess' && piece) piece.m = true;
  if (promote && type === 'chess' && piece?.t === 'p' && (move.to[0] === 0 || move.to[0] === board.length - 1)) piece.t = move.promotion || 'q';
  return piece;
}

function applyMoveToBoard(board, move, type = game.type, promote = true) {
  const next = cloneBoard(board);
  moveOnBoard(next, move, type, promote);
  return next;
}

function checkerCaptureDepth(board, move) {
  const next = applyMoveToBoard(board, move, 'checkers', false);
  const continuations = checkerRawMoves(next, move.to[0], move.to[1], true);
  return 1 + (continuations.length ? Math.max(...continuations.map(nextMove => checkerCaptureDepth(next, nextMove))) : 0);
}

function allCheckerMoves(board, color) {
  const captures = board.flatMap((line, row) => line.flatMap((piece, column) => piece?.c === color ? checkerRawMoves(board, row, column, true) : []));
  if (captures.length && game.variant !== 'casual') {
    if (game.variant === 'international' || game.variant === 'canadian') {
      const depths = captures.map(move => checkerCaptureDepth(board, move));
      const maximum = Math.max(...depths);
      return captures.filter((move, index) => depths[index] === maximum);
    }
    return captures;
  }
  const simple = board.flatMap((line, row) => line.flatMap((piece, column) => piece?.c === color ? checkerRawMoves(board, row, column, false).filter(move => !move.capture) : []));
  return game.variant === 'casual' ? [...captures, ...simple] : simple;
}

function allChessMoves(board, color) { return board.flatMap((line, row) => line.flatMap((piece, column) => piece?.c === color ? chessMovesFor(board, color, row, column) : [])); }
function allMoves(color = game.turn, board = game.board) { return game.type === 'chess' ? allChessMoves(board, color) : allCheckerMoves(board, color); }
function selectedMoves(row, column) { return allMoves(game.turn).filter(move => move.from[0] === row && move.from[1] === column); }

function kingInHill(board, color) {
  const centers = [[3,3],[3,4],[4,3],[4,4]];
  return centers.some(([row, column]) => board[row]?.[column]?.c === color && board[row][column].t === 'k');
}

function chessPositionKey() {
  const board = game.board.map(line => line.map(piece => piece ? `${piece.c}${piece.t}${piece.m ? 1 : 0}` : '--').join('')).join('/');
  return `${board}|${game.turn}|${game.enPassant ? `${game.enPassant.row},${game.enPassant.column}` : '-'}`;
}

function insufficientMaterial() {
  if (game.type !== 'chess') return false;
  const pieces = game.board.flat().filter(Boolean).filter(piece => piece.t !== 'k');
  if (!pieces.length) return true;
  if (pieces.some(piece => ['p', 'q', 'r'].includes(piece.t))) return false;
  return pieces.length === 1 || (pieces.every(piece => piece.t === 'b') && new Set(game.board.flatMap((line, row) => line.map((piece, column) => piece?.t === 'b' ? (row + column) % 2 : null)).filter(value => value !== null)).size === 1);
}

function checkEnd(lastMover = null) {
  if (game.type === 'chess' && game.variant === 'kinghill' && lastMover && kingInHill(game.board, lastMover)) {
    return finishResult(lastMover === 'w' ? 'Votre roi atteint le centre : vous gagnez.' : 'Le roi du bot atteint le centre : il gagne.', lastMover === 'w' ? 'win' : 'loss');
  }
  if (game.type === 'chess' && lastMover && game.variant === 'threecheck' && game.checks[lastMover] >= 3) {
    return finishResult(lastMover === 'w' ? 'Troisième échec donné : vous gagnez.' : 'Le bot donne son troisième échec et gagne.', lastMover === 'w' ? 'win' : 'loss');
  }
  if (game.type === 'chess' && (game.halfmove >= 100 || (game.repetitions.get(chessPositionKey()) || 0) >= 3 || insufficientMaterial())) {
    return finishResult(game.halfmove >= 100 ? 'Partie nulle : cinquante coups sans prise ni mouvement de pion.' : insufficientMaterial() ? 'Partie nulle : matériel insuffisant.' : 'Partie nulle : troisième répétition de la position.', 'draw');
  }
  const whitePieces = game.board.flat().filter(piece => piece?.c === 'w').length;
  const blackPieces = game.board.flat().filter(piece => piece?.c === 'b').length;
  const moves = allMoves(game.turn);
  if (game.type === 'checkers' && game.variant === 'giveaway') {
    if (!whitePieces || (!moves.length && game.turn === 'w')) return finishResult('Vous n’avez plus de pièce ou de coup : vous gagnez.', 'win');
    if (!blackPieces || (!moves.length && game.turn === 'b')) return finishResult('Le bot n’a plus de pièce ou de coup : il gagne.', 'loss');
  } else if (!moves.length || (game.type === 'checkers' && (!whitePieces || !blackPieces))) {
    if (game.type === 'checkers') return finishResult(game.turn === 'w' ? 'Vous n’avez plus de coup légal : le bot gagne.' : 'Le bot n’a plus de coup légal : vous gagnez.', game.turn === 'w' ? 'loss' : 'win');
    {
      const king = game.board.flatMap((line, row) => line.map((piece, column) => piece?.c === game.turn && piece.t === 'k' ? [row, column] : null)).find(Boolean);
      const checked = king && chessAttacked(game.board, king[0], king[1], other(game.turn));
      return finishResult(checked ? (game.turn === 'w' ? 'Échec et mat : le bot gagne.' : 'Échec et mat : vous gagnez.') : 'Pat : aucun coup légal, partie nulle.', checked ? (game.turn === 'w' ? 'loss' : 'win') : 'draw');
    }
  }
  statusElement.textContent = game.turn === 'w' ? 'À vous de jouer.' : 'Le bot réfléchit.';
  return false;
}

function applyMove(move) {
  if (!move || game.over) { checkEnd(); render(); return; }
  const piece = at(...move.from);
  if (!piece) return;
  const movedType = piece.t;
  const wasCapture = Boolean(move.capture || at(...move.to));
  if (game.type === 'chess' && piece.c === 'w' && piece.t === 'p' && (move.to[0] === 0 || move.to[0] === 7)) move.promotion = promotionSelect.value;
  game.history.push(snapshotState());
  game.future = [];
  animateBoardMove(move);
  moveOnBoard(game.board, move, game.type, false);
  if (game.type === 'chess') {
    piece.m = true;
    if (piece.t === 'p' && (move.to[0] === 0 || move.to[0] === 7)) piece.t = move.promotion || 'q';
    game.enPassant = movedType === 'p' && Math.abs(move.to[0] - move.from[0]) === 2 ? { row: (move.to[0] + move.from[0]) / 2, column: move.to[1], color: piece.c } : null;
    game.halfmove = movedType === 'p' || wasCapture ? 0 : game.halfmove + 1;
  }
  game.log.unshift(`${game.turn === 'w' ? 'Vous' : 'Bot'} : ${label(...move.from)} → ${label(...move.to)}${move.capture ? ' ×' : ''}`);
  game.log = game.log.slice(0, 10);
  if (game.type === 'checkers' && move.capture && chainCaptures.checked) {
    const continuations = checkerRawMoves(game.board, move.to[0], move.to[1], true);
    if (continuations.length) {
      const depths = continuations.map(nextMove => checkerCaptureDepth(game.board, nextMove));
      const maximum = Math.max(...depths);
      game.forced = [...move.to];
      game.selected = [...move.to];
      game.legal = continuations.filter((nextMove, index) => depths[index] === maximum);
      statusElement.textContent = game.turn === 'w' ? 'Vous devez poursuivre la prise maximale.' : 'Le bot poursuit sa prise.';
      render();
      if (game.turn === 'b') scheduleBot();
      return;
    }
  }
  if (game.type === 'checkers' && ((piece.c === 'w' && move.to[0] === 0) || (piece.c === 'b' && move.to[0] === game.size - 1))) piece.k = true;
  const lastMover = game.turn;
  game.forced = null;
  game.turn = other(game.turn);
  game.selected = null;
  game.legal = [];
  if (game.type === 'chess') {
    const enemyKing = game.board.flatMap((line, row) => line.map((item, column) => item?.c === game.turn && item.t === 'k' ? [row, column] : null)).find(Boolean);
    if (enemyKing && chessAttacked(game.board, enemyKing[0], enemyKing[1], lastMover)) game.checks[lastMover] += 1;
    const position = chessPositionKey();
    game.repetitions.set(position, (game.repetitions.get(position) || 0) + 1);
  }
  checkEnd(lastMover);
  render();
  if (!game.over && game.turn === 'b') scheduleBot();
}

function materialScore(board) {
  if (game.type === 'chess' && game.variant === 'kinghill') {
    if (kingInHill(board, 'b')) return 10000;
    if (kingInHill(board, 'w')) return -10000;
  }
  let score = 0;
  board.forEach((line, row) => line.forEach(piece => {
    if (!piece) return;
    let value = game.type === 'chess' ? values[piece.t] : piece.k ? 3.2 : 1;
    if (game.type === 'checkers' && !piece.k) value += (piece.c === 'b' ? row : board.length - 1 - row) * .04;
    score += piece.c === 'b' ? value : -value;
  }));
  return game.variant === 'giveaway' ? -score : score;
}

function minimax(board, turn, depth, alpha, beta) {
  const moves = allMoves(turn, board);
  if (!moves.length) return turn === 'b' ? -10000 - depth : 10000 + depth;
  if (!depth) return materialScore(board);
  const ordered = moves.sort((left, right) => Number(Boolean(right.capture)) - Number(Boolean(left.capture))).slice(0, game.size > 10 ? 18 : 28);
  if (turn === 'b') {
    let best = -Infinity;
    for (const move of ordered) { best = Math.max(best, minimax(applyMoveToBoard(board, move), 'w', depth - 1, alpha, beta)); alpha = Math.max(alpha, best); if (beta <= alpha) break; }
    return best;
  }
  let best = Infinity;
  for (const move of ordered) { best = Math.min(best, minimax(applyMoveToBoard(board, move), 'b', depth - 1, alpha, beta)); beta = Math.min(beta, best); if (beta <= alpha) break; }
  return best;
}

function chooseBotMove() {
  const moves = game.forced ? game.legal : allMoves('b');
  if (!moves.length) return null;
  const level = difficultySelect.value;
  if (level === 'extreme') {
    const depth = game.type === 'chess' ? 2 : game.size >= 12 ? 1 : 2;
    return moves.map(move => {
      const board = applyMoveToBoard(game.board, move, game.type, !game.forced);
      const continuation = game.type === 'checkers' && move.capture ? checkerCaptureDepth(game.board, move) * 3 : 0;
      return { move, score: minimax(board, 'w', depth, -Infinity, Infinity) + continuation };
    }).sort((left, right) => right.score - left.score)[0].move;
  }
  const noise = level === 'easy' ? 9 : level === 'normal' ? 4 : 1;
  return moves.map(move => {
    const target = game.board[move.to[0]][move.to[1]];
    const captureValue = move.capture ? game.type === 'chess' ? values[target?.t] || 1 : 4 + checkerCaptureDepth(game.board, move) : 0;
    return { move, score: captureValue + Math.random() * noise };
  }).sort((left, right) => right.score - left.score)[0].move;
}

function scheduleBot() {
  clearTimeout(botTimer);
  const delays = { easy: 950, normal: 550, hard: 260, extreme: 80 };
  botTimer = setTimeout(() => {
    if (game.over || game.turn !== 'b') return;
    const move = chooseBotMove();
    if (!move) { checkEnd(); render(); return; }
    applyMove(move);
  }, Math.max(motionDuration + 70, delays[difficultySelect.value]));
}

function selectCell(row, column) {
  if (game.over || game.turn !== 'w') return;
  const selectedMove = game.legal.find(move => move.to[0] === row && move.to[1] === column);
  if (selectedMove) { applyMove(selectedMove); return; }
  if (game.forced) return;
  const legal = selectedMoves(row, column);
  if (at(row, column)?.c === 'w' && legal.length) { game.selected = [row, column]; game.legal = legal; render(); }
}

function undoMove() {
  clearTimeout(botTimer);
  if (!game.history.length) return;
  const steps = game.turn === 'w' && !game.forced ? Math.min(2, game.history.length) : 1;
  for (let step = 0; step < steps; step += 1) {
    game.future.push(snapshotState());
    restoreState(game.history.pop());
  }
  render();
}

function redoMove() {
  clearTimeout(botTimer);
  if (!game.future.length) return;
  game.history.push(snapshotState());
  restoreState(game.future.pop());
  render();
  if (!game.over && game.turn === 'b') scheduleBot();
}

function chess960CastlingDiagnostic() {
  const previousVariant = game.variant;
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  board[7][0] = { c: 'w', t: 'r' };
  board[7][1] = { c: 'w', t: 'k' };
  board[7][4] = { c: 'w', t: 'r' };
  game.variant = 'chess960';
  const castlingMoves = chessPseudo(board, 7, 1).filter(move => move.castle);
  const kingSide = castlingMoves.find(move => move.to[1] === 6);
  const queenSide = castlingMoves.find(move => move.to[1] === 2);
  const kingBoard = kingSide ? applyMoveToBoard(board, kingSide, 'chess') : null;
  const queenBoard = queenSide ? applyMoveToBoard(board, queenSide, 'chess') : null;
  game.variant = previousVariant;
  return {
    moveCount: castlingMoves.length,
    kingSideValid: kingBoard?.[7][6]?.t === 'k' && kingBoard[7][5]?.t === 'r' && !kingBoard[7][1] && !kingBoard[7][4],
    queenSideValid: queenBoard?.[7][2]?.t === 'k' && queenBoard[7][3]?.t === 'r' && !queenBoard[7][0] && !queenBoard[7][1]
  };
}

function rulesText() {
  if (game.type === 'chess') {
    const variant = game.variant === 'chess960' ? 'La rangée arrière est tirée parmi les 960 dispositions valides ; le roque place toujours le roi en c/g et la tour en d/f. ' : game.variant === 'kinghill' ? 'Roi de la colline : le premier roi atteignant l’une des quatre cases centrales gagne. ' : game.variant === 'threecheck' ? 'Trois échecs : le premier camp donnant trois échecs gagne aussi immédiatement. ' : '';
    return `${variant}Déplacez les Blancs. Les coups laissant votre roi en échec sont exclus. Roque classique, prise en passant, promotion choisie, pat, répétition, cinquante coups et matériel insuffisant sont contrôlés.`;
  }
  const variant = game.variant === 'giveaway' ? 'Dames inversées : le premier camp sans pièce ou sans coup gagne. ' : game.variant === 'casual' ? 'Variante libre : une capture disponible n’est pas obligatoire. ' : game.variant === 'canadian' ? 'Dames canadiennes : plateau 12 × 12 et trente pions par camp. ' : '';
  const maximum = game.variant === 'international' || game.variant === 'canadian' ? 'Lorsqu’il existe plusieurs rafles, celle qui capture le plus de pièces est obligatoire. ' : '';
  return `${variant}${maximum}Les pions capturent vers l’avant et l’arrière. Une prise multiple se poursuit ; les dames se déplacent sans limite en diagonale. La promotion n’a lieu qu’à la fin de la rafle.`;
}

function render() {
  titleElement.textContent = game.type === 'chess' ? 'Échecs' : 'Dames';
  document.title = titleElement.textContent;
  rulesElement.textContent = rulesText();
  boardElement.style.setProperty('--board-size', game.size);
  boardElement.style.setProperty('--cell-size', `${game.size === 8 ? 82 : game.size === 10 ? 66 : game.size === 12 ? 55 : 48}px`);
  ['win', 'loss', 'draw'].forEach(outcome => boardElement.classList.toggle(`game-${outcome}`, game.outcome === outcome));
  statusElement.classList.toggle('result-win', game.outcome === 'win');
  statusElement.classList.toggle('result-loss', game.outcome === 'loss');
  statusElement.classList.toggle('result-draw', game.outcome === 'draw');
  boardElement.innerHTML = game.board.flatMap((line, row) => line.map((piece, column) => {
    const move = game.legal.find(item => item.to[0] === row && item.to[1] === column);
    const selected = game.selected?.[0] === row && game.selected?.[1] === column;
    const content = !piece ? '' : game.type === 'chess' ? `<span class="piece ${piece.c === 'b' ? 'black' : ''}">${glyphs[`${piece.c}${piece.t}`]}</span>` : `<span class="checker ${piece.c === 'b' ? 'black' : ''}${piece.k ? ' king' : ''}"></span>`;
    const arriving = game.motion?.until > Date.now() && game.motion.to[0] === row && game.motion.to[1] === column;
    return `<button class="cell ${(row + column) % 2 ? 'dark' : ''}${selected ? ' selected' : ''}${move ? (move.capture ? ' capture' : ' legal') : ''}${arriving ? ' arriving' : ''}" style="z-index:${row + 1}" data-row="${row}" data-column="${column}">${content}</button>`;
  })).join('');
  boardElement.querySelectorAll('.cell').forEach(cell => cell.addEventListener('click', () => selectCell(Number(cell.dataset.row), Number(cell.dataset.column))));
  const white = game.board.flat().filter(piece => piece?.c === 'w').length;
  const black = game.board.flat().filter(piece => piece?.c === 'b').length;
  scoreElement.innerHTML = `<div>Vous<br><strong>${white}</strong></div><div>Bot<br><strong>${black}</strong></div>`;
  historyElement.innerHTML = game.log.map(entry => `<li>${entry}</li>`).join('') || '<li>Déplacez une pièce blanche.</li>';
  undoButton.disabled = !game.history.length;
  redoButton.disabled = !game.future.length;
}

function updateRuleVariants() {
  const options = typeSelect.value === 'chess'
    ? [['classic', 'Classique'], ['chess960', 'Chess960'], ['kinghill', 'Roi de la colline'], ['threecheck', 'Trois échecs']]
    : [['international', 'Internationales'], ['canadian', 'Canadiennes'], ['giveaway', 'Inversées'], ['casual', 'Prises facultatives']];
  const previous = ruleVariantSelect.value;
  ruleVariantSelect.innerHTML = options.map(([value, name]) => `<option value="${value}">${name}</option>`).join('');
  if (options.some(([value]) => value === previous)) ruleVariantSelect.value = previous;
  boardSizeLabel.classList.toggle('hidden', typeSelect.value !== 'checkers');
  chainLabel.classList.toggle('hidden', typeSelect.value !== 'checkers');
  promotionLabel.classList.toggle('hidden', typeSelect.value !== 'chess');
}

function newGame(fromVariant = false) {
  clearTimeout(botTimer);
  updateRuleVariants();
  if (typeSelect.value === 'checkers' && ruleVariantSelect.value === 'canadian' && fromVariant) boardSizeSelect.value = '12';
  const size = typeSelect.value === 'chess' ? 8 : Number(boardSizeSelect.value);
  game = { type: typeSelect.value, variant: ruleVariantSelect.value, size, board: typeSelect.value === 'chess' ? initialChess() : initialCheckers(size), turn: 'w', selected: null, legal: [], forced: null, over: false, outcome: null, motion: null, log: [], enPassant: null, halfmove: 0, repetitions: new Map(), checks: { w: 0, b: 0 }, history: [], future: [] };
  if (game.type === 'chess') game.repetitions.set(chessPositionKey(), 1);
  statusElement.textContent = 'À vous de jouer.';
  render();
  const currentUrl = new URL(location.href);
  currentUrl.searchParams.set('variant', game.type);
  history.replaceState(null, '', currentUrl);
  localStorage.setItem('game-hub:last-game', game.type === 'checkers' ? 'checkers' : 'chess');
  window.GameRuntime?.rememberRecent(document.title);
}

const initialType = new URLSearchParams(location.search).get('variant');
if (!window.GameEffects) { const script = document.createElement('script'); script.src = '../../shared/effects.js?v=1'; document.head.appendChild(script); }
if (initialType === 'checkers') typeSelect.value = 'checkers';
document.getElementById('newGame').addEventListener('click', () => newGame());
undoButton.addEventListener('click', undoMove);
redoButton.addEventListener('click', redoMove);
document.addEventListener('keydown', event => {
  if (!(event.ctrlKey || event.metaKey)) return;
  if (event.key.toLowerCase() === 'z' && !event.shiftKey) { event.preventDefault(); undoMove(); }
  else if (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey)) { event.preventDefault(); redoMove(); }
});
typeSelect.addEventListener('change', () => newGame());
ruleVariantSelect.addEventListener('change', () => newGame(true));
boardSizeSelect.addEventListener('change', () => newGame());
difficultySelect.addEventListener('change', () => newGame());
newGame();

window.ChessBoardTestAPI = {
  diagnostics() {
    const whitePieces = game.board.flat().filter(piece => piece?.c === 'w').length;
    const blackPieces = game.board.flat().filter(piece => piece?.c === 'b').length;
    const legalMoves = allMoves('w').length;
    const chess960 = chess960CastlingDiagnostic();
    return {
      type: game.type,
      variant: game.variant,
      size: game.size,
      whitePieces,
      blackPieces,
      legalMoves,
      chess960Castles: chess960.moveCount,
      chess960CastlingValid: chess960.kingSideValid && chess960.queenSideValid,
      historyReady: Array.isArray(game.history) && Array.isArray(game.future),
      kingsPresent: game.type === 'checkers' || ['w', 'b'].every(color => game.board.flat().some(piece => piece?.c === color && piece.t === 'k')),
      expectedInitialPieces: game.type === 'chess' ? 16 : game.size * (game.size / 2 - 1) / 2
    };
  }
};
