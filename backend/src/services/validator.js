export function validateProgram(program, language = "java") {
  if (typeof program !== "string" || !program.trim()) {
    return { valid: false, errors: ["Program is empty."] };
  }
  if (language !== "java") {
    return { valid: false, errors: ["Only Java submissions are supported."] };
  }

  const errors = [];
  const classNames = [...program.matchAll(/\bclass\s+([A-Za-z_$][\w$]*)/g)].map((match) => match[1]);
  const uniqueClasses = new Set(classNames);

  if (!uniqueClasses.has("Solution")) {
    errors.push("Missing required class: Solution.");
  }
  if (!uniqueClasses.has("Main")) {
    errors.push("Missing required class: Main.");
  }

  const classStart = program.search(/\bclass\s+[A-Za-z_$][\w$]*/);
  const lastImport = [...program.matchAll(/^\s*import\s+[^;]+;/gm)].at(-1);
  if (lastImport && classStart >= 0 && lastImport.index > classStart) {
    errors.push("Imports must appear before class declarations.");
  }

  const braceBalance = countJavaBraces(program);
  if (braceBalance !== 0) {
    errors.push("Unbalanced braces in generated program.");
  }

  return { valid: errors.length === 0, errors };
}

function countJavaBraces(program) {
  let depth = 0;
  let state = "code";
  let escaped = false;

  for (let i = 0; i < program.length; i += 1) {
    const char = program[i];
    const next = program[i + 1];

    if (state === "line-comment") {
      if (char === "\n") state = "code";
      continue;
    }
    if (state === "block-comment") {
      if (char === "*" && next === "/") {
        state = "code";
        i += 1;
      }
      continue;
    }
    if (state === "string" || state === "char") {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if ((state === "string" && char === '"') || (state === "char" && char === "'")) state = "code";
      continue;
    }
    if (char === "/" && next === "/") {
      state = "line-comment";
      i += 1;
    } else if (char === "/" && next === "*") {
      state = "block-comment";
      i += 1;
    } else if (char === '"') {
      state = "string";
    } else if (char === "'") {
      state = "char";
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
    }
  }
  return depth;
}
