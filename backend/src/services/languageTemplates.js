/**
 * languageTemplates.js
 * ------------------------------------------------------------------
 * Global, reusable templates for the coding-challenge authoring system.
 *
 * These templates are the single source of truth for generating
 * participant starter code and server-side judge wrappers. The admin only
 * defines a structured function signature; these templates (plus
 * wrapperGenerator.js and sanitizer.js) build everything else.
 *
 * Contract:
 *   - Starter code = signature + minimal boilerplate ONLY. Never include
 *     wrappers, parsers, serializers, judge code, or unused helpers.
 *   - Data-structure helpers are injected ONLY when the signature actually
 *     references them (ListNode XOR TreeNode, never both unless both used).
 *   - Imports/includes live only at the top of the file.
 *   - mapType() maps canonical types to each language's native type.
 *
 * Supported judge languages: java, python, cpp, c.
 */

import { signatureUsesType } from "./signatureParser.js";

export const AUTHORING_LANGUAGES = [
  { id: "java", label: "Java", extension: ".java", monacoId: "java" },
  { id: "python", label: "Python", extension: ".py", monacoId: "python" },
  { id: "cpp", label: "C++", extension: ".cpp", monacoId: "cpp" },
  { id: "c", label: "C", extension: ".c", monacoId: "c" },
];

// Marker comments surrounding auto-generated data-structure helpers.
// The sanitizer strips this block from participant code before appending
// it, so duplicate ListNode/TreeNode definitions never collide.
export const HELPER_MARKERS = {
  python: { start: "# ===== DATA STRUCTURE HELPERS START =====\n", end: "# ===== DATA STRUCTURE HELPERS END =====\n" },
  java: { start: "// ===== DATA STRUCTURE HELPERS START =====\n", end: "// ===== DATA STRUCTURE HELPERS END =====\n" },
  cpp: { start: "// ===== DATA STRUCTURE HELPERS START =====\n", end: "// ===== DATA STRUCTURE HELPERS END =====\n" },
  c: { start: "/* ===== DATA STRUCTURE HELPERS START ===== */\n", end: "/* ===== DATA STRUCTURE HELPERS END ===== */\n" },
};

/**
 * Remove the auto-generated helper block (between markers) from a user
 * submitted program. Used before appending the participant code to the
 * judge wrapper so duplicate struct/class definitions never appear.
 */
export function stripHelperBlock(code, language) {
  const markers = HELPER_MARKERS[language];
  if (!markers || !code || typeof code !== "string") return code || "";
  const start = code.indexOf(markers.start);
  if (start === -1) return code;
  const end = code.indexOf(markers.end, start + markers.start.length);
  if (end === -1) return code;
  const after = end + markers.end.length;
  // Keep any code before the markers (imports etc.) and after them.
  return code.slice(0, start) + code.slice(after);
}

// ----------------------------------------------------------------------
// Type maps
// ----------------------------------------------------------------------

const JAVA_TYPE_MAP = {
  int: "int",
  long: "long",
  double: "double",
  float: "float",
  boolean: "boolean",
  char: "char",
  string: "String",
  "int[]": "int[]",
  "long[]": "long[]",
  "double[]": "double[]",
  "float[]": "float[]",
  "boolean[]": "boolean[]",
  "char[]": "char[]",
  "string[]": "String[]",
  "int[][]": "int[][]",
  "long[][]": "long[][]",
  "double[][]": "double[][]",
  "float[][]": "float[][]",
  "boolean[][]": "boolean[][]",
  "char[][]": "char[][]",
  "string[][]": "String[][]",
  "list<Integer>": "List<Integer>",
  "list<Long>": "List<Long>",
  "list<Double>": "List<Double>",
  "list<Float>": "List<Float>",
  "list<Boolean>": "List<Boolean>",
  "list<Character>": "List<Character>",
  "list<String>": "List<String>",
  "list<list<Integer>>": "List<List<Integer>>",
  "list<list<Long>>": "List<List<Long>>",
  "list<list<Double>>": "List<List<Double>>",
  "list<list<Float>>": "List<List<Float>>",
  "list<list<Boolean>>": "List<List<Boolean>>",
  "list<list<String>>": "List<List<String>>",
  ListNode: "ListNode",
  TreeNode: "TreeNode",
};

const CPP_TYPE_MAP = {
  int: "int",
  long: "long",
  double: "double",
  float: "float",
  boolean: "bool",
  char: "char",
  string: "string",
  "int[]": "vector<int>",
  "long[]": "vector<long>",
  "double[]": "vector<double>",
  "float[]": "vector<float>",
  "boolean[]": "vector<bool>",
  "char[]": "vector<char>",
  "string[]": "vector<string>",
  "int[][]": "vector<vector<int>>",
  "long[][]": "vector<vector<long>>",
  "double[][]": "vector<vector<double>>",
  "float[][]": "vector<vector<float>>",
  "boolean[][]": "vector<vector<bool>>",
  "char[][]": "vector<vector<char>>",
  "string[][]": "vector<vector<string>>",
  "list<Integer>": "vector<int>",
  "list<Long>": "vector<long>",
  "list<Double>": "vector<double>",
  "list<Boolean>": "vector<bool>",
  "list<String>": "vector<string>",
  "list<list<Integer>>": "vector<vector<int>>",
  "list<list<String>>": "vector<vector<string>>",
  "list<list<Double>>": "vector<vector<double>>",
  ListNode: "ListNode*",
  TreeNode: "TreeNode*",
};

const C_TYPE_MAP = {
  int: "int",
  long: "long",
  double: "double",
  float: "float",
  boolean: "int",
  char: "char",
  string: "char*",
  "int[]": "int*",
  "long[]": "long*",
  "double[]": "double*",
  "float[]": "float*",
  "boolean[]": "int*",
  "char[]": "char*",
  "string[]": "char**",
  "int[][]": "int**",
  "long[][]": "long**",
  "double[][]": "double**",
  "float[][]": "float**",
  "boolean[][]": "int**",
  "char[][]": "char**",
  "string[][]": "char***",
  ListNode: "struct ListNode*",
  TreeNode: "struct TreeNode*",
};

const PYTHON_TYPE_MAP = {
  int: "int",
  long: "int",
  double: "float",
  float: "float",
  boolean: "bool",
  char: "str",
  string: "str",
  "int[]": "List[int]",
  "long[]": "List[int]",
  "double[]": "List[float]",
  "float[]": "List[float]",
  "boolean[]": "List[bool]",
  "char[]": "List[str]",
  "string[]": "List[str]",
  "int[][]": "List[List[int]]",
  "long[][]": "List[List[int]]",
  "double[][]": "List[List[float]]",
  "float[][]": "List[List[float]]",
  "boolean[][]": "List[List[bool]]",
  "char[][]": "List[List[str]]",
  "string[][]": "List[List[str]]",
  "list<Integer>": "List[int]",
  "list<Long>": "List[int]",
  "list<Double>": "List[float]",
  "list<Boolean>": "List[bool]",
  "list<String>": "List[str]",
  "list<list<Integer>>": "List[List[int]]",
  "list<list<String>>": "List[List[str]]",
  "list<list<Double>>": "List[List[float]]",
  ListNode: "ListNode",
  TreeNode: "TreeNode",
};

const TYPE_MAPS = {
  java: JAVA_TYPE_MAP,
  python: PYTHON_TYPE_MAP,
  cpp: CPP_TYPE_MAP,
  c: C_TYPE_MAP,
};

/**
 * Map a canonical type token to a native language type.
 * Canonical tokens: int, long, double, float, boolean, char, string,
 * int[], string[], int[][], list<Integer>, ListNode, TreeNode, ...
 */
export function mapType(canonicalType, language) {
  const key = (canonicalType || "").toLowerCase().trim();
  const map = TYPE_MAPS[language] || JAVA_TYPE_MAP;
  if (map[key]) return map[key];

  // Fallback: handle nested generics heuristically
  if (key.startsWith("list<")) {
    const inner = key.slice(5, -1);
    if (language === "java") return `List<${mapType(inner, "java")}>`;
    if (language === "cpp") return `vector<${mapType(inner, "cpp")}>`;
    if (language === "python") return `List[${mapType(inner, "python")}]`;
    return "int*";
  }
  if (language === "java") {
    const boxed = {
      integer: "int", long: "long", double: "double", float: "float",
      boolean: "boolean", character: "char", string: "String",
    };
    if (boxed[key]) return boxed[key];
    return key;
  }
  if (language === "python") return "Any";
  if (language === "java") return "String";
  if (language === "cpp") return "auto";
  return "void*";
}

/** Whether a canonical type is an array ([] suffix or list<...>). */
export function isArrayType(canonicalType) {
  const t = (canonicalType || "").toLowerCase().trim();
  return t.endsWith("[]") || t.startsWith("list<");
}

/** Whether a canonical type is a matrix (2D array). */
export function isMatrixType(canonicalType) {
  const t = (canonicalType || "").toLowerCase().trim();
  return t.endsWith("[][]") || /^list<list</.test(t);
}

/** Inner element canonical type for arrays (int[] -> int, int[][] -> int[]). */
export function innerType(canonicalType) {
  const t = (canonicalType || "").toLowerCase().trim();
  if (t.endsWith("[][]")) return t.slice(0, -4);
  if (t.endsWith("[]")) return t.slice(0, -2);
  const listMatch = t.match(/^list<(.+)>$/);
  if (listMatch) return listMatch[1].trim();
  return t;
}

export function isVoidReturn(type) {
  return !type || (type || "").toLowerCase() === "void";
}

/** Whether a signature involves linked-list or tree structures. */
export function usesDataStructures(signature) {
  return signatureUsesType(signature, "ListNode") || signatureUsesType(signature, "TreeNode");
}

/**
 * Get ONLY the data-structure helper definitions the signature actually
 * needs. ListNode and TreeNode are independent — never both unless both
 * are used.
 *
 * @param {string} language
 * @param {Object} signature structured {name, returnType, params}
 */
export function getDataStructureHelpers(language, signature) {
  const markers = HELPER_MARKERS[language] || {};
  const markStart = markers.start || "";
  const markEnd = markers.end || "";
  const blocks = [];

  if (signatureUsesType(signature, "ListNode")) {
    if (language === "python") {
      blocks.push(`class ListNode:\n    def __init__(self, val=0, next=None):\n        self.val = val\n        self.next = next\n`);
    } else if (language === "java") {
      blocks.push(`class ListNode {\n    int val;\n    ListNode next;\n    ListNode() {}\n    ListNode(int val) { this.val = val; }\n    ListNode(int val, ListNode next) { this.val = val; this.next = next; }\n}\n`);
    } else if (language === "cpp") {
      blocks.push(`struct ListNode {\n    int val;\n    ListNode *next;\n    ListNode() : val(0), next(nullptr) {}\n    ListNode(int x) : val(x), next(nullptr) {}\n    ListNode(int x, ListNode *next) : val(x), next(next) {}\n};\n`);
    } else if (language === "c") {
      blocks.push(`struct ListNode {\n    int val;\n    struct ListNode *next;\n};\n`);
    }
  }

  if (signatureUsesType(signature, "TreeNode")) {
    if (language === "python") {
      blocks.push(`class TreeNode:\n    def __init__(self, val=0, left=None, right=None):\n        self.val = val\n        self.left = left\n        self.right = right\n`);
    } else if (language === "java") {
      blocks.push(`class TreeNode {\n    int val;\n    TreeNode left;\n    TreeNode right;\n    TreeNode() {}\n    TreeNode(int val) { this.val = val; }\n    TreeNode(int val, TreeNode left, TreeNode right) { this.val = val; this.left = left; this.right = right; }\n}\n`);
    } else if (language === "cpp") {
      blocks.push(`struct TreeNode {\n    int val;\n    TreeNode *left;\n    TreeNode *right;\n    TreeNode() : val(0), left(nullptr), right(nullptr) {}\n    TreeNode(int x) : val(x), left(nullptr), right(nullptr) {}\n    TreeNode(int x, TreeNode *left, TreeNode *right) : val(x), left(left), right(right) {}\n};\n`);
    } else if (language === "c") {
      blocks.push(`struct TreeNode {\n    int val;\n    struct TreeNode *left;\n    struct TreeNode *right;\n};\n`);
    }
  }

  if (blocks.length === 0) return "";
  return `${markStart}${blocks.join("\n")}${markEnd}`;
}

/**
 * C signature adaptation.
 * ----------------------------------
 * The judge wrapper reads array/matrix/linked-list inputs from stdin. For
 * C, the participant function signature must expose size parameters for
 * arrays and a `returnSize` pointer for array returns. This function
 * derives the *caller-side* parameter list for the wrapper and the *callee*
 * (participant) signature from the canonical signature.
 *
 * The participant C function keeps the exact stored signature (e.g.
 * `int* twoSum(int* nums, int numsSize, int target)`), so no rewriting of
 * the stored signature is ever needed. Only the wrapper's invocation and
 * declarations use the derived names.
 *
 * @returns {Object} { cParams, cArgList, cDecls, cParsers, returnSizeParam }
 */
export function deriveCSignature(signature) {
  const name = signature?.name || "solution";
  const params = Array.isArray(signature?.params) ? signature.params : [];
  const returnType = signature?.returnType || "void";

  const decls = [];
  const parseStmts = [];
  const argList = [];
  const cParams = []; // full caller signature (for the wrapper invocation decl)

  let arrayIdx = 0;
  params.forEach((p) => {
    const type = (p.type || "int").toLowerCase().trim();
    const v = p.name;

    if (type.endsWith("[][]") || type === "int[][]" || type === "string[][]" || type === "double[][]") {
      const rowsName = `${v}Rows`;
      const colsName = `${v}Cols`;
      decls.push(`int ${rowsName} = 0, ${colsName} = 0;`);
      decls.push(`${mapType(p.type, "c")} ${v} = NULL;`);
      parseStmts.push(`readMatrix(&${v}, &${rowsName}, &${colsName});`);
      cParams.push(`${mapType(p.type, "c")} ${v}, int ${rowsName}, int ${colsName}`);
      argList.push(v, rowsName, colsName);
      return;
    }
    if (type.endsWith("[]")) {
      const sizeName = `${v}Size`;
      decls.push(`int ${sizeName} = 0;`);
      decls.push(`${mapType(p.type, "c")} ${v} = NULL;`);
      parseStmts.push(`readArray((int**)&${v}, &${sizeName});`);
      cParams.push(`${mapType(p.type, "c")} ${v}, int ${sizeName}`);
      argList.push(v, sizeName);
      return;
    }
    if (type === "string") {
      decls.push(`char* ${v} = readString();`);
      cParams.push(`char* ${v}`);
      argList.push(v);
      return;
    }
    if (type === "boolean") {
      decls.push(`int ${v} = readInt();`);
      cParams.push(`int ${v}`);
      argList.push(v);
      return;
    }
    if (type === "listnode") {
      decls.push(`struct ListNode* ${v} = readLinkedList();`);
      cParams.push(`struct ListNode* ${v}`);
      argList.push(v);
      return;
    }
    if (type === "treenode") {
      decls.push(`struct TreeNode* ${v} = readTree();`);
      cParams.push(`struct TreeNode* ${v}`);
      argList.push(v);
      return;
    }
    // scalar
    decls.push(`${mapType(p.type, "c")} ${v} = read${scalarCReader(type)}();`);
    cParams.push(`${mapType(p.type, "c")} ${v}`);
    argList.push(v);
  });

  let returnSizeParam = "";
  const retType = (returnType || "").toLowerCase().trim();
  if (retType.endsWith("[]") && !retType.endsWith("[][]")) {
    returnSizeParam = "int* returnSize";
  }

  return { cParams, cArgList: argList, cDecls: decls, cParsers: parseStmts, returnSizeParam };
}

function scalarCReader(type) {
  if (type === "int" || type === "boolean" || type === "long") return "Int";
  if (type === "double" || type === "float") return "Double";
  if (type === "char") return "Char";
  if (type === "string") return "String";
  return "Int";
}

// ----------------------------------------------------------------------
// Starter code generation
// ----------------------------------------------------------------------

/**
 * Generate starter code for a language from a stored (structured) signature.
 * Starter code NEVER includes wrappers, parsers, serializers, or helper
 * classes. Only the exact signature + minimal boilerplate.
 */
export function generateStarterCode(signature, language) {
  if (!signature || !signature.name) {
    throw new Error("A valid function signature is required to generate starter code.");
  }
  const name = signature.name;
  const returnType = signature.returnType || "void";
  const params = Array.isArray(signature.params) ? signature.params : [];

  switch (language) {
    case "python": {
      const typed = params.map((p) => `        ${p.name}: ${mapType(p.type, "python")}`);
      const paramList = typed.length > 0
        ? `self, ${params.map((p) => `${p.name}: ${mapType(p.type, "python")}`).join(", ")}`
        : "self";
      const retHint = isVoidReturn(returnType) ? "None" : mapType(returnType, "python");
      const body = isVoidReturn(returnType)
        ? `        pass`
        : `        # TODO: implement ${name} and return ${retHint}\n        pass`;
      return `class Solution:\n    def ${name}(${paramList}) -> ${retHint}:\n${body}\n`;
    }
    case "java": {
      const paramList = params.map((p) => `${mapType(p.type, "java")} ${p.name}`).join(", ");
      const ret = mapType(returnType, "java");
      return `class Solution {\n    public ${ret} ${name}(${paramList}) {\n        \n    }\n}\n`;
    }
    case "cpp": {
      const paramList = params
        .map((p) => {
          const pt = mapType(p.type, "cpp");
          // Reference params for vectors to match LeetCode conventions.
          if (p.type === "string") return `string ${p.name}`;
          if (p.type === "ListNode") return `ListNode* ${p.name}`;
          if (p.type === "TreeNode") return `TreeNode* ${p.name}`;
          if (isArrayType(p.type)) return `${pt}& ${p.name}`;
          return `${pt} ${p.name}`;
        })
        .join(", ");
      const ret = mapType(returnType, "cpp");
      return `class Solution {\npublic:\n    ${ret} ${name}(${paramList}) {\n        \n    }\n};\n`;
    }
case "c": {
      // Use deriveCSignature so array/matrix parameters include their size
      // arguments and array returns include a returnSize pointer, exactly
      // matching how the judge wrapper invokes the function.
      const c = deriveCSignature(signature);
      let paramList = c.cParams ? c.cParams.join(", ") : "";
      const retKey = (returnType || "void").toLowerCase().trim();
      if (retKey.endsWith("[]") && !retKey.endsWith("[][]")) {
        paramList = paramList ? `${paramList}, int* returnSize` : "int* returnSize";
      }
      const ret = mapType(returnType, "c");
      return `${ret} ${name}(${paramList}) {\n    \n}\n`;
    }
    default:
      throw new Error(`Unsupported language for starter code generation: ${language}`);
  }
}

/**
 * Compose a full starter *file* for participants. Imports/includes live at
 * the top ONLY. Helpers are injected ONLY when the signature uses them.
 * Never includes wrapper/parser/judge code.
 */
export function composeStarterFile(signature, language) {
  const starter = generateStarterCode(signature, language);
  const helpers = getDataStructureHelpers(language, signature);

  if (language === "cpp") {
    return `#include <bits/stdc++.h>\nusing namespace std;\n\n${helpers}${starter}`;
  }
  if (language === "java") {
    return `import java.util.*;\n\n${helpers}${starter}`;
  }
  if (language === "c") {
    return `#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n#include <stdbool.h>\n\n${helpers}${starter}`;
  }
  if (language === "python") {
    const typing = `from typing import List\n\n`;
    return `${typing}${helpers}${starter}`;
  }
  throw new Error(`Unsupported language for starter file: ${language}`);
}

export default {
  AUTHORING_LANGUAGES,
  HELPER_MARKERS,
  mapType,
  isArrayType,
  isMatrixType,
  innerType,
  isVoidReturn,
  usesDataStructures,
  generateStarterCode,
  getDataStructureHelpers,
  composeStarterFile,
  stripHelperBlock,
  deriveCSignature,
};

