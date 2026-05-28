/**
 * ═══════════════════════════════════════════════════════
 *  ÉCHECS & DAMES — Moteur de jeu + IA Minimax α-β
 *  Séparé en : index.html (HTML+CSS) + game.js (ce fichier)
 *  v2 : Zobrist TT · Killer moves · History heuristic
 *       MVV-LVA · Quiescence · Iterative deepening
 *       Drag & Drop · Analyse panel · FEN/PGN · Grist
 * ═══════════════════════════════════════════════════════
 */

'use strict';

/* ═══════════════════════════════════
   CONSTANTES GLOBALES
═══════════════════════════════════ */
const CHESS    = 'chess';
const CHECKERS = 'checkers';
const WHITE    = 'white';
const BLACK    = 'black';

// Pièces d'échecs (Unicode)
const CHESS_PIECES = {
  wK:'♔', wQ:'♕', wR:'♖', wB:'♗', wN:'♘', wP:'♙',
  bK:'♚', bQ:'♛', bR:'♜', bB:'♝', bN:'♞', bP:'♟'
};

// Valeurs des pièces pour l'évaluation
const PIECE_VALUE = {
  P:100, N:320, B:330, R:500, Q:900, K:20000
};

// Tables de position (bonus positionnel pour chaque case)
const PST = {
  P: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0
  ],
  N: [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50
  ],
  B: [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20
  ],
  R: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0
  ],
  Q: [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20
  ],
  K_mid: [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20
  ]
};

/* ═══════════════════════════════════
   ZOBRIST HASHING + TRANSPOSITION TABLE
═══════════════════════════════════ */
const ZOBRIST = (() => {
  let s = 0xDEADBEEF;
  const r = () => { s ^= s<<13; s ^= s>>17; s ^= s<<5; return s>>>0; };
  const t = {};
  ['wK','wQ','wR','wB','wN','wP','bK','bQ','bR','bB','bN','bP','wM','bM']
    .forEach(p => { t[p] = Array.from({length:64}, r); });
  t.side = r();
  return t;
})();

const TT = new Map();
const TT_MAX = 200000;
const TT_EXACT = 0, TT_ALPHA = 1, TT_BETA = 2;

function ttGet(hash, depth) {
  const e = TT.get(hash);
  return (e && e.depth >= depth) ? e : null;
}
function ttSet(hash, depth, score, flag, bestMove) {
  if (TT.size >= TT_MAX) TT.delete(TT.keys().next().value);
  TT.set(hash, { depth, score, flag, bestMove });
}
function pieceZKey(p) {
  return p.type ? (p.color==='white'?'w':'b')+p.type : (p.color==='white'?'w':'b')+(p.king?'K':'M');
}
function computeHash(board, turn) {
  let h = 0;
  board.forEach((p,i) => { if(p && ZOBRIST[pieceZKey(p)]) h = (h ^ ZOBRIST[pieceZKey(p)][i])>>>0; });
  if (turn === 'black') h = (h ^ ZOBRIST.side)>>>0;
  return h;
}

/* ═══════════════════════════════════
   KILLER MOVES + HISTORY HEURISTIC
═══════════════════════════════════ */
const killers = Array.from({length:64}, ()=>[null,null]);
const histHeuristic = {};
function histKey(f,t2) { return f*64+t2; }
function histGet(m) { return histHeuristic[histKey(m.from,m.to)]||0; }
function histUpdate(m, depth) { histHeuristic[histKey(m.from,m.to)] = (histHeuristic[histKey(m.from,m.to)]||0) + depth*depth; }
function addKiller(move, ply) {
  if (!killers[ply]) return;
  if (!movesEqual(killers[ply][0], move)) { killers[ply][1]=killers[ply][0]; killers[ply][0]=move; }
}
function movesEqual(a,b) { return a && b && a.from===b.from && a.to===b.to; }

/* ═══════════════════════════════════
   MVV-LVA MOVE ORDERING
═══════════════════════════════════ */
const MVV_LVA = { K:0, Q:1, R:2, B:3, N:4, P:5 };
function mvvLva(move, board) {
  if (!move.capture && move.captured===undefined) return 0;
  const victim = board[move.to] || (move.captured!==undefined ? board[move.captured] : null);
  const attacker = board[move.from];
  if (!victim || !attacker) return 0;
  const vv = MVV_LVA[victim.type]  ?? 5;
  const av = MVV_LVA[attacker.type] ?? 5;
  return (vv*10 - av + 100);
}

function orderMoves(moves, board, ttMove, ply) {
  return moves.slice().sort((a,b) => {
    const scoreMove = (m) => {
      if (ttMove && movesEqual(m, ttMove)) return 10000;
      const cap = mvvLva(m, board);
      if (cap > 0) return 5000 + cap;
      if (killers[ply] && (movesEqual(m,killers[ply][0]) || movesEqual(m,killers[ply][1]))) return 4000;
      return histGet(m);
    };
    return scoreMove(b) - scoreMove(a);
  });
}

/* ═══════════════════════════════════
   HELPERS MODE DE JEU
═══════════════════════════════════ */
function humanSide() {
  const el = document.getElementById('human-side');
  return el ? el.value : WHITE;
}
function isHumanTurn() {
  const playMode = document.getElementById('play-mode').value;
  if (playMode === 'ai-ai')      return false;
  if (playMode === 'human-human') return true;
  return G.turn === humanSide();
}

function onPlayModeChange() {
  const row = document.getElementById('human-side-row');
  if (row) row.style.display = document.getElementById('play-mode').value === 'human-ai' ? '' : 'none';
  updatePlayerLabels();
  newGame();
}
function onHumanSideChange() {
  updatePlayerLabels();
  newGame();
}

/* ═══════════════════════════════════
   ÉTAT GLOBAL
═══════════════════════════════════ */
let G = {}; // état du jeu

function createState(mode) {
  return {
    mode,
    board:         mode === CHESS ? initChessBoard() : initCheckersBoard(),
    turn:          WHITE,
    selected:      null,
    legalMoves:    [],
    history:       [],          // [{from, to, piece, captured, special, boardBefore}]
    capturedWhite: [],          // pièces blanches capturées (par les noirs)
    capturedBlack: [],          // pièces noires capturées (par les blancs)
    moveList:      [],          // pour l'affichage algébrique
    gameOver:      false,
    flipped:       false,
    inCheck:       false,
    // Échecs — états spéciaux
    castling:      { wK:true, wRa:true, wRh:true, bK:true, bRa:true, bRh:true },
    enPassant:     null,        // case cible en passant
    // Scores (victoires)
    scores:        { white:0, black:0 },
    // Dames — multi-capture en cours
    mustCaptureFrom: null,
  };
}

/* ═══════════════════════════════════
   INITIALISATION DES PLATEAUX
═══════════════════════════════════ */
function initChessBoard() {
  const b = Array(64).fill(null);
  const backRank = ['R','N','B','Q','K','B','N','R'];
  backRank.forEach((t,i) => {
    b[i]    = { color: BLACK, type: t };
    b[56+i] = { color: WHITE, type: t };
  });
  for (let i=0; i<8; i++) {
    b[8+i]  = { color: BLACK, type: 'P' };
    b[48+i] = { color: WHITE, type: 'P' };
  }
  return b;
}

function initCheckersBoard() {
  const b = Array(64).fill(null);
  for (let r=0; r<8; r++) {
    for (let c=0; c<8; c++) {
      if ((r+c)%2 === 1) {
        const idx = r*8+c;
        if (r < 3)      b[idx] = { color: BLACK, king: false };
        else if (r > 4) b[idx] = { color: WHITE, king: false };
      }
    }
  }
  return b;
}

/* ═══════════════════════════════════
   UTILITAIRES PLATEAU
═══════════════════════════════════ */
const row = idx => Math.floor(idx/8);
const col = idx => idx%8;
const rc  = (r,c) => r*8+c;
const inBounds = (r,c) => r>=0 && r<8 && c>=0 && c<8;
const opponent = color => color===WHITE ? BLACK : WHITE;
const cloneBoard = b => b.map(p => p ? {...p} : null);

/* ═══════════════════════════════════
   GÉNÉRATION DES COUPS — ÉCHECS
═══════════════════════════════════ */
function chessMovesForPiece(board, idx, castling, enPassant, forLegal=true) {
  const piece = board[idx];
  if (!piece) return [];
  const { color, type } = piece;
  const moves = [];
  const r = row(idx), c = col(idx);
  const dir = color===WHITE ? -1 : 1;
  const opp = opponent(color);

  const addMove = (to, special={}) => moves.push({ from:idx, to, ...special });

  const slide = (dr, dc) => {
    let nr=r+dr, nc=c+dc;
    while (inBounds(nr,nc)) {
      const t=rc(nr,nc);
      if (board[t]) {
        if (board[t].color===opp) addMove(t,{capture:true});
        break;
      }
      addMove(t);
      nr+=dr; nc+=dc;
    }
  };

  const jump = (dr, dc) => {
    const nr=r+dr, nc=c+dc;
    if (!inBounds(nr,nc)) return;
    const t=rc(nr,nc);
    if (!board[t])                    addMove(t);
    else if (board[t].color===opp)    addMove(t,{capture:true});
  };

  switch(type) {
    case 'P': {
      // Avance
      const f1=rc(r+dir,c);
      if (!board[f1]) {
        if (r+dir===0 || r+dir===7) addMove(f1,{promote:true});
        else addMove(f1);
        // Double pas initial
        const startRow = color===WHITE ? 6 : 1;
        if (r===startRow) {
          const f2=rc(r+2*dir,c);
          if (!board[f2]) addMove(f2,{double:true});
        }
      }
      // Captures diagonales
      [-1,1].forEach(dc2 => {
        const nc2=c+dc2;
        if (!inBounds(r+dir,nc2)) return;
        const t=rc(r+dir,nc2);
        if (board[t]?.color===opp) {
          if (r+dir===0||r+dir===7) addMove(t,{capture:true,promote:true});
          else addMove(t,{capture:true});
        }
        // En passant
        if (enPassant===t) addMove(t,{capture:true,enpassant:true});
      });
      break;
    }
    case 'N':
      [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]
        .forEach(([dr,dc]) => jump(dr,dc));
      break;
    case 'B': [-1,-1].forEach(d=>slide(d,-1)); [-1,1].forEach(d=>slide(d,1));
              slide(-1,-1); slide(-1,1); slide(1,-1); slide(1,1); break;
    case 'R': slide(-1,0); slide(1,0); slide(0,-1); slide(0,1); break;
    case 'Q': slide(-1,0);slide(1,0);slide(0,-1);slide(0,1);
              slide(-1,-1);slide(-1,1);slide(1,-1);slide(1,1); break;
    case 'K': {
      [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]
        .forEach(([dr,dc])=>jump(dr,dc));
      // Roque
      if (forLegal && !isInCheck(board,color)) {
        const kRow = color===WHITE ? 7 : 0;
        const ck = color===WHITE ? 'wK':'bK';
        if (castling[ck] && r===kRow && c===4) {
          // Petit roque
          const rh = color===WHITE ? 'wRh':'bRh';
          if (castling[rh] && !board[rc(kRow,5)] && !board[rc(kRow,6)]) {
            if (!squareAttackedBy(board,rc(kRow,5),opp) &&
                !squareAttackedBy(board,rc(kRow,6),opp))
              addMove(rc(kRow,6),{castle:'K'});
          }
          // Grand roque
          const ra = color===WHITE ? 'wRa':'bRa';
          if (castling[ra] && !board[rc(kRow,3)] && !board[rc(kRow,2)] && !board[rc(kRow,1)]) {
            if (!squareAttackedBy(board,rc(kRow,3),opp) &&
                !squareAttackedBy(board,rc(kRow,2),opp))
              addMove(rc(kRow,2),{castle:'Q'});
          }
        }
      }
      break;
    }
  }
  return moves;
}

function allPseudoMoves(board, color, castling, enPassant) {
  const moves = [];
  board.forEach((p,i) => {
    // forLegal=false pour éviter la récursion isInCheck→squareAttackedBy→allPseudoMoves
    if (p?.color===color) moves.push(...chessMovesForPiece(board,i,castling,enPassant,false));
  });
  return moves;
}

function squareAttackedBy(board, idx, byColor) {
  // On génère les coups pseudo-légaux de la couleur attaquante
  const fakeCastling = {};
  const pseudo = allPseudoMoves(board, byColor, fakeCastling, null);
  return pseudo.some(m => m.to===idx);
}

function isInCheck(board, color) {
  const kingIdx = board.findIndex(p => p?.color===color && p?.type==='K');
  if (kingIdx<0) return false;
  return squareAttackedBy(board, kingIdx, opponent(color));
}

function legalChessMoves(board, color, castling, enPassant) {
  const pseudo = allPseudoMoves(board, color, castling, enPassant);
  // Ajouter les roques séparément (forLegal=true safe ici car allPseudoMoves passe forLegal=false)
  const kingIdx = board.findIndex(p => p?.color===color && p?.type==='K');
  if (kingIdx >= 0) {
    chessMovesForPiece(board, kingIdx, castling, enPassant, true)
      .filter(m => m.castle)
      .forEach(m => pseudo.push(m));
  }
  return pseudo.filter(m => {
    const nb = applyChessMove(cloneBoard(board), m, castling, enPassant).board;
    return !isInCheck(nb, color);
  });
}

function applyChessMove(board, move, castling, enPassant, promote='Q') {
  const piece = board[move.from];
  const newCastle = { ...castling };
  let newEP = null;

  // Déplacement
  board[move.to]   = piece;
  board[move.from] = null;

  // En passant : supprimer le pion capturé
  if (move.enpassant) {
    const epRow = row(move.to) + (piece.color===WHITE ? 1 : -1);
    board[rc(epRow, col(move.to))] = null;
  }

  // Double poussée de pion → marquer en passant
  if (move.double) {
    newEP = rc(row(move.to) - (piece.color===WHITE ? -1 : 1), col(move.to));
  }

  // Promotion
  if (move.promote) {
    board[move.to] = { color: piece.color, type: promote };
  }

  // Roque : déplacer aussi la tour
  if (move.castle) {
    const kRow = piece.color===WHITE ? 7 : 0;
    if (move.castle==='K') {
      board[rc(kRow,5)] = board[rc(kRow,7)];
      board[rc(kRow,7)] = null;
    } else {
      board[rc(kRow,3)] = board[rc(kRow,0)];
      board[rc(kRow,0)] = null;
    }
  }

  // MAJ droits de roque
  const c = piece.color;
  if (piece.type==='K') { newCastle[c==='white'?'wK':'bK']=false; newCastle[c==='white'?'wRa':'bRa']=false; newCastle[c==='white'?'wRh':'bRh']=false; }
  if (piece.type==='R') {
    const r0=row(move.from); const c0=col(move.from);
    if (c==='white' && r0===7) { if (c0===0) newCastle.wRa=false; if (c0===7) newCastle.wRh=false; }
    if (c==='black' && r0===0) { if (c0===0) newCastle.bRa=false; if (c0===7) newCastle.bRh=false; }
  }

  return { board, castling: newCastle, enPassant: newEP };
}

/* ═══════════════════════════════════
   GÉNÉRATION DES COUPS — DAMES
═══════════════════════════════════ */
function checkersMoves(board, color, mustFrom=null) {
  const dirs = color===WHITE ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]];
  const allDirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
  const captures=[], normals=[];

  const pcs = board.reduce((acc,p,i)=>{
    if (p?.color===color && (!mustFrom || i===mustFrom)) acc.push(i);
    return acc;
  },[]);

  pcs.forEach(idx => {
    const piece=board[idx], r0=row(idx), c0=col(idx);
    const movDirs = piece.king ? allDirs : dirs;

    // Captures
    movDirs.forEach(([dr,dc]) => {
      const mr=r0+dr, mc=c0+dc;
      const lr=r0+2*dr, lc=c0+2*dc;
      if (!inBounds(mr,mc)||!inBounds(lr,lc)) return;
      const mid=rc(mr,mc), land=rc(lr,lc);
      if (board[mid]?.color===opponent(color) && !board[land]) {
        captures.push({ from:idx, to:land, captured:mid });
      }
    });
  });

  if (captures.length>0) return captures; // capture obligatoire

  pcs.forEach(idx => {
    const piece=board[idx], r0=row(idx), c0=col(idx);
    const movDirs = piece.king ? allDirs : dirs;
    movDirs.forEach(([dr,dc]) => {
      const nr=r0+dr, nc=c0+dc;
      if (inBounds(nr,nc) && !board[rc(nr,nc)])
        normals.push({ from:idx, to:rc(nr,nc) });
    });
  });

  return normals;
}

function applyCheckersMove(board, move) {
  board[move.to] = board[move.from];
  board[move.from] = null;
  if (move.captured!==undefined) board[move.captured] = null;
  // Promotion dame
  const p=board[move.to];
  if (p.color===WHITE && row(move.to)===0) p.king=true;
  if (p.color===BLACK && row(move.to)===7) p.king=true;
  return board;
}

/* ═══════════════════════════════════
   NOTATION ALGÉBRIQUE
═══════════════════════════════════ */
const fileChar = c => String.fromCharCode(97+c);
const rankChar = r => String(8-r);
function squareName(idx) { return fileChar(col(idx))+rankChar(row(idx)); }

function moveNotation(move, piece, board) {
  if (G.mode===CHECKERS) return squareName(move.from)+'-'+squareName(move.to);
  const p=piece.type;
  let n='';
  if (move.castle) return move.castle==='K' ? 'O-O' : 'O-O-O';
  if (p!=='P') n+=p;
  if (move.capture||move.enpassant) {
    if (p==='P') n+=fileChar(col(move.from));
    n+='x';
  }
  n+=squareName(move.to);
  if (move.promote) n+='=Q';
  return n;
}

/* ═══════════════════════════════════
   ÉVALUATION STATIQUE — ÉCHECS
═══════════════════════════════════ */
function evaluateChess(board) {
  let score=0;
  board.forEach((p,i) => {
    if (!p) return;
    const base = PIECE_VALUE[p.type]||0;
    const idx  = p.color===WHITE ? i : 63-i;
    let pos=0;
    if (PST[p.type])      pos=PST[p.type][idx];
    else if (p.type==='K') pos=PST.K_mid[idx];
    const val = base+pos;
    score += p.color===WHITE ? val : -val;
  });
  return score;
}

/* ═══════════════════════════════════
   ÉVALUATION STATIQUE — DAMES
═══════════════════════════════════ */
function evaluateCheckers(board) {
  let score=0;
  board.forEach((p,r0)=>{
    if (!p) return;
    const val = p.king ? 300 : 100;
    // bonus d'avancement
    const adv = p.color===WHITE ? (7-row(r0))*5 : row(r0)*5;
    score += p.color===WHITE ? val+adv : -(val+adv);
  });
  return score;
}

/* ═══════════════════════════════════
   QUIESCENCE SEARCH (ÉCHECS)
═══════════════════════════════════ */
function quiescence(board, alpha, beta, color, castling, enPassant, qdepth=6) {
  if (_abortSearch || qdepth===0) return evaluateChess(board);
  const standPat = evaluateChess(board);
  const maximizing = color==='white';
  if (maximizing) {
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;
    const captures = legalChessMoves(board, color, castling, enPassant)
      .filter(m => m.capture || m.enpassant);
    for (const m of captures) {
      if (_abortSearch) break;
      const nb = cloneBoard(board);
      const r = applyChessMove(nb, m, castling, enPassant);
      const s = quiescence(r.board, alpha, beta, 'black', r.castling, r.enPassant, qdepth-1);
      if (s >= beta) return beta;
      if (s > alpha) alpha = s;
    }
    return alpha;
  } else {
    if (standPat <= alpha) return alpha;
    if (standPat < beta) beta = standPat;
    const captures = legalChessMoves(board, color, castling, enPassant)
      .filter(m => m.capture || m.enpassant);
    for (const m of captures) {
      if (_abortSearch) break;
      const nb = cloneBoard(board);
      const r = applyChessMove(nb, m, castling, enPassant);
      const s = quiescence(r.board, alpha, beta, 'white', r.castling, r.enPassant, qdepth-1);
      if (s <= alpha) return alpha;
      if (s < beta) beta = s;
    }
    return beta;
  }
}

/* ═══════════════════════════════════
   MINIMAX AVEC TT + KILLERS + HISTORY + QUIESCENCE
═══════════════════════════════════ */
let _abortSearch = false;

function minimax(board, depth, alpha, beta, maximizing, color, castling, enPassant, mustFrom=null, ply=0) {
  if (_abortSearch) return 0;

  const hash = computeHash(board, color);
  const ttEntry = ttGet(hash, depth);
  let ttMove = null;
  if (ttEntry) {
    ttMove = ttEntry.bestMove;
    if (ttEntry.flag === TT_EXACT) return ttEntry.score;
    if (ttEntry.flag === TT_ALPHA && ttEntry.score <= alpha) return alpha;
    if (ttEntry.flag === TT_BETA  && ttEntry.score >= beta)  return beta;
  }

  const evaluate = G.mode===CHESS ? evaluateChess : evaluateCheckers;

  if (depth === 0) {
    if (G.mode === CHESS) return quiescence(board, alpha, beta, color, castling, enPassant);
    return evaluate(board);
  }

  let rawMoves = G.mode===CHESS
    ? legalChessMoves(board, color, castling, enPassant)
    : checkersMoves(board, color, mustFrom);

  if (rawMoves.length === 0) {
    return maximizing ? -99999 : 99999;
  }

  const moves = orderMoves(rawMoves, board, ttMove, ply);
  let bestMove = null;
  const origAlpha = alpha;

  if (maximizing) {
    let best = -Infinity;
    for (const m of moves) {
      if (_abortSearch) break;
      const nb = cloneBoard(board);
      let nc=castling, ne=enPassant, nMF=null;
      if (G.mode===CHESS) {
        const r=applyChessMove(nb,m,castling,enPassant);
        nc=r.castling; ne=r.enPassant;
      } else {
        applyCheckersMove(nb,m);
        if (m.captured!==undefined) {
          const further=checkersMoves(nb,color,m.to);
          if (further.some(f=>f.captured!==undefined)) nMF=m.to;
        }
      }
      const score = minimax(nb,depth-1,alpha,beta,false,opponent(color),nc,ne,nMF,ply+1);
      if (score > best) { best=score; bestMove=m; }
      alpha = Math.max(alpha, best);
      if (beta <= alpha) {
        if (!m.capture && m.captured===undefined) { addKiller(m,ply); histUpdate(m,depth); }
        break;
      }
    }
    const flag = best <= origAlpha ? TT_ALPHA : best >= beta ? TT_BETA : TT_EXACT;
    ttSet(hash, depth, best, flag, bestMove);
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      if (_abortSearch) break;
      const nb = cloneBoard(board);
      let nc=castling, ne=enPassant, nMF=null;
      if (G.mode===CHESS) {
        const r=applyChessMove(nb,m,castling,enPassant);
        nc=r.castling; ne=r.enPassant;
      } else {
        applyCheckersMove(nb,m);
        if (m.captured!==undefined) {
          const further=checkersMoves(nb,color,m.to);
          if (further.some(f=>f.captured!==undefined)) nMF=m.to;
        }
      }
      const score = minimax(nb,depth-1,alpha,beta,true,opponent(color),nc,ne,nMF,ply+1);
      if (score < best) { best=score; bestMove=m; }
      beta = Math.min(beta, best);
      if (beta <= alpha) {
        if (!m.capture && m.captured===undefined) { addKiller(m,ply); histUpdate(m,depth); }
        break;
      }
    }
    const flag = best >= beta ? TT_BETA : best <= origAlpha ? TT_ALPHA : TT_EXACT;
    ttSet(hash, depth, best, flag, bestMove);
    return best;
  }
}

/* ═══════════════════════════════════
   OPENING BOOK (ouvertures classiques)
   Indices : row 0 = rangée 8 (noirs), row 7 = rangée 1 (blancs)
   a8=0 … h8=7 / a1=56 … h1=63
═══════════════════════════════════ */
// Map<clé_historique, [{from,to}]> — plusieurs coups possibles pour varier
const OPENING_BOOK = new Map([
  // ── COUP 1 BLANCS ────────────────────────────────────
  ['', [{from:52,to:36},{from:51,to:35},{from:50,to:34}]],
  // e4, d4, c4

  // ── RÉPONSES AU 1.e4 (NOIRS) ─────────────────────────
  ['52:36', [{from:12,to:28},{from:10,to:26},{from:12,to:20},{from:10,to:18}]],
  // 1...e5, c5 (Sicilienne), e6 (Française), c6 (Caro-Kann)

  // ── RÉPONSES AU 1.d4 (NOIRS) ─────────────────────────
  ['51:35', [{from:11,to:27},{from:6,to:21},{from:13,to:29}]],
  // 1...d5, Cf6, f5 (Hollandaise)

  // ── RÉPONSES AU 1.c4 (NOIRS) ─────────────────────────
  ['50:34', [{from:12,to:28},{from:6,to:21}]],
  // 1...e5, Cf6

  // ── 2e COUP BLANCS après 1.e4 e5 ─────────────────────
  ['52:36|12:28', [{from:62,to:45},{from:57,to:42}]],
  // 2.Cf3, 2.Cc3 (Viennoise)

  // ── 2e COUP BLANCS après 1.e4 c5 (Sicilienne) ────────
  ['52:36|10:26', [{from:62,to:45}]],
  // 2.Cf3

  // ── 2e COUP BLANCS après 1.e4 e6 (Française) ─────────
  ['52:36|12:20', [{from:51,to:35}]],
  // 2.d4

  // ── 2e COUP BLANCS après 1.e4 c6 (Caro-Kann) ─────────
  ['52:36|10:18', [{from:51,to:35}]],
  // 2.d4

  // ── 2e COUP BLANCS après 1.d4 d5 ─────────────────────
  ['51:35|11:27', [{from:50,to:34},{from:62,to:45}]],
  // 2.c4 (Gambit Dame), 2.Cf3

  // ── 2e COUP BLANCS après 1.d4 Cf6 ────────────────────
  ['51:35|6:21', [{from:50,to:34},{from:62,to:45}]],
  // 2.c4, 2.Cf3

  // ── 2e COUP NOIRS après 1.e4 e5 2.Cf3 ───────────────
  ['52:36|12:28|62:45', [{from:1,to:18},{from:6,to:21}]],
  // 2...Cc6, 2...Cf6 (Petroff)

  // ── 2e COUP NOIRS après 1.e4 e5 2.Cc3 (Viennoise) ───
  ['52:36|12:28|57:42', [{from:1,to:18},{from:6,to:21},{from:5,to:26}]],
  // 2...Cc6, Cf6, Fc5

  // ── 2e COUP NOIRS après 1.e4 c5 2.Cf3 (Sicilienne) ──
  ['52:36|10:26|62:45', [{from:11,to:19},{from:1,to:18},{from:12,to:20}]],
  // 2...d6 (Najdorf), Cc6, e6

  // ── 2e COUP NOIRS après 1.e4 e6 2.d4 (Française) ────
  ['52:36|12:20|51:35', [{from:11,to:27}]],
  // 2...d5

  // ── 2e COUP NOIRS après 1.e4 c6 2.d4 (Caro-Kann) ────
  ['52:36|10:18|51:35', [{from:11,to:27}]],
  // 2...d5

  // ── 2e COUP NOIRS après 1.d4 d5 2.c4 (Gambit Dame) ──
  ['51:35|11:27|50:34', [{from:12,to:20},{from:10,to:26},{from:11,to:34}]],
  // 2...e6 (QGD), c5 (Tarrasch), dxc4 (QGA accepté)

  // ── 2e COUP NOIRS après 1.d4 Cf6 2.c4 ───────────────
  ['51:35|6:21|50:34', [{from:14,to:30},{from:12,to:20},{from:10,to:18}]],
  // 2...g6 (Indien du Roi), e6 (Nimzo), c6 (Slave)

  // ── 3e COUP BLANCS après 1.e4 e5 2.Cf3 Cc6 ──────────
  ['52:36|12:28|62:45|1:18', [
    {from:61,to:25},  // 3.Fb5 (Lopez)
    {from:61,to:34},  // 3.Fc4 (Italienne)
    {from:51,to:35},  // 3.d4  (Écossaise)
  ]],

  // ── 3e COUP BLANCS après 1.e4 e5 2.Cf3 Cf6 (Petroff) ─
  ['52:36|12:28|62:45|6:21', [
    {from:45,to:28},  // 3.Cxe5
    {from:51,to:35},  // 3.d4
  ]],

  // ── 3e COUP BLANCS après 1.e4 c5 2.Cf3 d6 (Sicilienne) ─
  ['52:36|10:26|62:45|11:19', [{from:51,to:35}]],
  // 3.d4 (Sicilienne ouverte)

  // ── 3e COUP BLANCS après 1.e4 c5 2.Cf3 Cc6 ──────────
  ['52:36|10:26|62:45|1:18', [{from:51,to:35},{from:61,to:34}]],
  // 3.d4, 3.Fc4

  // ── 3e COUP BLANCS après 1.e4 e6 2.d4 d5 (Française) ─
  ['52:36|12:20|51:35|11:27', [
    {from:57,to:42},  // 3.Cc3 (Classique)
    {from:57,to:51},  // 3.Cd2 (Tarrasch) — d2 libre après 2.d4
    {from:36,to:27},  // 3.exd5 (Échange)
  ]],

  // ── 3e COUP BLANCS après 1.e4 c6 2.d4 d5 (Caro-Kann) ─
  ['52:36|10:18|51:35|11:27', [
    {from:57,to:42},  // 3.Cc3
    {from:36,to:27},  // 3.exd5 (Échange)
  ]],

  // ── 3e COUP BLANCS après 1.d4 d5 2.c4 e6 (QGD) ──────
  ['51:35|11:27|50:34|12:20', [{from:57,to:42},{from:62,to:45}]],
  // 3.Cc3, 3.Cf3

  // ── 3e COUP NOIRS après 1.e4 e5 2.Cf3 Cc6 3.Fb5 (Lopez) ─
  ['52:36|12:28|62:45|1:18|61:25', [
    {from:8,to:16},   // 3...a6 (Morphy — plus joué)
    {from:6,to:21},   // 3...Cf6 (Berlinoise)
    {from:11,to:19},  // 3...d6 (Steinitz)
  ]],

  // ── 3e COUP NOIRS après 1.e4 e5 2.Cf3 Cc6 3.Fc4 (Italienne) ─
  ['52:36|12:28|62:45|1:18|61:34', [
    {from:5,to:26},   // 3...Fc5 (Giuoco Piano)
    {from:6,to:21},   // 3...Cf6 (Deux Cavaliers)
  ]],

  // ── 3e COUP NOIRS après 1.e4 e5 2.Cf3 Cc6 3.d4 (Écossaise) ─
  ['52:36|12:28|62:45|1:18|51:35', [{from:28,to:35}]],
  // 3...exd4

  // ── 3e COUP NOIRS après 1.e4 c5 2.Cf3 d6 3.d4 ────────
  ['52:36|10:26|62:45|11:19|51:35', [{from:26,to:35}]],
  // 3...cxd4

  // ── 3e COUP NOIRS après 1.d4 d5 2.c4 e6 3.Cc3 (QGD) ──
  ['51:35|11:27|50:34|12:20|57:42', [
    {from:6,to:21},   // 3...Cf6
    {from:5,to:33},   // 3...Fb4 (Nimzo-Indien : f8→b4)
  ]],

  // ── 4e COUP BLANCS après Lopez 3.Fb5 a6 ──────────────
  ['52:36|12:28|62:45|1:18|61:25|8:16', [
    {from:25,to:32},  // 4.Fa4 (ligne principale)
    {from:25,to:18},  // 4.Fxc6 (Échange Lopez)
  ]],

  // ── 4e COUP NOIRS après Lopez 4.Fa4 ──────────────────
  ['52:36|12:28|62:45|1:18|61:25|8:16|25:32', [
    {from:6,to:21},   // 4...Cf6 (ligne principale)
    {from:11,to:19},  // 4...d6
  ]],

  // ── 4e COUP BLANCS après Italienne 3.Fc4 Fc5 ─────────
  ['52:36|12:28|62:45|1:18|61:34|5:26', [
    {from:50,to:42},  // 4.c3 (Giuoco Piano)
    {from:51,to:35},  // 4.d4
    {from:60,to:62},  // 4.O-O (roque)
  ]],

  // ── 5e COUP BLANCS après Lopez 4.Fa4 Cf6 ─────────────
  ['52:36|12:28|62:45|1:18|61:25|8:16|25:32|6:21', [
    {from:60,to:62},  // 5.O-O (roque)
  ]],

  // ── 3e COUP BLANCS après 1.d4 Cf6 2.c4 g6 (KID) ──────
  ['51:35|6:21|50:34|14:30', [
    {from:57,to:42},  // 3.Cc3
    {from:62,to:45},  // 3.Cf3
  ]],

  // ── 3e COUP NOIRS après 1.d4 Cf6 2.c4 g6 3.Cc3 (KID) ─
  ['51:35|6:21|50:34|14:30|57:42', [
    {from:5,to:30},   // 3...Fg7 (f8→g6 : 5→30)
    {from:11,to:19},  // 3...d6
  ]],
]);

function getBookMove(board, color) {
  if (G.mode !== CHESS) return null;
  const key = G.history.map(h => h.from + ':' + h.to).join('|');
  const candidates = OPENING_BOOK.get(key);
  if (!candidates || !candidates.length) return null;
  const legal = legalChessMoves(board, color, G.castling, G.enPassant);
  const valid = candidates.filter(c => legal.some(l => l.from===c.from && l.to===c.to));
  if (!valid.length) return null;
  const pick = valid[Math.floor(Math.random() * valid.length)];
  return legal.find(l => l.from===pick.from && l.to===pick.to) || null;
}

/* ═══════════════════════════════════
   GET BEST MOVE — ITERATIVE DEEPENING
═══════════════════════════════════ */
const ID_TIME_MS = [0, 300, 700, 1500, 3000, 6000];
let lastAnalysis = { depth:0, nodes:0, score:0, bestMove:null, timeMs:0 };
let _nodeCount = 0;

function getBestMove(board, color, maxDepth, castling, enPassant, mustFrom=null) {
  // Vérifier l'opening book avant de calculer
  const bookMove = getBookMove(board, color);
  if (bookMove) {
    lastAnalysis = { depth:0, nodes:0, score:0,
      bestMove: squareName(bookMove.from)+'→'+squareName(bookMove.to)+' 📖', timeMs:0 };
    updateAnalysisPanel();
    return bookMove;
  }

  const moves = G.mode===CHESS
    ? legalChessMoves(board, color, castling, enPassant)
    : checkersMoves(board, color, mustFrom);
  if (!moves.length) return null;

  const timeLimit = ID_TIME_MS[Math.min(maxDepth, 5)] || 1500;
  const start = Date.now();
  _abortSearch = false;
  _nodeCount = 0;

  let bestMove = moves[0];
  const maximizing = color === 'white';

  // Iterative deepening
  for (let d = 1; d <= maxDepth; d++) {
    if (Date.now() - start > timeLimit * 0.85) break;

    let iterBest = null;
    let iterScore = maximizing ? -Infinity : Infinity;
    const orderedMoves = orderMoves(moves, board, bestMove, 0); // use last best as TT hint

    for (const m of orderedMoves) {
      if (_abortSearch || (Date.now() - start > timeLimit)) break;
      const nb = cloneBoard(board);
      let nc=castling, ne=enPassant;
      if (G.mode===CHESS) { const r=applyChessMove(nb,m,castling,enPassant); nc=r.castling; ne=r.enPassant; }
      else applyCheckersMove(nb,m);

      _nodeCount++;
      const score = minimax(nb, d-1, -Infinity, Infinity, !maximizing, opponent(color), nc, ne);
      if (maximizing ? score > iterScore : score < iterScore) {
        iterScore = score; iterBest = m;
      }
    }
    if (iterBest) {
      bestMove = iterBest;
      lastAnalysis = {
        depth: d,
        nodes: _nodeCount,
        score: iterScore,
        bestMove: iterBest ? squareName(iterBest.from)+'→'+squareName(iterBest.to) : '—',
        timeMs: Date.now() - start
      };
      updateAnalysisPanel();
    }
    if (Date.now() - start > timeLimit) break;
  }
  return bestMove;
}

/* ═══════════════════════════════════
   PANNEAU D'ANALYSE
═══════════════════════════════════ */
function updateAnalysisPanel() {
  const scoreEl = document.getElementById('analysis-score');
  const depthEl = document.getElementById('analysis-depth');
  const nodesEl = document.getElementById('analysis-nodes');
  const timeEl  = document.getElementById('analysis-time');
  const moveEl  = document.getElementById('analysis-move');
  if (!scoreEl) return;

  const s = lastAnalysis.score;
  const pawnScore = (s / 100).toFixed(2);
  const sign = s > 0 ? '+' : '';
  scoreEl.textContent = sign + pawnScore;
  scoreEl.style.color = s > 50 ? '#4ade80' : s < -50 ? '#f87171' : '#e8c96d';
  if (depthEl) depthEl.textContent = lastAnalysis.depth;
  if (nodesEl) nodesEl.textContent = lastAnalysis.nodes > 999 ? (lastAnalysis.nodes/1000).toFixed(1)+'k' : lastAnalysis.nodes;
  if (timeEl)  timeEl.textContent  = lastAnalysis.timeMs + 'ms';
  if (moveEl)  moveEl.textContent  = lastAnalysis.bestMove || '—';
}

/* ═══════════════════════════════════
   EXPORT FEN / PGN
═══════════════════════════════════ */
function exportFEN() {
  if (G.mode !== CHESS) { alert('FEN disponible uniquement pour les échecs.'); return; }
  const pieces = { K:'K',Q:'Q',R:'R',B:'B',N:'N',P:'P' };
  let fen = '';
  for (let r=0; r<8; r++) {
    let empty=0;
    for (let c=0; c<8; c++) {
      const p = G.board[r*8+c];
      if (!p) { empty++; }
      else {
        if (empty) { fen+=empty; empty=0; }
        const ch = pieces[p.type]||'P';
        fen += p.color==='white' ? ch : ch.toLowerCase();
      }
    }
    if (empty) fen+=empty;
    if (r<7) fen+='/';
  }
  const turn = G.turn==='white'?'w':'b';
  let castle='';
  if (G.castling.wK) castle+='K'; if (G.castling.wRh) castle+='Q';
  if (G.castling.bK) castle+='k'; if (G.castling.bRh) castle+='q';
  if (!castle) castle='-';
  const ep = G.enPassant ? squareName(G.enPassant) : '-';
  fen += ` ${turn} ${castle} ${ep} 0 ${Math.ceil((G.moveList.length+1)/2)}`;
  navigator.clipboard.writeText(fen).then(()=>alert('FEN copié !\n'+fen)).catch(()=>prompt('FEN:',fen));
}

function exportPGN() {
  if (G.mode !== CHESS) { alert('PGN disponible uniquement pour les échecs.'); return; }
  let pgn = '[Event "Grist Widget Game"]\n';
  pgn += '[Date "'+new Date().toISOString().split('T')[0]+'"]\n';
  pgn += '[White "Blancs"]\n[Black "Noirs (IA)"]\n[Result "*"]\n\n';
  for (let i=0; i<G.moveList.length; i++) {
    if (i%2===0) pgn += (Math.floor(i/2)+1)+'. ';
    pgn += G.moveList[i]+' ';
  }
  pgn += '*';
  navigator.clipboard.writeText(pgn).then(()=>alert('PGN copié !')).catch(()=>prompt('PGN:',pgn));
}

/* ═══════════════════════════════════
   INTÉGRATION GRIST
═══════════════════════════════════ */
let gristAvailable = false;
let currentGameId = null;

async function initGrist() {
  if (typeof grist === 'undefined') return;
  try {
    grist.ready({ requiredAccess: 'full document' });
    await new Promise(r => setTimeout(r, 500));
    await ensureTables();
    gristAvailable = true;
    console.log('[Chess] Grist initialisé');
  } catch(e) {
    console.warn('[Chess] Grist non disponible:', e.message);
  }
}

async function ensureTables() {
  const tables = await grist.docApi.listTables().catch(()=>[]);
  const defs = {
    Games: [
      {id:'gameType',type:'Text'},{id:'startedAt',type:'DateTime'},
      {id:'finishedAt',type:'DateTime'},{id:'winner',type:'Text'},
      {id:'status',type:'Text'},{id:'currentTurn',type:'Text'},
      {id:'fen',type:'Text'},{id:'boardState',type:'Text'},{id:'moveCount',type:'Int'}
    ],
    Players: [
      {id:'name',type:'Text'},{id:'type',type:'Text'},
      {id:'elo',type:'Numeric'},{id:'wins',type:'Int'},
      {id:'losses',type:'Int'},{id:'draws',type:'Int'}
    ],
    Moves: [
      {id:'gameId',type:'Int'},{id:'moveIndex',type:'Int'},
      {id:'player',type:'Text'},{id:'fromSquare',type:'Text'},
      {id:'toSquare',type:'Text'},{id:'piece',type:'Text'},
      {id:'captured',type:'Text'},{id:'notation',type:'Text'},
      {id:'evaluation',type:'Numeric'},{id:'durationMs',type:'Numeric'},
      {id:'boardAfter',type:'Text'}
    ],
    AI_Analysis: [
      {id:'gameId',type:'Int'},{id:'depth',type:'Int'},
      {id:'evaluatedNodes',type:'Int'},{id:'bestMove',type:'Text'},
      {id:'score',type:'Numeric'},{id:'thinkingTime',type:'Numeric'}
    ]
  };
  for (const [name, cols] of Object.entries(defs)) {
    if (!tables.includes(name)) {
      await grist.docApi.applyUserActions([['AddTable', name, cols]]);
    }
  }
}

async function gristNewGame() {
  if (!gristAvailable) return;
  try {
    const result = await grist.docApi.applyUserActions([[
      'AddRecord', 'Games', null, {
        gameType: G.mode,
        startedAt: Math.floor(Date.now()/1000),
        status: 'playing',
        currentTurn: G.turn,
        moveCount: 0
      }
    ]]);
    currentGameId = result?.retValues?.[0] ?? null;
  } catch(e) { console.warn('[Chess] gristNewGame:', e.message); }
}

async function gristSaveMove(move, notation, evalScore, durationMs) {
  if (!gristAvailable || !currentGameId) return;
  try {
    const piece = G.board[move.to]; // board already updated
    const captured = move.capture ? (G.mode===CHESS ? (G.board[move.to]?.type||'') : 'piece') : '';
    await grist.docApi.applyUserActions([[
      'AddRecord', 'Moves', null, {
        gameId: currentGameId,
        moveIndex: G.history.length,
        player: G.turn === 'white' ? 'black' : 'white', // move already executed
        fromSquare: squareName(move.from),
        toSquare: squareName(move.to),
        piece: piece ? (piece.type||'P') : '',
        captured: captured,
        notation: notation,
        evaluation: evalScore || 0,
        durationMs: durationMs || 0,
        boardAfter: JSON.stringify(G.board.map(p => p ? (p.color[0]+(p.type||'p')) : null))
      }
    ]]);
    // Update game state
    await grist.docApi.applyUserActions([[
      'UpdateRecord', 'Games', currentGameId, {
        currentTurn: G.turn,
        moveCount: G.history.length,
        status: G.gameOver ? 'finished' : 'playing'
      }
    ]]);
  } catch(e) { console.warn('[Chess] gristSaveMove:', e.message); }
}

async function gristEndGame(winner) {
  if (!gristAvailable || !currentGameId) return;
  try {
    await grist.docApi.applyUserActions([[
      'UpdateRecord', 'Games', currentGameId, {
        finishedAt: Math.floor(Date.now()/1000),
        winner: winner,
        status: 'finished'
      }
    ]]);
  } catch(e) { console.warn('[Chess] gristEndGame:', e.message); }
}

/* ═══════════════════════════════════
   DRAG & DROP
═══════════════════════════════════ */
function getSquareUnderPointer(x, y) {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  if (el.classList.contains('square')) return el;
  return el.closest?.('.square') || null;
}

function highlightHoveredSquare(x, y) {
  document.querySelectorAll('.square.drag-hover').forEach(s => s.classList.remove('drag-hover'));
  const sq = getSquareUnderPointer(x, y);
  if (sq) {
    const idx = parseInt(sq.dataset.idx);
    const isLegal = G.legalMoves.some(m => m.to === idx);
    if (isLegal) sq.classList.add('drag-hover');
  }
}

function enableDragAndDrop(pieceEl, fromIndex) {
  if (G.gameOver) return;
  if (!G.board[fromIndex] || G.board[fromIndex].color !== G.turn) return;

  if (!isHumanTurn()) return;

  pieceEl.draggable = false;

  pieceEl.addEventListener('pointerdown', function startDrag(e) {
    if (G.gameOver) return;
    e.preventDefault();
    e.stopPropagation();

    // Select the piece to get legal moves
    selectPiece(fromIndex);
    if (!G.legalMoves.length) return;

    pieceEl.setPointerCapture(e.pointerId);
    pieceEl.classList.add('dragging');

    const rect = pieceEl.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    let dragMoved = false;

    function moveAt(x, y) {
      pieceEl.style.position = 'fixed';
      pieceEl.style.left = (x - offsetX) + 'px';
      pieceEl.style.top  = (y - offsetY) + 'px';
      pieceEl.style.zIndex = '9999';
      pieceEl.style.pointerEvents = 'none';
      pieceEl.style.transform = 'scale(1.15)';
      pieceEl.style.filter = 'drop-shadow(0 8px 20px rgba(0,0,0,0.8))';
    }
    moveAt(e.clientX, e.clientY);

    function onPointerMove(ev) {
      dragMoved = true;
      moveAt(ev.clientX, ev.clientY);
      highlightHoveredSquare(ev.clientX, ev.clientY);
    }

    async function onPointerUp(ev) {
      pieceEl.releasePointerCapture(ev.pointerId);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);

      pieceEl.removeAttribute('style');
      pieceEl.classList.remove('dragging');
      document.querySelectorAll('.square.drag-hover').forEach(s => s.classList.remove('drag-hover'));

      if (!dragMoved) return; // click handled separately

      const targetSq = getSquareUnderPointer(ev.clientX, ev.clientY);
      if (!targetSq) { deselectPiece(); return; }

      const toIndex = parseInt(targetSq.dataset.idx);
      const move = G.legalMoves.find(m => m.to === toIndex);
      if (move) {
        executeMove(move);
      } else {
        deselectPiece();
      }
    }

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  }, { once: true });
}

/* ═══════════════════════════════════
   RENDU DU PLATEAU
═══════════════════════════════════ */
function renderBoard() {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML='';

  const lastMove = G.history[G.history.length-1];

  for (let display=0; display<64; display++) {
    const idx = G.flipped ? 63-display : display;
    const r=row(idx), c=col(idx);
    const isLight=(r+c)%2===0;

    const sq=document.createElement('div');
    sq.className='square '+(isLight?'light':'dark');
    sq.dataset.idx=idx;

    // Highlight derniers coups
    if (lastMove) {
      if (idx===lastMove.from) sq.classList.add('last-from');
      if (idx===lastMove.to)   sq.classList.add('last-to');
    }
    // Sélection
    if (G.selected===idx) sq.classList.add('selected');

    // Coups légaux disponibles
    const isLegal = G.legalMoves.some(m=>m.to===idx);
    if (isLegal) {
      if (G.board[idx]) {
        sq.classList.add('capturable','clickable');
        const ring=document.createElement('div');
        ring.className='capture-ring';
        sq.appendChild(ring);
      } else {
        sq.classList.add('clickable');
        const dot=document.createElement('div');
        dot.className='move-dot';
        sq.appendChild(dot);
      }
    } else if (G.board[idx]?.color===G.turn && !G.gameOver) {
      sq.classList.add('clickable');
    }

    // Mise en échec du roi
    if (G.mode===CHESS && G.inCheck) {
      const p=G.board[idx];
      if (p?.type==='K' && p?.color===G.turn) sq.classList.add('in-check');
    }

    // Pièce
    const piece=G.board[idx];
    if (piece) {
      const pieceEl = createPieceEl(piece, idx);
      sq.appendChild(pieceEl);
      // Enable drag & drop on the piece element
      enableDragAndDrop(pieceEl, idx);
    }

    sq.addEventListener('click', ()=>handleSquareClick(idx));
    boardEl.appendChild(sq);
  }

  renderCoords();
  updateUI();
}

function createPieceEl(piece, idx) {
  if (G.mode===CHESS) {
    const el=document.createElement('div');
    el.className='piece '+(piece.color===WHITE?'white-piece':'black-piece');
    if (G.selected===idx) el.classList.add('selected-piece');
    const key=(piece.color===WHITE?'w':'b')+piece.type;
    el.textContent=CHESS_PIECES[key]||'?';
    return el;
  } else {
    const el=document.createElement('div');
    el.className='checker '+(piece.color===WHITE?'white-checker':'black-checker');
    if (G.selected===idx) el.classList.add('selected-piece');
    if (piece.king) {
      const crown=document.createElement('span');
      crown.className='checker-crown';
      crown.textContent='♛';
      el.appendChild(crown);
    }
    return el;
  }
}

function renderCoords() {
  const files = G.flipped ? 'hgfedcba' : 'abcdefgh';
  const ranks = G.flipped ? '12345678' : '87654321';

  const setCoords = (id, arr, cls, makeFn) => {
    const el=document.getElementById(id); if(!el) return;
    el.innerHTML='';
    arr.split('').forEach(ch=>{
      const d=document.createElement('div');
      d.className=cls+' coord-label';
      d.textContent=ch;
      makeFn(d);
      el.appendChild(d);
    });
  };

  setCoords('top-coords',    files, 'coord-h', ()=>{});
  setCoords('bottom-coords', files, 'coord-h', ()=>{});
  setCoords('left-coords',   ranks, 'coord-v', ()=>{});
  setCoords('right-coords',  ranks, 'coord-v', ()=>{});
}

/* ═══════════════════════════════════
   MISE À JOUR DE L'INTERFACE
═══════════════════════════════════ */
function updateUI() {
  // Tour actif
  document.getElementById('row-white').classList.toggle('active-player', G.turn===WHITE);
  document.getElementById('row-black').classList.toggle('active-player', G.turn===BLACK);

  // Statut
  let statusMsg='';
  if (G.gameOver) {
    statusMsg = '<strong>Partie terminée</strong>';
  } else if (G.inCheck && G.mode===CHESS) {
    statusMsg = `<strong>ÉCHEC</strong> au roi ${G.turn===WHITE?'blanc':'noir'} !`;
  } else {
    const who = G.turn===WHITE ? 'Blancs' : 'Noirs';
    statusMsg = `<strong>${who}</strong> jouent.`;
    if (G.mustCaptureFrom!==null && G.mode===CHECKERS)
      statusMsg += '<br><em>Capture multiple obligatoire.</em>';
  }
  document.getElementById('status-text').innerHTML=statusMsg;

  // Pièces capturées
  renderCaptured();
  // Historique
  renderMoveHistory();
}

function renderCaptured() {
  const wEl=document.getElementById('captured-white');
  const bEl=document.getElementById('captured-black');
  wEl.innerHTML = G.capturedWhite.map(p=>{
    const k=(p.color==='white'?'w':'b')+p.type;
    return `<span style="font-size:1.2rem;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.7))">${CHESS_PIECES[k]||'●'}</span>`;
  }).join('');
  bEl.innerHTML = G.capturedBlack.map(p=>{
    const k=(p.color==='white'?'w':'b')+p.type;
    return `<span style="font-size:1.2rem;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.7))">${CHESS_PIECES[k]||'●'}</span>`;
  }).join('');
}

function renderMoveHistory() {
  const el=document.getElementById('move-history');
  const list=G.moveList;
  let html='';
  for (let i=0; i<list.length; i+=2) {
    const num=Math.floor(i/2)+1;
    html+=`<div class="move-entry"><span class="move-num">${num}.</span><span class="move-w">${list[i]||''}</span><span class="move-b">${list[i+1]||''}</span></div>`;
  }
  el.innerHTML=html;
  el.scrollTop=el.scrollHeight;
}

/* ═══════════════════════════════════
   GESTION DES CLICS
═══════════════════════════════════ */
function handleSquareClick(idx) {
  if (G.gameOver) return;
  if (!isHumanTurn()) return;

  const piece=G.board[idx];

  // Si une pièce est déjà sélectionnée
  if (G.selected!==null) {
    const move=G.legalMoves.find(m=>m.to===idx);
    if (move) {
      executeMove(move);
      return;
    }
    // Re-sélection
    if (piece?.color===G.turn) {
      selectPiece(idx);
      return;
    }
    deselectPiece();
    return;
  }

  if (!piece || piece.color!==G.turn) return;
  selectPiece(idx);
}

function selectPiece(idx) {
  G.selected=idx;
  if (G.mode===CHESS) {
    G.legalMoves=legalChessMoves(G.board, G.turn, G.castling, G.enPassant)
      .filter(m=>m.from===idx);
  } else {
    const all=checkersMoves(G.board, G.turn, G.mustCaptureFrom);
    const hasCapture=all.some(m=>m.captured!==undefined);
    G.legalMoves=all.filter(m=>{
      if (m.from!==idx) return false;
      if (hasCapture && m.captured===undefined) return false;
      return true;
    });
  }
  renderBoard();
}

function deselectPiece() {
  G.selected=null;
  G.legalMoves=[];
  renderBoard();
}

/* ═══════════════════════════════════
   EXÉCUTION D'UN COUP
═══════════════════════════════════ */
function executeMove(move, promoteType=null) {
  const piece={...G.board[move.from]};

  // Promotion — demander si humain
  if (G.mode===CHESS && move.promote && !promoteType) {
    showPromotionModal(move);
    return;
  }
  promoteType = promoteType||'Q';

  // Sauvegarder pour annulation
  G.history.push({
    from:move.from, to:move.to,
    piece:{...piece},
    captured: G.board[move.to] ? {...G.board[move.to]} : null,
    special: {...move},
    boardBefore: cloneBoard(G.board),
    castlingBefore: {...G.castling},
    enPassantBefore: G.enPassant,
    capturedWhiteBefore: [...G.capturedWhite],
    capturedBlackBefore: [...G.capturedBlack],
    mustCaptureBefore: G.mustCaptureFrom,
  });

  if (G.mode===CHESS) {
    // Capturer la pièce
    if (G.board[move.to]) {
      const cap={...G.board[move.to]};
      if (cap.color===WHITE) G.capturedWhite.push(cap);
      else                   G.capturedBlack.push(cap);
    }
    if (move.enpassant) {
      const epRow=row(move.to)+(piece.color===WHITE?1:-1);
      const capIdx=rc(epRow, col(move.to));
      G.capturedBlack.push({...G.board[capIdx]});
      // (la suppression se fait dans applyChessMove)
    }
    const result=applyChessMove(G.board, move, G.castling, G.enPassant, promoteType);
    G.board=result.board;
    G.castling=result.castling;
    G.enPassant=result.enPassant;

    // Notation
    const notation=moveNotation(move, piece, G.board);
    G.moveList.push(notation);

    // Changer de tour
    G.turn=opponent(G.turn);
    G.selected=null; G.legalMoves=[];

    // Vérifier état
    const legal=legalChessMoves(G.board, G.turn, G.castling, G.enPassant);
    G.inCheck=isInCheck(G.board, G.turn);
    if (legal.length===0) {
      // Persist to Grist before ending
      const movNotation = G.moveList[G.moveList.length-1] || '';
      gristSaveMove(move, movNotation, lastAnalysis.score, 0);
      if (G.inCheck) endGame(opponent(G.turn)+' gagne par échec et mat !');
      else            endGame('Pat — Match nul !');
      renderBoard();
      return;
    }

  } else {
    // Dames
    if (move.captured!==undefined) {
      const cap={...G.board[move.captured]};
      if (cap.color===WHITE) G.capturedWhite.push(cap);
      else                   G.capturedBlack.push(cap);
      G.board[move.captured]=null;
    }
    G.board[move.to]=G.board[move.from];
    G.board[move.from]=null;
    const p=G.board[move.to];
    if (p.color===WHITE && row(move.to)===0) p.king=true;
    if (p.color===BLACK && row(move.to)===7) p.king=true;

    const notation=squareName(move.from)+'-'+squareName(move.to);
    G.moveList.push(notation);

    // Multi-capture
    G.mustCaptureFrom=null;
    if (move.captured!==undefined) {
      const further=checkersMoves(G.board, G.turn, move.to);
      if (further.some(f=>f.captured!==undefined)) {
        G.mustCaptureFrom=move.to;
        G.selected=move.to;
        G.legalMoves=further.filter(f=>f.captured!==undefined);
        renderBoard();
        scheduleAI();
        return;
      }
    }

    G.turn=opponent(G.turn);
    G.selected=null; G.legalMoves=[];

    // Vérifier fin de partie
    const oMoves=checkersMoves(G.board, G.turn);
    if (!oMoves.length) {
      const movNotation = G.moveList[G.moveList.length-1] || '';
      gristSaveMove(move, movNotation, lastAnalysis.score, 0);
      endGame((opponent(G.turn)===WHITE?'Blancs':'Noirs')+' gagnent !');
      renderBoard();
      return;
    }
  }

  // Persist to Grist (async, non-blocking)
  const movNotation = G.moveList[G.moveList.length-1] || '';
  gristSaveMove(move, movNotation, lastAnalysis.score, 0);

  renderBoard();
  scheduleAI();
}

/* ═══════════════════════════════════
   TOUR DE L'IA
═══════════════════════════════════ */
let aiTimer=null;
function scheduleAI() {
  if (G.gameOver) return;
  if (isHumanTurn()) return;

  document.getElementById('ai-thinking').classList.add('visible');
  clearTimeout(aiTimer);
  aiTimer=setTimeout(runAI, 80);
}

function runAI() {
  if (G.gameOver) { document.getElementById('ai-thinking').classList.remove('visible'); return; }
  const depth=parseInt(document.getElementById('ai-depth').value)||3;

  const best=getBestMove(G.board, G.turn, depth, G.castling, G.enPassant, G.mustCaptureFrom);
  document.getElementById('ai-thinking').classList.remove('visible');
  if (!best) return;
  executeMove(best,'Q');
}

/* ═══════════════════════════════════
   CONSEIL IA
═══════════════════════════════════ */
function getHint() {
  if (G.gameOver) return;
  const depth=Math.min(parseInt(document.getElementById('ai-depth').value)||3, 3);
  const hint=getBestMove(G.board, G.turn, depth, G.castling, G.enPassant, G.mustCaptureFrom);
  const hintEl=document.getElementById('hint-text');
  if (!hint) { hintEl.textContent='Aucun coup disponible.'; return; }

  const p=G.board[hint.from];
  let msg='';
  if (G.mode===CHESS) {
    msg=`<strong>${squareName(hint.from)} → ${squareName(hint.to)}</strong>`;
    if (p) msg+=`<br><em>${{K:'Roi',Q:'Dame',R:'Tour',B:'Fou',N:'Cavalier',P:'Pion'}[p.type]}</em>`;
    if (hint.capture) msg+=' · <em>Capture !</em>';
    if (hint.castle)  msg+=' · <em>Roque</em>';
  } else {
    msg=`<strong>${squareName(hint.from)} → ${squareName(hint.to)}</strong>`;
    if (hint.captured!==undefined) msg+=' · <em>Capture !</em>';
  }
  hintEl.innerHTML=msg;
}

/* ═══════════════════════════════════
   PROMOTION
═══════════════════════════════════ */
function showPromotionModal(move) {
  const modal=document.getElementById('promo-modal');
  const choices=document.getElementById('promo-choices');
  const color=G.board[move.from].color;
  const types=['Q','R','B','N'];
  choices.innerHTML='';
  types.forEach(t=>{
    const el=document.createElement('div');
    el.className='promo-piece '+(color===WHITE?'white-piece':'black-piece');
    el.textContent=CHESS_PIECES[(color===WHITE?'w':'b')+t];
    el.title={Q:'Dame',R:'Tour',B:'Fou',N:'Cavalier'}[t];
    el.onclick=()=>{
      modal.style.display='none';
      executeMove(move,t);
    };
    choices.appendChild(el);
  });
  modal.style.display='flex';
}

/* ═══════════════════════════════════
   FIN DE PARTIE
═══════════════════════════════════ */
function endGame(msg) {
  G.gameOver=true;
  // Incrémenter score
  if (msg.includes('Blancs') || msg.includes('white')) G.scores.white++;
  if (msg.includes('Noirs')  || msg.includes('black')) G.scores.black++;
  document.getElementById('score-white').textContent=G.scores.white;
  document.getElementById('score-black').textContent=G.scores.black;

  const banner=document.getElementById('game-over-banner');
  banner.textContent='✦ '+msg+' ✦';
  banner.classList.add('visible');
  document.getElementById('status-text').innerHTML='<strong>Partie terminée</strong>';

  // Extract winner label
  let winner = 'draw';
  if (msg.includes('Blancs') || msg.includes('white')) winner = 'white';
  if (msg.includes('Noirs')  || msg.includes('black')) winner = 'black';
  gristEndGame(winner);
}

/* ═══════════════════════════════════
   CONTRÔLES UTILISATEUR
═══════════════════════════════════ */
function updatePlayerLabels() {
  const playMode = document.getElementById('play-mode').value;
  const human = humanSide();
  const nameW = document.getElementById('name-white');
  const nameB = document.getElementById('name-black');
  if (!nameW || !nameB) return;
  if (playMode === 'human-ai') {
    nameW.textContent = human === WHITE ? 'Blancs' : 'Blancs (IA)';
    nameB.textContent = human === BLACK ? 'Noirs' : 'Noirs (IA)';
  } else if (playMode === 'ai-ai') {
    nameW.textContent = 'Blancs (IA)';
    nameB.textContent = 'Noirs (IA)';
  } else {
    nameW.textContent = 'Blancs';
    nameB.textContent = 'Noirs';
  }
}

function newGame() {
  clearTimeout(aiTimer);
  _abortSearch=true;
  const scores={...G.scores};
  G=createState(G.mode);
  G.scores=scores;
  // Auto-flip : si le joueur humain joue les noirs, retourner le plateau
  const playMode = document.getElementById('play-mode').value;
  if (playMode === 'human-ai' && humanSide() === BLACK) {
    G.flipped = true;
  }
  updatePlayerLabels();
  // Clear TT and history heuristic
  TT.clear();
  Object.keys(histHeuristic).forEach(k => delete histHeuristic[k]);
  document.getElementById('score-white').textContent=scores.white;
  document.getElementById('score-black').textContent=scores.black;
  document.getElementById('game-over-banner').classList.remove('visible');
  document.getElementById('hint-text').textContent='Appuyez sur Conseil pour une suggestion.';
  renderBoard();
  gristNewGame();
  scheduleAI();
}

function undoMove() {
  if (!G.history.length) return;
  const last=G.history.pop();
  G.board=last.boardBefore;
  G.castling=last.castlingBefore;
  G.enPassant=last.enPassantBefore;
  G.capturedWhite=last.capturedWhiteBefore;
  G.capturedBlack=last.capturedBlackBefore;
  G.mustCaptureFrom=last.mustCaptureBefore;
  G.turn=opponent(G.turn);
  G.selected=null; G.legalMoves=[];
  G.moveList.pop();
  G.gameOver=false;
  G.inCheck=isInCheck(G.board, G.turn);
  document.getElementById('game-over-banner').classList.remove('visible');

  // Si on annule le coup de l'IA aussi
  // Annuler aussi le coup de l'IA si le joueur revient à son tour
  const playMode=document.getElementById('play-mode').value;
  if (playMode==='human-ai' && G.history.length && G.turn===humanSide()) {
    const prev=G.history.pop();
    G.board=prev.boardBefore;
    G.castling=prev.castlingBefore;
    G.enPassant=prev.enPassantBefore;
    G.capturedWhite=prev.capturedWhiteBefore;
    G.capturedBlack=prev.capturedBlackBefore;
    G.turn=humanSide();
    G.moveList.pop();
    G.inCheck=isInCheck(G.board, G.turn);
  }
  renderBoard();
}

function flipBoard() {
  G.flipped=!G.flipped;
  renderBoard();
}

function resignGame() {
  if (G.gameOver) return;
  endGame((G.turn===WHITE?'Noirs':'Blancs')+' gagnent par abandon !');
  renderBoard();
}

function switchGame(mode) {
  clearTimeout(aiTimer);
  _abortSearch=true;
  const scores={...G.scores};
  G=createState(mode);
  G.scores=scores;
  // Clear TT and history heuristic
  TT.clear();
  Object.keys(histHeuristic).forEach(k => delete histHeuristic[k]);

  document.getElementById('btn-chess').classList.toggle('active',    mode===CHESS);
  document.getElementById('btn-checkers').classList.toggle('active', mode===CHECKERS);
  document.body.className='mode-'+mode;
  document.getElementById('game-over-banner').classList.remove('visible');
  document.getElementById('hint-text').textContent='Appuyez sur Conseil pour une suggestion.';

  // Adapter les icônes joueurs
  document.querySelector('#row-white .player-icon').textContent = mode===CHESS ? '♔' : '⬤';
  document.querySelector('#row-black .player-icon').textContent = mode===CHESS ? '♚' : '⬤';

  renderBoard();
  gristNewGame();
  scheduleAI();
}

/* ═══════════════════════════════════
   DÉMARRAGE
═══════════════════════════════════ */
G = createState(CHESS);
renderBoard();
initGrist().then(() => gristNewGame());
