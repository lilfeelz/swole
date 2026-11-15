/** Weekday names in routine order, Monday first. */
export const DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

/** Cardio keywords skipped when loading lifting exercises from routine. */
export const CARDIO = /boulder|bike|run|ski|box/i;

/**
 * Normalizes an exercise name for matching across routine and log files.
 *
 * @param {string} name Exercise name.
 * @returns {string} Lowercase alphanumeric key.
 */
export function key(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Normalizes historic load text: strips "r"/"rep"/"reps" while keeping "s" and "m".
 *
 * @param {string} raw Load text from a log file.
 * @returns {string} Cleaned load text.
 */
export function cleanLoad(raw) {
  return String(raw || "").replace(/(\d+)\s*(?:r|reps?)\b/gi, "$1");
}

/**
 * Maps a day field value to a weekday or uppercased free text.
 *
 * @param {string} raw Day field value; empty selects today's weekday.
 * @param {Date} [now] Reference date when raw is empty.
 * @returns {string} Weekday name or free text.
 */
export function resolveDay(raw, now = new Date()) {
  const text = String(raw || "").trim();
  if (!text) return DAYS[(now.getDay() + 6) % 7];
  const first = text.toUpperCase().split(/[^A-Z]+/)[0];
  return DAYS.includes(first) ? first : text.toUpperCase();
}

/**
 * Parses routine text containing weekday headers followed by "Exercise | scheme" lines.
 *
 * @param {string} text Routine file contents.
 * @returns {Record<string, Array<{ name: string, scheme: string }>>} Day to exercise list.
 */
export function parseRoutine(text) {
  /** @type {Record<string, Array<{ name: string, scheme: string }>>} */
  const blocks = {};
  let currentDay = "";

  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const upper = line.toUpperCase();
    if (DAYS.includes(upper)) {
      currentDay = upper;
      if (!blocks[currentDay]) blocks[currentDay] = [];
      continue;
    }

    if (!currentDay) continue;

    const parts = line.split("|").map((p) => p.trim());
    const name = parts[0];
    const scheme = parts.slice(1).join(" | ").trim();
    if (name && !CARDIO.test(name)) {
      blocks[currentDay].push({ name, scheme: scheme || "" });
    }
  }

  return blocks;
}

/**
 * Validates a parsed routine structure.
 *
 * @param {Record<string, Array<{ name: string, scheme: string }>>} blocks Routine blocks.
 * @returns {{ ok: boolean, errors: string[] }} Validation result.
 */
export function validateRoutine(blocks) {
  /** @type {string[]} */
  const errors = [];
  if (!blocks || typeof blocks !== "object") {
    return { ok: false, errors: ["routine must be an object"] };
  }
  const days = Object.keys(blocks);
  if (days.length === 0) {
    errors.push("routine contains no days");
  }
  for (const day of days) {
    const list = blocks[day];
    if (!Array.isArray(list) || list.length === 0) {
      errors.push(`day ${day} has no exercises`);
      continue;
    }
    for (let i = 0; i < list.length; i++) {
      if (!list[i].name) {
        errors.push(`day ${day} exercise #${i + 1} is missing a name`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Parses an ISO date string, returning null on invalid input.
 *
 * @param {string} raw ISO timestamp string.
 * @returns {Date|null} Parsed Date or null.
 */
export function parseDateValue(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Parses raw session text with DAY, START, END headers and "Exercise | load" entries.
 *
 * @param {string} text Raw session file text.
 * @returns {{ day: string, startAt: Date|null, endAt: Date|null, entries: Array<{ name: string, load: string }> }} Parsed session.
 */
export function parseSession(text) {
  let day = "";
  /** @type {Date|null} */
  let startAt = null;
  /** @type {Date|null} */
  let endAt = null;
  /** @type {Array<{ name: string, load: string }>} */
  const entries = [];

  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const dayMatch = /^DAY:\s*(.+)$/i.exec(line);
    if (dayMatch) {
      day = dayMatch[1].trim();
      continue;
    }

    const startMatch = /^START:\s*(.+)$/i.exec(line);
    if (startMatch) {
      startAt = parseDateValue(startMatch[1].trim());
      continue;
    }

    const endMatch = /^END:\s*(.+)$/i.exec(line);
    if (endMatch) {
      endAt = parseDateValue(endMatch[1].trim());
      continue;
    }

    const parts = line.split("|").map((p) => p.trim());
    if (parts[0]) {
      entries.push({
        name: parts[0],
        load: parts.slice(1).join(" | ").trim(),
      });
    }
  }

  return { day, startAt, endAt, entries };
}

/**
 * Serializes a session to plain text suitable for session.txt or log files.
 *
 * @param {{ day: string, startAt?: Date|null, endAt?: Date|null, entries?: Array<{ name: string, load: string }> }} session Session object.
 * @returns {string} Serialized text.
 */
export function formatSession(session) {
  const lines = [];
  if (session.day) lines.push(`DAY: ${session.day}`);
  if (session.startAt)
    lines.push(`START: ${new Date(session.startAt).toISOString()}`);
  if (session.endAt)
    lines.push(`END: ${new Date(session.endAt).toISOString()}`);
  if (lines.length > 0) lines.push("");

  for (const entry of session.entries || []) {
    const name = String(entry.name || "").trim();
    const load = String(entry.load || "").trim();
    if (name) {
      lines.push(load ? `${name} | ${load}` : name);
    }
  }

  return lines.join("\n") + "\n";
}

/**
 * Validates a session payload.
 *
 * @param {{ day?: string, startAt?: Date|null, endAt?: Date|null, entries?: Array<{ name: string, load: string }> }} session Session candidate.
 * @returns {{ ok: boolean, errors: string[] }} Validation result.
 */
export function validateSession(session) {
  /** @type {string[]} */
  const errors = [];
  if (!session || typeof session !== "object") {
    return { ok: false, errors: ["session must be an object"] };
  }
  if (!session.day) errors.push("session missing DAY");
  if (!session.startAt) errors.push("session missing START timestamp");
  if (session.startAt && Number.isNaN(new Date(session.startAt).getTime())) {
    errors.push("session START timestamp is invalid");
  }
  if (session.endAt && Number.isNaN(new Date(session.endAt).getTime())) {
    errors.push("session END timestamp is invalid");
  }
  if (
    session.startAt &&
    session.endAt &&
    new Date(session.endAt).getTime() < new Date(session.startAt).getTime()
  ) {
    errors.push("session END timestamp earlier than START");
  }
  const entries = session.entries || [];
  if (!Array.isArray(entries) || entries.length === 0) {
    errors.push("session contains no entries");
  } else {
    for (let i = 0; i < entries.length; i++) {
      if (!entries[i] || !entries[i].name) {
        errors.push(`entry #${i + 1} missing exercise name`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Returns 2-digit ISO week-year and 2-digit ISO week number for a Date.
 *
 * @param {Date} date Session date.
 * @returns {{ yy: string, ww: string }} Two-digit year and ISO week number.
 */
export function isoWeekParts(date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return {
    yy: String(d.getUTCFullYear()).slice(-2),
    ww: String(week).padStart(2, "0"),
  };
}

/**
 * Builds the relative archive path data/log/<yy>/<ww>/<unix-ts>.txt for a session.
 *
 * @param {{ startAt?: Date|null }} session Validated session with startAt.
 * @returns {string} Relative archive file path.
 */
export function logPathForSession(session) {
  const ref = session.startAt ? new Date(session.startAt) : new Date();
  const { yy, ww } = isoWeekParts(ref);
  const ts = Math.floor(ref.getTime() / 1000);
  return `data/log/${yy}/${ww}/${ts}.txt`;
}

/**
 * Computes a map of normalized exercise key to last logged load from historical sessions.
 *
 * @param {Array<{ startAt?: Date|null, entries?: Array<{ name: string, load: string }> }>} sessions Historical sessions.
 * @returns {Record<string, string>} Normalized key to last load.
 */
export function lastLoadsFromSessions(sessions) {
  /** @type {Record<string, string>} */
  const map = {};
  const sorted = [...(sessions || [])].sort((a, b) => {
    const ta = a.startAt ? new Date(a.startAt).getTime() : 0;
    const tb = b.startAt ? new Date(b.startAt).getTime() : 0;
    return ta - tb;
  });

  for (const session of sorted) {
    for (const entry of session.entries || []) {
      const n = String(entry.name || "").trim();
      const l = String(entry.load || "").trim();
      if (n && l) {
        map[key(n)] = cleanLoad(l);
      }
    }
  }
  return map;
}
