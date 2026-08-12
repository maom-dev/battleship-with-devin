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
const enemyFleetElement = document.getElementById('enemy-fleet');
const playerFleetElement = document.getElementById('player-fleet');
const statusResult = document.getElementById('status-result');
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
      // Fired-at squares stay enabled: a disabled button cannot hold keyboard
      // focus, which would throw a keyboard player back to the top of the page
      // after every shot. Refusing the shot is game.js's job anyway.
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

// Borders are drawn only where the neighbouring square belongs to a different
// ship (or to none), so two ships that touch read as two shapes rather than one
// long one.
function outlineClasses(ship, row, col) {
  const partOfShip = (r, c) => ship.cells.some((cell) => cell.row === r && cell.col === c);
  const edges = [];
  if (!partOfShip(row - 1, col)) edges.push('edge-top');
  if (!partOfShip(row + 1, col)) edges.push('edge-bottom');
  if (!partOfShip(row, col - 1)) edges.push('edge-left');
  if (!partOfShip(row, col + 1)) edges.push('edge-right');
  return edges;
}

function describeSquare(board, row, col, showShips) {
  const shot = board.shots[row][col];
  const ship = showShips ? shipAt(board, row, col) : undefined;
  const classes = ['square'];
  const spoken = [];

  if (ship) {
    classes.push('ship', ...outlineClasses(ship, row, col));
    spoken.push(isSunk(ship) ? `${ship.name}, sunk` : ship.name);
  }

  if (shot === HIT) {
    classes.push('hit');
    spoken.unshift('hit');
  } else if (shot === MISS) {
    classes.push('miss');
    spoken.unshift('miss');
  } else if (!ship) {
    spoken.push('not fired at');
  }

  return { className: classes.join(' '), label: spoken.join(', ') };
}

function renderBoard(board, squares, { showShips, playable }) {
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      const { className, label } = describeSquare(board, row, col, showShips);
      const square = squares[row][col];
      const spent = board.shots[row][col] !== null;

      square.className = spent && playable ? `${className} spent` : className;
      square.setAttribute('aria-label', `${squareName(row, col)}, ${label}`);

      if (playable) {
        // Announced as unavailable, but still focusable and still clickable, so
        // the click reaches the code that explains why nothing happened.
        square.setAttribute('aria-disabled', String(spent || game.isOver));
      }
    }
  }
}

function renderFleet(list, board) {
  list.replaceChildren();

  for (const ship of board.ships) {
    const sunk = isSunk(ship);
    const item = document.createElement('li');
    item.className = sunk ? 'fleet-item sunk' : 'fleet-item';

    for (const [className, text] of [
      ['fleet-name', ship.name],
      ['fleet-length', `${ship.length}`],
      ['fleet-state', sunk ? 'Sunk' : ''],
    ]) {
      const part = document.createElement('span');
      part.className = className;
      part.textContent = text;
      item.append(part);
    }

    list.append(item);
  }
}

function shipsLeft(board) {
  return board.ships.filter((ship) => !isSunk(ship)).length;
}

function shipCount() {
  return `Ships left — you ${shipsLeft(game.playerBoard)}, enemy ${shipsLeft(game.aiBoard)}.`;
}

function render() {
  // The enemy fleet is revealed only once the game is over.
  renderBoard(game.aiBoard, enemySquares, { showShips: game.isOver, playable: true });
  renderBoard(game.playerBoard, playerSquares, { showShips: true, playable: false });
  renderFleet(enemyFleetElement, game.aiBoard);
  renderFleet(playerFleetElement, game.playerBoard);

  // The result gets its own line so the final ship count stays readable.
  statusResult.textContent = game.isOver
    ? game.winner === 'player'
      ? 'You win! Every enemy ship is sunk.'
      : 'You lose. The computer sank your whole fleet.'
    : '';

  if (game.isOver) statusTurn.textContent = shipCount();
  else if (waitingForAi) statusTurn.textContent = 'The computer is taking its shot...';
  else statusTurn.textContent = `Your turn: click a square on the enemy's waters. ${shipCount()}`;
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
  statusResult.textContent = '';
  statusYou.textContent = '';
  statusEnemy.textContent = '';
  render();
}

document.getElementById('new-game').addEventListener('click', startNewGame);

// Reaching this line means the code loaded, so the "not started" notice can go
// and the game itself can appear.
document.getElementById('loading-warning').remove();
document.querySelector('main').hidden = false;
render();
