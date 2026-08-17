// Tests for the rules in game.js. Run them with:  npm test
//
// Each test name below matches one of the acceptance criteria we agreed.
// Nothing here needs a browser — these are pure rule checks.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BOARD_SIZE,
  SHIP_TYPES,
  HIT,
  MISS,
  UNKNOWN,
  placeFleetRandomly,
  createBoard,
  createGame,
  canPlace,
  fireAt,
  chooseAiShot,
  chooseRandomShot,
  createAiState,
  recordAiResult,
  untriedCells,
  allShipsSunk,
  isSunk,
  playerTurn,
  aiTurn,
  shipAt,
} from '../game.js';

// Random placement means one run proves very little, so the placement rules
// are checked over many freshly generated fleets.
const FLEETS_TO_CHECK = 200;

test('every ship stays completely inside the board', () => {
  for (let i = 0; i < FLEETS_TO_CHECK; i++) {
    for (const ship of placeFleetRandomly()) {
      for (const cell of ship.cells) {
        assert.ok(cell.row >= 0 && cell.row < BOARD_SIZE, `row ${cell.row} off board`);
        assert.ok(cell.col >= 0 && cell.col < BOARD_SIZE, `col ${cell.col} off board`);
      }
    }
  }
});

test('ships never overlap each other', () => {
  for (let i = 0; i < FLEETS_TO_CHECK; i++) {
    const used = new Set();
    for (const ship of placeFleetRandomly()) {
      for (const cell of ship.cells) {
        const key = `${cell.row},${cell.col}`;
        assert.ok(!used.has(key), `two ships share square ${key}`);
        used.add(key);
      }
    }
  }
});

test('every fleet has the five classic ships, straight and the right length', () => {
  for (let i = 0; i < FLEETS_TO_CHECK; i++) {
    const ships = placeFleetRandomly();
    assert.equal(ships.length, SHIP_TYPES.length);
    for (const type of SHIP_TYPES) {
      const ship = ships.find((s) => s.name === type.name);
      assert.ok(ship, `${type.name} missing`);
      assert.equal(ship.cells.length, type.length);
      const sameRow = ship.cells.every((c) => c.row === ship.cells[0].row);
      const sameCol = ship.cells.every((c) => c.col === ship.cells[0].col);
      assert.ok(sameRow || sameCol, `${type.name} is not in a straight line`);
    }
  }
});

test('a placement that runs off the board or overlaps is refused', () => {
  const ships = [{ name: 'Test', length: 2, cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }], hits: 0 }];
  assert.equal(canPlace(ships, [{ row: 0, col: 9 }, { row: 0, col: 10 }]), false); // off the side
  assert.equal(canPlace(ships, [{ row: 9, col: 0 }, { row: 10, col: 0 }]), false); // off the bottom
  assert.equal(canPlace(ships, [{ row: 0, col: 1 }, { row: 0, col: 2 }]), false); // overlaps
  assert.equal(canPlace(ships, [{ row: 5, col: 5 }, { row: 5, col: 6 }]), true); // fine
});

test('hits and misses are reported correctly', () => {
  const board = createBoard();
  const ship = board.ships[0];
  const target = ship.cells[0];
  const empty = untriedCells(board).find((cell) => !shipAt(board, cell.row, cell.col));

  const hit = fireAt(board, target.row, target.col);
  assert.equal(hit.valid, true);
  assert.equal(hit.result, HIT);
  assert.equal(board.shots[target.row][target.col], HIT);

  const miss = fireAt(board, empty.row, empty.col);
  assert.equal(miss.valid, true);
  assert.equal(miss.result, MISS);
  assert.equal(board.shots[empty.row][empty.col], MISS);
});

test('the same square can never be attacked twice', () => {
  const board = createBoard();
  const first = fireAt(board, 3, 4);
  assert.equal(first.valid, true);
  const recorded = board.shots[3][4];

  const repeat = fireAt(board, 3, 4);
  assert.equal(repeat.valid, false, 'a repeat shot must be refused');
  assert.equal(board.shots[3][4], recorded, 'a repeat shot must change nothing');

  // Shots outside the board are refused too.
  assert.equal(fireAt(board, -1, 0).valid, false);
  assert.equal(fireAt(board, 0, BOARD_SIZE).valid, false);
});

test('the AI never fires at a square it has already tried', () => {
  const board = createBoard();
  const ai = createAiState();
  const seen = new Set();
  for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
    const cell = chooseAiShot(board.shots, ai);
    assert.ok(cell, 'the AI ran out of squares too early');
    const key = `${cell.row},${cell.col}`;
    assert.ok(!seen.has(key), `the AI repeated square ${key}`);
    seen.add(key);
    const shot = fireAt(board, cell.row, cell.col);
    assert.equal(shot.valid, true);
    recordAiResult(ai, cell, shot);
  }
  // After 100 shots the whole board is used up and there is nothing left to pick.
  assert.equal(chooseAiShot(board.shots, ai), null);
  assert.equal(untriedCells(board).length, 0);
});

test('a ship counts as sunk only when all of its squares are hit', () => {
  const board = createBoard();
  const ship = board.ships.find((s) => s.name === 'Cruiser');

  for (let i = 0; i < ship.length - 1; i++) {
    const shot = fireAt(board, ship.cells[i].row, ship.cells[i].col);
    assert.equal(shot.result, HIT);
    assert.equal(shot.sunkShip, null, 'reported sunk too early');
    assert.equal(isSunk(ship), false);
  }

  const last = ship.cells[ship.length - 1];
  const finalShot = fireAt(board, last.row, last.col);
  assert.equal(finalShot.sunkShip, 'Cruiser', 'the wrong ship was named');
  assert.equal(isSunk(ship), true);
});

test('the player cannot fire twice in a row', () => {
  const game = createGame();

  assert.equal(game.turn, 'player', 'the player shoots first');
  assert.equal(playerTurn(game, 0, 0).valid, true);
  assert.equal(game.turn, 'ai', 'the turn must pass to the AI');

  const before = JSON.stringify(game.aiBoard.shots);
  const secondShot = playerTurn(game, 5, 5);
  assert.equal(secondShot.valid, false, 'the player fired out of turn');
  assert.equal(JSON.stringify(game.aiBoard.shots), before, 'an out-of-turn shot changed the board');
  assert.equal(game.turn, 'ai');
});

test('the AI cannot fire twice in a row', () => {
  const game = createGame();

  // It is the player's turn, so the AI may not shoot yet.
  assert.equal(aiTurn(game).valid, false, 'the AI fired before the player had gone');

  playerTurn(game, 0, 0);
  assert.equal(aiTurn(game).valid, true);
  assert.equal(game.turn, 'player', 'the turn must pass back to the player');

  const before = JSON.stringify(game.playerBoard.shots);
  assert.equal(aiTurn(game).valid, false, 'the AI fired out of turn');
  assert.equal(JSON.stringify(game.playerBoard.shots), before, 'an out-of-turn shot changed the board');
});

test('an invalid or repeated shot does not lose the player the turn', () => {
  const game = createGame();

  // Off the board: refused, and it is still the player's go.
  assert.equal(playerTurn(game, -1, 0).valid, false);
  assert.equal(game.turn, 'player');

  // One real shot, then the AI replies, so it is the player's turn again.
  assert.equal(playerTurn(game, 2, 2).valid, true);
  aiTurn(game);
  assert.equal(game.turn, 'player');

  // Clicking the same square again: refused, turn kept.
  assert.equal(playerTurn(game, 2, 2).valid, false);
  assert.equal(game.turn, 'player');

  // And a fresh square still works.
  assert.equal(playerTurn(game, 3, 3).valid, true);
  assert.equal(game.turn, 'ai');
});

test('the game ends when one side loses all five ships, and refuses further shots', () => {
  const game = createGame();

  // The player sinks the whole enemy fleet, square by square, with the AI
  // replying in between. The player needs 17 shots, so the AI gets at most 16 —
  // not enough to sink the player's own 17 squares, so the player always wins.
  for (const ship of game.aiBoard.ships) {
    for (const cell of ship.cells) {
      if (game.isOver) break;
      assert.equal(playerTurn(game, cell.row, cell.col).valid, true);
      aiTurn(game);
    }
  }

  assert.equal(allShipsSunk(game.aiBoard), true);
  assert.equal(game.isOver, true);
  assert.equal(game.winner, 'player');

  // Nothing may happen after the game is over.
  const before = JSON.stringify(game.playerBoard.shots);
  assert.equal(playerTurn(game, 0, 0).valid, false);
  assert.equal(aiTurn(game).valid, false);
  assert.equal(JSON.stringify(game.playerBoard.shots), before);
});

// aiTurn takes an optional square-chooser, which is how a test aims the AI at a
// particular square. It configures the AI through a parameter the rules already
// offer; it does not reach in and rewrite the game's own state, and the game in
// the browser never passes it.
function aimAt(target) {
  return (shots) => {
    assert.equal(shots[target.row][target.col], UNKNOWN, 'that square has already been fired at');
    return { row: target.row, col: target.col };
  };
}

test('the AI can win too, and the game stops as soon as it does', () => {
  const game = createGame();

  // Every square of the player's fleet, which is what the AI must hit.
  const playerShipCells = game.playerBoard.ships.flatMap((ship) => ship.cells);

  for (const target of playerShipCells) {
    assert.equal(game.isOver, false, 'the game ended before the last ship was sunk');

    // The player takes a real turn but deliberately fires at empty water, so it
    // never wins by accident. There are 83 water squares and only 17 turns.
    const water = untriedCells(game.aiBoard).find(
      (cell) => !shipAt(game.aiBoard, cell.row, cell.col)
    );
    assert.equal(playerTurn(game, water.row, water.col).result, MISS);

    // Now the AI fires, guided at one of the player's ship squares.
    const shot = aiTurn(game, Math.random, aimAt(target));
    assert.equal(shot.valid, true, 'the AI was refused its turn');
    assert.deepEqual(shot.cell, target, 'the AI did not fire where the test aimed it');
    assert.equal(shot.result, HIT);
  }

  assert.equal(allShipsSunk(game.playerBoard), true);
  assert.equal(game.isOver, true);
  assert.equal(game.winner, 'ai');

  // Turn order was obeyed throughout: 17 shots each, and no square fired at twice.
  assert.equal(untriedCells(game.playerBoard).length, BOARD_SIZE * BOARD_SIZE - playerShipCells.length);
});

test('a whole game played by both sides always ends with exactly one winner', () => {
  for (let round = 0; round < 20; round++) {
    const game = createGame();
    // Both sides fire at random. A game can last at most 100 shots each,
    // because no square may be fired at twice.
    for (let i = 0; i < BOARD_SIZE * BOARD_SIZE && !game.isOver; i++) {
      const cell = chooseRandomShot(game.aiBoard.shots);
      playerTurn(game, cell.row, cell.col);
      aiTurn(game);
    }
    assert.equal(game.isOver, true, 'the game never finished');
    assert.ok(game.winner === 'player' || game.winner === 'ai');
    const playerLost = allShipsSunk(game.playerBoard);
    const aiLost = allShipsSunk(game.aiBoard);
    assert.notEqual(playerLost, aiLost, 'both fleets cannot be sunk at once');
  }
});

test('a fresh game starts with an empty record of shots', () => {
  const game = createGame();
  for (const board of [game.playerBoard, game.aiBoard]) {
    for (const row of board.shots) {
      for (const square of row) assert.equal(square, UNKNOWN);
    }
  }
  assert.equal(game.isOver, false);
  assert.equal(game.winner, null);
  assert.equal(game.turn, 'player');
});
