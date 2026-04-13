import {
  boardInit,
  createBoard26,
  isValid,
  hasValidMove,
  placeDot,
  makeMove,
  countStones,
  availableMove
} from "./reversi-engine.js";

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function buildBoardGrid(root, n, onCell) {
  root.innerHTML = "";
  root.style.setProperty("--reversi-n", String(n));
  root.className = "reversi-board-grid";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const cell = el("button", "reversi-cell", "");
      cell.type = "button";
      cell.dataset.r = String(r);
      cell.dataset.c = String(c);
      cell.setAttribute(
        "aria-label",
        `Cell ${String.fromCharCode(97 + r)}${String.fromCharCode(97 + c)}`
      );
      cell.addEventListener("click", () => onCell(r, c));
      root.appendChild(cell);
    }
  }
}

function renderPieces(root, board, n) {
  const cells = root.querySelectorAll(".reversi-cell");
  let i = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const cell = cells[i++];
      cell.innerHTML = "";
      const ch = board[r][c];
      if (ch === "B" || ch === "W") {
        const disc = el(
          "span",
          `reversi-disc reversi-disc--${ch === "B" ? "black" : "white"}`
        );
        cell.appendChild(disc);
      }
    }
  }
}

export function mountReversiGadget(container) {
  const board = createBoard26();
  let n = 8;
  let botPlay = "B";
  let userPlay = "W";
  let waitingUser = false;
  let gameOver = false;
  let gameStarted = false;

  const win = el("div", "gadget-window bento reveal");
  win.style.setProperty("--d", "0.18s");

  const titlebar = el("div", "gadget-titlebar");
  titlebar.appendChild(el("span", "gadget-dots", "●●●"));

  const body = el("div", "gadget-body");

  const toolbar = el("div", "reversi-toolbar");
  const sizeLabel = el("label", "reversi-field");
  sizeLabel.appendChild(document.createTextNode("Size "));
  const sizeSel = el("select", "reversi-select");
  [6, 8, 10].forEach((s) => {
    const o = el("option", "", String(s));
    o.value = String(s);
    if (s === 8) o.selected = true;
    sizeSel.appendChild(o);
  });
  sizeLabel.appendChild(sizeSel);

  const colorLabel = el("label", "reversi-field");
  colorLabel.appendChild(document.createTextNode("Bot "));
  const colorSel = el("select", "reversi-select");
  [["B", "Black (first)"], ["W", "White"]].forEach(([v, t]) => {
    const o = el("option", "", t);
    o.value = v;
    if (v === "B") o.selected = true;
    colorSel.appendChild(o);
  });
  colorLabel.appendChild(colorSel);

  const newBtn = el("button", "reversi-new", "New game");
  newBtn.type = "button";
  const startBtn = el("button", "reversi-start", "Start");
  startBtn.type = "button";
  toolbar.appendChild(sizeLabel);
  toolbar.appendChild(colorLabel);
  toolbar.appendChild(newBtn);
  toolbar.appendChild(startBtn);

  const status = el("p", "reversi-status", "");
  const gridRoot = el("div", "reversi-board-wrap");

  body.appendChild(toolbar);
  body.appendChild(gridRoot);
  body.appendChild(status);

  win.appendChild(titlebar);
  win.appendChild(body);
  container.appendChild(win);

  function setStatus(t) {
    status.textContent = t;
  }

  function syncToolbarDisabled(dis) {
    sizeSel.disabled = dis;
    colorSel.disabled = dis;
  }

  function endGame() {
    gameOver = true;
    waitingUser = false;
    syncToolbarDisabled(false);
    const { bCount, wCount } = countStones(board, n);
    if (bCount > wCount) {
      setStatus(`Game over — Black ${bCount}, White ${wCount}. Black wins.`);
    } else if (wCount > bCount) {
      setStatus(`Game over — Black ${bCount}, White ${wCount}. White wins.`);
    } else {
      setStatus(`Game over — Draw (${bCount} each).`);
    }
  }

  function botMakeMove() {
    const rc = { row: -1, col: -1 };
    makeMove(board, n, botPlay, rc);
    if (rc.row !== -1 && rc.col !== -1) {
      placeDot(board, n, rc.row, rc.col, botPlay);
      setStatus(
        `Computer places ${botPlay} at ${String.fromCharCode(97 + rc.row)}${String.fromCharCode(97 + rc.col)}.`
      );
    } else {
      setStatus(`${botPlay} player has no valid move.`);
    }
    renderPieces(gridRoot, board, n);
  }

  /** Top of C while (1): get moves; if both empty break; user phase; recalc; if both empty break; bot phase. */
  function loopTop() {
    if (gameOver) return;

    let botMoves = availableMove(board, n, botPlay);
    let userMoves = availableMove(board, n, userPlay);

    if (botMoves.length === 0 && userMoves.length === 0) {
      endGame();
      return;
    }

    /* --- User's turn --- */
    if (userMoves.length > 0) {
      waitingUser = true;
      setStatus(`Your turn — ${userPlay}. Click a legal square.`);
      return;
    }

    waitingUser = false;
    setStatus(`${userPlay} player has no valid move.`);

    botMoves = availableMove(board, n, botPlay);
    userMoves = availableMove(board, n, userPlay);

    if (botMoves.length === 0 && userMoves.length === 0) {
      endGame();
      return;
    }

    runBotPhase();
  }

  function runBotPhase() {
    if (gameOver) return;
    const botMoves = availableMove(board, n, botPlay);
    if (botMoves.length > 0) {
      syncToolbarDisabled(true);
      setStatus("Bot is thinking…");
      setTimeout(() => {
        if (gameOver) return;
        botMakeMove();
        syncToolbarDisabled(false);
        loopTop();
      }, 30);
    } else {
      setStatus(`${botPlay} player has no valid move.`);
      setTimeout(() => loopTop(), 0);
    }
  }

  function onCell(r, c) {
    if (gameOver || !waitingUser || !gameStarted) return;
    if (!isValid(board, n, r, c, userPlay)) {
      setStatus(`Not a legal move — try another square. (${userPlay}'s turn.)`);
      return;
    }

    placeDot(board, n, r, c, userPlay);
    renderPieces(gridRoot, board, n);
    waitingUser = false;

    let botMoves = availableMove(board, n, botPlay);
    let userMoves = availableMove(board, n, userPlay);

    if (botMoves.length === 0 && userMoves.length === 0) {
      endGame();
      return;
    }

    runBotPhase();
  }

  function newGame() {
    gameOver = false;
    waitingUser = false;
    gameStarted = false;
    n = parseInt(sizeSel.value, 10);
    botPlay = colorSel.value;
    userPlay = botPlay === "B" ? "W" : "B";
    boardInit(board, n);
    buildBoardGrid(gridRoot, n, onCell);
    renderPieces(gridRoot, board, n);
    syncToolbarDisabled(false);
    startBtn.disabled = false;
    setStatus("Click Start to begin.");
  }

  function startGame() {
    if (gameStarted || gameOver) return;
    gameStarted = true;
    startBtn.disabled = true;

    /* C: If bot is Black, it moves first (outside the while loop). */
    if (botPlay === "B") {
      syncToolbarDisabled(true);
      setStatus("Bot is thinking…");
      setTimeout(() => {
        if (gameOver) return;
        botMakeMove();
        syncToolbarDisabled(false);
        loopTop();
      }, 30);
    } else {
      loopTop();
    }
  }

  newBtn.addEventListener("click", newGame);
  startBtn.addEventListener("click", startGame);
  sizeSel.addEventListener("change", newGame);
  colorSel.addEventListener("change", newGame);

  newGame();
}
