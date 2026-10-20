'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#7986cb', // J - indigo
  '#ffb74d', // L - orange
  '#fff59d', // Rayo - power-up
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8]],                                       // Rayo (power-up)
];

const LINE_SCORES = [0, 100, 300, 500, 800];
const RAYO = 8;
const POWER_EVERY = 5;
const RAYO_CELL_SCORE = 10;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const recordsBox = document.getElementById('records-box');
const recordsBody = document.getElementById('records-body');
const recordsExtra = document.getElementById('records-extra');
const nameEntry = document.getElementById('name-entry');
const recordMsg = document.getElementById('record-msg');
const playerName = document.getElementById('player-name');
const saveNameBtn = document.getElementById('save-name-btn');
const resetRecordsBtn = document.getElementById('reset-records-btn');

const THEME_KEY = 'tetris-theme';
let gridColor = '#22222e';

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let nextPowerAt, pendingPower;
let combo, maxCombo, started = false;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function rayoPiece() {
  const shape = PIECES[RAYO].map(row => [...row]);
  return { type: RAYO, shape, x: Math.floor(COLS / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    lines += cleared;
    if (lines >= nextPowerAt) {
      pendingPower = true;
      while (nextPowerAt <= lines) nextPowerAt += POWER_EVERY;
    }
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  } else {
    combo = 0;
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function applyRayo() {
  const r = current.y, c = current.x;
  let cells = 0;
  for (let i = 0; i < ROWS; i++) {
    if (board[i][c]) { cells++; board[i][c] = 0; }
  }
  cells += board[r].filter(v => v !== 0).length;
  board.splice(r, 1);
  board.unshift(new Array(COLS).fill(0));
  score += cells * RAYO_CELL_SCORE * level;
  updateHUD();
}

function lockPiece() {
  if (current.type === RAYO) {
    applyRayo();
  } else {
    merge();
    clearLines();
  }
  spawn();
}

function spawn() {
  current = next;
  next = pendingPower ? rayoPiece() : randomPiece();
  pendingPower = false;
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  if (colorIndex === RAYO) {
    context.fillStyle = '#333';
    context.font = `${Math.floor(size * 0.7)}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('⚡', x * size + size / 2, y * size + size / 2 + 1);
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  restartBtn.textContent = 'Reiniciar';
  recordsData.bestCombo = Math.max(recordsData.bestCombo, maxCombo);
  recordsData.maxLines = Math.max(recordsData.maxLines, lines);
  pendingEntry = score > 0 && qualifies(score) ? { score, lines, combo: maxCombo } : null;
  saveRecords();
  showOverlay(true);
  if (pendingEntry) {
    recordMsg.textContent = '¡Nuevo récord!';
    playerName.value = '';
    nameEntry.classList.remove('hidden');
    playerName.focus();
  }
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    restartBtn.textContent = 'Reiniciar';
    showOverlay(false);
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

const RECORDS_KEY = 'tetris-records';
const TOP_SIZE = 5;
let recordsData = loadRecords();
let pendingEntry = null;
let newIndex = -1;

function loadRecords() {
  const empty = { top: [], bestCombo: 0, maxLines: 0 };
  try {
    const d = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (!d || !Array.isArray(d.top)) return empty;
    const top = d.top
      .filter(e => e && Number.isFinite(e.score))
      .map(e => ({ name: String(e.name || 'Anónimo').slice(0, 12), score: e.score, lines: +e.lines || 0, combo: +e.combo || 0 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_SIZE);
    return { top, bestCombo: +d.bestCombo || 0, maxLines: +d.maxLines || 0 };
  } catch (e) { return empty; }
}

function saveRecords() {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(recordsData)); } catch (e) { /* almacenamiento no disponible */ }
}

function qualifies(s) {
  const top = recordsData.top;
  return top.length < TOP_SIZE || s > top[top.length - 1].score;
}

function renderRecords() {
  recordsBody.textContent = '';
  if (!recordsData.top.length) {
    const td = recordsBody.insertRow().insertCell();
    td.colSpan = 5;
    td.className = 'records-empty';
    td.textContent = 'Sin récords todavía';
  }
  recordsData.top.forEach((e, i) => {
    const tr = recordsBody.insertRow();
    if (i === newIndex) tr.className = 'record-new';
    [i + 1, e.name, e.score.toLocaleString(), e.lines, e.combo].forEach(v => {
      tr.insertCell().textContent = v;
    });
  });
  recordsExtra.textContent = `Mejor combo: ${recordsData.bestCombo} · Líneas máx.: ${recordsData.maxLines}`;
}

function showOverlay(showRecords) {
  recordsBox.classList.toggle('hidden', !showRecords);
  nameEntry.classList.add('hidden');
  if (showRecords) renderRecords();
  overlay.classList.remove('hidden');
}

function saveName() {
  if (!pendingEntry) return;
  const name = playerName.value.trim() || 'Anónimo';
  const top = recordsData.top;
  let i = top.findIndex(e => pendingEntry.score > e.score);
  if (i === -1) i = top.length;
  top.splice(i, 0, { name, ...pendingEntry });
  top.length = Math.min(top.length, TOP_SIZE);
  pendingEntry = null;
  newIndex = i;
  saveRecords();
  nameEntry.classList.add('hidden');
  recordMsg.textContent = '¡Nuevo récord!';
  renderRecords();
}

function init() {
  started = true;
  pendingEntry = null;
  newIndex = -1;
  combo = 0;
  maxCombo = 0;
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  nextPowerAt = POWER_EVERY;
  pendingPower = false;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  nameEntry.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (!started || e.target === playerName) return;
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', () => { saveName(); init(); restartBtn.blur(); }); // guarda el récord pendiente

saveNameBtn.addEventListener('click', () => { saveName(); saveNameBtn.blur(); });
playerName.addEventListener('keydown', e => { if (e.key === 'Enter') saveName(); });

resetRecordsBtn.addEventListener('click', () => {
  resetRecordsBtn.blur();
  if (!confirm('¿Borrar todos los records?')) return;
  recordsData = { top: [], bestCombo: 0, maxLines: 0 };
  newIndex = -1;
  pendingEntry = null;
  nameEntry.classList.add('hidden');
  saveRecords();
  renderRecords();
});

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim() || gridColor;
  themeToggle.setAttribute('aria-checked', String(theme === 'light'));
}

function setTheme(theme) {
  applyTheme(theme);
  try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* almacenamiento no disponible */ }
  if (current) { draw(); drawNext(); }
}

themeToggle.addEventListener('click', () => {
  setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  themeToggle.blur(); // evita que Espacio/Enter reactiven el botón durante la partida
});

let savedTheme = null;
try { savedTheme = localStorage.getItem(THEME_KEY); } catch (e) { /* ignorar */ }
applyTheme(savedTheme === 'light' ? 'light' : 'dark');

// pantalla de inicio: la partida arranca al pulsar "Jugar"
overlayTitle.textContent = 'TETRIS';
overlayScore.textContent = '';
restartBtn.textContent = 'Jugar';
showOverlay(true);
