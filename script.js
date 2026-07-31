const SIZE = 5;

let puzzle = null;
let cells = [];
let entries = { across: [], down: [] };
let selected = null;
let direction = "across";
let mistakes = 0;
let elapsedSeconds = 0;
let timerId = null;
let completed = false;
let revealedCells = new Set();

const gridEl = document.getElementById("grid");
const acrossEl = document.getElementById("acrossClues");
const downEl = document.getElementById("downClues");
const titleEl = document.getElementById("puzzleTitle");
const timerEl = document.getElementById("timer");
const mistakeEl = document.getElementById("mistakeCount");
const hintButton = document.getElementById("hintButton");
const hintPanel = document.getElementById("hintPanel");
const hintText = document.getElementById("hintText");
const helpButton = document.getElementById("helpButton");
const helpPanel = document.getElementById("helpPanel");
const checkButton = document.getElementById("checkButton");
const revealButton = document.getElementById("revealButton");
const clearButton = document.getElementById("clearButton");
const byline = document.getElementById("byline");
const menuModal = document.getElementById("menuModal");
const menuTitle = document.getElementById("menuTitle");
const menuOptions = document.getElementById("menuOptions");
const resultModal = document.getElementById("resultModal");
const resultTitle = document.getElementById("resultTitle");
const resultMessage = document.getElementById("resultMessage");
const doneButton = document.getElementById("doneButton");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      field += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i++;
      row.push(field);
      if (row.some(value => value.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some(value => value.trim() !== "")) rows.push(row);
  return rows;
}

function parseClues(value) {
  return String(value || "")
    .split(";")
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const divider = item.indexOf("|");
      return {
        number: Number(item.slice(0, divider)),
        clue: item.slice(divider + 1).trim()
      };
    });
}

function mondayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MINI_CONFIG.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const value = type => Number(parts.find(part => part.type === type)?.value);
  const localDate = new Date(Date.UTC(value("year"), value("month") - 1, value("day")));
  const day = localDate.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  localDate.setUTCDate(localDate.getUTCDate() + offset);
  return localDate.toISOString().slice(0, 10);
}

async function loadPuzzle() {
  if (!MINI_CONFIG.puzzleFeedUrl) return SAMPLE_MINI_PUZZLE;

  const separator = MINI_CONFIG.puzzleFeedUrl.includes("?") ? "&" : "?";
  const response = await fetch(
    `${MINI_CONFIG.puzzleFeedUrl}${separator}cacheBust=${Date.now()}`,
    { cache: "no-store" }
  );

  if (!response.ok) throw new Error("Could not load the crossword feed.");

  const rows = parseCsv(await response.text());
  const headerIndex = rows.findIndex(row =>
    row.some(cell => cell.trim().toUpperCase() === "WEEK START") &&
    row.some(cell => cell.trim().toUpperCase() === "GRID")
  );

  if (headerIndex === -1) throw new Error("Could not find the feed headers.");

  const headers = rows[headerIndex].map(cell => cell.trim().toUpperCase());
  const index = name => headers.indexOf(name);
  const targetWeek = new URLSearchParams(location.search).get("week") || mondayKey();

  const candidates = rows.slice(headerIndex + 1)
    .map(row => ({
      weekStart: String(row[index("WEEK START")] || "").trim(),
      puzzleNumber: String(row[index("PUZZLE #")] || "").trim(),
      title: String(row[index("TITLE")] || "").trim(),
      author: String(row[index("AUTHOR")] || "").trim(),
      status: String(row[index("STATUS")] || "").trim().toUpperCase(),
      grid: String(row[index("GRID")] || "").trim().split("/"),
      across: parseClues(row[index("ACROSS CLUES")]),
      down: parseClues(row[index("DOWN CLUES")]),
      overallHint: String(row[index("OVERALL HINT")] || "").trim()
    }))
    .filter(item => item.status === MINI_CONFIG.readyStatus)
    .filter(item => item.weekStart <= targetWeek)
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart));

  if (!candidates.length) throw new Error("No Ready crossword is available.");
  return candidates[0];
}

function buildEntries() {
  cells = Array.from({ length: SIZE }, (_, row) =>
    Array.from({ length: SIZE }, (_, col) => ({
      row,
      col,
      answer: puzzle.grid[row][col],
      value: "",
      number: null,
      acrossId: null,
      downId: null
    }))
  );

  entries = { across: [], down: [] };
  let number = 1;

  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const cell = cells[row][col];
      if (cell.answer === "#") continue;

      const startsAcross =
        (col === 0 || cells[row][col - 1].answer === "#") &&
        col + 1 < SIZE &&
        cells[row][col + 1].answer !== "#";

      const startsDown =
        (row === 0 || cells[row - 1][col].answer === "#") &&
        row + 1 < SIZE &&
        cells[row + 1][col].answer !== "#";

      if (startsAcross || startsDown) cell.number = number++;

      if (startsAcross) {
        const entryCells = [];
        let c = col;
        while (c < SIZE && cells[row][c].answer !== "#") {
          entryCells.push(cells[row][c]);
          c++;
        }
        const entry = {
          id: `A${cell.number}`,
          direction: "across",
          number: cell.number,
          cells: entryCells,
          clue: puzzle.across.find(item => item.number === cell.number)?.clue || "Clue missing"
        };
        entries.across.push(entry);
        entryCells.forEach(item => item.acrossId = entry.id);
      }

      if (startsDown) {
        const entryCells = [];
        let r = row;
        while (r < SIZE && cells[r][col].answer !== "#") {
          entryCells.push(cells[r][col]);
          r++;
        }
        const entry = {
          id: `D${cell.number}`,
          direction: "down",
          number: cell.number,
          cells: entryCells,
          clue: puzzle.down.find(item => item.number === cell.number)?.clue || "Clue missing"
        };
        entries.down.push(entry);
        entryCells.forEach(item => item.downId = entry.id);
      }
    }
  }
}

function renderGrid() {
  gridEl.innerHTML = "";

  cells.flat().forEach(cell => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cell";
    button.dataset.row = cell.row;
    button.dataset.col = cell.col;

    if (cell.answer === "#") {
      button.classList.add("block");
      button.tabIndex = -1;
    } else {
      button.innerHTML = `
        <span class="cell-number">${cell.number || ""}</span>
        <span class="cell-letter"></span>
      `;
      button.addEventListener("click", () => selectCell(cell, true));
    }

    gridEl.appendChild(button);
  });
}

function renderClues() {
  renderClueList(entries.across, acrossEl);
  renderClueList(entries.down, downEl);
}

function renderClueList(list, container) {
  container.innerHTML = "";

  list.forEach(entry => {
    const item = document.createElement("li");
    item.className = "clue-item";
    item.dataset.entryId = entry.id;
    item.innerHTML = `
      <span class="clue-number">${entry.number}</span>
      <span>${entry.clue}</span>
    `;
    item.addEventListener("click", () => {
      direction = entry.direction;
      const target = entry.cells.find(cell => !cell.value) || entry.cells[0];
      selectCell(target, false);
    });
    container.appendChild(item);
  });
}

function cellElement(cell) {
  return gridEl.querySelector(`[data-row="${cell.row}"][data-col="${cell.col}"]`);
}

function currentEntry() {
  if (!selected) return null;
  const id = direction === "across" ? selected.acrossId : selected.downId;
  return [...entries.across, ...entries.down].find(entry => entry.id === id) || null;
}

function selectCell(cell, toggleDirection) {
  if (cell.answer === "#") return;

  if (
    toggleDirection &&
    selected === cell &&
    cell.acrossId &&
    cell.downId
  ) {
    direction = direction === "across" ? "down" : "across";
  } else if (!cell[`${direction}Id`]) {
    direction = cell.acrossId ? "across" : "down";
  }

  selected = cell;
  updateHighlights();
  cellElement(cell).focus();
}

function updateHighlights() {
  gridEl.querySelectorAll(".cell").forEach(el => {
    el.classList.remove("selected", "active-word");
  });

  document.querySelectorAll(".clue-item").forEach(el => {
    el.classList.remove("active");
  });

  if (!selected) return;

  const entry = currentEntry();
  if (entry) {
    entry.cells.forEach(cell => cellElement(cell).classList.add("active-word"));
    document.querySelector(`[data-entry-id="${entry.id}"]`)?.classList.add("active");
  }

  cellElement(selected).classList.add("selected");
}

function updateCellDisplay(cell) {
  const el = cellElement(cell);
  if (!el) return;
  el.querySelector(".cell-letter").textContent = cell.value;
}

function moveWithinEntry(step) {
  const entry = currentEntry();
  if (!entry) return;

  const index = entry.cells.indexOf(selected);
  let next = index + step;

  if (next < 0) next = 0;
  if (next >= entry.cells.length) next = entry.cells.length - 1;

  selectCell(entry.cells[next], false);
}

function advanceAfterTyping() {
  const entry = currentEntry();
  if (!entry) return;

  const index = entry.cells.indexOf(selected);
  const nextEmpty = entry.cells.slice(index + 1).find(cell => !cell.value);

  if (nextEmpty) {
    selectCell(nextEmpty, false);
  } else if (index + 1 < entry.cells.length) {
    selectCell(entry.cells[index + 1], false);
  }
}

function handleLetter(letter) {
  if (!selected || completed) return;

  selected.value = letter;
  cellElement(selected).classList.remove("incorrect");
  updateCellDisplay(selected);
  advanceAfterTyping();
  saveState();
  checkForCompletion();
}

function handleBackspace() {
  if (!selected || completed) return;

  if (selected.value) {
    selected.value = "";
    updateCellDisplay(selected);
  } else {
    moveWithinEntry(-1);
    selected.value = "";
    updateCellDisplay(selected);
  }

  saveState();
}

function handleArrow(key) {
  if (!selected) return;

  const delta = {
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0]
  }[key];

  if (!delta) return;

  if (key === "ArrowLeft" || key === "ArrowRight") direction = "across";
  else direction = "down";

  let row = selected.row + delta[0];
  let col = selected.col + delta[1];

  while (row >= 0 && row < SIZE && col >= 0 && col < SIZE) {
    if (cells[row][col].answer !== "#") {
      selectCell(cells[row][col], false);
      return;
    }
    row += delta[0];
    col += delta[1];
  }

  updateHighlights();
}

function getScopeCells(scope) {
  if (scope === "square") return selected ? [selected] : [];
  if (scope === "word") return currentEntry()?.cells || [];
  return cells.flat().filter(cell => cell.answer !== "#");
}

function checkScope(scope) {
  const scopeCells = getScopeCells(scope);
  let newMistakes = 0;

  scopeCells.forEach(cell => {
    const el = cellElement(cell);
    el.classList.remove("incorrect");

    if (cell.value && cell.value !== cell.answer) {
      el.classList.add("incorrect");
      newMistakes++;
    }
  });

  if (newMistakes > 0) {
    mistakes += newMistakes;
    mistakeEl.textContent = mistakes;
    saveState();
  }

  checkForCompletion();
}

function revealScope(scope) {
  const scopeCells = getScopeCells(scope);
  if (!scopeCells.length) return;

  const label = scope === "square" ? "this square" : scope === "word" ? "this word" : "the entire puzzle";
  if (!window.confirm(`Reveal ${label}? Revealed letters will be marked.`)) return;

  scopeCells.forEach(cell => {
    cell.value = cell.answer;
    revealedCells.add(`${cell.row}-${cell.col}`);
    const el = cellElement(cell);
    el.classList.remove("incorrect");
    el.classList.add("revealed");
    updateCellDisplay(cell);
  });

  saveState();
  checkForCompletion();
}

function openMenu(type) {
  menuTitle.textContent = type === "check" ? "Check" : "Reveal";
  menuOptions.innerHTML = "";

  [
    ["square", "Square"],
    ["word", "Current word"],
    ["puzzle", "Entire puzzle"]
  ].forEach(([scope, label]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () => {
      closeModal(menuModal);
      if (type === "check") checkScope(scope);
      else revealScope(scope);
    });
    menuOptions.appendChild(button);
  });

  openModal(menuModal);
}

function checkForCompletion() {
  const openCells = cells.flat().filter(cell => cell.answer !== "#");
  const filled = openCells.every(cell => cell.value);
  const correct = openCells.every(cell => cell.value === cell.answer);

  if (filled && correct && !completed) {
    completed = true;
    stopTimer();
    saveState();
    requestAnimationFrame(() => requestAnimationFrame(showCompletion));
  }
}

function showCompletion() {
  const usedReveal = revealedCells.size > 0;
  resultTitle.textContent = usedReveal ? "Puzzle complete!" : "Congratulations!";
  resultMessage.textContent =
    `You finished ${puzzle.title} in ${formatTime(elapsedSeconds)} with ${mistakes} ${mistakes === 1 ? "mistake" : "mistakes"}.`;
  openModal(resultModal);
  doneButton.focus();
}

function openModal(modal) {
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(modal) {
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function startTimer() {
  stopTimer();
  timerEl.textContent = formatTime(elapsedSeconds);

  if (completed) return;

  timerId = window.setInterval(() => {
    elapsedSeconds++;
    timerEl.textContent = formatTime(elapsedSeconds);
    if (elapsedSeconds % 5 === 0) saveState();
  }, 1000);
}

function stopTimer() {
  if (timerId) window.clearInterval(timerId);
  timerId = null;
}

function storageKey() {
  return `globe-mini:${puzzle.weekStart}:${puzzle.puzzleNumber}`;
}

function saveState() {
  if (!puzzle) return;

  localStorage.setItem(storageKey(), JSON.stringify({
    values: cells.flat().map(cell => cell.value),
    mistakes,
    elapsedSeconds,
    completed,
    revealedCells: [...revealedCells]
  }));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey()));
    if (!saved) return;

    cells.flat().forEach((cell, index) => {
      if (cell.answer !== "#") cell.value = saved.values?.[index] || "";
    });

    mistakes = Number(saved.mistakes || 0);
    elapsedSeconds = Number(saved.elapsedSeconds || 0);
    completed = Boolean(saved.completed);
    revealedCells = new Set(saved.revealedCells || []);
  } catch {
    localStorage.removeItem(storageKey());
  }
}

function restoreDisplay() {
  cells.flat().forEach(cell => {
    if (cell.answer === "#") return;
    updateCellDisplay(cell);

    const key = `${cell.row}-${cell.col}`;
    if (revealedCells.has(key)) cellElement(cell).classList.add("revealed");
  });

  mistakeEl.textContent = mistakes;
  timerEl.textContent = formatTime(elapsedSeconds);
}

async function initialize() {
  try {
    puzzle = await loadPuzzle();

    if (!Array.isArray(puzzle.grid) || puzzle.grid.length !== SIZE || puzzle.grid.some(row => row.length !== SIZE)) {
      throw new Error("The puzzle grid must be exactly 5×5.");
    }

    titleEl.textContent = `${puzzle.title}${puzzle.puzzleNumber ? ` · #${puzzle.puzzleNumber}` : ""}`;
    byline.innerHTML = `By ${puzzle.author || "The Globe Staff"} · <em>The Globe</em>`;

    hintButton.disabled = !puzzle.overallHint;
    hintText.textContent = puzzle.overallHint || "";

    buildEntries();
    renderGrid();
    renderClues();
    loadState();
    restoreDisplay();

    const first = cells.flat().find(cell => cell.answer !== "#");
    selectCell(first, false);
    startTimer();

    if (completed) showCompletion();
  } catch (error) {
    titleEl.textContent = "Crossword unavailable";
    gridEl.innerHTML = `<p>${error.message}</p>`;
  }
}

document.addEventListener("keydown", event => {
  if (document.querySelector(".modal-backdrop.is-open")) {
    if (event.key === "Escape") {
      document.querySelectorAll(".modal-backdrop.is-open").forEach(closeModal);
    }
    return;
  }

  if (/^[a-zA-Z]$/.test(event.key)) {
    handleLetter(event.key.toUpperCase());
    event.preventDefault();
  } else if (event.key === "Backspace" || event.key === "Delete") {
    handleBackspace();
    event.preventDefault();
  } else if (event.key.startsWith("Arrow")) {
    handleArrow(event.key);
    event.preventDefault();
  } else if (event.key === " " && selected?.acrossId && selected?.downId) {
    direction = direction === "across" ? "down" : "across";
    updateHighlights();
    event.preventDefault();
  }
});

helpButton.addEventListener("click", () => {
  helpPanel.hidden = !helpPanel.hidden;
});

hintButton.addEventListener("click", () => {
  hintPanel.hidden = !hintPanel.hidden;
});

checkButton.addEventListener("click", () => openMenu("check"));
revealButton.addEventListener("click", () => openMenu("reveal"));

document.querySelectorAll("[data-close]").forEach(button => {
  button.addEventListener("click", () => closeModal(document.getElementById(button.dataset.close)));
});

doneButton.addEventListener("click", () => closeModal(resultModal));

document.querySelectorAll(".modal-backdrop").forEach(modal => {
  modal.addEventListener("click", event => {
    if (event.target === modal) closeModal(modal);
  });
});

clearButton.addEventListener("click", () => {
  if (!puzzle) return;
  if (!window.confirm("Clear this browser's saved progress for the current crossword?")) return;
  localStorage.removeItem(storageKey());
  location.reload();
});

initialize();
