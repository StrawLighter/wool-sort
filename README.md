# Wool Sort 🧶🐱

A cosy kitten-and-wool take on the *water sort* puzzle. Wind wool between wooden spools until every colour is together — and watch Mochi knit each finished colour straight into her scarf.

Plain HTML5 + Canvas. No build step, no dependencies. Works on phones (portrait) and desktop. Sibling of [Wool Flow](https://github.com/StrawLighter/wool-flow).

## Play

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8766
```

then visit <http://localhost:8766>. With GitHub Pages enabled the game is live at the Pages URL.

## How it plays

- Each **spool** holds up to four bands of wool (bottom → top). Tap a spool to pick up the run of same-coloured bands on top, then tap another spool to wind them on. Wool only winds onto a matching colour or an empty spool, and only as much as fits.
- **The twist — knit-away.** The moment one spool holds *every* band of a colour, Mochi knits that colour into the scarf and the spool comes back **empty**. In water sort a finished tube is dead space; here finishing a colour early buys you room, so the boards are dealt tighter (one spare spool from level 4 on).
- Empty every spool to complete the scarf. Beat par + 2 moves for three stars; using the extra spool caps you at two.
- **Little bobbins** (levels 6 and 9) hold only two bands. **Short strands** (levels 5 and 9) are colours with just three bands — gather all three to knit them. **Fuzzy wool** (levels 8 and 10) hides a band's colour until it reaches the top of its spool.

### Boosters

| Booster | Effect |
| --- | --- |
| **Undo** | Step back any number of moves. |
| **Hint** | Mochi shows the next move from a live solve of the current board. |
| **+Spool** | Adds one empty spool for this level (once). |
| **Restart** | Deal the level again. |

Keyboard: `z`/`u` undo, `h` hint, `r` restart, `Esc` deselect.

## Levels

Ten levels, dealt and proven solvable by `tools/gen.js`:

| # | Name | Colours | Spools | Twist | Par | Random-play win rate |
| - | --- | --- | --- | --- | --- | --- |
| 1 | First Stitch | 3 | 5 | tutorial | 10 | 100% |
| 2 | Two by Two | 4 | 6 | | 11 | ~91% |
| 3 | Loose Ends | 5 | 7 | | 15 | ~61% |
| 4 | Tight Knit | 5 | 6 | one spare spool | 11 | ~36% |
| 5 | Short Strand | 6 | 7 | short strand | 15 | ~26% |
| 6 | Little Bobbin | 6 | 8 | 2-band bobbin | 17 | ~24% |
| 7 | Seven Skeins | 7 | 8 | | 19 | ~12% |
| 8 | Fuzzy Logic | 7 | 8 | fuzzy wool | 24 | ~10% |
| 9 | Bobbin & Weave | 8 | 10 | bobbin + short strand | 27 | ~14% |
| 10 | Mochi's Masterpiece | 9 | 10 | fuzzy wool | 27 | ~2% |

"Random-play win rate" is how often a player making random legal moves finishes the scarf. *Par* is the true shortest solution (breadth-first search over canonical board states), stored with each level.

## Project layout

```
index.html        page shell, menu, HUD, modals
css/style.css     UI styling
js/engine.js      pure rules engine shared by browser + tools: moves, knit-away, solvers (BFS for par, DFS for hints)
js/levels.js      generated level data (do not edit by hand)
js/game.js        canvas renderer, animation, input, sound, progress
tools/gen.js      level generator: deals, verifies, rates difficulty, writes js/levels.js
assets/           art
```

### Regenerating levels

```bash
node --max-old-space-size=6144 tools/gen.js   # rebuild js/levels.js from the SPECS table
node tools/gen.js --check                      # re-verify every stored solution
```

To add a level, append a spec to `SPECS` in `tools/gen.js` (`colors`, `empties`, optional `smalls` bobbin capacities, `shorts` short-strand colours, `hidden`, and a `target` random-win-rate band) and rerun.

## Art

Logo, background, wooden spool, kitten poses, toolbar icons, the "Purr-fect!" banner and the two white wool textures were generated with Higgsfield (GPT Image 2.5), 12 images / 12 credits, then trimmed. The wool band and scarf textures are white so the game tints them per colour at runtime (`multiply` on an offscreen canvas) — any palette works. The celebration and thinking kittens reuse Wool Flow's Mochi so the two games share a character. Sounds are a tiny WebAudio synth; there are no audio files.

## Licence

MIT for the code. Art assets are for this project.
