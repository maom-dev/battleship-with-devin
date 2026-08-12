# Battleship with Devin

A browser game of Battleship: one human player against a simple computer opponent.
Built with plain HTML, CSS and JavaScript — no framework, no build step, no server.

**Status: Checkpoint 1 of 4 — the rules and their tests exist; the visual game does not yet.**

## How the project is organised

| File | What it is for |
|---|---|
| `game.js` | The rules: placing ships, firing, hit / miss / sunk, and when the game is over. Contains no screen code at all. |
| `test/rules.test.js` | Automated tests for those rules. |
| `package.json` | Just enough configuration for `npm test` to work. No dependencies are installed. |

Still to come: `index.html`, `styles.css`, `ui.js` (the visible game) and `DEBUGGING.md`.

## Running the tests yourself

Requires [Node.js](https://nodejs.org) 18 or newer (`node --version` to check).

```bash
git clone https://github.com/maom-dev/battleship-with-devin.git
cd battleship-with-devin
npm test
```

There is nothing to install first — the tests use the test runner built into Node,
and the project has no third-party dependencies.

The same tests run automatically on GitHub for every change, so a pull request
shows a green tick or a red cross before anyone has to read the code.

## The rules, in short

- Two 10x10 boards, five ships each: Carrier 5, Battleship 4, Cruiser 3, Submarine 3, Destroyer 2.
- Both fleets are placed randomly by the program.
- Players take turns firing at one square. A square can only be fired at once.
- A ship sinks when all of its squares are hit; the first side to sink all five enemy ships wins.
- The computer opponent picks a random square it has not tried yet.

## Licence

MIT — see [LICENSE](LICENSE).
