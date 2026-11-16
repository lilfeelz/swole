import { ready, canon } from "../workline.js";

/**
 * Mounts the UI on a transport.
 *
 * @param {import("../../types/swole.d.ts").Api} api Runtime transport.
 */
export function mount(api) {
  /**
   * Queries a DOM element by ID.
   *
   * @param {string} id Element ID.
   * @returns {any} Matching element.
   */
  const $ = (id) => document.getElementById(id);

  let timerRunning = false;
  let accumulatedSeconds = 0;
  let lastStartedAt = null;
  let timerInterval = null;
  let startedAt = null;
  let busy = false;

  /**
   * Formats a second count as HH:MM:SS.
   *
   * @param {number} seconds Total elapsed seconds.
   * @returns {string} Clock string.
   */
  function formatClock(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return (
      String(h).padStart(2, "0") +
      ":" +
      String(m).padStart(2, "0") +
      ":" +
      String(s).padStart(2, "0")
    );
  }

  /**
   * Calculates total elapsed session seconds using wall clock.
   *
   * @returns {number} Elapsed seconds.
   */
  function getElapsedSeconds() {
    if (timerRunning && lastStartedAt) {
      return (
        accumulatedSeconds + Math.floor((Date.now() - lastStartedAt) / 1000)
      );
    }
    return accumulatedSeconds;
  }

  /**
   * Updates the clock element with current elapsed time.
   *
   * @returns {void}
   */
  function updateClock() {
    $("clock").textContent = formatClock(getElapsedSeconds());
  }

  /**
   * Updates the clock visual state between running and paused.
   *
   * @param {boolean} running Whether timer is running.
   * @returns {void}
   */
  function setTimerState(running) {
    $("clock").classList.toggle("running", running);
  }

  /**
   * Saves current timer session state to localStorage.
   *
   * @returns {void}
   */
  function saveSessionState() {
    try {
      const data = {
        day: $("day").value,
        startedAt: startedAt ? startedAt.toISOString() : null,
        lastStartedAt,
        accumulatedSeconds,
        timerRunning,
      };
      localStorage.setItem("swole_active_session", JSON.stringify(data));
    } catch {
      // ignore storage errors
    }
  }

  /**
   * Restores timer session state from localStorage.
   *
   * @returns {void}
   */
  function restoreSessionState() {
    try {
      const raw = localStorage.getItem("swole_active_session");
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data) return;
      accumulatedSeconds = Number(data.accumulatedSeconds) || 0;
      startedAt = data.startedAt ? new Date(data.startedAt) : null;
      timerRunning = Boolean(data.timerRunning);
      if (timerRunning && data.lastStartedAt) {
        lastStartedAt = Number(data.lastStartedAt);
        setTimerState(true);
        updateClock();
        if (!timerInterval) timerInterval = setInterval(updateClock, 1000);
      } else {
        lastStartedAt = null;
        setTimerState(false);
        updateClock();
      }
    } catch {
      // ignore corrupted state
    }
  }

  /**
   * Starts the session timer.
   *
   * @returns {void}
   */
  function startTimer() {
    if (timerRunning) return;
    timerRunning = true;
    const now = Date.now();
    if (!startedAt) startedAt = new Date(now);
    lastStartedAt = now;
    setTimerState(true);
    updateClock();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateClock, 1000);
    saveSessionState();
  }

  /**
   * Pauses the session timer.
   *
   * @returns {void}
   */
  function pauseTimer() {
    if (!timerRunning) return;
    timerRunning = false;
    if (lastStartedAt) {
      accumulatedSeconds += Math.floor((Date.now() - lastStartedAt) / 1000);
      lastStartedAt = null;
    }
    setTimerState(false);
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    updateClock();
    saveSessionState();
  }

  /**
   * Resets the timer state and storage.
   *
   * @returns {void}
   */
  function resetTimer() {
    timerRunning = false;
    accumulatedSeconds = 0;
    lastStartedAt = null;
    startedAt = null;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    setTimerState(false);
    $("clock").textContent = "00:00:00";
    try {
      localStorage.removeItem("swole_active_session");
    } catch {
      // ignore
    }
  }

  /**
   * Toggles the timer between running and paused.
   *
   * @returns {void}
   */
  function toggleTimer() {
    if (timerRunning) pauseTimer();
    else startTimer();
  }

  /**
   * Saves entered loads and rows for the active day.
   *
   * @returns {void}
   */
  function saveDraft() {
    const day = $("day").value;
    if (!day) return;
    const rows = [...document.querySelectorAll("#list .row")].map((row) => {
      const input = row.querySelector("input");
      const name = input ? input.dataset.name : "";
      const schemeEl = row.querySelector(".scheme");
      const scheme = schemeEl ? schemeEl.textContent : "";
      const load = input ? input.value : "";
      const last = input ? input.placeholder : "";
      return { name, scheme, load, last };
    });
    try {
      localStorage.setItem("swole_draft_" + day, JSON.stringify(rows));
    } catch {
      // ignore
    }
  }

  /**
   * Loads draft rows for a day.
   *
   * @param {string} day Weekday name.
   * @returns {Array<object>|null} Saved rows or null.
   */
  function loadDraft(day) {
    try {
      const raw = localStorage.getItem("swole_draft_" + day);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * Clears draft rows for a day.
   *
   * @param {string} day Weekday name.
   * @returns {void}
   */
  function clearDraft(day) {
    try {
      localStorage.removeItem("swole_draft_" + day);
    } catch {
      // ignore
    }
  }

  /**
   * Escapes text for use in HTML markup.
   *
   * @param {string} value Raw text.
   * @returns {string} Escaped text.
   */
  function esc(value) {
    return String(value).replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );
  }

  /**
   * Shows a status message under the list.
   *
   * @param {string} message Status text.
   * @param {string} [kind] Optional CSS modifier ("ok" or "err").
   * @returns {void}
   */
  function status(message, kind = "") {
    const el = $("status");
    el.textContent = message || "";
    el.className = "status" + (kind ? " " + kind : "");
  }

  /**
   * Builds one exercise row: name and plan, input hinting the last load.
   *
   * @param {{ name: string, scheme?: string, last?: string, load?: string }} e Row data.
   * @returns {string} Row markup.
   */
  function row(e) {
    return `
          <div class="row">
            <button type="button" class="del-btn" title="Remove" aria-label="Remove">×</button>
            <div>
              <div class="name">${esc(e.name)}</div>
              ${e.scheme ? `<div class="scheme">${esc(e.scheme)}</div>` : ""}
            </div>
            <input inputmode="text" autocomplete="off" autocapitalize="off" data-name="${esc(e.name)}" placeholder="${esc(e.last || "3x5 / 80kg")}" value="${esc(e.load || "")}">
          </div>`;
  }

  /**
   * Validates a row's input; a valid line is replaced by its canonical form.
   *
   * @param {HTMLElement} r Row element.
   * @returns {boolean} Whether the input is empty or valid.
   */
  function check(r) {
    const input = /** @type {HTMLInputElement} */ (r.querySelector("input"));
    r.querySelector(".err")?.remove();
    let reason = "";
    if (input.value.trim()) {
      try {
        input.value = canon(input.value);
      } catch (err) {
        reason = err instanceof Error ? err.message : String(err);
      }
    }
    r.classList.toggle("invalid", Boolean(reason));
    if (!reason) r.classList.remove("show-err");
    if (reason) {
      const el = document.createElement("div");
      el.className = "err";
      el.setAttribute("role", "tooltip");
      el.textContent = reason;
      const code = document.createElement("code");
      code.textContent = input.value;
      el.appendChild(code);
      r.appendChild(el);
    }
    $("save").disabled = Boolean($("list").querySelector(".row.invalid"));
    return !reason;
  }

  /**
   * Points a Routine or Log tab at the backend's editor, or disables it.
   *
   * @param {HTMLAnchorElement} tab Tab link.
   * @param {string} [url] Editor URL.
   */
  function link(tab, url) {
    if (url) tab.href = url;
    else tab.removeAttribute("href");
    tab.classList.toggle("disabled", !url);
  }

  /**
   * Renders the day title and exercise rows.
   *
   * @param {import("../../types/swole.d.ts").ApiPayload} data Session payload for the selected day.
   * @returns {void}
   */
  function render(data) {
    if (data && data.day) {
      try {
        localStorage.setItem("swole_day_" + data.day, JSON.stringify(data));
      } catch {
        // ignore storage quota errors
      }
    }
    let opt = $("day").querySelector(`option[value="${data.day}"]`);
    if (!opt) {
      opt = document.createElement("option");
      opt.value = data.day;
      opt.textContent = data.day;
      $("day").appendChild(opt);
    }
    $("day").value = data.day;
    $("title").textContent = data.day;
    link($("tab-routine"), data.navLinks?.routine);
    link($("tab-log"), data.navLinks?.log);

    const draft = loadDraft(data.day);
    if (draft && draft.length) {
      $("list").innerHTML = draft.map(row).join("");
      return;
    }

    const program = data.program || [];
    if (!program.length) {
      $("list").innerHTML =
        '<div class="empty">Rest Day. Pick a weekday to load a list.</div>';
      return;
    }
    $("list").innerHTML = program.map(row).join("");
  }

  /**
   * Opens the add exercise modal.
   *
   * @returns {void}
   */
  function openModal() {
    $("modal-input").value = "";
    $("modal").style.display = "flex";
    setTimeout(() => $("modal-input").focus(), 50);
  }

  /**
   * Closes the add exercise modal.
   *
   * @returns {void}
   */
  function closeModal() {
    $("modal").style.display = "none";
    $("modal-input").value = "";
  }

  /**
   * Appends the new exercise from the modal to the active list.
   *
   * @returns {void}
   */
  function confirmAdd() {
    const name = $("modal-input").value.trim();
    if (!name) return;
    const empty = $("list").querySelector(".empty");
    if (empty) $("list").innerHTML = "";
    $("list").insertAdjacentHTML("beforeend", row({ name }));
    closeModal();
    saveDraft();
    const input = $("list").lastElementChild.querySelector("input");
    if (input) input.focus();
  }

  /** @type {"bug"|"feature"} */
  let feedbackType = "bug";

  /**
   * Sets the active feedback type (bug or feature).
   *
   * @param {"bug"|"feature"} type Selected type.
   * @returns {void}
   */
  function setFeedbackType(type) {
    feedbackType = type;
    $("type-bug").classList.toggle("active", type === "bug");
    $("type-feature").classList.toggle("active", type === "feature");
    $("feedback-input").placeholder =
      type === "bug"
        ? "Describe the unexpected behavior…"
        : "Describe the feature you would like…";
  }

  /**
   * Opens the feedback modal, optionally pre-filled.
   *
   * @param {string} [initialText] Initial text for textarea.
   * @param {"bug"|"feature"} [type] Feedback type.
   * @returns {void}
   */
  function openFeedbackModal(initialText = "", type = "bug") {
    setFeedbackType(type);
    $("feedback-input").value = initialText || "";
    $("feedback-modal").style.display = "flex";
    setTimeout(() => $("feedback-input").focus(), 50);
  }

  /**
   * Closes the feedback modal.
   *
   * @returns {void}
   */
  function closeFeedbackModal() {
    $("feedback-modal").style.display = "none";
    $("feedback-input").value = "";
  }

  /**
   * Constructs a pre-filled GitHub issue URL with context and diagnostics.
   *
   * @param {"bug"|"feature"} type Type of issue.
   * @param {string} message Description.
   * @param {string} [repoUrl] Repository base URL.
   * @returns {string} Encoded URL.
   */
  function buildGitHubIssueUrl(
    type,
    message,
    repoUrl = "https://github.com/lilfeelz/swole",
  ) {
    const isBug = type === "bug";
    const label = isBug ? "bug" : "enhancement";
    const titlePrefix = isBug ? "[Bug]: " : "[Feature]: ";
    const cleanMsg = (message || "").trim();
    const title = cleanMsg
      ? titlePrefix + cleanMsg.split("\n")[0].slice(0, 60)
      : titlePrefix + (isBug ? "Unexpected issue" : "Feature proposal");

    let body = "";
    if (isBug) {
      body = [
        "### Description",
        cleanMsg || "(No description provided)",
        "",
        "### Diagnostics",
        "- Date: " + new Date().toISOString(),
        "- Selected Day: " + $("day").value,
        "- Timer: " +
          formatClock(getElapsedSeconds()) +
          " (running: " +
          timerRunning +
          ")",
        "- Screen: " +
          window.innerWidth +
          "x" +
          window.innerHeight +
          " (dpr: " +
          (window.devicePixelRatio || 1) +
          ")",
        "- User Agent: " + navigator.userAgent,
        "- Last Status: " + ($("status").textContent || "(none)"),
      ].join("\n");
    } else {
      body = [
        "### Proposal",
        cleanMsg || "(No proposal provided)",
        "",
        "### Context",
        "Current workout day: " + $("day").value,
      ].join("\n");
    }

    const base = repoUrl.replace(/\/+$/, "") + "/issues/new";
    const params = new URLSearchParams({
      title,
      labels: label,
      body,
    });
    return base + "?" + params.toString();
  }

  /**
   * Submits feedback to GitHub issues or local API.
   *
   * @param {boolean} [saveToGit] Whether to write to data/feedback.txt via local API.
   * @returns {Promise<void>}
   */
  async function submitFeedback(saveToGit = false) {
    const msg = $("feedback-input").value.trim();
    if (saveToGit) {
      if (!msg) return;
      try {
        await api.track({
          category: "feedback",
          action: feedbackType,
          label: $("day").value,
          data: { message: msg },
        });
        closeFeedbackModal();
        status("feedback recorded", "ok");
      } catch (err) {
        status(err instanceof Error ? err.message : String(err), "err");
      }
      return;
    }

    const url = buildGitHubIssueUrl(feedbackType, msg);
    window.open(url, "_blank", "noopener");
    closeFeedbackModal();
  }

  /**
   * Loads a day's program from the configured backend.
   *
   * @param {string} day Weekday name or empty for default day.
   * @returns {Promise<void>} Resolves once rendered.
   */
  async function load(day) {
    const draft = day ? loadDraft(day) : null;
    if (!draft || !draft.length) {
      $("list").innerHTML = '<div class="empty">loading…</div>';
    }
    try {
      const data = await api.load(day);
      render(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const draftNow = day ? loadDraft(day) : null;
      if (!draftNow || !draftNow.length) {
        $("list").innerHTML = `<div class="empty">${esc(msg)}</div>`;
      }
      status(msg, "err");
    }
  }

  /**
   * Collects entered loads and saves the workout session.
   *
   * @returns {Promise<void>} Resolves when save completes.
   */
  async function save() {
    if (busy) return;
    await ready;
    const rows = [...document.querySelectorAll("#list .row")];
    if (!rows.map((r) => check(/** @type {HTMLElement} */ (r))).every(Boolean))
      return status("Fix the marked lines", "err");
    const entries = [...document.querySelectorAll("#list .row")]
      .map((row) => {
        const input = row.querySelector("input");
        return {
          name: input ? input.dataset.name : "",
          load: input ? input.value.trim() : "",
        };
      })
      .filter((entry) => entry.name && entry.load);
    if (!entries.length) return status("Enter at least one load", "err");

    const sessionStart = startedAt || new Date(Date.now() - 1000);
    const sessionEnd = new Date();

    busy = true;
    $("save").disabled = true;
    status("saving…");
    try {
      // ISO strings: google.script.run rejects Date arguments; the service parses them.
      const res = await api.save(
        /** @type {any} */ ({
          day: $("day").value,
          startAt: sessionStart.toISOString(),
          endAt: sessionEnd.toISOString(),
          entries,
        }),
      );
      busy = false;
      $("save").disabled = false;
      if (!res.saved) return status("Nothing saved", "err");
      const totalSecs = getElapsedSeconds();
      clearDraft($("day").value);
      resetTimer();
      status(
        "saved " + res.saved + " exercises (" + formatClock(totalSecs) + ")",
        "ok",
      );
      document.querySelectorAll("#list input").forEach((input) => {
        /** @type {HTMLInputElement} */ (input).value = "";
      });
      await load($("day").value);
    } catch (err) {
      busy = false;
      $("save").disabled = false;
      status(err instanceof Error ? err.message : String(err), "err");
    }
  }

  $("list").addEventListener("input", saveDraft);
  $("list").addEventListener("focusout", async (evt) => {
    const r = /** @type {HTMLElement} */ (evt.target).closest(".row");
    if (!r) return;
    await ready;
    check(/** @type {HTMLElement} */ (r));
    saveDraft();
  });
  // Tapping an invalid exercise name toggles a popover with the parse error; any other tap closes it.
  document.addEventListener("click", (evt) => {
    const name = /** @type {HTMLElement} */ (evt.target).closest(
      ".row.invalid .name",
    );
    const row = name?.closest(".row");
    for (const r of document.querySelectorAll(".row.show-err"))
      if (r !== row) r.classList.remove("show-err");
    row?.classList.toggle("show-err");
  });
  $("list").addEventListener("click", (evt) => {
    const target = /** @type {HTMLElement} */ (evt.target);
    const btn = target.closest(".del-btn");
    if (!btn) return;
    const row = btn.closest(".row");
    if (row) {
      row.remove();
      saveDraft();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      saveSessionState();
      saveDraft();
    } else {
      updateClock();
    }
  });
  window.addEventListener("pagehide", () => {
    saveSessionState();
    saveDraft();
  });
  window.addEventListener("beforeunload", () => {
    saveSessionState();
    saveDraft();
  });

  $("add-btn").addEventListener("click", openModal);
  $("modal-cancel").addEventListener("click", closeModal);
  $("modal-confirm").addEventListener("click", confirmAdd);
  $("modal").addEventListener("click", (evt) => {
    if (evt.target === $("modal")) closeModal();
  });
  $("modal-input").addEventListener("keydown", (evt) => {
    if (evt.key === "Enter") confirmAdd();
    if (evt.key === "Escape") closeModal();
  });

  $("feedback-file").style.display = "";
  $("feedback-btn").addEventListener("click", () => openFeedbackModal());
  $("feedback-cancel").addEventListener("click", closeFeedbackModal);
  $("type-bug").addEventListener("click", () => setFeedbackType("bug"));
  $("type-feature").addEventListener("click", () => setFeedbackType("feature"));
  $("feedback-submit").addEventListener("click", () => submitFeedback(false));
  $("feedback-file").addEventListener("click", () => submitFeedback(true));
  $("feedback-modal").addEventListener("click", (evt) => {
    if (evt.target === $("feedback-modal")) closeFeedbackModal();
  });
  $("status").addEventListener("click", () => {
    if ($("status").classList.contains("err")) {
      const errText = $("status").textContent || "";
      openFeedbackModal("Error: " + errText, "bug");
    }
  });

  $("clock").addEventListener("click", toggleTimer);
  $("day").addEventListener("change", () => {
    const picked = $("day").value;
    const cached = localStorage.getItem("swole_day_" + picked);
    if (cached) {
      try {
        render(JSON.parse(cached));
      } catch {
        // ignore corrupted cache
      }
    }
    load(picked);
  });
  $("save").addEventListener("click", save);

  restoreSessionState();

  const activeSession = (() => {
    try {
      return JSON.parse(localStorage.getItem("swole_active_session") || "null");
    } catch {
      return null;
    }
  })();

  const targetDay = (activeSession && activeSession.day) || "";
  if (targetDay) {
    const cachedTarget = localStorage.getItem("swole_day_" + targetDay);
    if (cachedTarget) {
      try {
        render(JSON.parse(cachedTarget));
      } catch {
        // ignore corrupted cache
      }
    }
  }
  load(targetDay);
}
