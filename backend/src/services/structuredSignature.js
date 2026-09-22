/**
 * structuredSignature.js
 * ------------------------------------------------------------------
 * Modular, reusable service for the parameter-based authoring workflow.
 *
 * The author never writes a raw signature string. Instead they provide:
 *
 *   {
 *     name: 'twoSum',
 *     returnType: 'int[]',
 *     parameters: [
 *       { name: 'nums', type: 'int[]' },
 *       { name: 'target', type: 'int' }
 *     ]
 *   }
 *
 * This service:
 *   1. Validates the structured input (identifier rules, supported types,
 *      unique parameter names).
 *   2. Normalizes it to the canonical signature consumed by the wrapper
 *      generator and language templates:
 *        { name, returnType, params: [{name, type}] }
 *   3. Generates the language-specific signature string for Java, Python,
 *      C++ and C (C uses deriveCSignature so array sizes / matrix
 *      dimensions / returnSize are included exactly as the wrapper calls).
 *
 * The canonical `signature` object remains the single source of truth in
 * the database and is 100% compatible with:
 *   - wrapperGenerator.composeProgram
 *   - languageTemplates.composeStarterFile / generateStarterCode
 *   - languageTemplates.getDataStructureHelpers
 *   - referenceSolutionService.generateExpectedOutputs
 */

import { mapType, deriveCSignature } from "./languageTemplates.js";

// Canonical return types supported by the parameter-based builder.
const PRIMITIVE_TYPES = ["int", "long", "double", "float", "boolean", "char", "string", "void"];
const ARRAY_1D_TYPES = ["int[]", "long[]", "double[]", "float[]", "boolean[]", "char[]", "string[]"];
const ARRAY_2D_TYPES = ["int[][]", "long[][]", "double[][]", "float[][]", "boolean[][]", "char[][]", "string[][]"];
const MATRIX_TYPES = ["int[][]", "double[][]", "boolean[][]", "char[][]", "string[][]"];
const COLLECTION_TYPES = ["list<Integer>", "list<Long>", "list<Double>", "list<String>", "list<Boolean>"];
const STRUCTURE_TYPES = ["ListNode", "TreeNode"];

export const SUPPORTED_RETURN_TYPES = [
  ...PRIMITIVE_TYPES,
  ...ARRAY_1D_TYPES,
  ...ARRAY_2D_TYPES,
  ...COLLECTION_TYPES,
  ...STRUCTURE_TYPES,
];

// Parameter types allowed in the builder. Note: `void` is a valid return
// type but never a parameter type.
export const SUPPORTED_PARAM_TYPES = [
  ...PRIMITIVE_TYPES.filter((t) => t !== "void"),
  ...ARRAY_1D_TYPES,
  ...MATRIX_TYPES,
  ...COLLECTION_TYPES,
  ...STRUCTURE_TYPES,
];

const SUPPORTED_TYPE_SET = new Set([...SUPPORTED_RETURN_TYPES, ...SUPPORTED_PARAM_TYPES]);

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Validate a single parameter entry.
 * @returns {string|null} error message or null when valid
 */
export function validateStructuredParameter(param, index) {
  if (!param) return `Parameter #${index + 1} is missing.`;
  const name = String(param.name || "").trim();
  if (!name) return `Parameter #${index + 1} is missing a name.`;
  if (!IDENTIFIER_RE.test(name)) {
    return `Parameter name "${name}" is not a valid identifier. Use letters, digits and underscores only.`;
  }
  const type = String(param.type || "").trim();
  if (!type) return `Parameter "${name}" is missing a type.`;
  const typeKey = type.toLowerCase();
  if (!SUPPORTED_TYPE_SET.has(typeKey) && !SUPPORTED_TYPE_SET.has(type)) {
    return `Parameter "${name}" has unsupported type "${type}".`;
  }
  return null;
}

/**
 * Validate a full structured signature input.
 * @returns {{valid: boolean, errors: string[], signature: Object|null}}
 */
export function validateStructuredSignature(input) {
  const errors = [];
  const source = input || {};
  const name = String(source.name || "").trim();
  const returnType = String(source.returnType || "").trim();

  if (!name) {
    errors.push("Function name is required.");
  } else if (!IDENTIFIER_RE.test(name)) {
    errors.push(`Function name "${name}" is not a valid identifier.`);
  }

  const retKey = returnType.toLowerCase();
  if (!returnType) {
    errors.push("Return type is required.");
  } else if (!SUPPORTED_TYPE_SET.has(retKey) && !SUPPORTED_TYPE_SET.has(returnType)) {
    errors.push(`Return type "${returnType}" is not supported.`);
  }

  const params = Array.isArray(source.parameters)
    ? source.parameters.map((p, i) => validateStructuredParameter(p, i))
    : [Array.isArray(source.params) ? null : "At least one parameter is required."];

  const paramErrors = params.filter(Boolean);
  if (paramErrors.length === 0) {
    const list = Array.isArray(source.parameters) && source.parameters.length > 0 ? source.parameters : source.params || [];
    const names = list.map((p) => String(p.name || "").trim().toLowerCase());
    const seen = new Set();
    for (const n of names) {
      if (!n) continue;
      if (seen.has(n)) {
        errors.push(`Parameter name "${n}" is duplicated. Parameter names must be unique.`);
        break;
      }
      seen.add(n);
    }
  }
  errors.push(...paramErrors);

  if (errors.length > 0) {
    return { valid: false, errors, signature: null };
  }

  const paramsList = Array.isArray(source.parameters) && source.parameters.length > 0 ? source.parameters : source.params || [];
  const signature = {
    name,
    returnType: retKey,
    params: paramsList.map((p) => ({
      name: String(p.name).trim(),
      type: String(p.type).trim().toLowerCase(),
    })),
  };

  return { valid: true, errors: [], signature };
}

/**
 * Normalize a structured signature input into the canonical
 * { name, returnType, params: [{name,type}] } object.
 * @param {Object} input - { name, returnType, parameters|params }
 * @returns {Object|null} canonical signature or null when invalid
 */
export function normalizeStructuredSignature(input) {
  const result = validateStructuredSignature(input);
  return result.valid ? result.signature : null;
}

/**
 * Generate a Java signature string:
 *   public int[] twoSum(int[] nums, int target)
 */
export function generateJavaSignature(signature) {
  const name = signature?.name || "solution";
  const ret = mapType(signature?.returnType || "void", "java");
  const params = (signature?.params || []).map((p) => `${mapType(p.type, "java")} ${p.name}`).join(", ");
  return `public ${ret} ${name}(${params})`;
}

/**
 * Generate a Python signature string:
 *   def twoSum(self, nums: List[int], target: int) -> List[int]:
 */
export function generatePythonSignature(signature) {
  const name = signature?.name || "solution";
  const params = (signature?.params || []).map((p) => `${p.name}: ${mapType(p.type, "python")}`).join(", ");
  const ret = signature?.returnType === "void" || !signature?.returnType ? "None" : mapType(signature.returnType, "python");
  const prefix = params ? `self, ${params}` : "self";
  return `def ${name}(${prefix}) -> ${ret}:`;
}

/**
 * Generate a C++ signature string:
 *   vector<int> twoSum(vector<int>& nums, int target)
 */
export function generateCppSignature(signature) {
  const name = signature?.name || "solution";
  const params = (signature?.params || []).map((p) => {
    const type = p.type || "int";
    const canon = (type || "").toLowerCase().trim();
    const mapped = mapType(type, "cpp");
    // Match starter-code conventions: vectors by reference, pointers for structures.
    if (canon.startsWith("list<") || canon.endsWith("[]")) return `${mapped}& ${p.name}`;
    if (canon === "listnode" || canon === "treenode") return `${mapped} ${p.name}`;
    return `${mapped} ${p.name}`;
  }).join(", ");
  return `${mapType(signature?.returnType || "void", "cpp")} ${name}(${params})`;
}

/**
 * Generate a C signature string using deriveCSignature so array/matrix
 * parameters include their size arguments and array returns include
 * returnSize exactly as the judge wrapper invokes the function:
 *
 *   int* twoSum(int* nums, int numsSize, int target, int* returnSize)
 */
export function generateCSignature(signature) {
  const name = signature?.name || "solution";
  const c = deriveCSignature(signature);
  const params = c.cParams ? c.cParams.join(", ") : [];
  let retType = mapType(signature?.returnType || "void", "c");
  const ret = (signature?.returnType || "void").toLowerCase().trim();
  let callParams = params;
  if (ret.endsWith("[]") && !ret.endsWith("[][]")) {
    callParams = params ? `${params}, int* returnSize` : "int* returnSize";
  }
  return `${retType} ${name}(${callParams})`;
}

/**
 * Generate signature preview strings for all four supported languages.
 * @param {Object} signature - canonical { name, returnType, params }
 * @returns {{java: string, python: string, cpp: string, c: string}}
 */
export function generateSignaturePreviews(signature) {
  if (!signature || !signature.name) return {};
  return {
    java: generateJavaSignature(signature),
    python: generatePythonSignature(signature),
    cpp: generateCppSignature(signature),
    c: generateCSignature(signature),
  };
}

export default {
  SUPPORTED_RETURN_TYPES,
  SUPPORTED_PARAM_TYPES,
  validateStructuredSignature,
  validateStructuredParameter,
  normalizeStructuredSignature,
  generateSignaturePreviews,
  generateJavaSignature,
  generatePythonSignature,
  generateCppSignature,
  generateCSignature,
};

