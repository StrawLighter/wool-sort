# Wool Sort 🧶🐱

A cosy kitten-and-wool take on the *water sort* puzzle. Wind wool between wooden spools until every colour is together — and watch Mochi knit each finished colour straight into her scarf. **100 levels in ten chapters, plus a daily puzzle.**

Plain HTML5 + Canvas. No build step, no dependencies. Works on phones (portrait) and desktop. Sibling of [Wool Flow](https://github.com/StrawLighter/wool-flow).

## Play

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8766
```

then visit <http://localhost:8766>. With GitHub Pages enabled the game is live at the Pages URL.

## How it plays

- Each **spool** holds up to four bands of wool (bottom → top). Tap a spool to pick up the run of same-coloured bands on top, then tap another spool to wind them on. Wool only winds onto a matching colour or an empty spool, and only as much as fits.
- **The twist — knit-away.** The moment one spool holds *every* band of a colour, Mochi knits that colour into the scarf and the spool comes back **empty**. In water sort a finished tube is dead space; here finishing a colour early buys you room, so the boards are dealt tighter than the original (one spare spool is the norm from chapter 2).
- Empty every spool to complete the scarf. Beat par + 2 moves for three stars; using the extra spool caps you at two.
- **Little bobbins** hold only two or three bands. **Short strands** are colours with just three bands — gather all three to knit them. **Fuzzy wool** hides a band's colour until it reaches the top of its spool.

### Boosters

| Booster | Effect |
| --- | --- |
| **Undo** | Step back any number of moves. |
| **Hint** | Mochi shows the next move from a live solve of the current board. |
| **+Spool** | Adds one empty spool for this level (once). |
| **Restart** | Deal the level again. |

Keyboard: `z`/`u` undo, `h` hint, `r` restart, `k` toggle Mochi smack, `Esc` deselect.

### Mochi smack (test)

With the 🐾 button in the HUD on (the default), every move is delivered by Mochi: she drops onto the source spool, winds up with a paw raised, smacks the top band, and the wool shoots across to the target spool along its strand before she hops away. It uses Wool Flow's front-view swipe sheet (`assets/kitten_swipe_front_sheet.png`) and adds about a quarter of a second per move. Turn it off to get the plain wind animation.

## Daily Puzzle

One fresh board a day, the same for everyone: the level is dealt in the browser from a hash of the local date (`WoolEngine.buildDaily('YYYY-MM-DD')`), verified solvable and given an exact A* par on the spot (well under a second). Each weekday has its own twist — plain Monday, short-strand Tuesday, bobbin Wednesday, fuzzy Thursday, odd-bobbin Friday, a bigger two-spare Saturday and a HARD Sunday finale (fuzzy + bobbin + an extra colour). Results and a 🔥 streak are kept in the browser; the win screen has a Share button that copies a one-line result.

## Sound

All sound effects are synthesised live with WebAudio (no audio files): a wool swish and pluck when you pick up, a per-band pluck as wool winds on, a soft thump when you drop, needle clicks and a bell run when Mochi knits, a jingle with a kitten meow and purr on a win, a sad mew when you are stuck, and small pops for the UI. The speaker button in the HUD mutes everything.

## Colour scheme

The palette follows the Sesame Street principle of a calm neutral base with bold saturated primaries on everything you can touch:

- **Wool colours** (`PALETTE` in `js/engine.js`): Elmo Red `#e4002b`, Cookie Blue `#1f75fe`, Big Bird Yellow `#ffd23f`, Oscar Green `#3cb44b`, Ernie Orange `#ff7f11`, Count Purple `#7b2cbf`, Abby Pink `#ff5fa2`, Rosita Teal `#12b5c6`, Snuffy Brown `#8d5524`, Telly Magenta `#d6249f`, Kermit Lime `#9acd32`, Grover Blue `#22318f` (+ two spares). The wool texture is blended lightly so the colours stay vivid.
- **UI** (`:root` in `css/style.css`): red for the call to action (Play / Next / Restart-in-modal), yellow for reward (stars, moves badge, completed levels, Hint), blue for tools (Undo, Daily, Share, home/sound), green for go (+Spool, Replay), orange for Restart. Everything gets a chunky dark-ink outline and a hard drop shadow; each chapter has its own colour pill and level stripe.

## Levels

Like the original water-sort games, the colour count and spool count climb steadily while spare spools shrink, hidden-colour boards appear once you are past the basics, and every tenth level is a marked **HARD** finale. Each decade of Wool Sort follows the same rhythm:

| Level ends in | Board |
| --- | --- |
| 1 | breather — two spare spools |
| 2, 6 | plain board, one spare spool |
| 3 | short strand |
| 4 | little bobbin (2 bands) |
| 5 | breather, fuzzy wool from chapter 4 |
| 7 | fuzzy wool |
| 8 | 3-band bobbin + short strand |
| 9 | plain, with a bobbin from chapter 6 |
| 0 | **HARD**: fuzzy wool, one spare spool, bobbin from chapter 5 |

Colours: 3–9 in chapter 1, then 5–6, 6–7, 7–8, 8–9, 9–10, 9–10, 10–11, 11–12 and 12 in chapters 2–10 (the palette has 14 colours, 12 are used).

All 100 levels are dealt and proven solvable by `tools/gen.js`. *Par* is the exact shortest solution from an A* search (admissible heuristic: a colour split into *r* runs needs at least *r − 1* moves); "random-play win" is how often a player making random legal moves finishes the scarf.

<details>
<summary>All 100 levels</summary>

| # | Name | Colours | Spools | Twist | Par | Random-play win |
| - | --- | --- | --- | --- | --- | --- |
| 1 | First Stitch | 3 | 5 | 2 spare | 10 | 100% |
| 2 | Two by Two | 4 | 6 | 2 spare | 11 | 91% |
| 3 | Loose Ends | 5 | 7 | 2 spare | 15 | 61% |
| 4 | Tight Knit | 5 | 6 |  | 11 | 36% |
| 5 | Short Strand | 6 | 7 | short strand | 15 | 26% |
| 6 | Little Bobbin | 6 | 8 | bobbin | 17 | 24% |
| 7 | Seven Skeins | 7 | 8 |  | 19 | 12% |
| 8 | Fuzzy Logic | 7 | 8 | fuzzy | 24 | 10% |
| 9 | Bobbin & Weave | 8 | 10 | bobbin, short strand | 27 | 14% |
| 10 | Mochi's Masterpiece | 9 | 10 | fuzzy | 27 | 2.0% |
| 11 | Casting On | 5 | 7 | 2 spare | 14 | 73% |
| 12 | Purl One | 5 | 6 |  | 14 | 19% |
| 13 | Knit Two | 5 | 6 | short strand | 13 | 18% |
| 14 | Slip Stitch | 5 | 7 | bobbin | 15 | 37% |
| 15 | Garter Row | 5 | 7 | 2 spare | 15 | 71% |
| 16 | Yarn Over | 6 | 7 |  | 18 | 18% |
| 17 | Moth in the Wool | 6 | 7 | fuzzy | 20 | 21% |
| 18 | Fuzzy Slippers | 6 | 8 | bobbin, short strand | 17 | 50% |
| 19 | Wound Tight | 6 | 7 |  | 18 | 19% |
| 20 | Dropped Stitch | 6 | 7 | fuzzy, **HARD** | 18 | 30% |
| 21 | Rib Stitch | 6 | 8 | 2 spare | 18 | 51% |
| 22 | Seed Stitch | 6 | 7 |  | 16 | 10% |
| 23 | Loose Thread | 6 | 7 | short strand | 18 | 10% |
| 24 | Wee Bobbin | 6 | 8 | bobbin | 19 | 12% |
| 25 | Cosy Corner | 6 | 8 | 2 spare | 18 | 34% |
| 26 | Twisted Yarn | 7 | 8 |  | 24 | 12% |
| 27 | Mystery Skein | 7 | 8 | fuzzy | 22 | 10% |
| 28 | Odd Bobbin | 7 | 9 | bobbin, short strand | 21 | 34% |
| 29 | Bramble Wool | 7 | 8 |  | 20 | 13% |
| 30 | Cable Knot | 7 | 8 | fuzzy, **HARD** | 19 | 11% |
| 31 | Tea Break | 7 | 9 | 2 spare | 22 | 28% |
| 32 | Double Knit | 7 | 8 |  | 22 | 6.0% |
| 33 | Frayed Ends | 7 | 8 | short strand | 20 | 5.5% |
| 34 | Cotton Reel | 7 | 9 | bobbin | 21 | 7.0% |
| 35 | Nap Time | 7 | 9 | fuzzy, 2 spare | 23 | 28% |
| 36 | Herringbone | 8 | 9 |  | 24 | 5.8% |
| 37 | Hidden Hank | 8 | 9 | fuzzy | 28 | 6.7% |
| 38 | Shuttle & Spool | 8 | 10 | bobbin, short strand | 22 | 19% |
| 39 | Tangle Tuesday | 8 | 9 |  | 26 | 5.8% |
| 40 | Cable Knit | 8 | 9 | fuzzy, **HARD** | 26 | 5.0% |
| 41 | Fresh Fleece | 8 | 10 | 2 spare | 24 | 5.8% |
| 42 | Basket Weave | 8 | 9 |  | 26 | 2.5% |
| 43 | Snipped Short | 8 | 9 | short strand | 24 | 3.3% |
| 44 | Tiny Reel | 8 | 10 | bobbin | 23 | 10% |
| 45 | Lamp Light | 8 | 10 | fuzzy, 2 spare | 25 | 17% |
| 46 | Cross Stitch | 9 | 10 |  | 29 | 2.5% |
| 47 | Foggy Fleece | 9 | 10 | fuzzy | 26 | 2.5% |
| 48 | Bobbin Lace | 9 | 11 | bobbin, short strand | 30 | 18% |
| 49 | Long Night | 9 | 10 |  | 25 | 2.5% |
| 50 | Fair Isle | 9 | 11 | fuzzy, bobbin, **HARD** | 28 | 2.5% |
| 51 | Sunday Skein | 9 | 11 | 2 spare | 29 | 8.3% |
| 52 | Lace Panel | 9 | 10 |  | 28 | 1.7% |
| 53 | Short Row | 9 | 10 | short strand | 28 | 1.7% |
| 54 | Thimble | 9 | 11 | bobbin | 30 | 1.7% |
| 55 | Mochi's Nap | 9 | 11 | fuzzy, 2 spare | 28 | 3.3% |
| 56 | Stockinette | 10 | 11 |  | 32 | 1.3% |
| 57 | Fuzzy Mittens | 10 | 11 | fuzzy | 31 | 1.3% |
| 58 | Spindle & Spool | 10 | 12 | bobbin, short strand | 33 | 1.3% |
| 59 | Late Stitches | 10 | 12 | bobbin | 30 | 1.3% |
| 60 | Double Points | 10 | 12 | fuzzy, bobbin, **HARD** | 33 | 1.3% |
| 61 | Warm Up | 9 | 11 | 2 spare | 30 | 6.7% |
| 62 | Chevron | 9 | 10 |  | 30 | 0.0% |
| 63 | Loose Loop | 9 | 10 | short strand | 32 | 0.0% |
| 64 | Mini Bobbin | 9 | 11 | bobbin | 28 | 0.8% |
| 65 | Fireside | 9 | 11 | fuzzy, 2 spare | 29 | 6.7% |
| 66 | Zigzag Rib | 10 | 11 |  | 31 | 0.0% |
| 67 | Wool Mist | 10 | 11 | fuzzy | 34 | 0.0% |
| 68 | Reel & Remnant | 10 | 12 | bobbin, short strand | 32 | 11% |
| 69 | Knotty | 10 | 12 | bobbin | 37* | 1.3% |
| 70 | Tangled Skeins | 10 | 12 | fuzzy, bobbin, **HARD** | 34 | 3.7% |
| 71 | Morning Yarn | 10 | 12 | 2 spare | 32 | 3.7% |
| 72 | Diamond Rib | 10 | 11 |  | 31 | 0.0% |
| 73 | Odd Length | 10 | 11 | short strand | 31 | 0.0% |
| 74 | Bobbin Jar | 10 | 12 | bobbin | 34 | 1.3% |
| 75 | Cushion Pile | 10 | 12 | fuzzy, 2 spare | 31 | 5.0% |
| 76 | Honeycomb | 11 | 12 |  | 36 | 0.0% |
| 77 | Lost Colour | 11 | 12 | fuzzy | 36 | 0.0% |
| 78 | Spare Reel | 11 | 13 | bobbin, short strand | 34 | 5.0% |
| 79 | Thick Wool | 11 | 13 | bobbin | 35 | 0.0% |
| 80 | Moth Holes | 11 | 13 | fuzzy, bobbin, **HARD** | 37 | 1.3% |
| 81 | Wide Awake | 11 | 13 | 2 spare | 34 | 2.5% |
| 82 | Trellis | 11 | 12 |  | 37 | 0.0% |
| 83 | Cut Strand | 11 | 12 | short strand | 38 | 0.0% |
| 84 | Dinky Bobbin | 11 | 13 | bobbin | 34 | 0.0% |
| 85 | Purring Along | 11 | 13 | fuzzy, 2 spare | 35 | 2.5% |
| 86 | Braided Cable | 12 | 13 |  | 38 | 0.0% |
| 87 | Foggy Night | 12 | 13 | fuzzy | 38 | 0.0% |
| 88 | Bobbin Pair | 12 | 14 | bobbin, short strand | 36 | 1.3% |
| 89 | Endless Row | 12 | 14 | bobbin | 47* | 0.0% |
| 90 | Aran Sweater | 12 | 14 | fuzzy, bobbin, **HARD** | 47* | 0.0% |
| 91 | Last Light | 12 | 14 | 2 spare | 37 | 2.5% |
| 92 | Twelve Skeins | 12 | 13 |  | 39 | 0.0% |
| 93 | Short & Sweet | 12 | 13 | short strand | 39 | 0.0% |
| 94 | Smallest Bobbin | 12 | 14 | bobbin | 37 | 0.0% |
| 95 | Whiskers | 12 | 14 | fuzzy, 2 spare | 40 | 0.0% |
| 96 | Master Rib | 12 | 13 |  | 40 | 0.0% |
| 97 | Blind Knit | 12 | 13 | fuzzy | 40 | 0.0% |
| 98 | Reel Trouble | 12 | 14 | bobbin, short strand | 46* | 1.3% |
| 99 | Ninety-Nine Stitches | 12 | 14 | bobbin | 42* | 0.0% |
| 100 | The Grand Scarf | 12 | 14 | fuzzy, bobbin, **HARD** | 36 | 0.0% |

\* par from the best of 24 randomised depth-first solves (the A* search hit its node cap), so it may be beatable.

</details>

## Project layout

```
index.html        page shell, menu, HUD, modals
css/style.css     UI styling
js/engine.js      pure rules engine shared by browser + tools: moves, knit-away, dealing, daily puzzle, solvers (A* for par, BFS, DFS for hints)
js/levels.js      generated level data (do not edit by hand)
js/game.js        canvas renderer, animation, input, WebAudio sound kit, daily puzzle UI, progress
tools/gen.js      level generator: deals, verifies, rates difficulty, writes js/levels.js (worker threads)
assets/           art
```

### Regenerating levels

```bash
node tools/gen.js                 # regenerate 11-100, keep the hand-tuned 1-10
node tools/gen.js --range 41-60   # regenerate one range, keep the rest
node tools/gen.js --all           # everything
node tools/gen.js --check         # re-verify every stored solution
node tools/gen.js --table         # print the level table below
```

Levels 1–10 are hand-tuned specs in `HAND`; 11–100 come from `specFor(id)` in `tools/gen.js`. The generator uses one worker thread per core and takes a few minutes for the full set.

## Art

Logo, background, wooden spool, kitten poses, toolbar icons, the daily-puzzle icon, the "Purr-fect!" banner and the two white wool textures were generated with Higgsfield (GPT Image 2.5), 15 images / 15 credits, then trimmed. The wool band and scarf textures are white so the game tints them per colour at runtime (`multiply` on an offscreen canvas) — any palette works. The celebration and thinking kittens reuse Wool Flow's Mochi so the two games share a character. Sounds are synthesised with WebAudio; there are no audio files.

## Licence

MIT for the code. Art assets are for this project.
