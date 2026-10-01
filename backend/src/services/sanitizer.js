function extractImports(code) {
  const imports = [];
  const body = code.replace(/^\s*import\s+[^;]+;\s*$/gm, (statement) => {
    imports.push(statement.trim());
    return "";
  });
  return { imports: [...new Set(imports)], body };
}

function extractClass(code, className) {
  const declaration = new RegExp(`\\bclass\\s+${className}\\b`);
  const match = declaration.exec(code);
  if (!match) return "";

  const openBrace = code.indexOf("{", match.index);
  if (openBrace < 0) return "";

  let depth = 0;
  let inString = false;
  let stringQuote = "";
  let escaped = false;

  for (let i = openBrace; i < code.length; i += 1) {
    const char = code[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === stringQuote) inString = false;
      continue;
    }
    if (char === '"' || char === "'") {
      inString = true;
      stringQuote = char;
    } else if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) return code.slice(match.index, i + 1);
  }
  return "";
}

export function sanitizeCode(code) {
  if (typeof code !== "string") return { imports: [], body: "" };
  const withoutPackage = stripHelperBlock(code).replace(/^\s*package\s+[\w.]+\s*;\s*$/gm, "");
  const { imports, body } = extractImports(withoutPackage);
  const solution = extractClass(body, "Solution");
  return { imports, body: (solution || body).trim() };
}

export function composeImportPreamble(wrapperImports, participantImports = []) {
  const imports = [...new Set([...wrapperImports, ...participantImports])];
  return imports.length ? `${imports.join("\n")}\n\n` : "";
}
import { stripHelperBlock } from "./languageTemplates.js";
