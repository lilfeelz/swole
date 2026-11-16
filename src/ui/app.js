import { createBrowserStore } from "../stores/browser.js";
import { createService } from "../core/service.js";

/**
 * Queries a DOM element by ID.
 *
 * @param {string} id Element ID.
 * @returns {any} Matching element.
 */
const $ = (id) => document.getElementById(id);

let api = null;
let timerRunning = false;
let accumulatedSeconds = 0;
let lastStartedAt = 0;
let timerInterval = null;
let workoutStartAt = null;
let busy = false;

/**
 * Formats seconds count as HH:MM:SS.
 *
 * @param {number} totalSeconds Total seconds elapsed.
 * @returns {string} Formatted clock string.
 */
function formatClock(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return (
    String(h).padStart(2, "0") +
    ":" +
    String(m).padStart(2, "0") +
    ":" +
    String(s).padStart(2, "0")
  );
}

/**
 * Calculates total elapsed workout seconds.
 *
 * @returns {number} Elapsed seconds.
 */
function getElapsedSeconds() {
  if (timerRunning && lastStartedAt) {
    return accumulatedSeconds + Math.floor((Date.now() - lastStartedAt) / 1000);
  }
  return accumulatedSeconds;
}

/**
 * Refreshes the clock element text.
 */
function updateClock() {
  const clockEl = $("clock");
  if (clockEl) {
    clockEl.textContent = formatClock(getElapsedSeconds());
  }
}

/**
 * Sets clock element visual active state.
 *
 * @param {boolean} running Whether timer is running.
 */
function setTimerState(running) {
  const clockEl = $("clock");
  if (clockEl) {
    clockEl.classList.toggle("running", running);
  }
}

/**
 * Saves current timer state to local storage.
 */
function saveTimerState() {
  try {
    const data = {
      workoutStartAt: workoutStartAt ? workoutStartAt.toISOString() : null,
      lastStartedAt,
      accumulatedSeconds,
      timerRunning,
    };
    localStorage.setItem("swole_timer", JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Restores timer state from local storage.
 */
function restoreTimerState() {
  try {
    const raw = localStorage.getItem("swole_timer");
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!data) return;
    accumulatedSeconds = Number(data.accumulatedSeconds) || 0;
    workoutStartAt = data.workoutStartAt ? new Date(data.workoutStartAt) : null;
    timerRunning = Boolean(data.timerRunning);
    if (timerRunning && data.lastStartedAt) {
      lastStartedAt = Number(data.lastStartedAt);
      setTimerState(true);
      updateClock();
      if (!timerInterval) timerInterval = setInterval(updateClock, 1000);
    } else {
      lastStartedAt = 0;
      setTimerState(false);
      updateClock();
    }
  } catch {
    // Ignore corrupt storage
  }
}

/**
 * Starts workout timer.
 */
function startTimer() {
  if (timerRunning) return;
  timerRunning = true;
  lastStartedAt = Date.now();
  if (!workoutStartAt) workoutStartAt = new Date();
  setTimerState(true);
  updateClock();
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(updateClock, 1000);
  saveTimerState();
}

/**
 * Pauses workout timer.
 */
function pauseTimer() {
  if (!timerRunning) return;
  accumulatedSeconds += Math.floor((Date.now() - lastStartedAt) / 1000);
  timerRunning = false;
  lastStartedAt = 0;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  setTimerState(false);
  updateClock();
  saveTimerState();
}

/**
 * Resets workout timer to zero.
 */
function resetTimer() {
  timerRunning = false;
  accumulatedSeconds = 0;
  lastStartedAt = 0;
  workoutStartAt = null;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  setTimerState(false);
  updateClock();
  localStorage.removeItem("swole_timer");
}

/**
 * Displays a transient status message in the footer.
 *
 * @param {string} text Message content.
 * @param {"ok" | "err" | "info"} [kind] Visual status style.
 */
function showStatus(text, kind = "info") {
  const statusEl = $("status");
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.className = `status ${kind}`;
}

/**
 * Initializes the API layer depending on environment.
 *
 * @returns {Promise<import("../../types/swole.d.ts").Api>} Initialized Api interface.
 */
async function initApi() {
  const win = /** @type {any} */ (window);
  if (win.swoleApi) return win.swoleApi;

  // Check if server /api endpoint exists
  try {
    const probe = await fetch("/api/load", {
      method: "HEAD",
      cache: "no-store",
    });
    if (probe.ok) {
      return {
        async load(day) {
          const res = await fetch(`/api/load${day ? `?day=${day}` : ""}`);
          return res.json();
        },
        async start(day) {
          const res = await fetch("/api/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ day }),
          });
          return res.json();
        },
        async stop(session) {
          const res = await fetch("/api/stop", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session }),
          });
          return res.json();
        },
        async save(session) {
          const res = await fetch("/api/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session }),
          });
          return res.json();
        },
        async track(event) {
          await fetch("/api/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event }),
          });
        },
      };
    }
  } catch {
    // Server endpoint not reachable
  }

  // Fallback to local BrowserStore demo mode
  const banner = $("demo-banner");
  if (banner) banner.style.display = "block";
  const store = createBrowserStore();
  return createService({ store });
}

/**
 * Renders the exercise cards list for the active day.
 *
 * @param {Array<{ name: string, scheme: string, last?: string }>} program Exercise definitions.
 * @param {string} day Active weekday name.
 */
function renderProgram(program, day) {
  const listEl = $("list");
  if (!listEl) return;
  listEl.innerHTML = "";

  const draftKey = `swole_draft_${day}`;
  let drafts = {};
  try {
    drafts = JSON.parse(localStorage.getItem(draftKey) || "{}");
  } catch {
    drafts = {};
  }

  for (const ex of program) {
    const row = document.createElement("div");
    row.className = "row";
    row.dataset.name = ex.name;

    const nameLine = document.createElement("div");
    nameLine.className = "name-line";

    const nameSpan = document.createElement("span");
    nameSpan.className = "name";
    nameSpan.textContent = ex.name;

    const schemeSpan = document.createElement("span");
    schemeSpan.className = "scheme";
    schemeSpan.textContent = ex.scheme || "";

    nameLine.appendChild(nameSpan);
    nameLine.appendChild(schemeSpan);

    const lastLine = document.createElement("div");
    lastLine.className = "last-line";
    if (ex.last) {
      lastLine.innerHTML = `last: <span>${ex.last}</span>`;
    }

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = ex.last ? `e.g. ${ex.last}` : "load (e.g. 100kg x 5)";
    input.value = drafts[ex.name] || "";
    if (input.value) row.classList.add("filled");

    input.addEventListener("focus", () => {
      row.classList.add("focused");
      if (!timerRunning) startTimer();
    });

    input.addEventListener("blur", () => {
      row.classList.remove("focused");
    });

    input.addEventListener("input", () => {
      drafts[ex.name] = input.value;
      try {
        localStorage.setItem(draftKey, JSON.stringify(drafts));
      } catch {
        // Ignore storage errors
      }
      row.classList.toggle("filled", Boolean(input.value.trim()));
    });

    row.appendChild(nameLine);
    row.appendChild(lastLine);
    row.appendChild(input);
    listEl.appendChild(row);
  }
}

/**
 * Loads session view and populates navigation and inputs.
 *
 * @param {string} [requestedDay] Selected weekday name.
 */
async function loadView(requestedDay) {
  if (busy) return;
  busy = true;
  showStatus("Loading...");

  try {
    const payload = await api.load(requestedDay);
    const daySelect = $("day");
    if (daySelect) {
      daySelect.innerHTML = "";
      for (const d of payload.days) {
        const opt = document.createElement("option");
        opt.value = d;
        opt.textContent = d;
        if (d === payload.day) opt.selected = true;
        daySelect.appendChild(opt);
      }
    }

    // Configure 3-tab segmented control links
    const tabRoutine = $("tab-routine");
    if (tabRoutine) {
      if (payload.navLinks?.routine) {
        tabRoutine.href = payload.navLinks.routine;
        tabRoutine.classList.remove("disabled");
      } else {
        tabRoutine.removeAttribute("href");
        tabRoutine.classList.add("disabled");
      }
    }

    const tabLog = $("tab-log");
    if (tabLog) {
      if (payload.navLinks?.log) {
        tabLog.href = payload.navLinks.log;
        tabLog.classList.remove("disabled");
      } else {
        tabLog.removeAttribute("href");
        tabLog.classList.add("disabled");
      }
    }

    renderProgram(payload.program, payload.day);
    showStatus("");
  } catch (err) {
    showStatus(`Failed to load: ${err.message}`, "err");
  } finally {
    busy = false;
  }
}

/**
 * Collects input values and saves the workout session.
 */
async function saveWorkout() {
  if (busy) return;
  busy = true;
  showStatus("Saving session...");

  try {
    const day = $("day").value;
    const listEl = $("list");
    const rows = listEl.querySelectorAll(".row");
    const entries = [];

    for (const row of rows) {
      const name = row.dataset.name;
      const input = row.querySelector("input");
      const load = input ? input.value.trim() : "";
      if (load && name) {
        entries.push({ name, load });
      }
    }

    if (entries.length === 0) {
      showStatus("Please record at least one exercise load", "err");
      busy = false;
      return;
    }

    const endAt = new Date();
    const startAt =
      workoutStartAt || new Date(endAt.getTime() - getElapsedSeconds() * 1000);

    const result = await api.save({
      day,
      startAt,
      endAt,
      entries,
    });

    if (result.ok) {
      showStatus(`Saved ${result.saved} exercises!`, "ok");
      localStorage.removeItem(`swole_draft_${day}`);
      resetTimer();
      await loadView(day);
    } else {
      showStatus("Save returned non-ok result", "err");
    }
  } catch (err) {
    showStatus(`Save failed: ${err.message}`, "err");
  } finally {
    busy = false;
  }
}

// Setup Event Listeners
window.addEventListener("DOMContentLoaded", async () => {
  api = await initApi();
  restoreTimerState();

  const clockEl = $("clock");
  if (clockEl) {
    clockEl.addEventListener("click", () => {
      if (timerRunning) {
        pauseTimer();
      } else {
        startTimer();
      }
    });
  }

  const daySelect = $("day");
  if (daySelect) {
    daySelect.addEventListener("change", () => {
      loadView(daySelect.value);
    });
  }

  const saveBtn = $("save");
  if (saveBtn) {
    saveBtn.addEventListener("click", saveWorkout);
  }

  const modal = $("modal");
  const addBtn = $("add-btn");
  const modalClose = $("modal-close");
  const modalAdd = $("modal-add");

  if (addBtn && modal) {
    addBtn.addEventListener("click", () => {
      modal.style.display = "flex";
      const nameInput = $("custom-name");
      if (nameInput) nameInput.focus();
    });
  }

  if (modalClose && modal) {
    modalClose.addEventListener("click", () => {
      modal.style.display = "none";
    });
  }

  if (modalAdd && modal) {
    modalAdd.addEventListener("click", () => {
      const nameInput = $("custom-name");
      const schemeInput = $("custom-scheme");
      const name = nameInput ? nameInput.value.trim() : "";
      const scheme = schemeInput ? schemeInput.value.trim() : "";

      if (!name) return;

      const listEl = $("list");
      if (listEl) {
        const row = document.createElement("div");
        row.className = "row";
        row.dataset.name = name;

        const nameLine = document.createElement("div");
        nameLine.className = "name-line";
        const nameSpan = document.createElement("span");
        nameSpan.className = "name";
        nameSpan.textContent = name;
        const schemeSpan = document.createElement("span");
        schemeSpan.className = "scheme";
        schemeSpan.textContent = scheme;
        nameLine.appendChild(nameSpan);
        nameLine.appendChild(schemeSpan);

        const lastLine = document.createElement("div");
        lastLine.className = "last-line";

        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "load (e.g. 100kg x 5)";

        input.addEventListener("focus", () => {
          row.classList.add("focused");
          if (!timerRunning) startTimer();
        });
        input.addEventListener("blur", () => row.classList.remove("focused"));
        input.addEventListener("input", () => {
          row.classList.toggle("filled", Boolean(input.value.trim()));
        });

        row.appendChild(nameLine);
        row.appendChild(lastLine);
        row.appendChild(input);
        listEl.appendChild(row);
      }

      if (nameInput) nameInput.value = "";
      if (schemeInput) schemeInput.value = "";
      modal.style.display = "none";
    });
  }

  await loadView();
});
