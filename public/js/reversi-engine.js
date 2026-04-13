/**
 * Port of the provided C reversi bot. Gaming logic matches the original;
 * only I/O and time APIs are adapted for the browser.
 *
 * C time: gettimeofday → performance.now()
 */

export const N = 26;
export const INF = 999999;

let searchStartTime = 0;
let timeLimit = 0.93;
let searchEnd = false;

function getTimeElapsed() {
  return (performance.now() - searchStartTime) / 1000;
}

export function boardInit(board, n) {
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      board[i][j] = "U";
    }
  }
  const mid = Math.floor(n / 2);
  board[mid - 1][mid - 1] = "W";
  board[mid - 1][mid] = "B";
  board[mid][mid - 1] = "B";
  board[mid][mid] = "W";
}

export function positionInBounds(n, row, col) {
  return row >= 0 && row < n && col >= 0 && col < n;
}

export function checkLegalInDirection(board, n, row, col, colour, deltaRow, deltaCol) {
  const other = colour === "W" ? "B" : "W";
  let foundOther = false;
  for (let num = 1; num < n; num++) {
    const nr = row + num * deltaRow;
    const nc = col + num * deltaCol;
    if (!positionInBounds(n, nr, nc)) {
      break;
    }
    if (board[nr][nc] === other) {
      foundOther = true;
    } else if (board[nr][nc] === colour) {
      if (foundOther) {
        return true;
      }
      break;
    } else {
      break;
    }
  }
  return false;
}

export function isValid(board, n, row, col, player) {
  const deltaRows = [0, 1, 1, 1, 0, -1, -1, -1];
  const deltaCols = [1, 1, 0, -1, -1, -1, 0, 1];
  if (!positionInBounds(n, row, col) || board[row][col] !== "U") {
    return false;
  }
  for (let i = 0; i < 8; i++) {
    if (checkLegalInDirection(board, n, row, col, player, deltaRows[i], deltaCols[i])) {
      return true;
    }
  }
  return false;
}

export function hasValidMove(board, n, player) {
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (isValid(board, n, r, c, player)) return true;
    }
  }
  return false;
}

export function copyBoard(src, dest, n) {
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      dest[r][c] = src[r][c];
    }
  }
}

export function placeDotSimulation(board, n, row, col, player) {
  const deltaRows = [0, 1, 1, 1, 0, -1, -1, -1];
  const deltaCols = [1, 1, 0, -1, -1, -1, 0, 1];
  const other = player === "W" ? "B" : "W";
  board[row][col] = player;
  for (let i = 0; i < 8; i++) {
    if (checkLegalInDirection(board, n, row, col, player, deltaRows[i], deltaCols[i])) {
      for (let num = 1; num < n; num++) {
        const nr = row + num * deltaRows[i];
        const nc = col + num * deltaCols[i];
        if (board[nr][nc] === other) {
          board[nr][nc] = player;
        } else {
          break;
        }
      }
    }
  }
}

export function placeDot(board, n, row, col, player) {
  placeDotSimulation(board, n, row, col, player);
}

/** Same behavior as C: inner block returns 100 on corners, else 1; remainder of C function is unreachable. */
export function getPositionWeight(n, row, col, board, player) {
  void board;
  void player;
  {
    if ((row === 0 || row === n - 1) && (col === 0 || col === n - 1)) return 100;
    return 1;
  }
}

export function evaluateBoard(board, n, botPlayer) {
  const userPlayer = botPlayer === "W" ? "B" : "W";
  let myPieces = 0;
  let oppPieces = 0;
  let emptyCount = 0;
  let positionalScore = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (board[r][c] === botPlayer) {
        myPieces++;
        positionalScore += getPositionWeight(n, r, c, board, botPlayer);
      } else if (board[r][c] === userPlayer) {
        oppPieces++;
        positionalScore -= getPositionWeight(n, r, c, board, userPlayer);
      } else {
        emptyCount++;
      }
    }
  }
  let myValidMoves = 0;
  let oppValidMoves = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (isValid(board, n, r, c, botPlayer)) myValidMoves++;
      if (isValid(board, n, r, c, userPlayer)) oppValidMoves++;
    }
  }
  let finalScore = 0;
  /* C integer division */
  if (emptyCount > Math.floor((n * n * 2) / 3)) {
    finalScore = 50 * (myValidMoves - oppValidMoves) + 10 * positionalScore - 15 * (myPieces - oppPieces);
  } else if (emptyCount > Math.floor((n * n) / 4)) {
    finalScore = 40 * (myValidMoves - oppValidMoves) + 30 * positionalScore + 0 * (myPieces - oppPieces);
  } else {
    finalScore = 100 * (myPieces - oppPieces) + 10 * positionalScore + 10 * (myValidMoves - oppValidMoves);
  }
  return finalScore;
}

export function maxLevel(board, n, currentPlayer, botPlayer, depth, alpha, beta) {
  if (getTimeElapsed() >= timeLimit) {
    searchEnd = true;
    return evaluateBoard(board, n, botPlayer);
  }
  const nextPlayer = currentPlayer === "W" ? "B" : "W";
  let best = -INF;
  if (depth === 0) {
    return evaluateBoard(board, n, botPlayer);
  }
  if (!hasValidMove(board, n, currentPlayer)) {
    if (!hasValidMove(board, n, nextPlayer)) {
      return evaluateBoard(board, n, botPlayer);
    }
    return minLevel(board, n, nextPlayer, botPlayer, depth, alpha, beta);
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (!isValid(board, n, i, j, currentPlayer)) continue;
      const nextBoard = allocBoard26();
      copyBoard(board, nextBoard, n);
      placeDotSimulation(nextBoard, n, i, j, currentPlayer);
      const score = minLevel(nextBoard, n, nextPlayer, botPlayer, depth - 1, alpha, beta);
      if (searchEnd) return best;
      if (score > best) best = score;
      if (best > alpha) alpha = best;
      if (alpha >= beta) return best;
    }
  }
  return best;
}

export function minLevel(board, n, currentPlayer, botPlayer, depth, alpha, beta) {
  if (getTimeElapsed() >= timeLimit) {
    searchEnd = true;
    return evaluateBoard(board, n, botPlayer);
  }
  const nextPlayer = currentPlayer === "W" ? "B" : "W";
  let worst = INF;
  if (depth === 0) {
    return evaluateBoard(board, n, botPlayer);
  }
  if (!hasValidMove(board, n, currentPlayer)) {
    if (!hasValidMove(board, n, nextPlayer)) {
      return evaluateBoard(board, n, botPlayer);
    }
    return maxLevel(board, n, nextPlayer, botPlayer, depth, alpha, beta);
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (!isValid(board, n, i, j, currentPlayer)) continue;
      const nextBoard = allocBoard26();
      copyBoard(board, nextBoard, n);
      placeDotSimulation(nextBoard, n, i, j, currentPlayer);
      const score = maxLevel(nextBoard, n, nextPlayer, botPlayer, depth - 1, alpha, beta);
      if (searchEnd) return worst;
      if (score < worst) worst = score;
      if (worst < beta) beta = worst;
      if (alpha >= beta) return worst;
    }
  }
  return worst;
}

function allocBoard26() {
  const b = new Array(26);
  for (let i = 0; i < 26; i++) {
    b[i] = new Array(26).fill("U");
  }
  return b;
}

export function makeMove(board, n, current, rowCol) {
  searchStartTime = performance.now();
  searchEnd = false;
  let bestScore = -INF;
  let bestRow = -1;
  let bestCol = -1;
  const maxDepth = n * n;
  const opponent = current === "W" ? "B" : "W";
  for (let depth = 1; depth <= maxDepth; depth++) {
    let currentBestRow = -1;
    let currentBestCol = -1;
    let currentBestScore = -INF;
    searchEnd = false;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (isValid(board, n, r, c, current)) {
          const nextBoard = allocBoard26();
          copyBoard(board, nextBoard, n);
          placeDotSimulation(nextBoard, n, r, c, current);
          const moveScore = minLevel(nextBoard, n, opponent, current, depth - 1, -INF, INF);
          if (moveScore > currentBestScore) {
            currentBestScore = moveScore;
            currentBestRow = r;
            currentBestCol = c;
          }
        }
        if (searchEnd) break;
      }
      if (searchEnd) break;
    }
    if (!searchEnd) {
      bestScore = currentBestScore;
      bestRow = currentBestRow;
      bestCol = currentBestCol;
    } else {
      break;
    }
    if (getTimeElapsed() >= timeLimit * 0.9) break;
  }
  rowCol.row = bestRow;
  rowCol.col = bestCol;
  return 0;
}

export function availableMove(board, n, player) {
  const pairs = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (isValid(board, n, i, j, player)) {
        pairs.push(String.fromCharCode(97 + i) + String.fromCharCode(97 + j));
      }
    }
  }
  return pairs.join("");
}

export function createBoard26() {
  return allocBoard26();
}

export function countStones(board, n) {
  let bCount = 0;
  let wCount = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (board[i][j] === "B") bCount++;
      else if (board[i][j] === "W") wCount++;
    }
  }
  return { bCount, wCount };
}
