// game.js — the rules of Battleship.
//
// This file contains NO screen code: it never touches HTML, colours or clicks.
// It only answers questions like "is that a hit?" and "is the game over?".
// That is what makes it testable without a browser.

export const BOARD_SIZE = 10;

// The five classic ships. Order matters only for display.
export const SHIP_TYPES = [
  { name: 'Carrier', length: 5 },
  { name: 'Battleship', length: 4 },
  { name: 'Cruiser', length: 3 },
  { name: 'Submarine', length: 3 },
  { name: 'Destroyer', length: 2 },
];

// Every square starts as UNKNOWN. Once fired at it becomes HIT or MISS,
// and it is never allowed to change again.
export const UNKNOWN = null;
export const HIT = 'hit';
export const MISS = 'miss';

// A "random number source" is passed in so tests can supply a predictable one.
function randomInt(limit, random) {
  return Math.floor(random() * limit);
}

// The squares a ship would occupy if it started at (row, col).
// Horizontal ships extend to the right, vertical ships extend downwards.
function shipCells(row, col, horizontal, length) {
  const cells = [];
  for (let i = 0; i < length; i++) {
    cells.push(horizontal ? { row, col: col + i } : { row: row + i, col });
  }
  return cells;
}

// A placement is legal only if every square is on the board
// and no square is already taken by another ship.
export function canPlace(ships, cells) {
  return cells.every(
    (cell) =>
      cell.row >= 0 &&
      cell.row < BOARD_SIZE &&
      cell.col >= 0 &&
      cell.col < BOARD_SIZE &&
      !ships.some((ship) =>
        ship.cells.some((taken) => taken.row === cell.row && taken.col === cell.col)
      )
  );
}

// Keep trying random positions until one is legal, for each ship in turn.
// Ten ships on a 100-square board leaves plenty of room, so this always
// succeeds quickly; the attempt limit exists only so a bug can never
// turn into an infinite loop.
export function placeFleetRandomly(random = Math.random) {
  const ships = [];
  for (const type of SHIP_TYPES) {
    let placed = false;
    for (let attempt = 0; attempt < 1000 && !placed; attempt++) {
      const horizontal = random() < 0.5;
      const row = randomInt(BOARD_SIZE, random);
      const col = randomInt(BOARD_SIZE, random);
      const cells = shipCells(row, col, horizontal, type.length);
      if (canPlace(ships, cells)) {
        ships.push({ name: type.name, length: type.length, cells, hits: 0 });
        placed = true;
      }
    }
    if (!placed) throw new Error(`Could not place ${type.name}`);
  }
  return ships;
}

// A board is one player's fleet plus the record of every shot fired AT them.
export function createBoard(random = Math.random) {
  return {
    ships: placeFleetRandomly(random),
    // shots[row][col] is UNKNOWN, HIT or MISS.
    shots: Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(UNKNOWN)),
  };
}

export function shipAt(board, row, col) {
  return board.ships.find((ship) =>
    ship.cells.some((cell) => cell.row === row && cell.col === col)
  );
}

export function isSunk(ship) {
  return ship.hits >= ship.length;
}

export function allShipsSunk(board) {
  return board.ships.every(isSunk);
}

export function isOnBoard(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

// Has this square already been fired at?
export function alreadyFired(board, row, col) {
  return board.shots[row][col] !== UNKNOWN;
}

// Fire one shot at a board.
// Returns { valid, result, sunkShip } — sunkShip is the ship's name if this
// shot finished it off, otherwise null. An invalid shot (off the board, or a
// repeat) changes nothing at all, so the shooter simply does not lose a turn.
export function fireAt(board, row, col) {
  if (!isOnBoard(row, col) || alreadyFired(board, row, col)) {
    return { valid: false, result: null, sunkShip: null };
  }
  const ship = shipAt(board, row, col);
  if (!ship) {
    board.shots[row][col] = MISS;
    return { valid: true, result: MISS, sunkShip: null };
  }
  board.shots[row][col] = HIT;
  ship.hits += 1;
  return { valid: true, result: HIT, sunkShip: isSunk(ship) ? ship.name : null };
}

// Every square that has not been fired at yet.
export function untriedCells(board) {
  const cells = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (!alreadyFired(board, row, col)) cells.push({ row, col });
    }
  }
  return cells;
}

// The AI: pick one square at random from the ones it has not tried.
// It never looks at where the ships are.
export function chooseAiShot(board, random = Math.random) {
  const choices = untriedCells(board);
  if (choices.length === 0) return null;
  return choices[randomInt(choices.length, random)];
}

// A game is the two boards plus who has won, if anyone.
export function createGame(random = Math.random) {
  return {
    playerBoard: createBoard(random),
    aiBoard: createBoard(random),
    isOver: false,
    winner: null, // 'player' or 'ai' once the game ends
  };
}

// The player fires at the AI's board. If that ends the game, the AI does not
// get a reply shot. Returns what happened so the screen can describe it.
export function playerTurn(game, row, col) {
  if (game.isOver) return { valid: false, result: null, sunkShip: null };
  const shot = fireAt(game.aiBoard, row, col);
  if (shot.valid && allShipsSunk(game.aiBoard)) {
    game.isOver = true;
    game.winner = 'player';
  }
  return shot;
}

// The AI fires back once.
export function aiTurn(game, random = Math.random) {
  if (game.isOver) return { valid: false, result: null, sunkShip: null, cell: null };
  const cell = chooseAiShot(game.playerBoard, random);
  if (!cell) return { valid: false, result: null, sunkShip: null, cell: null };
  const shot = fireAt(game.playerBoard, cell.row, cell.col);
  if (allShipsSunk(game.playerBoard)) {
    game.isOver = true;
    game.winner = 'ai';
  }
  return { ...shot, cell };
}
