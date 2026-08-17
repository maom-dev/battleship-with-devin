# Debugging log

Every bug in this file was actually found in this project. Nothing here is invented,
and nothing is included because it makes a tidy story. Where a problem was a wrong
comment rather than wrong behaviour, it says so.

Each entry records **how it was found**, because that turned out to be the most useful
thing to know: different kinds of bug were caught by completely different methods, and
none of the methods caught everything.

---

## 1. Turn order was never actually enforced (Checkpoint 1)

**Found by:** a human reading the requirements against the tests, before any of the
screen code existed. There was a rule about alternating turns and no test for it.

**The bug:** `game.js` checked only whether the game was over before accepting a shot.
Nothing stopped `playerTurn` being called twice in a row. The game *appeared* correct
because the screen code was going to call player-then-computer in that order — the
alternation was a convention in the caller, not a rule of the game.

**The fix:** the game now records whose turn it is. `playerTurn` refuses unless it is the
player's turn and hands over afterwards; `aiTurn` does the mirror image. A refused shot
does not hand over the turn, so firing at the same square twice still costs nothing.

**Tests added:** the player cannot fire twice in a row; the computer cannot fire twice in
a row; a repeated shot does not lose the turn; a whole game always ends with exactly one
winner.

**Lesson:** a rule that only exists in the order somebody calls the functions is not a
rule. It is a habit, and habits are not tested.

---

## 2. A test that quietly stopped testing anything (Checkpoint 1)

**Found by:** a human asking what a line in the test actually did.

**The bug:** the test proving the computer can win contained `game.turn = 'ai'` before
every computer shot — it reached in and overwrote the game's own record of whose turn it
was. That is not something a real player could do. Worse, it hid the exact failure it
should have caught: if `aiTurn` ever forgot to hand the turn back, the real game would
freeze, but this test would still pass, because it force-set the turn each time round the
loop.

**The fix:** the test now steers the computer through the random-number source that
`chooseAiShot` already accepts as an argument, while the player deliberately fires at
empty water. The computer wins in 17 fully legal turns and no test touches `game.turn`.

**How we know the new test is better:** `aiTurn` was deliberately broken so that it stops
handing the turn back. The old test passed anyway. The new one fails, along with three
others — 11 pass, 4 fail. The code was then restored.

**Lesson:** passing a value into a parameter a function already offers is *configuring*
it. Reaching in and rewriting its internal state is *cheating on its behalf*, and it can
turn a test into decoration.

**Not a bug, recorded for honesty:** in the same review a comment was found claiming
"ten ships on a 100-square board". Each board has five. Wrong comment, correct code — no
behaviour changed, but a misleading comment misleads the next reader, so it was fixed.

---

## 3. Keyboard focus was lost after every shot (Checkpoint 3)

**Found by:** browser testing of the playable version — specifically by playing with the
keyboard rather than the mouse. Reproduced every time.

**The bug:** after a shot, the screen code set that square's button to `disabled`.
Browsers will not give a disabled button keyboard focus, so focus fell back to the top of
the page. A player using only a keyboard had to Tab across the grid again for every single
turn. Nobody clicking with a mouse would ever notice.

**The fix:** fired squares stay enabled. They are marked `aria-disabled` so a screen reader
still announces them as unavailable, and the rules engine — which was always the thing
actually refusing repeat shots — is unchanged.

**Lesson:** "it works" usually means "it works the way I happened to try it".

---

## 4. An explanatory message that could never appear (Checkpoint 3)

**Found by:** the same browser testing round, by clicking a square that had already been
fired at and noticing that the promised explanation never showed.

**The bug:** the screen code contained a message — *"You have already fired at B4. Pick
another square."* — that could not run. The `disabled` from bug 3 swallowed the click
before the code could see it. The game behaved correctly (the shot was ignored and the
turn was not lost); the player simply got no explanation of why nothing happened.

**The fix:** the same one as bug 3. Once fired squares stay enabled, the click reaches the
code and the message does its job.

**Lesson:** two bugs, one cause. It is worth asking *why* a bug exists before fixing what
it looks like, because dead code often means something upstream is wrong.

---

## 5. The ship counter vanished at the end of the game (Checkpoint 3)

**Found by:** browser testing, on reaching a win.

**The bug:** the "You win" sentence *replaced* the line showing how many ships each side
had left, so the final score could not be read.

**The fix:** the result now has its own line and the count stays where it was.

---

## 6. Both boards stacked vertically on a phone in landscape (Checkpoint 3)

**Found by:** the project owner, playing the deployed game on his own phone. The 15 automated
rules tests could not catch it — they cover the rules, not the screen — and the exploratory
browser testing, which did find three other UI issues, did not expose this one either.

**The bug:** each square was a fixed 32 pixels, so one board was always 342 pixels wide and
two boards needed 748 pixels including the gap and page margins. Phones in landscape are
typically 667–844 pixels wide, so on many of them the boards did not fit side by side and
wrapped onto separate lines — the layout was technically working exactly as written, and
was still wrong.

**The fix:** the square size is now a single value the stylesheet can change, and it
shrinks on narrow screens: about 28 pixels on a 667-pixel landscape phone, which is the
largest size at which two boards still fit. Below roughly 600 pixels wide — i.e. portrait —
the boards stack on purpose and the squares return to full size.

**A limit worth stating:** Apple and Google both recommend touch targets of about 44
pixels. A ten-wide grid at 44 pixels needs a screen about 494 pixels wide *per board*, so
that target is unreachable on any phone; the boards get the largest squares the screen
allows and no more. This is a genuine trade-off of showing two 10x10 grids at once, not
something a different stylesheet could solve, so it was put to the owner as a trade-off to
accept or reject rather than quietly forced.

**Not recorded as a bug:** he then played the deployed game on his own phone and found the
squares easy to tap. Falling short of a published guideline is not the same as a defect, so
this stays a documented trade-off.

**Testing gap this exposed:** the browser used for testing would not resize below 485
pixels, so narrow layouts were only ever partly checked. That is why a human on a real
phone found this and the exploratory browser testing did not.

---

## 7. Two touching ships looked like one long ship (Checkpoint 3)

**Found by:** the project owner, playing the deployed game. A three-square ship and a
four-square ship happened to be placed next to each other, and once both were hit they
read as a single seven-square ship.

**The bug:** the rules allow ships to touch — that is intentional and unchanged — but the
screen drew every ship square in the same colour with no boundary between them, so
adjacent ships were visually indistinguishable. The game state was always correct; the
picture of it was ambiguous.

**The fix:** two changes, deliberately belt-and-braces because this is about
comprehension, not correctness.

1. Each ship is outlined on the sides where its neighbour is *not* part of that same ship,
   so two ships that touch read as two shapes.
2. A fleet list under each board names every ship, its length, and whether it is sunk. The
   enemy list gives away no positions — the names and lengths are fixed and public, and you
   are told about each sinking when it happens.

The enemy fleet is also revealed once the game is over, so the final picture can be checked
against the list.

---

## 8. The computer opponent was too weak to be worth playing (after Checkpoint 4)

**Found by:** the project owner playing the finished, deployed game. Not a rule being broken —
the opponent obeyed every rule — but it never followed up a hit, which a person notices
immediately and no rules test would ever ask about.

**The bug:** `chooseAiShot` picked uniformly from every square it had not tried and kept no
notes at all, so the result of its last shot changed nothing about its next one. After a hit,
the chance it tried a neighbouring square was about one in twenty-five. Measured over 1,000
seeded fleets it needed **95.5 shots on average** to sink seventeen squares — very nearly the
whole board — so the player won almost every game.

**The fix:** the opponent now hunts and targets, and is given its own notes
(`createAiState`) rather than none: one colour of the checkerboard while it is searching, then
the squares around its unexplained hits, preferring the line once two hits align. Same
measurement: **52.5 shots on average**, fewer than the random opponent on 100% of the same
1,000 fleets.

**Two things ships-may-touch forced, which are easy to get wrong:**

1. When a ship sinks, the opponent is told its name, so it knows how many squares it was —
   but never *which* of its hits those were, because a row of hits can be two ships moored
   together. So the bookkeeping is a count of unexplained hits, and while that count is above
   zero the chase continues on all of them. Claiming to know which hits belonged to the wreck
   would abandon half-found ships.
2. The usual trick of marking the ring of water around a sunk ship as empty is simply invalid
   in this game, and is deliberately absent. A ship may be moored right alongside the one
   that just sank.

For the same reason two aligned hits only *prefer* a direction: if that line turns out to be
two touching ships, both ends go to water and the opponent falls back to the other neighbours
of its hits instead of walking away.

**What it is allowed to know:** the squares it has fired at, whether each was a hit or a miss,
and the names of sunk ships — the same three things the player reads off the screen. Rather
than trust review, the shape of the code enforces it: the strategy is handed the grid of hits
and misses, its own notes and a random source, never a board, so the ship positions are not
reachable from anything it is given. Three tests hold that line: one asserts exactly what the
game passes the strategy and that no ship data can be reached from it, one gives the same
visible history to two completely different hidden fleets and requires the identical shot fifty
times over, and one checks the strategy does not so much as modify the grid it is shown.

**Tests added:** 13, all with the fleet placed by hand. Where the choice of square matters they
check *every* square the opponent could have picked rather than one lucky roll: the search
pattern and its fallback when that colour is used up, the follow-up after a single hit
including in a corner, carrying a line on at either end, one end blocked by the board edge,
both ends dead so it must fall back, returning to the hunt when nothing is unexplained, and a
Destroyer moored flush against a Cruiser where the first sinking leaves a hit unexplained and
the opponent has to keep going. Plus a seeded replay: the same seed plays the same game twice.

**Also added:** `scripts/ai-benchmark.js` (`npm run bench`), which plays both opponents against
the same 1,000 seeded fleets. Same fleets for both, so the difference in the numbers is the
difference between the opponents and not luck in where the ships were; each run gets its own
deep copy of the ships, their hit counters and the shots grid, so neither run can disturb the
other.

**Not changed:** the screen. `ui.js` still calls `aiTurn(game)` exactly as before, and "New
game" clears the opponent's notes for free because it rebuilds the game. The only test that had
to be rewritten was the one that used to steer the opponent by feeding it a rigged random
number — that trick relied on the opponent choosing from *all* untried squares in order, which
is no longer true. `aiTurn` now takes an optional square-chooser for that purpose, which the
game itself never passes.

**Lesson:** "obeys the rules" and "is worth playing against" are different properties, and the
15 rules tests only ever promised the first. A person playing one game spotted in seconds what
a green test suite had no opinion about.

---

## Verification after the fixes

Everything below is a *regression* run: it happened **after** the Checkpoint 3 repairs, to
confirm they work and that nothing else broke. It is not the testing that found the bugs —
bugs 3, 4 and 5 came from exploratory browser testing of the first playable version, and bugs
6 and 7 from the owner playing the deployed game. This run found nothing new, which is the
result a regression run is supposed to produce.

| Check | Result |
|---|---|
| `npm test` | 15 of 15, unchanged by every Checkpoint 3 fix |
| Keyboard: three shots in a row | Focus stayed on each fired square — the fix for bug 3 |
| Repeated shot | The explanation now appears, and still costs no turn — the fix for bug 4 |
| Ship count at game over | Still on screen beside the result — the fix for bug 5 |
| Layouts 320-844px | Side by side in landscape, stacked in portrait, no horizontal scrolling anywhere — the fix for bug 6 |
| Touching ships | Every touching pair separated by an outline; fleet lists matched the boards exactly — the fix for bug 7 |
| Enemy positions before game over | Not present anywhere in the page, not just invisible |
| Turn discipline | Rapid clicking, spamming one square, clicking during the computer's pause, and pressing New game mid-pause all stayed strictly one shot each |
| The deployed game on a phone, played by the owner at Checkpoint 4 | Landscape boards side by side and easy to tap, portrait stacked, New game resetting correctly |

The last row is the one that matters most, and it is the one no script could produce. Bugs 6
and 7 were found that way, so the fixes were confirmed the same way.

## What this log says about the process

Eight problems, and where each of them came from:

| How it was found | Which ones |
|---|---|
| A human reading requirements against tests | 1 |
| A human questioning a line of test code | 2 |
| The owner playing the finished, deployed game | 8 |
| The 15 automated rules tests | *none* |
| Exploratory browser testing of the first playable version | 3, 4, 5 |
| The owner using the deployed game on a real device | 6, 7 |
| The scripted browser regression run after the fixes | *none — 26 of 26 passed* |

The automated suite now stands at 28 tests: the 15 rules tests, unchanged in what they promise,
plus 13 for the computer opponent added with bug 8.

The 15 automated rules tests found no bug, and that is not a criticism of them: they cover the
rules, the rules were right, and they have been protecting the rules ever since — every fix
in Checkpoint 3 touched only the screen, and `npm test` staying at 15 out of 15 is what made
those fixes safe to make quickly.

Every bug found after Checkpoint 1 was in the screen, the part with no automated tests of its
own. Two of them were found only because a person used the real thing on a real device, after
all 15 automated rules tests had passed. The exploratory browser testing did find three
different UI issues, but it did not expose those two device-specific problems — a desktop
browser cannot show how a phone lays the boards out in landscape, or how a square feels under
a thumb.
