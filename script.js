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

function onSquareClick(e) {
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
  updateStatus();
  render();
  checkGameState();
  setTimeout(() => aiMove(), 50);
}

function aiMove() {
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
  updateStatus(searchResult.score);
  render();
  checkGameState();
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
  const color = engine.whiteToMove ? 'w' : 'b';
  const moves = engine.generateMoves(color);
  if (moves.length === 0) {
    if (engine.isInCheck(color)) {
      gameStateEl.textContent = engine.whiteToMove ? 'White is checkmated' : 'Black is checkmated';
    } else {
      gameStateEl.textContent = 'Stalemate';
    }
  } else if (engine.isInCheck(color)) {
    gameStateEl.textContent = `${engine.whiteToMove ? 'White' : 'Black'} in check`;
  }
}

function newGame() {
  engine.reset();
  selected = null;
  legalMoves = [];
  lastMove = null;
  moveList = [];
  movesEl.innerHTML = '';
  humanColor = sideSelect.value;
  if (humanColor === 'black') {
    // flip board by reversing render order? easier to keep same orientation but AI moves first
    setTimeout(() => aiMove(), 100);
  }
  updateStatus(0);
  render();
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
}

depthInput.addEventListener('input', () => {
  depthValue.textContent = depthInput.value;
});

document.getElementById('new-game').addEventListener('click', newGame);
document.getElementById('undo').addEventListener('click', undo);

createBoard();
updateStatus();

