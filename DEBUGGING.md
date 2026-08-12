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

**Found by:** the project owner, playing the deployed game on his own phone. Neither the
automated tests nor the browser testing caught it.

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
something a different stylesheet could solve.

**Testing gap this exposed:** the browser used for testing would not resize below 485
pixels, so narrow layouts were only ever partly checked. That is why a human on a real
phone found this and the automated testing did not.

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

## What this log says about the process

Seven problems, found four different ways:

| How it was found | Which ones |
|---|---|
| A human reading requirements against tests | 1 |
| A human questioning a line of test code | 2 |
| Automated tests | *none* |
| Playing the game in a browser | 3, 4, 5 |
| The owner using the deployed game on a real device | 6, 7 |

The automated tests found nothing, and that is not a criticism of them: they cover the
rules, the rules were right, and they have been protecting the rules ever since — every fix
in Checkpoint 3 touched only the screen, and `npm test` staying at 15 out of 15 is what made
those fixes safe to make quickly.

Every bug found after Checkpoint 1 was in the part with no automated tests. Two of them were
found only because a person used the real thing on a real device, after both the test suite
and a scripted browser run had passed.
