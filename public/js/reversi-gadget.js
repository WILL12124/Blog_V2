import {
  boardInit,
  createBoard26,
  isValid,
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
      cell.classList.remove("reversi-cell--hint");
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

function renderHints(root, board, n, player) {
  const cells = root.querySelectorAll(".reversi-cell");
  let i = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const cell = cells[i++];
      if (board[r][c] === "U" && isValid(board, n, r, c, player)) {
        cell.classList.add("reversi-cell--hint");
        const dot = el("span", "reversi-hint-dot");
        cell.appendChild(dot);
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
        `Bot places at ${String.fromCharCode(97 + rc.row)}${String.fromCharCode(97 + rc.col)}.`
      );
    }
    renderPieces(gridRoot, board, n);
  }

  // After bot moves, check if user can move. If not → game over.
  function loopTop() {
    if (gameOver) return;
    const userMoves = availableMove(board, n, userPlay);
    if (userMoves.length === 0) {
      endGame();
      return;
    }
    waitingUser = true;
    setStatus(`Your turn. Click a highlighted square.`);
    renderHints(gridRoot, board, n, userPlay);
  }

  function runBotPhase() {
    if (gameOver) return;
    const botMoves = availableMove(board, n, botPlay);
    if (botMoves.length === 0) {
      endGame();
      return;
    }
    syncToolbarDisabled(true);
    setStatus("Bot is thinking…");
    // requestAnimationFrame ensures the browser paints the user's move
    // before the synchronous makeMove blocks the main thread
    requestAnimationFrame(() => setTimeout(() => {
      if (gameOver) return;
      botMakeMove();
      syncToolbarDisabled(false);
      loopTop();
    }, 0));
  }

  function onCell(r, c) {
    if (gameOver || !waitingUser || !gameStarted) return;
    if (!isValid(board, n, r, c, userPlay)) {
      setStatus(`Not a legal move — click a highlighted square.`);
      return;
    }

    waitingUser = false;
    placeDot(board, n, r, c, userPlay);
    renderPieces(gridRoot, board, n);
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

    if (botPlay === "B") {
      runBotPhase();
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
