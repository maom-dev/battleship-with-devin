---
name: browser-testing-battleship
description: How to serve and browser-test this static Battleship game (game.js/ui.js), drive long games quickly, and check mobile layouts without Playwright.
---

# Browser testing the Battleship static site

## Serve and open
- No build step, no deps needed for the browser: `cd <repo> && python3 -m http.server 8000`, then open `http://localhost:8000`.
- Opening `index.html` from the filesystem will NOT work (ES modules blocked); the page then shows only the `#loading-warning` paragraph. If you see that text, you are not serving over HTTP.
- Node tests: `npm test`, benchmark: `npm run bench` (no install needed).

## Useful DOM handles (ui.js)
- Enemy board squares: `#enemy-board .square` (clickable buttons, 100 in row-major order); own board: `#player-board .square` (disabled).
- Every square's `aria-label` is authoritative state, e.g. `"B7, not fired at"`, `"A6, hit, Carrier"`, `"F6, miss"` — great for assertions without pixel guessing.
- Status lines: `#status-result` (win/lose text), `#status-turn`, `#status-you`, `#status-enemy` ("The computer fired at X: a hit!").
- New game button: `#new-game`. AI reply is delayed `AI_THINKING_TIME = 600ms`, so wait ~750-800ms per turn.

## Driving a full game fast
A whole game is ~50-100 turns; clicking each by mouse is too slow. Install a small async driver in the page (real `.click()` on the actual buttons, so the app's own handlers run) and record `#status-enemy` after each turn, e.g. with a `MutationObserver` on `#status-enemy` pushing into `window.__log`. Poll `window.__log` afterwards. Do the first few shots with real mouse clicks if you need visual proof.

## Proving hunt/target AI behaviour
- Follow-up test: after any `#status-enemy` message ending in `a hit!`, the next AI shot must be orthogonally adjacent to some already-hit cell on `#player-board`. Random AI would be adjacent only ~4% of the time, so a run of consecutive adjacent shots is decisive.
- AI-state reset test: reaching "New game" while the AI has a *wounded but unsunk* ship (a hit that did not sink anything) is the only state where a leaked `aiState` is observable — after New game a leaked state would immediately fire adjacent to the OLD hit cells. Ending a game right after a sink resets `unresolvedHits` to 0, which makes the test vacuous.

## Mobile layout checks without Playwright
- Chrome's window cannot be narrowed below ~532px, so `wmctrl -r :ACTIVE: -e 0,0,0,390,940` will NOT give a 390px viewport.
- Instead drive CDP directly (Chrome listens on `http://localhost:29229`): `pip install websocket-client`, connect to the page's `webSocketDebuggerUrl` with `suppress_origin=True` (otherwise Chrome answers `403 Rejected an incoming WebSocket connection`), then send `Emulation.setDeviceMetricsOverride` with the desired width/height and `Emulation.clearDeviceMetricsOverride` afterwards.
- CSS breakpoints in `styles.css` are orientation-based: `(orientation: landscape) and (max-width: 60rem)` shrinks squares so both boards stay side by side; `(orientation: portrait) and (max-width: 30rem)` stacks them. Assert with `document.documentElement.scrollWidth === clientWidth` (no horizontal scrolling) plus `.board` bounding rects (same `x` = stacked, same `y` = side by side).

## Devin Secrets Needed
None — everything is local and unauthenticated.
