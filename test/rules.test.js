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
  const seen = new Set();
  for (let i = 0; i < BOARD_SIZE * BOARD_SIZE; i++) {
    const cell = chooseAiShot(board);
    assert.ok(cell, 'the AI ran out of squares too early');
    const key = `${cell.row},${cell.col}`;
    assert.ok(!seen.has(key), `the AI repeated square ${key}`);
    seen.add(key);
    assert.equal(fireAt(board, cell.row, cell.col).valid, true);
  }
  // After 100 shots the whole board is used up and there is nothing left to pick.
  assert.equal(chooseAiShot(board), null);
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

test('the game ends when one side loses all five ships, and refuses further shots', () => {
  const game = createGame();

  // The player sinks the whole enemy fleet, square by square.
  for (const ship of game.aiBoard.ships) {
    for (const cell of ship.cells) {
      if (!game.isOver) playerTurn(game, cell.row, cell.col);
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

test('the AI can win too, and the game stops as soon as it does', () => {
  const game = createGame();
  // Let the AI keep firing until it has sunk everything the player owns.
  for (let i = 0; i < BOARD_SIZE * BOARD_SIZE && !game.isOver; i++) {
    aiTurn(game);
  }
  assert.equal(game.isOver, true);
  assert.equal(game.winner, 'ai');
  assert.equal(allShipsSunk(game.playerBoard), true);
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
});
