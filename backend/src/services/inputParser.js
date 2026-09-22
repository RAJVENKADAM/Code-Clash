/**
 * inputParser.js
 * ------------------------------------------------------------------
 * Automatic test-case input parser.
 *
 * For the authoring system, visible/hidden test-case "input" fields store
 * a JSON representation of the function arguments (as a JSON array), e.g.
 *
 *    [2,7,11,15]
 *    9
 *
 * This service exposes:
 *   - parseArguments(raw)  -> array of typed JS values
 *   - formatArguments(raw) -> per-language literal string used by the judge wrapper
 *
 * Linked-list / tree inputs are stored as plain arrays (level-order) and
 * converted to structured values by the judge wrapper on each language side.
 */

/**
 * Try to parse a raw input block into a JS value.
 * Returns a string if it's not JSON-parseable.
 */
export function parseInputValue(raw) {
  if (raw === undefined || raw === null) return raw;
  const s = String(raw).trim();
  if (s === "") return "";
  try {
    // Allow "3" -> 3, "[1,2]" -> array, '"abc"' -> "abc", "true" -> true
    return JSON.parse(s);
  } catch (e) {
    // Not JSON: treat as plain string (e.g. a raw word like "abc")
    return s;
  }
}

/**
 * Given a test-case input string (each line = one argument in JSON form),
 * return an array of typed JS argument values.
 */
export function parseArguments(rawInput) {
  if (!rawInput) return [];
  const lines = String(rawInput)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "");
  return lines.map(parseInputValue);
}

/**
 * Format a JS value as a language literal for the judge wrapper.
 */
export function formatLiteral(value, language) {
  if (value === null || value === undefined) {
    return language === "python" ? "None" : "null";
  }
  if (typeof value === "boolean") {
    return language === "python" ? (value ? "True" : "False") : value ? "true" : "false";
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return language === "python" ? "float('inf')" : "1e18";
    }
    return String(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const inner = value.map((v) => formatLiteral(v, language)).join(", ");
    return `[${inner}]`;
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch (e) {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Build a wrapper snippet for parsing each argument based on canonical type.
 * Returns per-language code that reads from a `tokens`/stream and yields
 * the parameter value.
 *
 * This is intentionally simple and extensible: for each canonical param
 * type we emit the appropriate read expression. The wrapper generator
 * assembles these into the final program.
 */
export function buildParseExpression(param, language, idx) {
  const type = (param.type || "int").toLowerCase().trim();
  const name = param.name || `arg${idx}`;

  // Python
  if (language === "python") {
    if (type === "string") return `${name} = next(tokens)`;
    if (type === "char") return `${name} = next(tokens)[0] if next(tokens) else ''`;
    if (type === "int" || type === "long") return `${name} = int(next(tokens))`;
    if (type === "double") return `${name} = float(next(tokens))`;
    if (type === "boolean") return `${name} = next(tokens).lower() in ('true','1')`;
    if (type.endsWith("[]") || type.startsWith("list<") || type === "ListNode" || type === "TreeNode") {
      return `${name} = parse_array(next(tokens))`;
    }
    return `${name} = next(tokens)`;
  }

  // Java
  if (language === "java") {
    if (type === "string") return `${name} = sc.next();`;
    if (type === "char") return `${name} = sc.next().charAt(0);`;
    if (type === "int") return `${name} = sc.nextInt();`;
    if (type === "long") return `${name} = sc.nextLong();`;
    if (type === "double") return `${name} = sc.nextDouble();`;
    if (type === "boolean") return `${name} = sc.nextBoolean();`;
    if (type.endsWith("[]") || type === "ListNode" || type === "TreeNode") {
      return `${name} = parseArray(sc);`;
    }
    if (type.startsWith("list<")) return `${name} = parseList(sc);`;
    return `${name} = sc.next();`;
  }

  // C++
  if (language === "cpp") {
    if (type === "string") return `cin >> ${name};`;
    if (type === "char") return `cin >> ${name};`;
    if (type === "int") return `cin >> ${name};`;
    if (type === "long") return `cin >> ${name};`;
    if (type === "double") return `cin >> ${name};`;
    if (type === "boolean") return `cin >> ${name};`;
    if (type.endsWith("[]") || type === "ListNode" || type === "TreeNode") {
      return `${name} = parseArray<${mapCppInner(type)}>(cin);`;
    }
    return `cin >> ${name};`;
  }

  // C
  if (language === "c") {
    if (type === "string") return `scanf("%s", ${name});`;
    if (type === "char") return `scanf(" %c", &${name});`;
    if (type === "int") return `scanf("%d", &${name});`;
    if (type === "long") return `scanf("%lld", &${name});`;
    if (type === "double") return `scanf("%lf", &${name});`;
    if (type === "boolean") return `{ int __b; scanf("%d", &__b); ${name} = __b; }`;
    if (type.endsWith("[]")) return `parse_array(&${name}, &${name}Size);`;
    if (type === "ListNode") return `${name} = parse_linked_list();`;
    if (type === "TreeNode") return `${name} = parse_tree();`;
    return `scanf("%d", &${name});`;
  }

  return "";
}

function mapCppInner(type) {
  if (type === "int[]") return "int";
  if (type === "long[]") return "long";
  if (type === "double[]") return "double";
  if (type === "boolean[]") return "bool";
  if (type === "string[]") return "string";
  if (type === "int[][]") return "vector<int>";
  return "int";
}

export default {
  parseInputValue,
  parseArguments,
  formatLiteral,
  buildParseExpression,
};

