# Globe Mini — Google Sheets connected version v0.2

This package is connected to the published Google Sheets CSV feed:

https://docs.google.com/spreadsheets/d/e/2PACX-1vR3ahvvaBZxl36o7wCybngwNVpFPVmH4PtqaWEv92rQdvgd1-YIsu_jbphwc6SJog/pub?gid=305675118&single=true&output=csv

## Upload to GitHub

Upload and replace these files in the root of the Globe Mini repository:

- index.html
- style.css
- config.js
- sample-puzzle.js
- script.js

GitHub Pages will rebuild automatically after you commit.

## Required spreadsheet headers

The published tab must include these exact column headings:

- Week Start
- Puzzle #
- Title
- Author
- Status
- Grid
- Across Clues
- Down Clues
- Overall Hint

## Required row format

- Status must be `Ready`
- Week Start should be a Monday
- Grid must contain five rows separated by `/`
- Each grid row must contain exactly five letters or `#`
- Clues use `number|clue;number|clue`

Example grid:

PRESS/R#A#T/EARTH/S#E#R/STORY

## Testing

The game normally selects the newest Ready puzzle whose Week Start has arrived.

To test a specific week, add:

?week=2026-08-03

to the end of the GitHub Pages URL.
