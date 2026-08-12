# Battleship with Devin

A browser game of Battleship: one human player against a simple computer opponent.
Built with plain HTML, CSS and JavaScript — no framework, no build step, no server.

**Play it: <https://maom-dev.github.io/battleship-with-devin/>**

**Status: complete (Checkpoint 4 of 4).** Deployed, tested in a browser and on a phone, and
every bug found along the way is written up in [DEBUGGING.md](DEBUGGING.md).

## How to play

Both fleets are placed at random when the page loads. Click a square on **Enemy waters** to fire;
the computer then fires back at **Your fleet**. Red is a hit, white is a miss, grey is one of your ships.
The first side to sink all five enemy ships wins. **New game** reshuffles both fleets and starts again.

Under each board is a fleet list naming every ship, its length, and whether it has been sunk. Ships are
allowed to touch, so each one is outlined to keep two neighbours from looking like a single longer ship.
The enemy's ships stay hidden until the game is over, then the whole enemy fleet is revealed.

The computer picks a square at random from the ones it has not tried yet. It cannot see where your ships are.

## How it was verified

Four stages, at different points in the project. The run that found the bugs is not the run
that proved them fixed.

| Stage | When | Outcome |
|---|---|---|
| 15 automated rules tests (`npm test`), run on every push and pull request by GitHub Actions | Checkpoint 1 onwards | No bugs found — the rules were right, and the tests have protected them ever since |
| Exploratory browser testing of the first playable version | Checkpoint 2, before any fixes | Three UI bugs found |
| Scripted browser regression run, 26 checks: turn discipline under rapid clicking, keyboard play, the fleet lists against the boards, no enemy positions leaking before the end, and every layout from 320px to desktop | Checkpoint 3, after the fixes | 26 of 26 passed, no new bugs |
| The owner playing the deployed game on a phone | Checkpoint 3, then again at Checkpoint 4 | Two UX bugs found, and later confirmed fixed: boards side by side in landscape with comfortably tappable squares, stacked in portrait, New game resetting correctly |

The 15 automated rules tests found no bug, because they cover the rules and the rules were
right. Every bug was in the screen — and two of them were found only by a person using the
deployed game on a real device, after the exploratory browser testing had already passed.

## Running it on your own machine

The game's files are the whole website — there is nothing to build. Because browsers refuse to load
JavaScript modules straight off the file system for security reasons, opening `index.html` by
double-clicking will show a warning instead of the game. Serve the folder instead:

```bash
git clone https://github.com/maom-dev/battleship-with-devin.git
cd battleship-with-devin
python3 -m http.server 8000
```

Then open <http://localhost:8000> in your browser. (Any static file server will do; `python3` is just
the one most machines already have.)

## How the project is organised

| File | What it is for |
|---|---|
| `index.html` | The page: two boards, the status lines, the New game button. |
| `styles.css` | How it looks — the grid of squares and the colours. |
| `game.js` | The rules: placing ships, firing, hit / miss / sunk, and when the game is over. Contains no screen code at all. |
| `ui.js` | The screen: draws the boards from the game state and handles clicks. Decides nothing itself. |
| `DEBUGGING.md` | Every bug found in this project, how it was found and how it was fixed. |
| `test/rules.test.js` | Automated tests for the rules. |
| `package.json` | Just enough configuration for `npm test` to work. No dependencies are installed. |

## Running the tests

Requires [Node.js](https://nodejs.org) 18 or newer (`node --version` to check).

```bash
npm test
```

There is nothing to install first — the tests use the test runner built into Node, and the project has
no third-party dependencies. The same tests run automatically on GitHub for every change, so a pull
request shows a green tick or a red cross before anyone has to read the code.

## The rules, in short

- Two 10x10 boards, five ships each: Carrier 5, Battleship 4, Cruiser 3, Submarine 3, Destroyer 2.
- Both fleets are placed randomly by the program.
- Players take strict alternating turns. A square can only be fired at once.
- Clicking a square you have already fired at is ignored, and does not cost you your turn.
- Ships may be placed touching each other. They may not overlap or hang off the edge.
- A ship sinks when all of its squares are hit; the first side to sink all five enemy ships wins.

## Licence

MIT — see [LICENSE](LICENSE).

## About this project

Built by [Devin](https://devin.ai) under human direction, in four reviewed checkpoints: the
rules and their tests, the playable screen, the bug fixes, then deployment and documentation.
The scope was deliberately kept small — no framework, no build step, random ship placement, one
simple opponent — so that every decision could be reviewed and explained by a non-engineer.
[DEBUGGING.md](DEBUGGING.md) is the honest record of what went wrong and how each problem was
found.
