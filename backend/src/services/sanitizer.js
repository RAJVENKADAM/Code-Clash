/**
 * sanitizer.js
 * ------------------------------------------------------------------
 * Sanitizes participant/reference source code before it is merged into a
 * judge wrapper. Guarantees:
 *
 *   - Normalized line endings (LF) and trimmed whitespace.
 *   - No package declarations.
 *   - All import statements hoisted to the top and deduplicated.
 *   - No auto-generated data-structure helper blocks.
 *   - No duplicate Solution class declarations (first one wins).
 *
 * The sanitizer never *creates* code — it only strips/relocates. The
 * wrapper generator is the only component that decides what gets injected.
 */

import { HELPER_MARKERS, stripHelperBlock } from "./languageTemplates.js";

/** Normalize CRLF / CR to LF. */
function normalizeNewlines(code) {
  return String(code || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/** Remove Java `package x.y;` declarations. */
function stripPackageDeclarations(code, language) {
  if (language !== "java") return code;
  return code
    .split("\n")
    .filter((line) => !/^\s*package\s+[\w.]+\s*;\s*$/.test(line))
    .join("\n");
}

/**
 * Extract import-like statements and remove them from the body.
 * Returns { imports: string[], body: string }.
 */
function extractImports(code, language) {
  const lines = code.split("\n");
  const imports = [];
  const bodyLines = [];
  let inBlockComment = false;

  const isJavaImport = (line) => /^\s*import\s+[\w.*]+\s*;\s*$/.test(line);
  const isPyImport = (line) =>
    /^\s*(?:from\s+[\w.]+\s+import\s+.+|import\s+.+)\s*$/.test(line) &&
    !line.includes("(") && // avoid multiline `from x import (`
    !/^\s*import\s+$/.test(line);
  const isCInclude = (line) => /^\s*#\s*include\s*[<"][^>"]+[>"]\s*$/.test(line);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (inBlockComment) {
      bodyLines.push(rawLine);
      if (line.includes("*/")) inBlockComment = false;
      continue;
    }
    if (line.startsWith("/*") && !line.includes("*/")) {
      bodyLines.push(rawLine);
      inBlockComment = true;
      continue;
    }

    if (language === "java" && isJavaImport(line)) {
      imports.push(line.replace(/^\s*/, ""));
      continue;
    }
    if (language === "python" && isPyImport(line)) {
      imports.push(line);
      continue;
    }
    if ((language === "cpp" || language === "c") && isCInclude(line)) {
      imports.push(line.replace(/^\s*/, ""));
      continue;
    }
    bodyLines.push(rawLine);
  }

  return { imports: dedupeImports(imports), body: bodyLines.join("\n") };
}

/** Deduplicate a list of import statements, preserving first occurrence. */
function dedupeImports(imports) {
  const seen = new Set();
  const result = [];
  for (const imp of imports) {
    const key = imp.replace(/\s+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(imp);
  }
  return result;
}

/**
 * Find the index just past the closing brace of the class/struct/block that
 * starts at `startIndex` (the position of the `c` in `class`/`struct`).
 */
function findBraceBlockEnd(code, startIndex) {
  let i = code.indexOf("{", startIndex);
  if (i === -1) return code.length;
  let depth = 0;
  for (; i < code.length; i++) {
    if (code[i] === "{") depth++;
    else if (code[i] === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return code.length;
}

/**
 * Strip duplicate `class Solution` definitions (Java/C++/Python). The first
 * definition wins; any subsequent `class Solution` blocks are removed
 * entirely so the final program has exactly one Solution class.
 */
function stripDuplicateSolutionClasses(code, language) {
  if (language === "python") {
    const lines = code.split("\n");
    let seen = false;
    let inSolution = false;
    let solutionIndent = 0;
    const result = [];
    for (const line of lines) {
      if (/^\s*class\s+Solution\s*:/.test(line)) {
        if (!seen) {
          seen = true;
          inSolution = true;
          solutionIndent = line.match(/^(\s*)/)[1].length;
          result.push(line);
        }
        // else: skip this entire duplicate class block
        continue;
      }
      if (inSolution) {
        if (line.trim() !== "") {
          const indent = line.match(/^(\s*)/)[1].length;
          if (indent <= solutionIndent) inSolution = false;
        }
      }
      if (!seen || !inSolution) result.push(line);
    }
    return result.join("\n");
  }

  // Java / C++: brace-matched blocks
  const regex = /\bclass\s+Solution\b/g;
  const toRemove = [];
  let match;
  let first = true;
  while ((match = regex.exec(code)) !== null) {
    if (first) {
      first = false;
      continue;
    }
    const end = findBraceBlockEnd(code, match.index);
    toRemove.push({ start: match.index, end });
  }
  let result = code;
  for (let i = toRemove.length - 1; i >= 0; i--) {
    const { start, end } = toRemove[i];
    result = result.slice(0, start) + result.slice(end);
  }
  return result;
}

/**
 * Sanitize arbitrary source code.
 *
 * @param {string} code raw participant/reference source
 * @param {string} language java|python|cpp|c
 * @returns {{ imports: string[], body: string }}
 */
export function sanitizeCode(code, language) {
  let text = normalizeNewlines(code);
  text = stripHelperBlock(text, language);
  text = stripPackageDeclarations(text, language);
  const { imports, body } = extractImports(text, language);
  let cleanedBody = stripDuplicateSolutionClasses(body, language);
  cleanedBody = cleanedBody.trim();
  return { imports, body: cleanedBody };
}

/**
 * Compose an import preamble (deduplicated against wrapper imports).
 * @param {string[]} wrapperImports
 * @param {string[]} participantImports
 * @param {string} language
 * @returns {string} a block of import lines + trailing blank line, or ""
 */
export function composeImportPreamble(wrapperImports, participantImports, language) {
  const merged = dedupeImports([...wrapperImports, ...(participantImports || [])]);
  if (merged.length === 0) return "";
  return merged.join("\n") + "\n\n";
}

export default {
  sanitizeCode,
  composeImportPreamble,
  normalizeNewlines,
};

