// ui.js — the screen.
//
// This file draws the boards and handles clicks. It decides nothing about the
// game itself: every question ("is that a hit?", "whose turn is it?", "is it
// over?") is answered by game.js. If the two ever disagree, game.js is right.

import {
  BOARD_SIZE,
  HIT,
  MISS,
  createGame,
  playerTurn,
  aiTurn,
  shipAt,
  isSunk,
} from './game.js';

const COLUMN_LABELS = 'ABCDEFGHIJ'.split('');
const AI_THINKING_TIME = 600; // milliseconds, so the reply is readable

const enemyBoardElement = document.getElementById('enemy-board');
const playerBoardElement = document.getElementById('player-board');
const statusTurn = document.getElementById('status-turn');
const statusYou = document.getElementById('status-you');
const statusEnemy = document.getElementById('status-enemy');

let game = createGame();
let waitingForAi = false;
// Bumped by "New game" so a reply already scheduled for the old game is ignored.
let gameId = 0;

// Squares are named the way a person would say them: B7, J10.
function squareName(row, col) {
  return `${COLUMN_LABELS[col]}${row + 1}`;
}

// Build the 100 squares of one board once; render() only changes their colours.
function buildBoard(container, onClick) {
  const squares = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    squares.push([]);
    for (let col = 0; col < BOARD_SIZE; col++) {
      const square = document.createElement('button');
      square.type = 'button';
      square.className = 'square';
      if (onClick) square.addEventListener('click', () => onClick(row, col));
      else square.disabled = true;
      container.appendChild(square);
      squares[row].push(square);
    }
  }
  return squares;
}

const enemySquares = buildBoard(enemyBoardElement, handlePlayerShot);
const playerSquares = buildBoard(playerBoardElement, null);

function describeSquare(board, row, col, showShips) {
  const shot = board.shots[row][col];
  if (shot === HIT) return { className: 'square hit', label: 'hit' };
  if (shot === MISS) return { className: 'square miss', label: 'miss' };
  if (showShips && shipAt(board, row, col)) return { className: 'square ship', label: 'your ship' };
  return { className: 'square', label: 'not fired at' };
}

function renderBoard(board, squares, showShips) {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const { className, label } = describeSquare(board, row, col, showShips);
      const square = squares[row][col];
      square.className = className;
      square.setAttribute('aria-label', `${squareName(row, col)}, ${label}`);
      // Squares already fired at, and every square once the game is over,
      // can no longer be clicked.
      if (!showShips) {
        square.disabled = game.isOver || board.shots[row][col] !== null;
      }
    }
  }
}

function shipsLeft(board) {
  return board.ships.filter((ship) => !isSunk(ship)).length;
}

function render() {
  renderBoard(game.aiBoard, enemySquares, false);
  renderBoard(game.playerBoard, playerSquares, true);

  if (game.isOver) {
    statusTurn.textContent =
      game.winner === 'player'
        ? 'You win! Every enemy ship is sunk.'
        : 'You lose. The computer sank your whole fleet.';
    statusTurn.className = 'status-turn status-over';
    return;
  }

  statusTurn.className = 'status-turn';
  statusTurn.textContent = waitingForAi
    ? 'The computer is taking its shot...'
    : `Your turn: click a square on the enemy's waters. ` +
      `Ships left — you ${shipsLeft(game.playerBoard)}, enemy ${shipsLeft(game.aiBoard)}.`;
}

function describeShot(who, cell, shot) {
  const where = squareName(cell.row, cell.col);
  if (shot.sunkShip) return `${who} ${where}: hit — the ${shot.sunkShip} is sunk!`;
  return `${who} ${where}: ${shot.result === HIT ? 'a hit!' : 'a miss.'}`;
}

function handlePlayerShot(row, col) {
  if (waitingForAi || game.isOver) return;

  const shot = playerTurn(game, row, col);
  if (!shot.valid) {
    // Firing at the same square twice is simply ignored; the turn is not lost.
    statusYou.textContent = `You have already fired at ${squareName(row, col)}. Pick another square.`;
    return;
  }

  statusYou.textContent = describeShot('You fired at', { row, col }, shot);
  statusEnemy.textContent = '';

  if (game.isOver) {
    render();
    return;
  }

  waitingForAi = true;
  render();

  const thisGame = gameId;
  window.setTimeout(() => {
    if (thisGame !== gameId) return; // a new game was started in the meantime
    const reply = aiTurn(game);
    waitingForAi = false;
    if (reply.valid) {
      statusEnemy.textContent = describeShot('The computer fired at', reply.cell, reply);
    }
    render();
  }, AI_THINKING_TIME);
}

function startNewGame() {
  gameId += 1;
  game = createGame();
  waitingForAi = false;
  statusYou.textContent = '';
  statusEnemy.textContent = '';
  render();
}

document.getElementById('new-game').addEventListener('click', startNewGame);

// Reaching this line means the code loaded, so the "not started" notice can go.
document.getElementById('loading-warning').remove();
render();
