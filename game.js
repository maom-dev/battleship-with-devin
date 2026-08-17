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
// Five ships occupy only 17 of the board's 100 squares, so there is plenty of
// room and this succeeds quickly; the attempt limit exists only so a bug can
// never turn into an infinite loop.
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

// Every square of a shots grid that has not been fired at yet.
export function untriedInShots(shots) {
  const cells = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (shots[row][col] === UNKNOWN) cells.push({ row, col });
    }
  }
  return cells;
}

// Every square that has not been fired at yet.
export function untriedCells(board) {
  return untriedInShots(board.shots);
}

// ---------------------------------------------------------------------------
// The AI.
//
// The strategy below is deliberately given ONLY the shots grid (null / hit /
// miss), its own notes, and a random source. It is never handed a board, so it
// cannot reach the ships even by accident: where the ships are is simply not
// among the things it is told.
//
// It plays in two modes, the way a person does:
//   Hunt   — search for a ship it has no trace of yet.
//   Target — finish off a ship it has already hit.
// ---------------------------------------------------------------------------

const SHIP_LENGTHS = new Map(SHIP_TYPES.map((type) => [type.name, type.length]));

// The AI's notes. Everything in here comes from what the AI was told about its
// own shots — a hit, a miss, or the name of a ship that has just sunk.
//
// `parity` picks one colour of the board's checkerboard, chosen afresh each
// game so two games do not open the same way.
// `unresolvedHits` counts hits that no sunk ship accounts for yet. It is a
// count, not a map: when a ship sinks we learn how many of our hits belonged to
// it, never which ones, because ships are allowed to touch.
export function createAiState(random = Math.random) {
  return {
    parity: randomInt(2, random),
    hits: [], // every hit not yet fully accounted for by sunk ships
    unresolvedHits: 0,
  };
}

function orthogonalNeighbours(row, col) {
  return [
    { row: row - 1, col },
    { row: row + 1, col },
    { row, col: col - 1 },
    { row, col: col + 1 },
  ];
}

function isHit(shots, row, col) {
  return isOnBoard(row, col) && shots[row][col] === HIT;
}

// Untried squares next to a hit that some ship still afloat may be part of.
// While any hit is unaccounted for, every recorded hit stays in play: we cannot
// tell which hits the ship that just sank was made of, so we keep them all
// rather than guess wrong and abandon a half-found ship.
export function aiTargetCandidates(shots, aiState) {
  if (aiState.unresolvedHits <= 0) return [];
  const seen = new Set();
  const candidates = [];
  for (const hit of aiState.hits) {
    for (const cell of orthogonalNeighbours(hit.row, hit.col)) {
      const key = `${cell.row},${cell.col}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (isOnBoard(cell.row, cell.col) && shots[cell.row][cell.col] === UNKNOWN) {
        candidates.push(cell);
      }
    }
  }
  return candidates;
}

// Two hits in a row suggest which way the ship lies, so a square that carries
// that line on is tried first. It is only a preference: because ships may
// touch, two neighbouring hits can belong to two different ships, so when the
// line runs out the plain neighbours of the hits are still there to fall back on.
function extendsALine(shots, cell) {
  return orthogonalNeighbours(cell.row, cell.col).some((next) => {
    const stepRow = next.row - cell.row;
    const stepCol = next.col - cell.col;
    return (
      isHit(shots, next.row, next.col) &&
      isHit(shots, next.row + stepRow, next.col + stepCol)
    );
  });
}

function pickOneOfTheBest(candidates, shots, random) {
  const onALine = candidates.filter((cell) => extendsALine(shots, cell));
  const shortlist = onALine.length > 0 ? onALine : candidates;
  return shortlist[randomInt(shortlist.length, random)];
}

// Hunt mode. Every ship is at least two squares long, so it must cover at least
// one square of either checkerboard colour: searching one colour finds every
// ship while firing half as many searching shots. Once that colour is used up
// the AI takes anything left, so it can always finish the board.
export function chooseHuntShot(shots, aiState, random = Math.random) {
  const untried = untriedInShots(shots);
  if (untried.length === 0) return null;
  const onParity = untried.filter((cell) => (cell.row + cell.col) % 2 === aiState.parity);
  const choices = onParity.length > 0 ? onParity : untried;
  return choices[randomInt(choices.length, random)];
}

// The plain random opponent, kept as the baseline the hunting AI is measured
// against.
export function chooseRandomShot(shots, random = Math.random) {
  const choices = untriedInShots(shots);
  if (choices.length === 0) return null;
  return choices[randomInt(choices.length, random)];
}

// The AI's choice of square: finish a wounded ship if there is one, else hunt.
export function chooseAiShot(shots, aiState, random = Math.random) {
  const targets = aiTargetCandidates(shots, aiState);
  if (targets.length > 0) return pickOneOfTheBest(targets, shots, random);
  return chooseHuntShot(shots, aiState, random);
}

// Tell the AI how its own shot turned out. `shot` is exactly what fireAt
// reported: valid, hit or miss, and the name of any ship that sank — the same
// three facts the player reads off the screen.
export function recordAiResult(aiState, cell, shot) {
  if (!shot.valid) return aiState;
  if (shot.result === HIT) {
    aiState.hits.push({ row: cell.row, col: cell.col });
    aiState.unresolvedHits += 1;
  }
  if (shot.sunkShip) {
    const length = SHIP_LENGTHS.get(shot.sunkShip) ?? 0;
    aiState.unresolvedHits = Math.max(0, aiState.unresolvedHits - length);
  }
  // Nothing left unaccounted for: the hunt starts again from a clean slate.
  if (aiState.unresolvedHits === 0) aiState.hits = [];
  return aiState;
}

// A game is the two boards, whose turn it is, and who has won, if anyone.
// Turn order is a rule enforced here, not a convention the screen has to
// remember: neither side can fire out of turn even if asked to.
export function createGame(random = Math.random) {
  return {
    playerBoard: createBoard(random),
    aiBoard: createBoard(random),
    aiState: createAiState(random),
    turn: 'player', // the player always shoots first
    isOver: false,
    winner: null, // 'player' or 'ai' once the game ends
  };
}

// The player fires at the AI's board. If that ends the game, the AI does not
// get a reply shot. Returns what happened so the screen can describe it.
// A refused shot (off the board, or a repeat) does not hand the turn over.
export function playerTurn(game, row, col) {
  if (game.isOver || game.turn !== 'player') {
    return { valid: false, result: null, sunkShip: null };
  }
  const shot = fireAt(game.aiBoard, row, col);
  if (!shot.valid) return shot;
  if (allShipsSunk(game.aiBoard)) {
    game.isOver = true;
    game.winner = 'player';
  } else {
    game.turn = 'ai';
  }
  return shot;
}

// The AI fires back once, then hands the turn back to the player.
// `chooseShot` exists so a test can aim the AI at a chosen square; the game
// itself never passes it, and the AI it defaults to is the one that plays in
// the browser.
export function aiTurn(game, random = Math.random, chooseShot = chooseAiShot) {
  const refused = { valid: false, result: null, sunkShip: null, cell: null };
  if (game.isOver || game.turn !== 'ai') return refused;
  const cell = chooseShot(game.playerBoard.shots, game.aiState, random);
  if (!cell) return refused;
  const shot = fireAt(game.playerBoard, cell.row, cell.col);
  recordAiResult(game.aiState, cell, shot);
  if (allShipsSunk(game.playerBoard)) {
    game.isOver = true;
    game.winner = 'ai';
  } else {
    game.turn = 'player';
  }
  return { ...shot, cell };
}
