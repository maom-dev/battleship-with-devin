# Battleship with Devin

A browser game of Battleship: one human player against a simple computer opponent.
Built with plain HTML, CSS and JavaScript — no framework, no build step, no server.

**Status: Checkpoint 2 of 4 — the game is playable.**

## How to play

Both fleets are placed at random when the page loads. Click a square on **Enemy waters** to fire;
the computer then fires back at **Your fleet**. Red is a hit, white is a miss, grey is one of your ships.
The first side to sink all five enemy ships wins. **New game** reshuffles both fleets and starts again.

The computer picks a square at random from the ones it has not tried yet. It cannot see where your ships are.

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
| `test/rules.test.js` | Automated tests for the rules. |
| `package.json` | Just enough configuration for `npm test` to work. No dependencies are installed. |

Still to come: `DEBUGGING.md` (Checkpoint 3).

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
- A ship sinks when all of its squares are hit; the first side to sink all five enemy ships wins.

## Licence

MIT — see [LICENSE](LICENSE).
