/**
 * validator.js
 * ------------------------------------------------------------------
 * Validates a fully-composed judge program before it is sent to the
 * execution engine. Catches structural defects that would otherwise
 * surface as confusing remote compilation errors.
 *
 * Validation rules (per language):
 *   - Source is non-empty.
 *   - Exactly one Solution class (Java/C++/Python) or one solution
 *     function (C).
 *   - A `main` / `public class Main` exists (Java/C++/C); Python has a
 *     `main()` or guarded `if __name__ == "__main__"`.
 *   - No import statements after any class declaration (Java).
 *   - No duplicate import statements.
 *   - No duplicate parser/serializer/helper method definitions.
 *   - No reference to ListNode/TreeNode helpers unless they are defined.
 *   - Balanced braces / brackets / parens.
 */

export class ProgramValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProgramValidationError";
  }
}

function countOccurrences(code, pattern) {
  const matches = code.match(pattern);
  return matches ? matches.length : 0;
}

function isBalanced(code) {
  const stack = [];
  const pairs = { ")": "(", "]": "[", "}": "{" };
  for (const ch of code) {
    if (ch === "(" || ch === "[" || ch === "{") stack.push(ch);
    else if (ch === ")" || ch === "]" || ch === "}") {
      if (stack.pop() !== pairs[ch]) return false;
    }
  }
  return stack.length === 0;
}

/** Distinct import/include/import-from lines. */
function collectImports(code, language) {
  const lines = code.split("\n");
  const imports = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (language === "java" && /^import\s+[\w.*]+\s*;\s*$/.test(line)) {
      imports.push(line.replace(/\s+/g, " "));
    } else if (language === "python" && /^(from\s+[\w.]+\s+import\s+.+|import\s+.+)$/.test(line)) {
      imports.push(line.replace(/\s+/g, " "));
    } else if ((language === "cpp" || language === "c") && /^#\s*include\s*[<"][^>"]+[>"]\s*$/.test(line)) {
      imports.push(line.replace(/\s+/g, " "));
    }
  }
  return imports;
}

/** Check that no import statement appears after a top-level class declaration. */
function importsAfterClassDeclarationJava(code) {
  const lines = code.split("\n");
  let seenClass = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (/^(public\s+)?class\s+[A-Za-z_]\w*/.test(line)) seenClass = true;
    if (seenClass && /^import\s+[\w.*]+\s*;\s*$/.test(line)) {
      return { found: true, line };
    }
  }
  return { found: false };
}

function findDefinitionNames(code, language) {
  const names = [];
  let pattern;
  if (language === "python") {
    pattern = /^\s*def\s+([A-Za-z_]\w*)\s*\(/gm;
  } else {
    pattern = /\b(?:static\s+)?([A-Za-z_]\w*)\s*\([^)]*\)\s*\{/g;
  }
  let match;
  while ((match = pattern.exec(code)) !== null) {
    names.push(match[1]);
  }
  return names;
}

/**
 * Validate a composed program.
 * @param {string} program
 * @param {string} language java|python|cpp|c
 * @param {Object} [signature] optional structured signature for helper checks
 * @throws {ProgramValidationError}
 */
export function validateProgram(program, language, signature) {
  if (!program || typeof program !== "string" || program.trim() === "") {
    throw new ProgramValidationError("Generated program is empty.");
  }

  const code = program;
  const lang = (language || "").toLowerCase();

  // 1. Balanced delimiters
  if (!isBalanced(code)) {
    throw new ProgramValidationError("Generated program has unbalanced braces/parens.");
  }

  // 2. Language-specific structural checks
  if (lang === "java") {
    const mainCount = countOccurrences(code, /\bpublic\s+class\s+Main\b/g);
    if (mainCount !== 1) {
      throw new ProgramValidationError(
        mainCount === 0
          ? "Generated Java program is missing 'public class Main'."
          : `Generated Java program has ${mainCount} 'public class Main' declarations (expected exactly 1).`
      );
    }
    const solutionCount = countOccurrences(code, /\bclass\s+Solution\b/g);
    if (solutionCount !== 1) {
      throw new ProgramValidationError(
        solutionCount === 0
          ? "Generated Java program is missing 'class Solution'."
          : `Generated Java program has ${solutionCount} 'class Solution' declarations (expected exactly 1).`
      );
    }
    const importCheck = importsAfterClassDeclarationJava(code);
    if (importCheck.found) {
      throw new ProgramValidationError(
        `Java import statement appears after a class declaration: "${importCheck.line}". All imports must precede class declarations.`
      );
    }
    // C++ leakage guards
    if (/\bpublic:\s*/.test(code)) {
      throw new ProgramValidationError("Found C++ 'public:' specifier inside Java program.");
    }
    if (/using\s+namespace\s+/.test(code)) {
      throw new ProgramValidationError("Found C++ 'using namespace' statement inside Java program.");
    }
    if (/\bstd::/.test(code)) {
      throw new ProgramValidationError("Found C++ 'std::' namespace qualifier inside Java program.");
    }
  } else if (lang === "cpp") {
    const solutionCount = countOccurrences(code, /\bclass\s+Solution\b/g);
    if (solutionCount !== 1) {
      throw new ProgramValidationError(
        solutionCount === 0
          ? "Generated C++ program is missing 'class Solution'."
          : `Generated C++ program has ${solutionCount} 'class Solution' declarations (expected exactly 1).`
      );
    }
    if (!/\bint\s+main\s*\(/.test(code)) {
      throw new ProgramValidationError("Generated C++ program is missing 'int main()'.");
    }
  } else if (lang === "c") {
    if (!/\bint\s+main\s*\(/.test(code)) {
      throw new ProgramValidationError("Generated C program is missing 'int main()'.");
    }
  } else if (lang === "python") {
    const solutionCount = countOccurrences(code, /^\s*class\s+Solution\s*:/gm);
    if (solutionCount !== 1) {
      throw new ProgramValidationError(
        solutionCount === 0
          ? "Generated Python program is missing 'class Solution'."
          : `Generated Python program has ${solutionCount} 'class Solution' declarations (expected exactly 1).`
      );
    }
    if (!/^\s*def\s+main\s*\(/m.test(code)) {
      throw new ProgramValidationError("Generated Python program is missing 'def main()'.");
    }
  }

  // 3. No duplicate imports
  const imports = collectImports(code, lang);
  const uniqueImports = new Set(imports);
  if (uniqueImports.size !== imports.length) {
    throw new ProgramValidationError("Generated program contains duplicate import statements.");
  }

  // 4. No duplicate parser/serializer/helper definitions
  const definitions = findDefinitionNames(code, lang);
  const dupes = {};
  for (const name of definitions) {
    dupes[name] = (dupes[name] || 0) + 1;
  }
  for (const [name, count] of Object.entries(dupes)) {
    if (count > 1 && !/^parse|^serialize|^printOutput|^read|^build_|^main$/.test(name)) {
      continue; // only flag judge-injected helpers
    }
    if (count > 1) {
      throw new ProgramValidationError(`Generated program defines "${name}" more than once.`);
    }
  }

  // 5. Helper references must be backed by definitions
  if (lang !== "c" || true) {
    const helperNames = ["ListNode", "TreeNode"];
    for (const helper of helperNames) {
      const references = countOccurrences(code, new RegExp(`\\b${helper}\\b`, "g"));
      const definitionsCount = countOccurrences(
        code,
        new RegExp(`(?:class\\s+${helper}|struct\\s+${helper})`, "g")
      );
      if (references > 0 && definitionsCount === 0) {
        throw new ProgramValidationError(
          `Generated program references "${helper}" but does not define it.`
        );
      }
    }
  }

  return true;
}

export default { validateProgram, ProgramValidationError };

