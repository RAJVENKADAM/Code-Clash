/**
 * Parse and format the JSON-based test-case input used by Java wrappers.
 */

export function parseInputValue(raw) {
  if (raw === undefined || raw === null) return raw;
  const value = String(raw).trim();
  if (value === "") return "";
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function parseArguments(rawInput) {
  if (!rawInput) return [];
  return String(rawInput)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map(parseInputValue);
}

export function formatLiteral(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return String(value);
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "1e18";
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `{${value.map(formatLiteral).join(", ")}}`;
  }
  return JSON.stringify(value);
}

export function buildParseExpression(param, idx) {
  const type = String(param.type || "int").toLowerCase().trim();
  const name = param.name || `arg${idx}`;
  if (type === "string") return `${name} = parseString();`;
  if (type === "char") return `${name} = parseChar();`;
  if (type === "int") return `${name} = parseInt();`;
  if (type === "long") return `${name} = parseLong();`;
  if (type === "double") return `${name} = parseDouble();`;
  if (type === "boolean" || type === "bool") return `${name} = parseBool();`;
  if (type.endsWith("[]") || type === "ListNode" || type === "TreeNode") {
    return `${name} = parseArray();`;
  }
  if (type.startsWith("list<")) return `${name} = parseList();`;
  return `${name} = parseInt();`;
}

export default {
  parseInputValue,
  parseArguments,
  formatLiteral,
  buildParseExpression,
};
