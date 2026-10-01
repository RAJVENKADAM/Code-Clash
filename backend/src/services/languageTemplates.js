import { signatureUsesType } from "./signatureParser.js";

export const AUTHORING_LANGUAGES = [
  { id: "java", label: "Java", extension: ".java", monacoId: "java" },
];

export const HELPER_MARKERS = {
  java: {
    start: "// ===== DATA STRUCTURE HELPERS START =====\n",
    end: "// ===== DATA STRUCTURE HELPERS END =====\n",
  },
};

const JAVA_TYPE_MAP = {
  int: "int",
  long: "long",
  double: "double",
  float: "float",
  boolean: "boolean",
  bool: "boolean",
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
  "list<integer>": "List<Integer>",
  "list<long>": "List<Long>",
  "list<double>": "List<Double>",
  "list<float>": "List<Float>",
  "list<boolean>": "List<Boolean>",
  "list<character>": "List<Character>",
  "list<string>": "List<String>",
  "list<list<integer>>": "List<List<Integer>>",
  "list<list<long>>": "List<List<Long>>",
  "list<list<double>>": "List<List<Double>>",
  "list<list<float>>": "List<List<Float>>",
  "list<list<boolean>>": "List<List<Boolean>>",
  "list<list<string>>": "List<List<String>>",
  listnode: "ListNode",
  treenode: "TreeNode",
  void: "void",
};

export function stripHelperBlock(code) {
  const markers = HELPER_MARKERS.java;
  if (!code || typeof code !== "string") return code || "";
  const start = code.indexOf(markers.start);
  if (start === -1) return code;
  const end = code.indexOf(markers.end, start + markers.start.length);
  if (end === -1) return code;
  return code.slice(0, start) + code.slice(end + markers.end.length);
}

export function mapType(canonicalType) {
  const key = String(canonicalType || "").toLowerCase().trim();
  if (JAVA_TYPE_MAP[key]) return JAVA_TYPE_MAP[key];
  if (key.startsWith("list<") && key.endsWith(">")) {
    return `List<${mapType(key.slice(5, -1))}>`;
  }
  return key;
}

export function isArrayType(canonicalType) {
  const type = String(canonicalType || "").toLowerCase().trim();
  return type.endsWith("[]") || type.startsWith("list<");
}

export function isMatrixType(canonicalType) {
  const type = String(canonicalType || "").toLowerCase().trim();
  return type.endsWith("[][]") || /^list<list</.test(type);
}

export function innerType(canonicalType) {
  const type = String(canonicalType || "").toLowerCase().trim();
  if (type.endsWith("[][]")) return type.slice(0, -4);
  if (type.endsWith("[]")) return type.slice(0, -2);
  const match = type.match(/^list<(.+)>$/);
  return match ? match[1].trim() : type;
}

export function isVoidReturn(type) {
  return !type || String(type).toLowerCase() === "void";
}

export function usesDataStructures(signature) {
  return (
    signatureUsesType(signature, "ListNode") ||
    signatureUsesType(signature, "TreeNode")
  );
}

export function getDataStructureHelpers(signature) {
  const blocks = [];
  if (signatureUsesType(signature, "ListNode")) {
    blocks.push(
      `class ListNode {\n    int val;\n    ListNode next;\n    ListNode() {}\n    ListNode(int val) { this.val = val; }\n    ListNode(int val, ListNode next) { this.val = val; this.next = next; }\n}\n`,
    );
  }
  if (signatureUsesType(signature, "TreeNode")) {
    blocks.push(
      `class TreeNode {\n    int val;\n    TreeNode left;\n    TreeNode right;\n    TreeNode() {}\n    TreeNode(int val) { this.val = val; }\n    TreeNode(int val, TreeNode left, TreeNode right) { this.val = val; this.left = left; this.right = right; }\n}\n`,
    );
  }
  if (blocks.length === 0) return "";
  const markers = HELPER_MARKERS.java;
  return `${markers.start}${blocks.join("\n")}${markers.end}`;
}

export function generateStarterCode(signature, language = "java") {
  if (language !== "java") {
    throw new Error("Only Java is currently supported.");
  }
  if (!signature || !signature.name) {
    throw new Error(
      "A valid function signature is required to generate starter code.",
    );
  }
  const params = (signature.params || [])
    .map((param) => `${mapType(param.type)} ${param.name}`)
    .join(", ");
  return `class Solution {\n    public ${mapType(signature.returnType || "void")} ${signature.name}(${params}) {\n        \n    }\n}\n`;
}

export function composeStarterFile(signature, language = "java") {
  if (language !== "java") {
    throw new Error("Only Java is currently supported.");
  }
  const helpers = getDataStructureHelpers(signature);
  return `import java.util.*;\n\n${helpers}${generateStarterCode(signature)}\n`;
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
};
