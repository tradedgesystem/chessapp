class ChessEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.board = [
      'r','n','b','q','k','b','n','r',
      'p','p','p','p','p','p','p','p',
      '','','','','','','','',
      '','','','','','','','',
      '','','','','','','','',
      '','','','','','','','',
      'P','P','P','P','P','P','P','P',
      'R','N','B','Q','K','B','N','R'
    ];
    this.whiteToMove = true;
    this.castling = { K: true, Q: true, k: true, q: true };
    this.enPassant = null;
    this.halfmoveClock = 0;
    this.fullmove = 1;
    this.history = [];
    this.nodes = 0;
  }

  cloneBoard() {
    return this.board.slice();
  }

  inBounds(file, rank) {
    return file >= 0 && file < 8 && rank >= 0 && rank < 8;
  }

  indexToCoord(index) {
    const file = index % 8;
    const rank = Math.floor(index / 8);
    return { file, rank };
  }

  coordToIndex(file, rank) {
    return rank * 8 + file;
  }

  isWhite(piece) { return piece === piece.toUpperCase(); }
  isBlack(piece) { return piece === piece.toLowerCase(); }

  pieceAt(index) {
    return this.board[index];
  }

  kingPosition(color) {
    const target = color === 'w' ? 'K' : 'k';
    return this.board.indexOf(target);
  }

  generateMoves(color = this.whiteToMove ? 'w' : 'b') {
    const moves = [];
    for (let i = 0; i < 64; i++) {
      const piece = this.board[i];
      if (!piece) continue;
      if ((color === 'w' && !this.isWhite(piece)) || (color === 'b' && !this.isBlack(piece))) continue;
      const type = piece.toLowerCase();
      switch (type) {
        case 'p':
          this.generatePawnMoves(i, moves, color);
          break;
        case 'n':
          this.generateKnightMoves(i, moves, color);
          break;
        case 'b':
          this.generateSlidingMoves(i, moves, color, [ [1,1], [1,-1], [-1,1], [-1,-1] ]);
          break;
        case 'r':
          this.generateSlidingMoves(i, moves, color, [ [1,0], [-1,0], [0,1], [0,-1] ]);
          break;
        case 'q':
          this.generateSlidingMoves(i, moves, color, [ [1,1], [1,-1], [-1,1], [-1,-1], [1,0], [-1,0], [0,1], [0,-1] ]);
          break;
        case 'k':
          this.generateKingMoves(i, moves, color);
          break;
      }
    }
    return moves.filter(m => this.isLegal(m));
  }

  generatePawnMoves(index, moves, color) {
    const dir = color === 'w' ? -1 : 1;
    const startRank = color === 'w' ? 6 : 1;
    const promotionRank = color === 'w' ? 0 : 7;
    const { file, rank } = this.indexToCoord(index);
    const oneStep = this.coordToIndex(file, rank + dir);
    if (this.inBounds(file, rank + dir) && !this.board[oneStep]) {
      if (rank + dir === promotionRank) {
        ['q','r','b','n'].forEach(p => moves.push(this.createMove(index, oneStep, p)));
      } else {
        moves.push(this.createMove(index, oneStep));
      }
      if (rank === startRank) {
        const twoStep = this.coordToIndex(file, rank + 2*dir);
        if (!this.board[twoStep]) {
          moves.push(this.createMove(index, twoStep, null, false, true));
        }
      }
    }
    // captures
    for (const df of [-1, 1]) {
      const nf = file + df;
      const nr = rank + dir;
      if (!this.inBounds(nf, nr)) continue;
      const targetIndex = this.coordToIndex(nf, nr);
      const targetPiece = this.board[targetIndex];
      if (targetPiece && ((color === 'w' && this.isBlack(targetPiece)) || (color === 'b' && this.isWhite(targetPiece)))) {
        if (nr === promotionRank) {
          ['q','r','b','n'].forEach(p => moves.push(this.createMove(index, targetIndex, p)));
        } else {
          moves.push(this.createMove(index, targetIndex));
        }
      }
      // en passant
      if (this.enPassant === targetIndex && !targetPiece) {
        moves.push(this.createMove(index, targetIndex, null, true));
      }
    }
  }

  generateKnightMoves(index, moves, color) {
    const { file, rank } = this.indexToCoord(index);
    const deltas = [ [1,2], [2,1], [2,-1], [1,-2], [-1,-2], [-2,-1], [-2,1], [-1,2] ];
    for (const [df, dr] of deltas) {
      const nf = file + df, nr = rank + dr;
      if (!this.inBounds(nf, nr)) continue;
      const dest = this.coordToIndex(nf, nr);
      const target = this.board[dest];
      if (!target || (color === 'w' ? this.isBlack(target) : this.isWhite(target))) {
        moves.push(this.createMove(index, dest));
      }
    }
  }

  generateSlidingMoves(index, moves, color, directions) {
    const { file, rank } = this.indexToCoord(index);
    for (const [df, dr] of directions) {
      let nf = file + df, nr = rank + dr;
      while (this.inBounds(nf, nr)) {
        const dest = this.coordToIndex(nf, nr);
        const target = this.board[dest];
        if (!target) {
          moves.push(this.createMove(index, dest));
        } else {
          if (color === 'w' ? this.isBlack(target) : this.isWhite(target)) {
            moves.push(this.createMove(index, dest));
          }
          break;
        }
        nf += df; nr += dr;
      }
    }
  }

  generateKingMoves(index, moves, color) {
    const { file, rank } = this.indexToCoord(index);
    for (let df = -1; df <= 1; df++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (df === 0 && dr === 0) continue;
        const nf = file + df, nr = rank + dr;
        if (!this.inBounds(nf, nr)) continue;
        const dest = this.coordToIndex(nf, nr);
        const target = this.board[dest];
        if (!target || (color === 'w' ? this.isBlack(target) : this.isWhite(target))) {
          moves.push(this.createMove(index, dest));
        }
      }
    }
    // castling
    if (color === 'w' && rank === 7 && file === 4) {
      const f1 = this.coordToIndex(5, 7);
      const g1 = this.coordToIndex(6, 7);
      const d1 = this.coordToIndex(3, 7);
      const c1 = this.coordToIndex(2, 7);
      const b1 = this.coordToIndex(1, 7);
      if (this.castling.K && !this.board[f1] && !this.board[g1] && !this.isSquareAttacked(4,7,'b') && !this.isSquareAttacked(5,7,'b') && !this.isSquareAttacked(6,7,'b')) {
        moves.push(this.createCastleMove(index, g1, 'K'));
      }
      if (this.castling.Q && !this.board[d1] && !this.board[c1] && !this.board[b1] && !this.isSquareAttacked(4,7,'b') && !this.isSquareAttacked(3,7,'b') && !this.isSquareAttacked(2,7,'b')) {
        moves.push(this.createCastleMove(index, c1, 'Q'));
      }
    }
    if (color === 'b' && rank === 0 && file === 4) {
      if (this.castling.k && !this.board[5] && !this.board[6] && !this.isSquareAttacked(4,0,'w') && !this.isSquareAttacked(5,0,'w') && !this.isSquareAttacked(6,0,'w')) {
        moves.push(this.createCastleMove(index, 6, 'k'));
      }
      if (this.castling.q && !this.board[3] && !this.board[2] && !this.board[1] && !this.isSquareAttacked(4,0,'w') && !this.isSquareAttacked(3,0,'w') && !this.isSquareAttacked(2,0,'w')) {
        moves.push(this.createCastleMove(index, 2, 'q'));
      }
    }
  }

  createMove(from, to, promotion=null, isEnPassant=false, isDoublePawn=false) {
    return { from, to, promotion, isEnPassant, isDoublePawn, isCastle: false };
  }

  createCastleMove(from, to, side) {
    return { from, to, promotion: null, isEnPassant: false, isDoublePawn: false, isCastle: true, castleSide: side };
  }

  isSquareAttacked(file, rank, byColor) {
    // pawns
    const dir = byColor === 'w' ? -1 : 1;
    for (const df of [-1,1]) {
      const nf = file + df, nr = rank + dir;
      if (this.inBounds(nf, nr)) {
        const idx = this.coordToIndex(nf, nr);
        const p = this.board[idx];
        if (p === (byColor === 'w' ? 'P' : 'p')) return true;
      }
    }
    // knights
    const knightDeltas = [ [1,2], [2,1], [2,-1], [1,-2], [-1,-2], [-2,-1], [-2,1], [-1,2] ];
    for (const [df, dr] of knightDeltas) {
      const nf = file + df, nr = rank + dr;
      if (!this.inBounds(nf, nr)) continue;
      const p = this.board[this.coordToIndex(nf, nr)];
      if (p === (byColor === 'w' ? 'N' : 'n')) return true;
    }
    // bishops / queens
    const diagDirs = [ [1,1], [1,-1], [-1,1], [-1,-1] ];
    for (const [df, dr] of diagDirs) {
      let nf = file + df, nr = rank + dr;
      while (this.inBounds(nf, nr)) {
        const p = this.board[this.coordToIndex(nf, nr)];
        if (p) {
          if (p === (byColor === 'w' ? 'B' : 'b') || p === (byColor === 'w' ? 'Q' : 'q')) return true;
          else break;
        }
        nf += df; nr += dr;
      }
    }
    // rooks / queens
    const straightDirs = [ [1,0], [-1,0], [0,1], [0,-1] ];
    for (const [df, dr] of straightDirs) {
      let nf = file + df, nr = rank + dr;
      while (this.inBounds(nf, nr)) {
        const p = this.board[this.coordToIndex(nf, nr)];
        if (p) {
          if (p === (byColor === 'w' ? 'R' : 'r') || p === (byColor === 'w' ? 'Q' : 'q')) return true;
          else break;
        }
        nf += df; nr += dr;
      }
    }
    // king
    for (let df=-1; df<=1; df++) {
      for (let dr=-1; dr<=1; dr++) {
        if (df===0 && dr===0) continue;
        const nf = file + df, nr = rank + dr;
        if (this.inBounds(nf, nr)) {
          const p = this.board[this.coordToIndex(nf, nr)];
          if (p === (byColor === 'w' ? 'K' : 'k')) return true;
        }
      }
    }
    return false;
  }

  isLegal(move) {
    const state = this.makeMove(move);
    const inCheck = this.isInCheck(this.whiteToMove ? 'b' : 'w');
    this.undoMove(state);
    return !inCheck;
  }

  isInCheck(color) {
    const kingIndex = this.kingPosition(color);
    if (kingIndex === -1) return false;
    const { file, rank } = this.indexToCoord(kingIndex);
    return this.isSquareAttacked(file, rank, color === 'w' ? 'b' : 'w');
  }

  makeMove(move, record = false) {
    const state = {
      board: this.board,
      castling: { ...this.castling },
      enPassant: this.enPassant,
      halfmoveClock: this.halfmoveClock,
      fullmove: this.fullmove,
      whiteToMove: this.whiteToMove,
      move
    };
    this.board = this.board.slice();
    const movingPiece = this.board[move.from];
    const targetPiece = this.board[move.to];

    // halfmove clock
    if (movingPiece.toLowerCase() === 'p' || targetPiece) this.halfmoveClock = 0; else this.halfmoveClock++;
    if (!this.whiteToMove) this.fullmove++;

    this.board[move.from] = '';
    if (move.isEnPassant) {
      const { file, rank } = this.indexToCoord(move.to);
      const capIndex = this.coordToIndex(file, rank + (this.whiteToMove ? 1 : -1));
      state.captured = this.board[capIndex];
      this.board[capIndex] = '';
    }
    if (move.isCastle) {
      if (move.castleSide === 'K') {
        this.board[this.coordToIndex(5,7)] = 'R';
        this.board[this.coordToIndex(7,7)] = '';
      }
      if (move.castleSide === 'Q') {
        this.board[this.coordToIndex(3,7)] = 'R';
        this.board[this.coordToIndex(0,7)] = '';
      }
      if (move.castleSide === 'k') {
        this.board[5] = 'r';
        this.board[7] = '';
      }
      if (move.castleSide === 'q') {
        this.board[3] = 'r';
        this.board[0] = '';
      }
    }

    this.board[move.to] = move.promotion ? (this.whiteToMove ? move.promotion.toUpperCase() : move.promotion.toLowerCase()) : movingPiece;

    // update castling rights
    if (movingPiece === 'K') { this.castling.K = false; this.castling.Q = false; }
    if (movingPiece === 'k') { this.castling.k = false; this.castling.q = false; }
    if (movingPiece === 'R') {
      if (move.from === this.coordToIndex(0,7)) this.castling.Q = false;
      if (move.from === this.coordToIndex(7,7)) this.castling.K = false;
    }
    if (movingPiece === 'r') {
      if (move.from === this.coordToIndex(0,0)) this.castling.q = false;
      if (move.from === this.coordToIndex(7,0)) this.castling.k = false;
    }
    if (targetPiece === 'R') {
      if (move.to === this.coordToIndex(0,7)) this.castling.Q = false;
      if (move.to === this.coordToIndex(7,7)) this.castling.K = false;
    }
    if (targetPiece === 'r') {
      if (move.to === this.coordToIndex(0,0)) this.castling.q = false;
      if (move.to === this.coordToIndex(7,0)) this.castling.k = false;
    }

    this.enPassant = null;
    if (move.isDoublePawn) {
      const { file, rank } = this.indexToCoord(move.to);
      this.enPassant = this.coordToIndex(file, rank - (this.whiteToMove ? 1 : -1));
    }

    this.whiteToMove = !this.whiteToMove;
    this.nodes++;
    if (record) this.history.push(state);
    return state;
  }

  undoMove(state) {
    this.board = state.board;
    this.castling = state.castling;
    this.enPassant = state.enPassant;
    this.halfmoveClock = state.halfmoveClock;
    this.fullmove = state.fullmove;
    this.whiteToMove = state.whiteToMove;
    const move = state.move;
    const movingPiece = this.board[move.to];
    this.board[move.from] = movingPiece && move.promotion ? (this.whiteToMove ? 'P' : 'p') : movingPiece;
    this.board[move.to] = state.captured || '';
    if (move.isEnPassant) {
      const { file, rank } = this.indexToCoord(move.to);
      const capIndex = this.coordToIndex(file, rank + (this.whiteToMove ? 1 : -1));
      this.board[capIndex] = state.captured;
      this.board[move.to] = '';
    }
    if (move.isCastle) {
      if (move.castleSide === 'K') {
        this.board[this.coordToIndex(7,7)] = 'R';
        this.board[this.coordToIndex(5,7)] = '';
      }
      if (move.castleSide === 'Q') {
        this.board[this.coordToIndex(0,7)] = 'R';
        this.board[this.coordToIndex(3,7)] = '';
      }
      if (move.castleSide === 'k') {
        this.board[this.coordToIndex(7,0)] = 'r';
        this.board[this.coordToIndex(5,0)] = '';
      }
      if (move.castleSide === 'q') {
        this.board[this.coordToIndex(0,0)] = 'r';
        this.board[this.coordToIndex(3,0)] = '';
      }
    }
  }

  evaluate() {
    const values = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
    let score = 0;
    for (const piece of this.board) {
      if (!piece) continue;
      const val = values[piece.toLowerCase()];
      score += this.isWhite(piece) ? val : -val;
    }
    return score;
  }

  search(depth, alpha=-Infinity, beta=Infinity) {
    this.nodes = 0;
    const maximizing = this.whiteToMove;
    const result = this.minimax(depth, alpha, beta, maximizing);
    return { move: result.move, score: result.score, nodes: this.nodes };
  }

  minimax(depth, alpha, beta, maximizing) {
    if (depth === 0) {
      const evalScore = this.evaluate();
      return { score: evalScore, move: null };
    }
    const color = maximizing ? 'w' : 'b';
    const moves = this.generateMoves(color);
    if (moves.length === 0) {
      if (this.isInCheck(color)) {
        return { score: maximizing ? -Infinity : Infinity, move: null };
      }
      return { score: 0, move: null }; // stalemate
    }
    let bestMove = null;
    if (maximizing) {
      let maxEval = -Infinity;
      for (const move of moves) {
        const state = this.makeMove(move);
        const evalResult = this.minimax(depth - 1, alpha, beta, false).score;
        this.undoMove(state);
        if (evalResult > maxEval) {
          maxEval = evalResult;
          bestMove = move;
        }
        alpha = Math.max(alpha, evalResult);
        if (beta <= alpha) break;
      }
      return { score: maxEval, move: bestMove };
    } else {
      let minEval = Infinity;
      for (const move of moves) {
        const state = this.makeMove(move);
        const evalResult = this.minimax(depth - 1, alpha, beta, true).score;
        this.undoMove(state);
        if (evalResult < minEval) {
          minEval = evalResult;
          bestMove = move;
        }
        beta = Math.min(beta, evalResult);
        if (beta <= alpha) break;
      }
      return { score: minEval, move: bestMove };
    }
  }
}

if (typeof module !== 'undefined') {
  module.exports = ChessEngine;
}
