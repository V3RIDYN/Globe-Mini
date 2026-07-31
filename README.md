# Globe Mini Crossword v0.1

A playable 5×5 weekly mini crossword prototype for The Globe.

## Included features

- 5×5 crossword grid
- Automatic clue numbering
- Across and Down clues
- Mouse, touchscreen, and keyboard entry
- Click the same crossing square again to switch direction
- Arrow-key navigation
- Active square and active word highlighting
- Check Square
- Check Current Word
- Check Entire Puzzle
- Reveal Square
- Reveal Current Word
- Reveal Entire Puzzle
- Confirmation before revealing
- Timer
- Mistake count
- Saved browser progress
- Completion popup
- Optional overall hint
- Responsive layout for SNO embedding

## Test locally

Unzip the folder and open `index.html`.

The included sample crossword is only for testing the game interface.

## Connect Google Sheets later

1. Publish a compact feed sheet as CSV.
2. Open `config.js`.
3. Paste its published CSV address into `puzzleFeedUrl`.
4. Upload the revised files to GitHub.

The expected feed columns are:

- Week Start
- Puzzle #
- Title
- Author
- Status
- Grid
- Across Clues
- Down Clues
- Overall Hint

Grid example:

`PRESS/R#A#T/EARTH/S#E#R/STORY`

Clue example:

`1|The news media, collectively;6|Our planet;7|A reported narrative`

## GitHub upload

Upload all five files to the root of a GitHub repository:

- index.html
- style.css
- config.js
- sample-puzzle.js
- script.js
