/**
 * parameterConverter.js
 * ------------------------------------------------------------------
 * Converts parameter-based test case values into the canonical judge
 * input format, and back. The author never writes raw stdin or JSON.
 *
 * The judge wrapper reads one line per parameter from stdin. E.g. for
 * signature `twoSum(nums:int[], target:int)` and values
 *   { nums: "[2,7,11,15]", target: 9 }
 * this produces the judge input string:
 *   "[2,7,11,15]\n9"
 *
 * Values are stored per-parameter in the test case as strings in the
 * form the author typed (e.g. "[2,7,11,15]", "9", "hello", "true").
 * Lists / linked lists / trees are stored as JSON arrays.
 *
 * This service is reusable by any future authoring flow (e.g. the daily
 * challenge authoring pipeline).
 */

import { getStoredSignature } from "./signatureParser.js";

const ARRAYABLE = (type) => type.endsWith("[]") || type.startsWith("list<") || type === "listnode" || type === "treenode";

/**
 * Normalize a raw per-parameter value for a given type into the canonical
 * judge input line (one line per parameter).
 *
 * @param {string} type - canonical type (int, string, int[], int[][], ListNode, ...)
 * @param {string} raw - the value the author typed in the parameter field
 * @returns {string} canonical judge line for this parameter
 */
export function serializeParameterValue(type, raw) {
  const t = (type || "int").toLowerCase().trim();
  const s = raw === undefined || raw === null ? "" : String(raw).trim();

  // Strings and chars are stored quoted in the judge input.
  if (t === "string" || t === "char") {
    if (s === "") return "";
    // If already a JSON string literal, keep it as-is.
    if (s.startsWith('"') && s.endsWith('"')) return s;
    return JSON.stringify(s);
  }

  // Booleans are stored as-is (true/false).
  if (t === "boolean") {
    return s.toLowerCase() === "false" ? "false" : "true";
  }

  // Arrays / lists / linked lists / trees are stored as JSON arrays.
  if (ARRAYABLE(t)) {
    if (s === "") return "[]";
    // If already valid JSON, keep it.
    try {
      JSON.parse(s);
      return s;
    } catch (e) {
      return "[]";
    }
  }

  // Numeric primitives and everything else: pass through trimmed.
  return s;
}

/**
 * Convert a full set of parameter values into the judge input string.
 * @param {Object} signature - canonical { name, returnType, params }
 * @param {Object} values - { paramName: rawValue }
 * @returns {string} judge input (one line per parameter)
 */
export function convertParameterValuesToInput(signature, values) {
  const params = Array.isArray(signature?.params) ? signature.params : [];
  if (params.length === 0) return "";
  return params
    .map((p) => serializeParameterValue(p.type, values ? values[p.name] : undefined))
    .join("\n");
}

/**
 * Validate that a test case's parameter values cover every parameter and
 * are well-formed for the declared parameter types.
 * @param {Object} signature - canonical signature
 * @param {Object} values - { paramName: rawValue }
 * @returns {string[]} array of error messages (empty when valid)
 */
export function validateParameterValues(signature, values) {
  const errors = [];
  const params = Array.isArray(signature?.params) ? signature.params : [];
  if (params.length === 0) return errors;

  const seen = new Set();
  for (const p of params) {
    const raw = values ? values[p.name] : undefined;
    const has = raw !== undefined && raw !== null && String(raw).trim() !== "";
    if (!has) {
      errors.push(`Missing value for parameter "${p.name}".`);
      continue;
    }
    const t = (p.type || "int").toLowerCase().trim();
    const s = String(raw).trim();
    if (ARRAYABLE(t)) {
      try {
        JSON.parse(s);
      } catch (e) {
        errors.push(`Value for "${p.name}" must be a JSON array (e.g. [1,2,3]).`);
      }
    } else if (t === "int" || t === "long") {
      if (!/^-?\d+$/.test(s)) errors.push(`Value for "${p.name}" must be an integer.`);
    } else if (t === "double" || t === "float") {
      if (Number.isNaN(Number(s)) || s.trim() === "") errors.push(`Value for "${p.name}" must be a number.`);
    } else if (t === "boolean") {
      if (s.toLowerCase() !== "true" && s.toLowerCase() !== "false") errors.push(`Value for "${p.name}" must be true or false.`);
    }
    seen.add(p.name);
  }
  return errors;
}

/**
 * Validate a list of parameter-based test cases.
 * @param {Object} signature - canonical signature
 * @param {Array<{parameterValues: Object}>} testCases
 * @returns {string[]} errors
 */
export function validateParameterTestCases(signature, testCases) {
  const errors = [];
  if (!Array.isArray(testCases) || testCases.length === 0) {
    errors.push("At least one test case is required.");
    return errors;
  }
  testCases.forEach((tc, i) => {
    const values = tc?.parameterValues || {};
    const per = validateParameterValues(signature, values);
    per.forEach((e) => errors.push(`Test case #${i + 1}: ${e}`));
  });
  return errors;
}

/**
 * Build the judge test-case array (input + expectedOutput) from a list of
 * parameter-based test cases. Expected outputs are filled in later by the
 * reference solution.
 * @param {Object} signature
 * @param {Array<{parameterValues: Object, description?: string}>} testCases
 * @returns {Array<{input: string, expectedOutput: string, description?: string, parameterValues: Object}>}
 */
export function buildTestCaseInputs(signature, testCases) {
  if (!Array.isArray(testCases)) return [];
  return testCases.map((tc) => {
    const values = tc?.parameterValues || {};
    return {
      input: convertParameterValuesToInput(signature, values),
      expectedOutput: "",
      description: tc?.description || "",
      parameterValues: values,
    };
  });
}

/**
 * Parse a stored judge input string back into per-parameter values.
 * Used by the edit flow to reload parameter-based test cases.
 * @param {Object} signature
 * @param {string} input - judge input (one line per parameter)
 * @returns {Object} { paramName: rawValue }
 */
export function parseInputToParameterValues(signature, input) {
  const params = Array.isArray(signature?.params) ? signature.params : [];
  const lines = String(input || "").split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== "");
  const values = {};
  params.forEach((p, i) => {
    values[p.name] = lines[i] !== undefined ? lines[i] : "";
  });
  return values;
}

export default {
  serializeParameterValue,
  convertParameterValuesToInput,
  validateParameterValues,
  validateParameterTestCases,
  buildTestCaseInputs,
  parseInputToParameterValues,
};
