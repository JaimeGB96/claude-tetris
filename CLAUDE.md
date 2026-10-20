# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris (HTML5 Canvas). No build, no dependencies, no package.json, no tests, no linter. README and UI text are in Spanish.

## Running

Open `index.html` directly, or serve statically (e.g. `python -m http.server 8000`) and visit `http://localhost:8000`.

## Architecture

Three files: `index.html` (DOM + two canvases), `style.css`, and `game.js` (all logic, one script, global state, loaded via plain `<script>`).

- `game.js` looks up DOM elements by id at load (`board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`). Renaming ids in `index.html` breaks the game.
- Board canvas size is hard-coded in `index.html` (`300x600`) and must equal `COLS*BLOCK` x `ROWS*BLOCK` from `game.js` if those constants change.
- State is module-level `let` variables, reset in `init()`. The loop (`loop`, via `requestAnimationFrame`) accumulates `dropAccum` against `dropInterval`; pause/game over use `cancelAnimationFrame(animId)` and pause resumes by resetting `lastTime` and calling `loop` again.
- Piece lifecycle: `spawn()` promotes `next` to `current` and detects game over (spawn collision); `lockPiece()` = `merge()` -> `clearLines()` -> `spawn()`. Hard drop, soft drop and the gravity tick all route through `lockPiece()`.
- Pieces are matrices whose cell values are color indices (1-7) into `COLORS`; the board stores those same indices (0 = empty). Rotation is `rotateCW` plus horizontal-only kicks (`[0,-1,1,-2,2]`) in `tryRotate`.
- Skins: `SKINS` (`retro|neon|pastel|pixel`) each define `colors`, optional `bg`/`grid`, and `drawBlock(context, px, py, size, color, colorIndex)`. `applySkin(name)` sets the global `skin` and `COLORS` (now `let`); the wrapper `drawBlock` handles alpha (ghost) and delegates to the skin; `clearCanvas` paints `skin.bg` when set. Persisted under `tetris-skin`; independent of the light/dark theme. New skins must draw the Rayo glyph via `drawRayo` and reset any `shadowBlur`.
- Power-up Rayo: piece type 8 (`[[8]]`, never from `randomPiece`). `clearLines()` sets `pendingPower` every `POWER_EVERY` lines (`nextPowerAt`); `spawn()` then makes `next` a Rayo. `lockPiece()` routes Rayo to `applyRayo()` (clears its row + column, scores `RAYO_CELL_SCORE * cells * level`, no LINES) instead of merge/clearLines.
- Scoring/speed live in `clearLines()` (`LINE_SCORES * level`, level = lines/10+1, `dropInterval = max(100, 1000-(level-1)*90)`); drops add score in `softDrop`/`hardDrop`.
