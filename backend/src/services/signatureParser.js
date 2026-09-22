/**
 * signatureParser.js
 * ------------------------------------------------------------------
 * Parses a single-line function signature into a canonical, language
 * agnostic representation: { name, returnType, params: [{name, type}] }.
 *
 * Admins provide ONE signature (in any of the 4 supported languages) and
 * the platform derives starter code + judge wrappers for every language.
 *
 * Examples:
 *   Java:     public int[] twoSum(int[] nums, int target)
 *   Python:   def twoSum(nums, target):
 *   C++:      vector<int> twoSum(vector<int>& nums, int target)
 *   C:        int* twoSum(int* nums, int numsSize, int target)
 */

const PRIMITIVES = new Set([
  "int", "long", "double", "boolean", "bool", "char", "string", "string", "float",
  "short", "byte", "size_t", "void",
]);

/**
 * Normalize a canonical type token (strip references, const, ptr markers).
 */
function normalizeTypeToken(token) {
  if (!token) return token;
  let t = token.trim();
  t = t.replace(/^const\s+/g, "").replace(/&$/g, "").trim();
  t = t.replace(/\s*\*\s*$/g, "").replace(/\s*\*\s*/g, "*").trim();
  if (t === "bool") return "boolean";
  if (t === "str") return "string";
  if (t === "vector") return "int[]";
  return t;
}

function isArrayToken(t) {
  return /\[\s*\]/.test(t) || t === "vector<int>" || t === "vector<long>" || t === "vector<double>" || t === "vector<string>"; 
}

function canonicalizeType(rawType, language) {
  let t = (rawType || "").trim();
  t = t.replace(/^const\s+/g, "").replace(/&$/g, "").trim();

  // Pointer arrays in C/C++
  if (t.endsWith("**")) return `${t.slice(0, -2)}[][]`;
  if (t.endsWith("*")) return `${t.slice(0, -1)}[]`;

  // C++ vectors -> arrays / nested arrays
  const vecMatch = t.match(/^vector\s*<\s*(.+)\s*>$/);
  if (vecMatch) {
    const inner = vecMatch[1].trim();
    const innerVec = inner.match(/^vector\s*<\s*(.+)\s*>$/);
    if (innerVec) return `${canonicalizeType(innerVec[1], language)}[][]`;
    return `${canonicalizeType(inner, language)}[]`;
  }

  // Java generics
  const listMatch = t.match(/^List\s*<\s*(.+)\s*>$/i);
  if (listMatch) {
    const inner = listMatch[1].trim();
    const innerList = inner.match(/^List\s*<\s*(.+)\s*>$/i);
    if (innerList) return `list<list<${canonicalizeType(innerList[1], language)}>>`;
    return `list<${canonicalizeType(inner, language)}>`;
  }

  // Java/C# style array
  t = t.replace(/\s*\[\s*\]\s*$/g, "[]");
  if (t === "String") return "string";
  if (t === "Integer") return "int";
  if (t === "Long") return "long";
  if (t === "Double") return "double";
  if (t === "Boolean") return "boolean";
  if (t === "Character") return "char";
  if (t === "List") return "list<Integer>";
  if (t === "TreeNode") return "TreeNode";
  if (t === "ListNode") return "ListNode";

  return t.toLowerCase() === t ? t : t;
}

/**
 * Parse a full signature string.
 * @returns {{ name: string, returnType: string, params: Array<{name:string,type:string}>, language: string|null }}
 */
export function parseSignature(signature) {
  if (!signature || typeof signature !== "string") {
    throw new Error("Function signature is required.");
  }

  let sig = signature.trim();
  // Strip trailing semicolon
  sig = sig.replace(/;+\s*$/, "");

  let language = null;
  let name = "";
  let returnType = "void";
  let params = [];

  // Python: def twoSum(nums, target):  OR def twoSum(nums: List[int], target: int) -> List[int]:
  const pyMatch = sig.match(/^def\s+([A-Za-z_]\w*)\s*\((.*)\)\s*(->\s*(.+))?\s*:?\s*$/);
  if (pyMatch) {
    language = "python";
    name = pyMatch[1];
    if (pyMatch[4]) returnType = canonicalizeType(pyMatch[4].trim(), "python");
    const body = pyMatch[2].trim();
    params = parsePythonParams(body);
    return { name, returnType, params, language };
  }

  // Generic: strip `public`/`static`/access modifiers, then find `name(args)`.
  const cleaned = sig
    .replace(/\bpublic\b/g, " ")
    .replace(/\bprivate\b/g, " ")
    .replace(/\bprotected\b/g, " ")
    .replace(/\bstatic\b/g, " ")
    .replace(/\bfinal\b/g, " ")
    .replace(/\bvirtual\b/g, " ")
    .replace(/\boverride\b/g, " ")
    .replace(/\bconstexpr\b/g, " ")
    .replace(/\binline\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const callMatch = cleaned.match(/([A-Za-z_]\w*)\s*\(([^()]*)\)\s*$/);
  if (!callMatch) {
    throw new Error(`Could not parse function signature: "${signature}"`);
  }
  name = callMatch[1];

  // Return type is everything before the function name.
  const before = cleaned.slice(0, cleaned.lastIndexOf(callMatch[1])).trim();
  if (before) {
    // Could be "int[]" or "std::vector<int>" etc.
    let rt = before;
    // In C/C++ arrays the brackets may appear after the name: int foo(int a[]) -> return int
    if (rt === "auto" || rt === "struct") {
      // C++ trailing return
      const arrIdx = before.lastIndexOf("]");
      rt = before.slice(0, arrIdx + 1).trim();
    }
    returnType = canonicalizeType(rt, "cpp");
  }

  // Language detection
  if (/::/.test(before) || /std::/.test(sig)) language = "cpp";
  else if (/^[A-Z][A-Za-z0-9_<>[\],\s.]*$/.test(before) && !PRIMITIVES.has(before.toLowerCase())) language = "java";
  else if (/^\w[\w\s]*\*/.test(sig) || /^struct\s/.test(sig)) language = "c";
  else language = "cpp";

  params = parseCPPJavaParams(callMatch[2], language);

  return { name, returnType, params, language };
}

function parsePythonParams(body) {
  if (!body.trim()) return [];
  const parts = splitTopLevel(body);
  return parts
    .filter((p) => p && p.trim() && !p.trim().startsWith("*") && !p.trim().startsWith("**"))
    .map((p) => {
      p = p.trim();
      // Remove default values
      p = p.split("=")[0].trim();
      // name: Type
      const typeMatch = p.match(/^([A-Za-z_]\w*)\s*:\s*(.+)$/);
      if (typeMatch) {
        return { name: typeMatch[1], type: canonicalizeType(typeMatch[2].trim(), "python") };
      }
      return { name: p, type: "int" };
    })
    // Python instance/class params are implicit; never store them as real parameters.
    .filter((p) => p.name !== "self" && p.name !== "cls");
}

function parseCPPJavaParams(body, language) {
  if (!body.trim()) return [];
  const parts = splitTopLevel(body);
  const result = [];
  for (const raw of parts) {
    let p = raw.trim();
    if (!p) continue;
    // Strip default value
    p = p.split("=")[0].trim();
    // Remove `const` and reference markers
    const noConst = p.replace(/^const\s+/, "").trim();
    // C-style array param: int nums[] or int nums[10]
    const arrParam = noConst.match(/^([\w:]+)\s+([A-Za-z_]\w*)\s*\[\s*\]\s*$/);
    if (arrParam) {
      result.push({ name: arrParam[2], type: `${canonicalizeType(arrParam[1], language)}[]` });
      continue;
    }
    // C-style pointer: int* nums  OR int *nums
    const ptrParam = noConst.match(/^([\w:]+)\s*\*\s*([A-Za-z_]\w*)$/);
    if (ptrParam) {
      result.push({ name: ptrParam[2], type: `${canonicalizeType(ptrParam[1], language)}[]` });
      continue;
    }
    // Java/C++: Type name  (type may contain spaces for nested generics)
    const typeNameMatch = noConst.match(/^(.+?)\s+([A-Za-z_]\w*)$/);
    if (typeNameMatch) {
      result.push({
        name: typeNameMatch[2],
        type: canonicalizeType(typeNameMatch[1], language),
      });
      continue;
    }
    // Unnamed param -> ignore or assign paramN
    result.push({ name: `param${result.length + 1}`, type: canonicalizeType(p, language) });
  }
  return result;
}

/**
 * Split a comma-separated string while respecting nested <> [] () and quotes.
 */
function splitTopLevel(str) {
  const parts = [];
  let depth = 0;
  let current = "";
  let inQuote = false;
  let quoteChar = "";
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inQuote) {
      current += ch;
      if (ch === quoteChar) inQuote = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
      current += ch;
      continue;
    }
    if (ch === "<" || ch === "[" || ch === "(") depth++;
    if (ch === ">" || ch === "]" || ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  return parts;
}

export function validateSignature(signature) {
  try {
    const parsed = parseSignature(signature);
    if (!parsed.name) return { valid: false, error: "Function name could not be determined." };
    if (!parsed.returnType) return { valid: false, error: "Return type could not be determined." };
    return { valid: true, parsed };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/**
 * Normalize a stored signature into canonical structured metadata.
 *
 * Source of truth contract:
 *   - If `stored` is already an object with `name`, use it verbatim (but
 *     normalize names/types to lowercase canonical tokens where needed).
 *   - If `stored` is a raw signature string (legacy data), parse it once.
 *   - Never regenerate from starter code — starter code is always derived
 *     FROM this object.
 *
 * @param {Object|string} stored - persisted signature metadata or raw string
 * @returns {{name: string, returnType: string, params: Array<{name:string,type:string}>}}
 */
export function getStoredSignature(stored) {
  if (!stored) return null;
  if (typeof stored === "string") {
    const result = validateSignature(stored);
    if (!result.valid) return null;
    return result.parsed;
  }
  const s = stored || {};
  if (!s.name) return null;
  // Accept both the legacy `params` key and the new `parameters` key used by
  // the parameter-based authoring workflow.
  const paramList = Array.isArray(s.params) && s.params.length > 0
    ? s.params
    : Array.isArray(s.parameters) ? s.parameters : [];
  return {
    name: String(s.name),
    returnType: canonicalizeType(String(s.returnType || "void"), "cpp"),
    params: paramList
      .filter((p) => p && p.name)
      .map((p) => ({
        name: String(p.name),
        type: canonicalizeType(String(p.type || "int"), "cpp"),
      })),
  };
}

/**
 * Whether a signature uses the given canonical type (case-insensitive).
 * Used to decide whether ListNode/TreeNode helpers or specific parsers are
 * needed. Handles both exact matches (e.g. "ListNode") and array-of-helper
 * forms (e.g. "ListNode[]").
 */
export function signatureUsesType(signature, typeName) {
  const key = typeName.toLowerCase();
  const types = [
    signature?.returnType,
    ...(signature?.params || []).map((p) => p.type),
  ];
  return types.some((t) => {
    const s = String(t || "").toLowerCase().trim();
    return s === key || s === `${key}[]` || s === `${key}[][]`;
  });
}

export default { parseSignature, validateSignature, splitTopLevel, getStoredSignature, signatureUsesType };

