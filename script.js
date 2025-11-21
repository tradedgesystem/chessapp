const boardEl = document.getElementById('board');
const movesEl = document.getElementById('moves');
const evalEl = document.getElementById('eval');
const depthInput = document.getElementById('depth');
const depthValue = document.getElementById('depth-value');
const nodesEl = document.getElementById('nodes');
const engineDepthEl = document.getElementById('engine-depth');
const turnEl = document.getElementById('turn');
const sideSelect = document.getElementById('side');
const gameStateEl = document.getElementById('game-state');
const overlayEl = document.getElementById('overlay');
const whiteClockEl = document.getElementById('white-clock');
const blackClockEl = document.getElementById('black-clock');
const recommendTextEl = document.getElementById('recommend-text');

const pieceIcons = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟︎'
};

const engine = new ChessEngine();
let selected = null;
let legalMoves = [];
let lastMove = null;
let humanColor = 'white';
let moveList = [];
let recommended = null;

let whiteTime = 5 * 60 * 1000;
let blackTime = 5 * 60 * 1000;
let activeClock = 'w';
let clockInterval = null;
let lastTick = Date.now();
let gameOver = false;

function createBoard() {
  boardEl.innerHTML = '';
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const square = document.createElement('div');
      square.className = `square ${(rank + file) % 2 === 0 ? 'light' : 'dark'}`;
      square.dataset.index = rank * 8 + file;
      square.addEventListener('click', onSquareClick);
      boardEl.appendChild(square);
    }
  }
  render();
}

function render() {
  for (const square of boardEl.children) {
    square.classList.remove('highlight', 'target', 'last-move');
    square.innerHTML = '';
    const idx = Number(square.dataset.index);
    const piece = engine.board[idx];
    if (piece) {
      const span = document.createElement('span');
      span.className = `piece ${engine.isWhite(piece) ? 'white-piece' : 'black-piece'}`;
      span.textContent = pieceIcons[piece];
      square.appendChild(span);
    }
  }
  if (selected !== null) {
    const square = boardEl.querySelector(`[data-index="${selected}"]`);
    if (square) square.classList.add('highlight');
    legalMoves.forEach(m => {
      const target = boardEl.querySelector(`[data-index="${m.to}"]`);
      if (target) target.classList.add('target');
    });
  }
  if (lastMove) {
    const fromSq = boardEl.querySelector(`[data-index="${lastMove.from}"]`);
    const toSq = boardEl.querySelector(`[data-index="${lastMove.to}"]`);
    fromSq?.classList.add('last-move');
    toSq?.classList.add('last-move');
  }
  turnEl.textContent = engine.whiteToMove ? 'White' : 'Black';
}

function formatTime(ms) {
  const clamped = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(clamped / 60)).padStart(2, '0');
  const s = String(clamped % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function updateClockDisplay() {
  whiteClockEl.textContent = formatTime(whiteTime);
  blackClockEl.textContent = formatTime(blackTime);
}

function flagOut(color) {
  gameOver = true;
  gameStateEl.textContent = `${color === 'w' ? 'White' : 'Black'} ran out of time`;
  clearArrow();
}

function tickClock() {
  if (gameOver) return;
  const now = Date.now();
  const delta = now - lastTick;
  lastTick = now;
  if (activeClock === 'w') {
    whiteTime -= delta;
    if (whiteTime <= 0) {
      whiteTime = 0;
      flagOut('w');
    }
  } else {
    blackTime -= delta;
    if (blackTime <= 0) {
      blackTime = 0;
      flagOut('b');
    }
  }
  updateClockDisplay();
}

function startClocks() {
  whiteTime = 5 * 60 * 1000;
  blackTime = 5 * 60 * 1000;
  activeClock = engine.whiteToMove ? 'w' : 'b';
  lastTick = Date.now();
  updateClockDisplay();
  if (clockInterval) clearInterval(clockInterval);
  clockInterval = setInterval(tickClock, 200);
}

function switchClock() {
  activeClock = engine.whiteToMove ? 'w' : 'b';
  lastTick = Date.now();
}

function clearArrow() {
  overlayEl.innerHTML = '';
}

function drawArrow(move) {
  if (!move) { clearArrow(); return; }
  const from = engine.indexToCoord(move.from);
  const to = engine.indexToCoord(move.to);
  overlayEl.innerHTML = '';
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
  marker.setAttribute('id', 'arrowhead');
  marker.setAttribute('markerWidth', '6');
  marker.setAttribute('markerHeight', '6');
  marker.setAttribute('refX', '3');
  marker.setAttribute('refY', '3');
  marker.setAttribute('orient', 'auto');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M0,0 L6,3 L0,6 z');
  path.setAttribute('fill', '#22c55e');
  marker.appendChild(path);
  defs.appendChild(marker);
  overlayEl.appendChild(defs);

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', from.file + 0.5);
  line.setAttribute('y1', from.rank + 0.5);
  line.setAttribute('x2', to.file + 0.5);
  line.setAttribute('y2', to.rank + 0.5);
  line.setAttribute('stroke', '#22c55e');
  line.setAttribute('stroke-width', '0.18');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('marker-end', 'url(#arrowhead)');
  overlayEl.appendChild(line);
}

function updateRecommendation() {
  if ((engine.whiteToMove && humanColor === 'black') || (!engine.whiteToMove && humanColor === 'white')) {
    recommendTextEl.textContent = 'Waiting for your turn…';
    recommended = null;
    clearArrow();
    return;
  }
  recommendTextEl.textContent = 'Calculating best move…';
  const depth = Math.max(2, parseInt(depthInput.value, 10));
  const result = engine.search(depth);
  recommended = result.move;
  drawArrow(recommended);
  if (!recommended) {
    recommendTextEl.textContent = 'No legal moves available.';
    return;
  }
  const preState = engine.makeMove(recommended);
  const opponentColor = engine.whiteToMove ? 'w' : 'b';
  const givesCheck = engine.isInCheck(opponentColor);
  const capturedPiece = preState.board[recommended.to];
  const isPromotion = Boolean(recommended.promotion);
  engine.undoMove(preState);
  const moveText = moveToAlgebra(recommended);
  const perspective = humanColor === 'white' ? 1 : -1;
  const centipawns = result.score * perspective;
  const verdict = centipawns > 50 ? 'improves your position' : centipawns < -50 ? 'may be defensive' : 'keeps things balanced';
  let reason = 'maintains solid development';
  if (givesCheck) reason = 'puts your opponent in check';
  else if (capturedPiece) reason = 'wins material';
  else if (isPromotion) reason = 'promotes your pawn';
  recommendTextEl.textContent = `${moveText} ${verdict} because it ${reason} (eval ${(centipawns / 100).toFixed(2)})`;
}

function onSquareClick(e) {
  if (gameOver) return;
  const idx = Number(e.currentTarget.dataset.index);
  const piece = engine.board[idx];
  const playerIsWhite = humanColor === 'white';
  const playerTurn = (engine.whiteToMove && playerIsWhite) || (!engine.whiteToMove && !playerIsWhite);
  if (!playerTurn) return;

  if (selected === null) {
    if (!piece) return;
    if ((engine.whiteToMove && !engine.isWhite(piece)) || (!engine.whiteToMove && !engine.isBlack(piece))) return;
    selected = idx;
    legalMoves = engine.generateMoves(engine.whiteToMove ? 'w' : 'b').filter(m => m.from === selected);
  } else {
    const move = legalMoves.find(m => m.to === idx);
    if (move) {
      playHumanMove(move);
      selected = null;
      legalMoves = [];
    } else if (piece && ((engine.whiteToMove && engine.isWhite(piece)) || (!engine.whiteToMove && engine.isBlack(piece)))) {
      selected = idx;
      legalMoves = engine.generateMoves(engine.whiteToMove ? 'w' : 'b').filter(m => m.from === selected);
    } else {
      selected = null;
      legalMoves = [];
    }
  }
  render();
  updateRecommendation();
}

function moveToAlgebra(move) {
  const files = 'abcdefgh';
  const from = engine.indexToCoord(move.from);
  const to = engine.indexToCoord(move.to);
  let str = `${files[from.file]}${8 - from.rank}${files[to.file]}${8 - to.rank}`;
  if (move.promotion) str += `=${move.promotion.toUpperCase()}`;
  return str;
}

function addMoveToLog(move, player) {
  const text = `${player === 'w' ? moveList.length / 2 + 1 + '.' : ''} ${moveToAlgebra(move)}`;
  if (player === 'w') {
    const li = document.createElement('li');
    li.textContent = text;
    li.dataset.white = text;
    movesEl.appendChild(li);
  } else {
    const last = movesEl.lastElementChild;
    if (last) {
      last.textContent = `${last.dataset.white || ''} ${moveToAlgebra(move)}`;
    }
  }
  movesEl.scrollTop = movesEl.scrollHeight;
}

function playHumanMove(move) {
  lastMove = move;
  engine.makeMove(move, true);
  moveList.push(move);
  addMoveToLog(move, engine.whiteToMove ? 'b' : 'w');
  tickClock();
  switchClock();
  updateStatus();
  render();
  checkGameState();
  updateRecommendation();
  setTimeout(() => aiMove(), 500);
}

function aiMove() {
  if (gameOver) return;
  if ((engine.whiteToMove && humanColor === 'white') || (!engine.whiteToMove && humanColor === 'black')) return;
  const depth = parseInt(depthInput.value, 10);
  const searchResult = engine.search(depth);
  engineDepthEl.textContent = depth;
  nodesEl.textContent = searchResult.nodes;
  if (!searchResult.move) {
    checkGameState();
    return;
  }
  lastMove = searchResult.move;
  engine.makeMove(searchResult.move, true);
  moveList.push(searchResult.move);
  addMoveToLog(searchResult.move, engine.whiteToMove ? 'b' : 'w');
  tickClock();
  switchClock();
  updateStatus(searchResult.score);
  render();
  checkGameState();
  updateRecommendation();
}

function updateStatus(score = engine.evaluate()) {
  if (Number.isFinite(score)) {
    evalEl.textContent = (score / 100).toFixed(2);
  } else {
    evalEl.textContent = score > 0 ? '+M' : '-M';
  }
  gameStateEl.textContent = 'Game in progress';
}

function checkGameState() {
  if (gameOver) return;
  const color = engine.whiteToMove ? 'w' : 'b';
  const moves = engine.generateMoves(color);
  if (moves.length === 0) {
    if (engine.isInCheck(color)) {
      gameStateEl.textContent = engine.whiteToMove ? 'White is checkmated' : 'Black is checkmated';
      gameOver = true;
    } else {
      gameStateEl.textContent = 'Stalemate';
      gameOver = true;
    }
  } else if (engine.isInCheck(color)) {
    gameStateEl.textContent = `${engine.whiteToMove ? 'White' : 'Black'} in check`;
  }
  if (gameOver) clearArrow();
}

function newGame() {
  engine.reset();
  selected = null;
  legalMoves = [];
  lastMove = null;
  moveList = [];
  recommended = null;
  movesEl.innerHTML = '';
  humanColor = sideSelect.value;
  gameOver = false;
  startClocks();
  if (humanColor === 'black') {
    // flip board by reversing render order? easier to keep same orientation but AI moves first
    setTimeout(() => aiMove(), 100);
  }
  updateStatus(0);
  render();
  updateRecommendation();
}

function undo() {
  if (moveList.length === 0) return;
  // undo last move
  let state = engine.history.pop();
  engine.undoMove(state);
  moveList.pop();
  // undo previous move to keep turn consistent
  if (moveList.length > 0) {
    state = engine.history.pop();
    engine.undoMove(state);
    moveList.pop();
  }
  movesEl.innerHTML = '';
  const copy = [...moveList];
  moveList = [];
  for (let i = 0; i < copy.length; i++) {
    moveList.push(copy[i]);
    addMoveToLog(copy[i], i % 2 === 0 ? 'w' : 'b');
  }
  lastMove = moveList[moveList.length - 1] || null;
  render();
  updateStatus();
  updateRecommendation();
}

depthInput.addEventListener('input', () => {
  depthValue.textContent = depthInput.value;
});

document.getElementById('new-game').addEventListener('click', newGame);
document.getElementById('undo').addEventListener('click', undo);

createBoard();
updateStatus();
startClocks();
updateRecommendation();

