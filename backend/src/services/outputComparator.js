/**
 * outputComparator.js
 * ------------------------------------------------------------------
 * Tolerant output comparison for the judge.
 *
 * Supports:
 *   - Primitives (int, long, double, boolean, char, string)
 *   - 1D & nested arrays
 *   - Lists / array-lists
 *   - Floating point values with tolerance (1e-6)
 *   - Trees / linked lists (serialized level-order or node arrays)
 *   - Ignores extra whitespace, trailing spaces, and CRLF/LF differences
 */

const EPSILON = 1e-6;

/**
 * Normalize both sides: trim, collapse whitespace, unify line endings.
 */
export function normalizeText(value) {
  return String(value === undefined || value === null ? "" : value)
    .trim()
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .trim();
}

function isNumericString(s) {
  return s !== "" && !Number.isNaN(Number(s));
}

function isArrayLike(v) {
  return Array.isArray(v);
}

/**
 * Recursive structural comparison.
 * If both sides are JSON-parseable and arrays/objects, compare structurally.
 * Floats are compared with tolerance when both are numbers.
 */
function deepEquals(a, b) {
  // Handle floats
  if (typeof a === "number" && typeof b === "number") {
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return Math.abs(a - b) <= EPSILON;
    }
    return a === b;
  }
  if (typeof a === "string" && typeof b === "string") {
    if (isNumericString(a) && isNumericString(b)) {
      const na = Number(a);
      const nb = Number(b);
      if (Number.isFinite(na) && Number.isFinite(nb)) {
        return Math.abs(na - nb) <= EPSILON;
      }
    }
    return normalizeText(a) === normalizeText(b);
  }
  if (isArrayLike(a) && isArrayLike(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEquals(a[i], b[i])) return false;
    }
    return true;
  }
  if (a !== null && b !== null && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) {
      if (!deepEquals(a[k], b[k])) return false;
    }
    return true;
  }
  return a === b;
}

/**
 * Compare actual output vs expected output.
 * @param {string|number|Array} actual
 * @param {string|number|Array} expected
 * @returns {{ passed: boolean, normalizedExpected: string, normalizedActual: string }}
 */
export function compareOutput(actual, expected) {
  const aStr = String(actual === undefined || actual === null ? "" : actual);
  const eStr = String(expected === undefined || expected === null ? "" : expected);

  // Fast path: normalized string equality
  if (normalizeText(aStr) === normalizeText(eStr)) {
    return {
      passed: true,
      normalizedExpected: normalizeText(eStr),
      normalizedActual: normalizeText(aStr),
    };
  }

  // Structural comparison for JSON-parseable content
  let parsedA;
  let parsedE;
  let actualIsJson = false;
  let expectedIsJson = false;
  try {
    parsedA = JSON.parse(aStr);
    actualIsJson = true;
  } catch (e) {
    // Fall through to line-aware comparison
  }
  try {
    parsedE = JSON.parse(eStr);
    expectedIsJson = true;
  } catch (e) {
    // Fall through to line-aware comparison
  }

  if (actualIsJson && expectedIsJson && deepEquals(parsedA, parsedE)) {
    return {
      passed: true,
      normalizedExpected: normalizeText(eStr),
      normalizedActual: normalizeText(aStr),
    };
  }

  const comparableA =
    actualIsJson && typeof parsedA === "string" ? parsedA : aStr;
  const comparableE =
    expectedIsJson && typeof parsedE === "string" ? parsedE : eStr;
  if (
    ((actualIsJson && typeof parsedA === "string") ||
      (expectedIsJson && typeof parsedE === "string")) &&
    normalizeText(comparableA) === normalizeText(comparableE)
  ) {
    return {
      passed: true,
      normalizedExpected: normalizeText(eStr),
      normalizedActual: normalizeText(aStr),
    };
  }

  // Line-by-line comparison ignoring trailing whitespace per line
  const aLines = String(aStr).split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== "");
  const eLines = String(eStr).split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== "");
  if (aLines.length === eLines.length && aLines.length > 0) {
    let allMatch = true;
    for (let i = 0; i < aLines.length; i++) {
      try {
        const pa = JSON.parse(aLines[i]);
        const pe = JSON.parse(eLines[i]);
        if (!deepEquals(pa, pe)) {
          allMatch = false;
          break;
        }
      } catch (err) {
        if (normalizeText(aLines[i]) !== normalizeText(eLines[i])) {
          allMatch = false;
          break;
        }
      }
    }
    if (allMatch) {
      return {
        passed: true,
        normalizedExpected: eLines.join("\n"),
        normalizedActual: aLines.join("\n"),
      };
    }
  }

  return {
    passed: false,
    normalizedExpected: normalizeText(eStr),
    normalizedActual: normalizeText(aStr),
  };
}

export default {
  normalizeText,
  compareOutput,
  EPSILON,
};
