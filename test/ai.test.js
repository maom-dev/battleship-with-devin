// Tests for the computer opponent in game.js. Run them with:  npm test
//
// The rules tests in rules.test.js prove the game is fair. These prove the
// opponent plays sensibly: it searches a checkerboard, it follows up a hit, and
// it is told nothing about where the ships are.
//
// Every test here fixes the fleet by hand and, where the choice matters, checks
// the answer for every square the AI could possibly have picked — so nothing
// depends on luck.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BOARD_SIZE,
  HIT,
  MISS,
  UNKNOWN,
  createGame,
  createAiState,
  chooseAiShot,
  chooseHuntShot,
  chooseRandomShot,
  aiTargetCandidates,
  recordAiResult,
  fireAt,
  playerTurn,
  aiTurn,
  isSunk,
} from '../game.js';

// --- little helpers --------------------------------------------------------

// A board with the fleet placed exactly where the test wants it.
// `spec` entries are [name, row, col, 'h' | 'v', length].
function boardWith(...spec) {
  const ships = spec.map(([name, row, col, direction, length]) => ({
    name,
    length,
    hits: 0,
    cells: Array.from({ length }, (_, i) =>
      direction === 'h' ? { row, col: col + i } : { row: row + i, col }
    ),
  }));
  return {
    ships,
    shots: Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(UNKNOWN)),
  };
}

// Fire and tell the AI what happened, the way aiTurn does.
function aiFires(board, ai, row, col) {
  const shot = fireAt(board, row, col);
  recordAiResult(ai, { row, col }, shot);
  return shot;
}

// Every square the AI could pick, whichever way the coin falls. A random source
// returning (i + 0.5) / n selects slot i of an n-way choice, so stepping i over
// every slot of every plausible list size enumerates all the AI's options.
function everyPossibleChoice(shots, ai) {
  const chosen = new Set();
  for (let size = 1; size <= BOARD_SIZE * BOARD_SIZE; size++) {
    for (let i = 0; i < size; i++) {
      const cell = chooseAiShot(shots, ai, () => (i + 0.5) / size);
      if (cell) chosen.add(`${cell.row},${cell.col}`);
    }
  }
  return chosen;
}

function keys(...cells) {
  return new Set(cells.map(([row, col]) => `${row},${col}`));
}

// A small seeded random source, so a test can replay an identical game.
function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Hunt mode ------------------------------------------------------------

test('while nothing is wounded the AI searches one colour of the checkerboard', () => {
  for (const parity of [0, 1]) {
    const board = boardWith(['Destroyer', 4, 4, 'h', 2]);
    const ai = { ...createAiState(), parity };
    for (const key of everyPossibleChoice(board.shots, ai)) {
      const [row, col] = key.split(',').map(Number);
      assert.equal((row + col) % 2, parity, `hunt shot ${key} is off the search pattern`);
    }
  }
});

test('when its colour is used up the AI takes the squares that are left', () => {
  const board = boardWith(['Destroyer', 4, 4, 'h', 2]);
  const ai = { ...createAiState(), parity: 0 };

  // Use up every square of the AI's colour except the ship's own two squares,
  // which sit on both colours, so hunting cannot stumble into a hit here.
  const shipSquares = keys([4, 4], [4, 5]);
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if ((row + col) % 2 === 0 && !shipSquares.has(`${row},${col}`)) {
        board.shots[row][col] = MISS;
      }
    }
  }

  const cell = chooseHuntShot(board.shots, ai, () => 0.99);
  assert.ok(cell, 'the AI gave up while squares were still untried');
  assert.equal(board.shots[cell.row][cell.col], UNKNOWN);
});

test('the AI stops choosing only when the board is completely used up', () => {
  const board = boardWith(['Destroyer', 0, 0, 'h', 2]);
  const ai = createAiState();
  for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
    const cell = chooseAiShot(board.shots, ai);
    assert.ok(cell, `ran out of squares after ${i} shots`);
    aiFires(board, ai, cell.row, cell.col);
  }
  assert.equal(chooseAiShot(board.shots, ai), null);
});

// --- Target mode ----------------------------------------------------------

test('after a hit the AI tries a square next to it, and never off the board', () => {
  const board = boardWith(['Destroyer', 0, 0, 'h', 2]); // in the corner
  const ai = createAiState();
  assert.equal(aiFires(board, ai, 0, 0).result, HIT);

  assert.deepEqual(everyPossibleChoice(board.shots, ai), keys([0, 1], [1, 0]));
});

test('after two hits in a line the AI carries the line on, at either end', () => {
  const board = boardWith(['Cruiser', 5, 3, 'h', 3]);
  const ai = createAiState();
  aiFires(board, ai, 5, 3);
  aiFires(board, ai, 5, 4);

  assert.deepEqual(everyPossibleChoice(board.shots, ai), keys([5, 2], [5, 5]));
});

test('if one end of the line is unusable the AI tries the other end', () => {
  const board = boardWith(['Cruiser', 5, 0, 'h', 3]); // flush against the left edge
  const ai = createAiState();
  aiFires(board, ai, 5, 0);
  aiFires(board, ai, 5, 1);

  // (5,-1) is off the board, so (5,2) is the only way the line can continue.
  assert.deepEqual(everyPossibleChoice(board.shots, ai), keys([5, 2]));
});

test('when both ends of the line are dead the AI falls back to the other neighbours', () => {
  // A vertical Cruiser with a vertical Destroyer touching its side: the two
  // hits below look like one horizontal ship, and they are not.
  const board = boardWith(['Cruiser', 5, 5, 'v', 3], ['Destroyer', 4, 6, 'v', 2]);
  const ai = createAiState();
  aiFires(board, ai, 5, 5); // Cruiser
  aiFires(board, ai, 5, 6); // Destroyer — aligned with the first hit, different ship
  assert.equal(aiFires(board, ai, 5, 4).result, MISS); // left end of the line: water
  assert.equal(aiFires(board, ai, 5, 7).result, MISS); // right end: water too

  // The guess about the direction was wrong, so the AI goes back to the plain
  // neighbours of its hits rather than giving up on two wounded ships.
  assert.deepEqual(
    everyPossibleChoice(board.shots, ai),
    keys([4, 5], [6, 5], [4, 6], [6, 6])
  );
});

// --- Sink bookkeeping -----------------------------------------------------

test('once every hit is accounted for the AI goes back to hunting', () => {
  const board = boardWith(['Destroyer', 4, 4, 'h', 2]);
  const ai = { ...createAiState(), parity: 0 };
  aiFires(board, ai, 4, 4);
  const sinking = aiFires(board, ai, 4, 5);

  assert.equal(sinking.sunkShip, 'Destroyer');
  assert.equal(ai.unresolvedHits, 0);
  assert.deepEqual(ai.hits, [], 'the AI kept notes it no longer needs');
  assert.deepEqual(aiTargetCandidates(board.shots, ai), []);

  // Back to searching the checkerboard — and the squares around the wreck are
  // still fair game, because ships are allowed to touch.
  for (const key of everyPossibleChoice(board.shots, ai)) {
    const [row, col] = key.split(',').map(Number);
    assert.equal((row + col) % 2, 0);
  }
  assert.equal(board.shots[4][3], UNKNOWN, 'the AI must not write off untried squares');
});

test('a sunk ship does not end the chase while hits remain unexplained', () => {
  // Destroyer at (3,3)-(3,4) with the Cruiser flush against it at (3,5)-(3,7).
  const board = boardWith(['Destroyer', 3, 3, 'h', 2], ['Cruiser', 3, 5, 'h', 3]);
  const cruiser = board.ships.find((ship) => ship.name === 'Cruiser');
  const ai = createAiState();

  aiFires(board, ai, 3, 5); // one Cruiser square
  aiFires(board, ai, 3, 4); // Destroyer
  const sinking = aiFires(board, ai, 3, 3); // Destroyer sinks

  assert.equal(sinking.sunkShip, 'Destroyer');
  assert.equal(ai.unresolvedHits, 1, 'the Cruiser hit must stay unexplained');
  assert.ok(aiTargetCandidates(board.shots, ai).length > 0, 'the AI dropped the wounded Cruiser');

  // It finishes the Cruiser without wandering off: every shot from here until
  // the last hit is explained stays next to a hit.
  for (let i = 0; i < 20 && !isSunk(cruiser); i++) {
    const candidates = aiTargetCandidates(board.shots, ai);
    assert.ok(candidates.length > 0, 'the AI left target mode with a wounded ship on the board');
    const cell = chooseAiShot(board.shots, ai);
    assert.ok(
      candidates.some((c) => c.row === cell.row && c.col === cell.col),
      `shot ${cell.row},${cell.col} was not next to a hit`
    );
    aiFires(board, ai, cell.row, cell.col);
  }

  assert.equal(isSunk(cruiser), true, 'the Cruiser was never finished off');
  assert.equal(ai.unresolvedHits, 0);
});

// --- Information the AI is allowed to use ---------------------------------

test('the strategy is handed the shots grid, its own notes and a random source — nothing else', () => {
  const game = createGame();
  let handed = null;
  const spy = (...args) => {
    handed = args;
    return chooseAiShot(...args);
  };

  playerTurn(game, 0, 0);
  assert.equal(aiTurn(game, Math.random, spy).valid, true);

  assert.equal(handed.length, 3, 'the strategy was given more than three arguments');
  assert.equal(handed[0], game.playerBoard.shots, 'the strategy was not given the shots grid');
  assert.equal(handed[1], game.aiState);
  assert.equal(typeof handed[2], 'function');

  // Nothing reachable from those arguments describes a ship.
  const seen = new Set();
  const scan = (value, path) => {
    if (value === null || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    for (const [key, child] of Object.entries(value)) {
      assert.ok(
        !['ships', 'cells'].includes(key),
        `the strategy can reach ship data at ${path}.${key}`
      );
      scan(child, `${path}.${key}`);
    }
  };
  scan(handed[0], 'shots');
  scan(handed[1], 'aiState');
});

test('the same shots and notes give the same shot whatever the hidden fleet is', () => {
  // Two completely different fleets, the same visible history: if the AI's
  // choice ever differed, it would be reading something it cannot see.
  const first = boardWith(['Cruiser', 0, 0, 'h', 3], ['Destroyer', 9, 8, 'h', 2]);
  const second = boardWith(['Cruiser', 2, 7, 'v', 3], ['Destroyer', 6, 1, 'v', 2]);

  for (const shots of [first.shots, second.shots]) {
    shots[4][4] = HIT;
    shots[4][5] = HIT;
    shots[0][1] = MISS;
  }
  const notes = () => ({ parity: 0, hits: [{ row: 4, col: 4 }, { row: 4, col: 5 }], unresolvedHits: 2 });

  for (let seed = 1; seed <= 50; seed++) {
    assert.deepEqual(
      chooseAiShot(first.shots, notes(), mulberry32(seed)),
      chooseAiShot(second.shots, notes(), mulberry32(seed))
    );
  }
});

test('the strategy leaves the shots grid alone', () => {
  const board = boardWith(['Cruiser', 5, 5, 'h', 3]);
  const ai = createAiState();
  aiFires(board, ai, 5, 5);
  const before = JSON.stringify(board.shots);

  chooseAiShot(board.shots, ai, mulberry32(7));
  assert.equal(JSON.stringify(board.shots), before, 'choosing a square changed the board');
});

// --- Repeatability --------------------------------------------------------

test('the same seed plays the same game twice', () => {
  const play = () => {
    const random = mulberry32(2024);
    const game = createGame(random);
    const fired = [];
    while (!game.isOver) {
      const target = chooseRandomShot(game.aiBoard.shots, random);
      playerTurn(game, target.row, target.col);
      const reply = aiTurn(game, random);
      if (reply.cell) fired.push(`${reply.cell.row},${reply.cell.col}`);
    }
    return { winner: game.winner, fired };
  };

  assert.deepEqual(play(), play());
});
