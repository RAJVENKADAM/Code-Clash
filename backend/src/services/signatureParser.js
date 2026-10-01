/**
 * Parses Java method signatures into the canonical
 * { name, returnType, params: [{ name, type }] } representation.
 */

function canonicalizeType(rawType) {
  let type = String(rawType || "").trim().replace(/\s+/g, " ");
  const arrayMatch = type.match(/((?:\s*\[\s*\])+)$/);
  const arraySuffix = arrayMatch
    ? "[]".repeat((arrayMatch[1].match(/\[/g) || []).length)
    : "";
  if (arrayMatch) type = type.slice(0, arrayMatch.index).trim();

  const listMatch = type.match(/^(?:List|ArrayList)\s*<\s*(.+)\s*>$/i);
  if (listMatch) {
    const inner = canonicalizeType(listMatch[1]);
    const boxedInner = {
      int: "integer",
      char: "character",
      boolean: "boolean",
    }[inner] || inner;
    return `list<${boxedInner}>${arraySuffix}`;
  }

  const typeAliases = {
    string: "string",
    integer: "int",
    long: "long",
    double: "double",
    float: "float",
    boolean: "boolean",
    character: "char",
    int: "int",
    char: "char",
    byte: "byte",
    short: "short",
    void: "void",
    listnode: "ListNode",
    treenode: "TreeNode",
  };
  const canonical = typeAliases[type.toLowerCase()] || type;
  return `${canonical}${arraySuffix}`;
}

function parseJavaParameters(body) {
  if (!body.trim()) return [];
  return splitTopLevel(body).map((raw, index) => {
    const parameter = raw.trim().replace(/^final\s+/, "");
    if (!parameter || parameter.includes("=") || parameter.includes("*")) {
      throw new Error(`Invalid Java parameter: "${parameter}"`);
    }

    const match = parameter.match(
      /^(.+?)\s+([A-Za-z_$][\w$]*)(\s*(?:\[\s*\])*)$/,
    );
    if (!match) {
      throw new Error(`Could not parse Java parameter #${index + 1}: "${parameter}"`);
    }
    return {
      name: match[2],
      type: canonicalizeType(`${match[1]}${match[3] || ""}`),
    };
  });
}

/**
 * Parse a Java method signature such as
 * `public int[] twoSum(int[] nums, int target)`.
 */
export function parseSignature(signature) {
  if (!signature || typeof signature !== "string") {
    throw new Error("Java method signature is required.");
  }

  let source = signature.trim().replace(/;+\s*$/, "");
  if (/^def\s/.test(source) || /\bvector\s*</i.test(source) || /::|[*&]/.test(source)) {
    throw new Error("Only Java method signatures are supported.");
  }

  const callMatch = source.match(/([A-Za-z_$][\w$]*)\s*\(([^()]*)\)\s*$/);
  if (!callMatch) {
    throw new Error(`Could not parse Java method signature: "${signature}"`);
  }

  const name = callMatch[1];
  const modifiers = /^(?:(?:public|protected|private|static|final|abstract|synchronized|native|strictfp|default)\s+)*/;
  const before = source.slice(0, source.lastIndexOf(name)).trim().replace(modifiers, "").trim();
  if (!before) {
    throw new Error("Java method return type is required.");
  }

  const returnType = canonicalizeType(before);
  if (
    !/^[A-Za-z_$][\w$]*(?:\s*<[^;()]+>)?(?:\s*\[\s*\])*$/.test(before) ||
    returnType.toLowerCase() === "def"
  ) {
    throw new Error(`Invalid Java return type: "${before}"`);
  }

  return {
    name,
    returnType,
    params: parseJavaParameters(callMatch[2]),
  };
}

/**
 * Split a comma-separated string while respecting nested <> [] () and quotes.
 */
export function splitTopLevel(str) {
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
    if (!parsed.name) {
      return { valid: false, error: "Function name could not be determined." };
    }
    if (!parsed.returnType) {
      return { valid: false, error: "Return type could not be determined." };
    }
    return { valid: true, parsed };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * Normalize stored signature metadata or parse a legacy signature string.
 */
export function getStoredSignature(stored) {
  if (!stored) return null;
  if (typeof stored === "string") {
    const result = validateSignature(stored);
    return result.valid ? result.parsed : null;
  }
  if (!stored.name) return null;

  const params = Array.isArray(stored.params) && stored.params.length > 0
    ? stored.params
    : Array.isArray(stored.parameters) ? stored.parameters : [];
  return {
    name: String(stored.name),
    returnType: canonicalizeType(String(stored.returnType || "void")),
    params: params
      .filter((param) => param && param.name)
      .map((param) => ({
        name: String(param.name),
        type: canonicalizeType(String(param.type || "int")),
      })),
  };
}

/**
 * Check whether a signature uses a particular canonical helper type.
 */
export function signatureUsesType(signature, typeName) {
  const key = typeName.toLowerCase();
  const types = [
    signature?.returnType,
    ...(signature?.params || []).map((param) => param.type),
  ];
  return types.some((type) => {
    const value = String(type || "").toLowerCase().trim();
    return value === key || value === `${key}[]` || value === `${key}[][]`;
  });
}

export default {
  parseSignature,
  validateSignature,
  splitTopLevel,
  getStoredSignature,
  signatureUsesType,
};
