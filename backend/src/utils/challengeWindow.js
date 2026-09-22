/**
 * Daily Challenge Window helpers.
 *
 * The daily challenge runs from 6:00 PM on one day to 6:00 PM the next day.
 * A challenge's `activeDate` represents the START of its 24-hour window (6 PM).
 */
const WINDOW_START_HOUR = 18; // 6:00 PM (24-hour clock)

/**
 * Return the challenge window start (6 PM) for the calendar day of `date`.
 * @param {Date} date
 * @returns {Date}
 */
export function getWindowStart(date = new Date()) {
  const d = new Date(date);
  d.setHours(WINDOW_START_HOUR, 0, 0, 0);
  return d;
}

/**
 * Return the current active 24-hour window [start, end) that contains `now`.
 * If `now` is before 6 PM today, the active window started yesterday at 6 PM.
 * @param {Date} now
 * @returns {{ start: Date, end: Date }}
 */
export function getCurrentWindow(now = new Date()) {
  const n = new Date(now);
  let start = getWindowStart(n);
  if (n < start) {
    start = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  }
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/**
 * Return the START of the next challenge window (i.e. the next 6 PM occurrence,
 * which is the earliest valid activeDate for a new daily challenge).
 * @param {Date} now
 * @returns {Date}
 */
export function getNextWindowStart(now = new Date()) {
  const n = new Date(now);
  let start = getWindowStart(n);
  if (n >= start) {
    start = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  }
  return start;
}

/**
 * Return the calendar-day key (YYYY-MM-DD) for a given 6 PM window start.
 * Used to enforce "one challenge per day" for the super admin.
 * @param {Date} activeDate
 * @returns {string}
 */
export function getWindowDayKey(activeDate) {
  const d = new Date(activeDate);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export default {
  getWindowStart,
  getCurrentWindow,
  getNextWindowStart,
  getWindowDayKey,
};
