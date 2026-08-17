// scripts/ai-benchmark.js — how much better is the hunting AI than pure chance?
//
// Run it with:  npm run bench          (1000 boards, a second or two)
//               npm run bench -- 200   (fewer boards)
//
// Both opponents are set loose on the SAME 1000 fleets and asked to sink all
// seventeen squares; the score is how many shots that took. Using the same
// fleets for both means the difference in the numbers is the difference between
// the two opponents, not luck in where the ships ended up.
//
// Each run gets its own deep copy of the fleet — its own ship objects, its own
// hit counters, its own shots grid — so one run can never disturb the other.

import {
  BOARD_SIZE,
  placeFleetRandomly,
  fireAt,
  allShipsSunk,
  createAiState,
  chooseAiShot,
  chooseRandomShot,
  recordAiResult,
  UNKNOWN,
} from '../game.js';

// A seeded random source, so the whole comparison can be repeated exactly.
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

// A fresh, wholly independent board with the same ships in the same places.
function freshBoard(fleet) {
  return {
    ships: fleet.map((ship) => ({
      name: ship.name,
      length: ship.length,
      hits: 0,
      cells: ship.cells.map((cell) => ({ row: cell.row, col: cell.col })),
    })),
    shots: Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(UNKNOWN)),
  };
}

// Shots needed to sink the whole fleet. `strategy` sees only the shots grid.
function shotsToClear(fleet, strategy, random) {
  const board = freshBoard(fleet);
  const ai = createAiState(random);
  for (let shots = 1; shots <= BOARD_SIZE * BOARD_SIZE; shots++) {
    const cell = strategy(board.shots, ai, random);
    const shot = fireAt(board, cell.row, cell.col);
    recordAiResult(ai, cell, shot);
    if (allShipsSunk(board)) return shots;
  }
  throw new Error('the fleet survived a full board of shots');
}

const huntAndTarget = (shots, ai, random) => chooseAiShot(shots, ai, random);
const pureChance = (shots, ai, random) => chooseRandomShot(shots, random);

function summarise(label, scores) {
  const sorted = [...scores].sort((a, b) => a - b);
  const at = (fraction) => sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))];
  return {
    opponent: label,
    mean: Number((scores.reduce((sum, n) => sum + n, 0) / scores.length).toFixed(1)),
    median: at(0.5),
    p90: at(0.9),
    max: sorted[sorted.length - 1],
  };
}

const boards = Number(process.argv[2] ?? 1000);
const hunting = [];
const chance = [];
let huntingBetter = 0;
let tied = 0;

for (let seed = 1; seed <= boards; seed++) {
  const fleet = placeFleetRandomly(mulberry32(seed));
  // Separate, identically seeded random sources: each opponent's own coin
  // flips, unaffected by how many times the other one tossed.
  const a = shotsToClear(fleet, huntAndTarget, mulberry32(seed + 1e6));
  const b = shotsToClear(fleet, pureChance, mulberry32(seed + 2e6));
  hunting.push(a);
  chance.push(b);
  if (a < b) huntingBetter++;
  else if (a === b) tied++;
}

console.log(`${boards} fleets, each played by both opponents.\n`);
console.table([summarise('hunt and target', hunting), summarise('pure chance (baseline)', chance)]);
console.log(
  `\nFewer shots than pure chance on ${((huntingBetter / boards) * 100).toFixed(1)}% of fleets ` +
    `(tied on ${((tied / boards) * 100).toFixed(1)}%).`
);
console.log(
  `Saves ${(chance.reduce((s, n) => s + n, 0) / boards - hunting.reduce((s, n) => s + n, 0) / boards).toFixed(1)} ` +
    'shots per game on average.'
);
