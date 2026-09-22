/**
 * wrapperGenerator.js
 * ------------------------------------------------------------------
 * Generates minimal, language-correct judge wrappers for Python, Java,
 * C++, and C.
 *
 * Architecture (strict separation):
 *
 *   Structured Signature
 *         ↓
 *   Wrapper Generator (this file)
 *         ↓
 *   Sanitizer (participant/reference code cleanup)
 *         ↓
 *   Validator (structural checks before the judge)
 *
 * Contract:
 *   - Wrapper = parser + serializer + main() ONLY. Never includes the
 *     Solution class/function.
 *   - Participant code = ONLY the Solution class/function. Merge happens
 *     at execution time.
 *   - Imports are hoisted to the top and deduplicated. In Java, ALL
 *     imports (wrapper + participant) appear before any class declaration.
 *   - Parsers are injected ONLY for parameter types actually used.
 *   - Serializers are injected ONLY for the actual return type.
 *   - ListNode/TreeNode helpers injected ONLY when the signature uses them.
 */

import {
  mapType,
  getDataStructureHelpers,
  isVoidReturn,
  isArrayType,
  isMatrixType,
  innerType,
  deriveCSignature,
} from "./languageTemplates.js";
import { sanitizeCode, composeImportPreamble } from "./sanitizer.js";
import { validateProgram, ProgramValidationError } from "./validator.js";
import { signatureUsesType } from "./signatureParser.js";

export class CompilationGenerationError extends Error {
  constructor(message) {
    super(message);
    this.name = "CompilationGenerationError";
  }
}

// ----------------------------------------------------------------------
// Type-set helpers
// ----------------------------------------------------------------------

function getUsedTypes(signature) {
  const types = new Set();
  const add = (t) => {
    const key = String(t || "").toLowerCase().trim();
    if (key) types.add(key);
  };
  add(signature?.returnType);
  (signature?.params || []).forEach((p) => add(p.type));
  return types;
}

function usesListNode(signature) {
  return signatureUsesType(signature, "ListNode");
}

function usesTreeNode(signature) {
  return signatureUsesType(signature, "TreeNode");
}

/**
 * Compose the final judge program.
 *
 * @param {Object} question { signature: {name, returnType, params} }
 * @param {string} userCode participant/reference source
 * @param {string} language
 * @param {Object} [options]
 * @returns {string} fully composed, validated judge program
 */
export function composeProgram(question, userCode, language, options = {}) {
  const normLang = (language || "").toLowerCase().trim();
  const signature = question?.signature || {};
  const params = Array.isArray(signature.params) ? signature.params : [];
  const name = signature.name || "solution";
  const returnType = signature.returnType || "void";

  // 1. Sanitize participant/reference code: hoist imports, strip helpers &
  //    duplicate classes, normalize newlines.
  const { imports: participantImports, body: cleanedCode } = sanitizeCode(userCode || "", normLang);

  let program = "";
  switch (normLang) {
    case "python":
      program = composePython(signature, params, name, returnType, participantImports, cleanedCode);
      break;
    case "java":
      program = composeJava(signature, params, name, returnType, participantImports, cleanedCode);
      break;
    case "cpp":
      program = composeCpp(signature, params, name, returnType, participantImports, cleanedCode);
      break;
    case "c":
      program = composeC(signature, params, name, returnType, participantImports, cleanedCode);
      break;
    default:
      throw new CompilationGenerationError(`Unsupported language: ${language}`);
  }

  // 2. Validate the composed program before returning it to the caller.
  try {
    validateProgram(program, normLang, signature);
  } catch (err) {
    if (err instanceof ProgramValidationError) {
      throw new CompilationGenerationError(err.message);
    }
    throw err;
  }

  return program;
}

// ----------------------------------------------------------------------
// PYTHON
// ----------------------------------------------------------------------

function composePython(signature, params, name, returnType, participantImports, userCode) {
  const usedTypes = getUsedTypes(signature);
  const hasListNode = usesListNode(signature);
  const hasTreeNode = usesTreeNode(signature);

  const parseLines = params
    .map((p, idx) => {
      const type = (p.type || "int").toLowerCase().trim();
      const v = p.name;
      if (hasListNode && type === "listnode") return `    ${v} = build_listnode(lines[${idx}])`;
      if (hasTreeNode && type === "treenode") return `    ${v} = build_treenode(lines[${idx}])`;
      return `    ${v} = parse_arg(lines[${idx}])`;
    })
    .join("\n");

  const argList = params.map((p) => p.name).join(", ");
  const call = params.length > 0 ? `result = sol.${name}(${argList})` : `result = sol.${name}()`;
  const printCode = isVoidReturn(returnType)
    ? `    print("null")`
    : `    print(serialize(result))`;

  const dsHelpers = getDataStructureHelpers("python", signature);

  // Serializer sections — only what the return type requires.
  const serializerSections = [];
  const retType = (returnType || "").toLowerCase().trim();
  if (hasListNode) {
    serializerSections.push(`    if isinstance(val, ListNode):
        res, curr = [], val
        while curr:
            res.append(curr.val)
            curr = curr.next
        return json.dumps(res)`);
  }
  if (hasTreeNode) {
    serializerSections.push(`    if isinstance(val, TreeNode):
        if not val: return "[]"
        res, q = [], [val]
        while q:
            node = q.pop(0)
            if node:
                res.append(node.val)
                q.append(node.left)
                q.append(node.right)
            else:
                res.append(None)
        while res and res[-1] is None: res.pop()
        return json.dumps(res)`);
  }
  if (!isVoidReturn(returnType) && !hasListNode && !hasTreeNode) {
    // Fallback: plain json.dumps works for primitives, arrays, matrices,
    // strings, booleans, chars (Python represents char as str).
    serializerSections.push(`    return json.dumps(val)`);
  }
  const serializerBody = serializerSections.join("\n\n");

  const wrapper = `# Auto-generated judge wrapper
import sys
import json

${dsHelpers}

def build_listnode(arr):
    if not arr: return None
    head = ListNode(arr[0])
    curr = head
    for v in arr[1:]:
        curr.next = ListNode(v)
        curr = curr.next
    return head

def build_treenode(arr):
    if not arr or arr[0] is None: return None
    root = TreeNode(arr[0])
    q = [root]
    i = 1
    while q and i < len(arr):
        node = q.pop(0)
        if i < len(arr) and arr[i] is not None:
            node.left = TreeNode(arr[i])
            q.append(node.left)
        i += 1
        if i < len(arr) and arr[i] is not None:
            node.right = TreeNode(arr[i])
            q.append(node.right)
        i += 1
    return root

def serialize(val):
    if val is None: return "null"
${serializerBody}

def parse_arg(raw):
    return json.loads(raw)

def main():
    lines = [line.strip() for line in sys.stdin.read().splitlines() if line.strip()]
${parseLines}
    sol = Solution()
    ${call}
${printCode}

if __name__ == "__main__":
    main()
`;

  const preamble = composeImportPreamble(["import sys", "import json"], participantImports, "python");
  return `${preamble}${wrapper}\n# ===== Participant Solution =====\n${userCode}\n`;
}

// ----------------------------------------------------------------------
// JAVA
// ----------------------------------------------------------------------

function composeJava(signature, params, name, returnType, participantImports, userCode) {
  const usedTypes = getUsedTypes(signature);
  const hasListNode = usesListNode(signature);
  const hasTreeNode = usesTreeNode(signature);

  const decls = params.map((p) => `${mapType(p.type, "java")} ${p.name};`).join("\n        ");
  const parseStmts = params.map((p) => `${p.name} = ${buildJavaParserCall(p)};`).join("\n        ");
  const argList = params.map((p) => p.name).join(", ");
  const retType = mapType(returnType, "java");
  const isVoidRt = isVoidReturn(returnType);

  const call = isVoidRt
    ? `sol.${name}(${argList});`
    : `${retType} result = sol.${name}(${argList});`;
  const printStmt = isVoidRt
    ? `System.out.println("null");`
    : `System.out.println(serialize(result));`;

  const dsHelpers = getDataStructureHelpers("java", signature);
  const parsers = buildJavaParsers(usedTypes, hasListNode, hasTreeNode);
  const serializer = buildJavaSerializer(returnType, hasListNode, hasTreeNode);

  const wrapperBody = `public class Main {
    private static BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));

    private static String readNextLine() throws IOException {
        String line;
        while ((line = reader.readLine()) != null) {
            line = line.trim();
            if (!line.isEmpty()) return line;
        }
        return "";
    }

${parsers}

${serializer}

    public static void main(String[] args) {
        try {
            ${decls}
            ${parseStmts}

            Solution sol = new Solution();
            ${call}
            ${printStmt}
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
`;

  // All imports (wrapper + participant) are hoisted before any class.
  const wrapperImports = ["import java.util.*;", "import java.io.*;"];
  const preamble = composeImportPreamble(wrapperImports, participantImports, "java");

  return `${preamble}// Auto-generated judge wrapper
${dsHelpers}

${wrapperBody}
// ===== Participant Solution =====
${userCode}
`;
}

function buildJavaParserCall(p) {
  const type = (p.type || "int").toLowerCase().trim();
  if (type === "int") return "parseInt()";
  if (type === "long") return "parseLong()";
  if (type === "double") return "parseDouble()";
  if (type === "boolean" || type === "bool") return "parseBool()";
  if (type === "string") return "parseString()";
  if (type === "char") return "parseChar()";
  if (type === "int[]") return "parseIntArray()";
  if (type === "long[]") return "parseLongArray()";
  if (type === "double[]") return "parseDoubleArray()";
  if (type === "boolean[]") return "parseBooleanArray()";
  if (type === "char[]") return "parseCharArray()";
  if (type === "string[]") return "parseStringArray()";
  if (type === "int[][]") return "parseIntMatrix()";
  if (type === "double[][]") return "parseDoubleMatrix()";
  if (type === "listnode") return "parseListNode()";
  if (type === "treenode") return "parseTreeNode()";
  return "parseInt()";
}

function buildJavaParsers(usedTypes, hasListNode, hasTreeNode) {
  const parts = [];

  parts.push(`    private static String parseString() throws IOException {
        String s = readNextLine();
        if (s.length() >= 2 && s.startsWith("\\\"") && s.endsWith("\\\"")) return s.substring(1, s.length() - 1);
        return s;
    }
    private static int parseInt() throws IOException { String s = readNextLine(); return s.isEmpty() ? 0 : Integer.parseInt(s); }
    private static long parseLong() throws IOException { String s = readNextLine(); return s.isEmpty() ? 0L : Long.parseLong(s); }
    private static double parseDouble() throws IOException { String s = readNextLine(); return s.isEmpty() ? 0.0 : Double.parseDouble(s); }
    private static boolean parseBool() throws IOException { String s = readNextLine(); return Boolean.parseBoolean(s); }
    private static char parseChar() throws IOException { String s = parseString(); return s.isEmpty() ? ' ' : s.charAt(0); }`);

  if (usedTypes.has("int[]") || hasListNode || hasTreeNode) {
    parts.push(`    private static int[] parseIntArray() throws IOException {
        String line = readNextLine();
        if (line.isEmpty() || line.equals("[]")) return new int[0];
        String cleaned = line.replaceAll("[\\\\[\\\\]]", "").trim();
        if (cleaned.isEmpty()) return new int[0];
        String[] parts = cleaned.split(",");
        int[] res = new int[parts.length];
        for (int i = 0; i < parts.length; i++) {
            String p = parts[i].trim();
            res[i] = p.equals("null") ? Integer.MIN_VALUE : Integer.parseInt(p);
        }
        return res;
    }`);
  }
  if (usedTypes.has("long[]")) {
    parts.push(`    private static long[] parseLongArray() throws IOException {
        String line = readNextLine();
        if (line.isEmpty() || line.equals("[]")) return new long[0];
        String[] parts = line.replaceAll("[\\\\[\\\\]]", "").split(",");
        long[] res = new long[parts.length];
        for (int i = 0; i < parts.length; i++) res[i] = Long.parseLong(parts[i].trim());
        return res;
    }`);
  }
  if (usedTypes.has("double[]")) {
    parts.push(`    private static double[] parseDoubleArray() throws IOException {
        String line = readNextLine();
        if (line.isEmpty() || line.equals("[]")) return new double[0];
        String[] parts = line.replaceAll("[\\\\[\\\\]]", "").split(",");
        double[] res = new double[parts.length];
        for (int i = 0; i < parts.length; i++) res[i] = Double.parseDouble(parts[i].trim());
        return res;
    }`);
  }
  if (usedTypes.has("boolean[]")) {
    parts.push(`    private static boolean[] parseBooleanArray() throws IOException {
        String line = readNextLine();
        if (line.isEmpty() || line.equals("[]")) return new boolean[0];
        String[] parts = line.replaceAll("[\\\\[\\\\]]", "").split(",");
        boolean[] res = new boolean[parts.length];
        for (int i = 0; i < parts.length; i++) res[i] = Boolean.parseBoolean(parts[i].trim());
        return res;
    }`);
  }
  if (usedTypes.has("char[]")) {
    parts.push(`    private static char[] parseCharArray() throws IOException {
        String line = readNextLine();
        if (line.isEmpty() || line.equals("[]")) return new char[0];
        String[] parts = line.replaceAll("[\\\\[\\\\]]", "").split(",");
        char[] res = new char[parts.length];
        for (int i = 0; i < parts.length; i++) {
            String v = parts[i].trim().replaceAll("^\\\\\"|\\\\\"$", "");
            res[i] = v.isEmpty() ? ' ' : v.charAt(0);
        }
        return res;
    }`);
  }
  if (usedTypes.has("string[]")) {
    parts.push(`    private static String[] parseStringArray() throws IOException {
        String line = readNextLine();
        if (line.isEmpty() || line.equals("[]")) return new String[0];
        String[] parts = line.replaceAll("[\\\\[\\\\]]", "").split(",");
        String[] res = new String[parts.length];
        for (int i = 0; i < parts.length; i++) res[i] = parts[i].trim().replaceAll("^\\\\\"|\\\\\"$", "");
        return res;
    }`);
  }
  if (usedTypes.has("int[][]")) {
    parts.push(`    private static int[][] parseIntMatrix() throws IOException {
        String line = readNextLine().trim();
        if (line.equals("[]") || line.equals("[[]]")) return new int[0][0];
        String cleaned = line.substring(2, line.length() - 2);
        String[] rows = cleaned.split("\\\\s*\\\\],\\\\s*\\\\[\\\\s*");
        int[][] mat = new int[rows.length][];
        for (int i = 0; i < rows.length; i++) {
            if (rows[i].trim().isEmpty()) { mat[i] = new int[0]; continue; }
            String[] parts = rows[i].split(",");
            mat[i] = new int[parts.length];
            for (int j = 0; j < parts.length; j++) mat[i][j] = Integer.parseInt(parts[j].trim());
        }
        return mat;
    }`);
  }
  if (usedTypes.has("double[][]")) {
    parts.push(`    private static double[][] parseDoubleMatrix() throws IOException {
        String line = readNextLine().trim();
        if (line.equals("[]") || line.equals("[[]]")) return new double[0][0];
        String cleaned = line.substring(2, line.length() - 2);
        String[] rows = cleaned.split("\\\\s*\\\\],\\\\s*\\\\[\\\\s*");
        double[][] mat = new double[rows.length][];
        for (int i = 0; i < rows.length; i++) {
            if (rows[i].trim().isEmpty()) { mat[i] = new double[0]; continue; }
            String[] parts = rows[i].split(",");
            mat[i] = new double[parts.length];
            for (int j = 0; j < parts.length; j++) mat[i][j] = Double.parseDouble(parts[j].trim());
        }
        return mat;
    }`);
  }
  if (hasListNode) {
    parts.push(`    private static ListNode parseListNode() throws IOException {
        int[] arr = parseIntArray();
        if (arr.length == 0) return null;
        ListNode head = new ListNode(arr[0]), curr = head;
        for (int i = 1; i < arr.length; i++) { curr.next = new ListNode(arr[i]); curr = curr.next; }
        return head;
    }`);
  }
  if (hasTreeNode) {
    parts.push(`    private static TreeNode parseTreeNode() throws IOException {
        int[] arr = parseIntArray();
        if (arr.length == 0 || arr[0] == Integer.MIN_VALUE) return null;
        TreeNode root = new TreeNode(arr[0]);
        Queue<TreeNode> q = new LinkedList<>();
        q.offer(root);
        int i = 1;
        while (!q.isEmpty() && i < arr.length) {
            TreeNode node = q.poll();
            if (i < arr.length && arr[i] != Integer.MIN_VALUE) { node.left = new TreeNode(arr[i]); q.offer(node.left); }
            i++;
            if (i < arr.length && arr[i] != Integer.MIN_VALUE) { node.right = new TreeNode(arr[i]); q.offer(node.right); }
            i++;
        }
        return root;
    }`);
  }

  return parts.join("\n\n");
}

function buildJavaSerializer(returnType, hasListNode, hasTreeNode) {
  const retType = (returnType || "").toLowerCase().trim();
  const isVoidRt = isVoidReturn(returnType);

  if (isVoidRt) {
    return `    private static String serialize(Object obj) { return String.valueOf(obj); }`;
  }

  const checks = [];
  if (retType === "int[]" || retType === "long[]" || retType === "double[]" || retType === "float[]" || retType === "boolean[]" || retType === "char[]") {
    checks.push(`        if (obj instanceof int[] || obj instanceof long[] || obj instanceof double[] || obj instanceof float[] || obj instanceof boolean[] || obj instanceof char[]) return Arrays.toString((Object) obj).replaceAll("\\\\s+", "");`);
  } else if (retType === "string[]") {
    checks.push(`        if (obj instanceof String[]) return Arrays.toString((String[]) obj).replaceAll("\\\\s+", "");`);
  } else if (retType === "int[][]" || retType === "double[][]" || retType === "string[][]") {
    checks.push(`        if (obj instanceof int[][] || obj instanceof double[][] || obj instanceof String[][]) return Arrays.deepToString((Object) obj).replaceAll("\\\\s+", "");`);
  }

  if (hasListNode) {
    checks.push(`        if (obj instanceof ListNode) {
            StringBuilder sb = new StringBuilder("[");
            ListNode curr = (ListNode) obj;
            while (curr != null) {
                sb.append(curr.val);
                if (curr.next != null) sb.append(",");
                curr = curr.next;
            }
            return sb.append("]").toString();
        }`);
  }
  if (hasTreeNode) {
    checks.push(`        if (obj instanceof TreeNode) {
            if (obj == null) return "[]";
            StringBuilder sb = new StringBuilder("[");
            Queue<TreeNode> q = new LinkedList<>();
            q.offer((TreeNode) obj);
            boolean first = true;
            while (!q.isEmpty()) {
                TreeNode node = q.poll();
                if (node == null) { sb.append(first ? "" : ",").append("null"); first = false; continue; }
                if (!first) sb.append(",");
                sb.append(node.val);
                first = false;
                q.offer(node.left);
                q.offer(node.right);
            }
            return sb.append("]").toString();
        }`);
  }

  if (retType === "string") {
    checks.push(`        if (obj instanceof String) return "\\"" + obj + "\\"";`);
  } else if (retType === "char") {
    checks.push(`        if (obj instanceof Character) return "\\"" + obj + "\\"";`);
  } else if (retType === "boolean") {
    checks.push(`        return String.valueOf(obj);`);
  } else if (retType === "int" || retType === "long" || retType === "double" || retType === "float") {
    checks.push(`        return String.valueOf(obj);`);
  } else {
    checks.push(`        return String.valueOf(obj);`);
  }

  return `    private static String serialize(Object obj) {
        if (obj == null) return "null";
${checks.join("\n")}
    }`;
}

// ----------------------------------------------------------------------
// C++
// ----------------------------------------------------------------------

function composeCpp(signature, params, name, returnType, participantImports, userCode) {
  const usedTypes = getUsedTypes(signature);
  const hasListNode = usesListNode(signature);
  const hasTreeNode = usesTreeNode(signature);

  const decls = params.map((p) => `${mapType(p.type, "cpp")} ${p.name};`).join("\n    ");
  const parseStmts = params.map((p) => `${p.name} = ${buildCppParserCall(p)};`).join("\n    ");
  const argList = params.map((p) => p.name).join(", ");
  const retType = mapType(returnType, "cpp");
  const isVoidRt = isVoidReturn(returnType);

  const call = isVoidRt
    ? `sol.${name}(${argList});`
    : `${retType} result = sol.${name}(${argList});`;
  const printStmt = isVoidRt ? `cout << "null" << endl;` : `printOutput(result);`;

  const dsHelpers = getDataStructureHelpers("cpp", signature);
  const parsers = buildCppParsers(usedTypes, hasListNode, hasTreeNode);
  const serializers = buildCppSerializers(returnType, hasListNode, hasTreeNode);

  const wrapperBody = `inline string readNextLine() {
    string line;
    while (getline(cin, line)) {
        size_t start = line.find_first_not_of(" \\t\\r\\n");
        if (start != string::npos) return line.substr(start, line.find_last_not_of(" \\t\\r\\n") - start + 1);
    }
    return "";
}

${parsers}

${serializers}

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    ${decls}
    ${parseStmts}

    Solution sol;
    ${call}
    ${printStmt}
    return 0;
}
`;

  const wrapperImports = [
    "#include <iostream>",
    "#include <vector>",
    "#include <string>",
    "#include <sstream>",
    "#include <queue>",
    "#include <algorithm>",
    "using namespace std;",
  ];
  const preamble = composeImportPreamble(wrapperImports, participantImports, "cpp");

  return `${preamble}// Auto-generated judge wrapper
${dsHelpers}

${wrapperBody}
// ===== Participant Solution =====
${userCode}
`;
}

function buildCppParserCall(p) {
  const type = (p.type || "int").toLowerCase().trim();
  if (type === "int") return "parseInt()";
  if (type === "long") return "parseLong()";
  if (type === "double") return "parseDouble()";
  if (type === "boolean" || type === "bool") return "parseBool()";
  if (type === "string") return "parseString()";
  if (type === "char") return "parseChar()";
  if (type === "int[]" || type === "long[]" || type === "double[]" || type === "string[]" || type === "boolean[]" || type === "char[]") return "parseArray<" + cppVectorType(type) + ">()";
  if (type === "int[][]" || type === "double[][]" || type === "string[][]") return "parseMatrix<" + cppVectorType(type) + ">()";
  if (type === "listnode") return "parseListNode()";
  if (type === "treenode") return "parseTreeNode()";
  return "parseInt()";
}

function cppVectorType(type) {
  if (type === "int[]") return "int";
  if (type === "long[]") return "long";
  if (type === "double[]") return "double";
  if (type === "string[]") return "string";
  if (type === "boolean[]") return "bool";
  if (type === "char[]") return "char";
  if (type === "int[][]") return "vector<int>";
  if (type === "double[][]") return "vector<double>";
  if (type === "string[][]") return "vector<string>";
  return "int";
}

function buildCppParsers(usedTypes, hasListNode, hasTreeNode) {
  const parts = [];

  parts.push(`inline int parseInt() { string s = readNextLine(); return s.empty() ? 0 : stoi(s); }
inline long parseLong() { string s = readNextLine(); return s.empty() ? 0L : stol(s); }
inline double parseDouble() { string s = readNextLine(); return s.empty() ? 0.0 : stod(s); }
inline bool parseBool() { string s = readNextLine(); return s == "true" || s == "1"; }
inline char parseChar() { string s = readNextLine(); return s.empty() ? ' ' : s[0]; }
inline string parseString() {
    string s = readNextLine();
    return (s.length() >= 2 && s.front() == '"' && s.back() == '"') ? s.substr(1, s.length() - 2) : s;
}`);

  const arrayTypes = ["int[]", "long[]", "double[]", "boolean[]", "char[]", "string[]"];
  const usesArray = arrayTypes.some((t) => usedTypes.has(t)) || hasListNode || hasTreeNode;
  if (usesArray) {
    parts.push(`template <typename T>
inline vector<T> parseArray() {
    string line = readNextLine();
    if (line.empty() || line == "[]") return {};
    string cleaned;
    for (char c : line) if (c != '[' && c != ']') cleaned += c;
    stringstream ss(cleaned); string t; vector<T> res;
    while (getline(ss, t, ',')) {
        if (!t.empty()) {
            stringstream conv(t);
            T val;
            if constexpr (is_same<T, string>::value) {
                string s = t;
                if (s.length() >= 2 && s.front() == '"' && s.back() == '"') s = s.substr(1, s.length() - 2);
                res.push_back(s);
            } else if constexpr (is_same<T, bool>::value) {
                res.push_back(t == "true" || t == "1");
            } else {
                conv >> val;
                res.push_back(val);
            }
        }
    }
    return res;
}`);

    parts.push(`template <typename T>
inline vector<vector<T>> parseMatrix() {
    string line = readNextLine();
    vector<vector<T>> mat;
    if (line == "[]" || line == "[[]]") return mat;
    size_t i = 0;
    while (i < line.size()) {
        if (line[i] == '[') {
            size_t j = line.find(']', i);
            if (j != string::npos) {
                string row = line.substr(i + 1, j - i - 1);
                stringstream ss(row); string t; vector<T> r;
                while (getline(ss, t, ',')) {
                    if (!t.empty()) {
                        stringstream conv(t);
                        T val;
                        if constexpr (is_same<T, string>::value) {
                            string s = t;
                            if (s.length() >= 2 && s.front() == '"' && s.back() == '"') s = s.substr(1, s.length() - 2);
                            r.push_back(s);
                        } else {
                            conv >> val;
                            r.push_back(val);
                        }
                    }
                }
                mat.push_back(r);
                i = j + 1;
            } else i++;
        } else i++;
    }
    return mat;
}`);
  }

  if (hasListNode) {
    parts.push(`inline ListNode* parseListNode() {
    vector<int> arr = parseArray<int>();
    if (arr.empty()) return nullptr;
    ListNode* head = new ListNode(arr[0]), *curr = head;
    for (size_t i = 1; i < arr.size(); i++) { curr->next = new ListNode(arr[i]); curr = curr->next; }
    return head;
}`);
  }
  if (hasTreeNode) {
    parts.push(`inline TreeNode* parseTreeNode() {
    vector<int> arr = parseArray<int>();
    if (arr.empty() || arr[0] == INT_MIN) return nullptr;
    TreeNode* root = new TreeNode(arr[0]);
    queue<TreeNode*> q; q.push(root);
    size_t i = 1;
    while (!q.empty() && i < arr.size()) {
        TreeNode* node = q.front(); q.pop();
        if (i < arr.size() && arr[i] != INT_MIN) { node->left = new TreeNode(arr[i]); q.push(node->left); }
        i++;
        if (i < arr.size() && arr[i] != INT_MIN) { node->right = new TreeNode(arr[i]); q.push(node->right); }
        i++;
    }
    return root;
}`);
  }

  return parts.join("\n\n");
}

function buildCppSerializers(returnType, hasListNode, hasTreeNode) {
  const retType = (returnType || "").toLowerCase().trim();
  if (isVoidReturn(returnType)) {
    return `inline void printOutput(int v) { cout << v << endl; }`;
  }

  const parts = [];
  if (retType === "int" || retType === "long" || retType === "double" || retType === "float") {
    parts.push(`inline void printOutput(int v) { cout << v << endl; }
inline void printOutput(double v) { cout << v << endl; }
inline void printOutput(long v) { cout << v << endl; }`);
  } else if (retType === "boolean" || retType === "bool") {
    parts.push(`inline void printOutput(bool v) { cout << (v ? "true" : "false") << endl; }`);
  } else if (retType === "char") {
    parts.push(`inline void printOutput(char v) { cout << "\\"" << v << "\\"" << endl; }`);
  } else if (retType === "string") {
    parts.push(`inline void printOutput(const string& v) { cout << "\\"" << v << "\\"" << endl; }`);
  }

  if (retType.endsWith("[]") && !retType.endsWith("[][]")) {
    parts.push(`template <typename T>
void printOutput(const vector<T>& v) {
    cout << "[";
    for (size_t i = 0; i < v.size(); i++) { if (i) cout << ","; printElement(v[i]); }
    cout << "]" << endl;
}

template <typename T>
void printElement(const T& v) { cout << v; }

inline void printElement(const string& v) { cout << v; }
inline void printElement(const bool& v) { cout << (v ? "true" : "false"); }`);
  }

  if (retType.endsWith("[][]")) {
    parts.push(`template <typename T>
void printOutput(const vector<vector<T>>& v) {
    cout << "[";
    for (size_t i = 0; i < v.size(); i++) {
        if (i) cout << ",";
        cout << "[";
        for (size_t j = 0; j < v[i].size(); j++) {
            if (j) cout << ",";
            printElement(v[i][j]);
        }
        cout << "]";
    }
    cout << "]" << endl;
}

template <typename T>
void printElement(const T& v) { cout << v; }

inline void printElement(const string& v) { cout << v; }
inline void printElement(const bool& v) { cout << (v ? "true" : "false"); }`);
  }

  if (hasListNode) {
    parts.push(`inline void printOutput(ListNode* head) {
    cout << "[";
    for (ListNode* cur = head; cur; cur = cur->next) { cout << cur->val << (cur->next ? "," : ""); }
    cout << "]" << endl;
}`);
  }
  if (hasTreeNode) {
    parts.push(`inline void printOutput(TreeNode* root) {
    cout << "[";
    if (!root) { cout << "]" << endl; return; }
    queue<TreeNode*> q; q.push(root);
    bool first = true;
    while (!q.empty()) {
        TreeNode* node = q.front(); q.pop();
        if (!first) cout << ",";
        first = false;
        if (!node) { cout << "null"; continue; }
        cout << node->val;
        q.push(node->left);
        q.push(node->right);
    }
    cout << "]" << endl;
}`);
  }

  return parts.join("\n\n");
}

// ----------------------------------------------------------------------
// C
// ----------------------------------------------------------------------

function composeC(signature, params, name, returnType, participantImports, userCode) {
  const hasListNode = usesListNode(signature);
  const hasTreeNode = usesTreeNode(signature);
  const dsHelpers = getDataStructureHelpers("c", signature);
  const usedTypes = getUsedTypes(signature);

  const c = deriveCSignature(signature);
  const isVoidRt = isVoidReturn(returnType);
  const retType = (returnType || "").toLowerCase().trim();
  const isArrayReturn = retType.endsWith("[]") && !retType.endsWith("[][]");

  // Build invocation. The participant function keeps its stored signature;
  // the wrapper passes derived size args + a returnSize pointer.
  const callArgs = c.cArgList.slice();
  if (isArrayReturn) callArgs.push("&returnSize");
  const call = isVoidRt
    ? `${name}(${callArgs.join(", ")});`
    : `${mapType(returnType, "c")} result = ${name}(${callArgs.join(", ")});`;

  const printCode = isVoidRt
    ? `    printf("null\\n");`
    : isArrayReturn
      ? `    printIntArray(result, returnSize);`
      : retType === "string"
        ? `    printf("\\"%s\\"\\n", result);`
        : retType === "listnode"
          ? `    printLinkedList(result);`
          : retType === "treenode"
            ? `    printTree(result);`
            : retType === "boolean"
              ? `    printf("%s\\n", result ? "true" : "false");`
              : retType === "char"
                ? `    printf("\\"%c\\"\\n", result);`
                : `    printf("%d\\n", result);`;

  const decls = c.cDecls.slice();
  if (isArrayReturn) decls.push("int returnSize = 0;");

  const body = `static char lineBuf[100000];
static char* readLine() {
    if (fgets(lineBuf, sizeof(lineBuf), stdin)) {
        size_t len = strlen(lineBuf);
        while (len > 0 && (lineBuf[len - 1] == '\\r' || lineBuf[len - 1] == '\\n')) lineBuf[--len] = '\\0';
        return lineBuf;
    }
    return "";
}

static int readInt() { return atoi(readLine()); }
static double readDouble() { return atof(readLine()); }
static char readChar() { char* s = readLine(); return s && *s ? s[0] : ' '; }
static char* readString() { return strdup(readLine()); }

static void readArray(int** arr, int* size) {
    char* line = readLine();
    if (!line || *line == '\\0' || strcmp(line, "[]") == 0) { *size = 0; *arr = NULL; return; }
    int cap = 16, n = 0;
    *arr = (int*)malloc(cap * sizeof(int));
    char* p = line;
    while (*p) {
        if (*p == '[' || *p == ' ' || *p == ',') { p++; continue; }
        if (*p == ']') break;
        (*arr)[n++] = atoi(p);
        if (n >= cap) { cap *= 2; *arr = (int*)realloc(*arr, cap * sizeof(int)); }
        while (*p && *p != ',' && *p != ']') p++;
    }
    *size = n;
}

static void readMatrix(int*** mat, int* rows, int* cols) {
    char* line = readLine();
    if (!line || strcmp(line, "[]") == 0 || strcmp(line, "[[]]") == 0) { *rows = 0; *cols = 0; *mat = NULL; return; }
    int r = 0;
    int** m = NULL;
    char* p = line;
    while (*p) {
        if (*p == '[') {
            int c = 0;
            int* row = NULL;
            int cap = 4;
            p++;
            while (*p && *p != ']') {
                if (*p == ',' || *p == ' ') { p++; continue; }
                if (c >= cap) { cap *= 2; row = (int*)realloc(row, cap * sizeof(int)); }
                row[c++] = atoi(p);
                while (*p && *p != ',' && *p != ']') p++;
            }
            m = (int**)realloc(m, (r + 1) * sizeof(int*));
            m[r++] = row;
            if (c == 0) { free(row); m[r - 1] = NULL; }
            else { m[r - 1] = row; }
        }
        if (*p) p++;
    }
    *mat = m;
    *rows = r;
    *cols = (r > 0 && m[0]) ? 0 : 0;
    if (r > 0) {
        for (int i = 0; i < r; i++) {
            int c = 0;
            if (m[i]) {
                char* q = line;
                // count elements in row i (best effort)
            }
        }
        *cols = 0;
    }
}

${hasListNode ? `static struct ListNode* readLinkedList() {
    int* arr = NULL; int size = 0;
    readArray(&arr, &size);
    if (size == 0) return NULL;
    struct ListNode* head = (struct ListNode*)malloc(sizeof(struct ListNode));
    head->val = arr[0]; head->next = NULL;
    struct ListNode* curr = head;
    for (int i = 1; i < size; i++) {
        curr->next = (struct ListNode*)malloc(sizeof(struct ListNode));
        curr = curr->next; curr->val = arr[i]; curr->next = NULL;
    }
    free(arr);
    return head;
}` : ""}

${hasTreeNode ? `static struct TreeNode* readTree() {
    int* arr = NULL; int size = 0;
    readArray(&arr, &size);
    if (size == 0 || arr[0] == INT_MIN) { free(arr); return NULL; }
    struct TreeNode** q = (struct TreeNode**)malloc(size * sizeof(struct TreeNode*));
    int qh = 0, qt = 0;
    struct TreeNode* root = (struct TreeNode*)malloc(sizeof(struct TreeNode));
    root->val = arr[0]; root->left = NULL; root->right = NULL;
    q[qt++] = root;
    int i = 1;
    while (qh < qt && i < size) {
        struct TreeNode* node = q[qh++];
        if (i < size && arr[i] != INT_MIN) {
            node->left = (struct TreeNode*)malloc(sizeof(struct TreeNode));
            node->left->val = arr[i]; node->left->left = NULL; node->left->right = NULL;
            q[qt++] = node->left;
        }
        i++;
        if (i < size && arr[i] != INT_MIN) {
            node->right = (struct TreeNode*)malloc(sizeof(struct TreeNode));
            node->right->val = arr[i]; node->right->left = NULL; node->right->right = NULL;
            q[qt++] = node->right;
        }
        i++;
    }
    free(q);
    free(arr);
    return root;
}` : ""}

static void printIntArray(int* arr, int size) {
    printf("[");
    for (int i = 0; i < size; i++) { if (i) printf(","); printf("%d", arr[i]); }
    printf("]\\n");
}

${hasListNode ? `static void printLinkedList(struct ListNode* head) {
    printf("[");
    struct ListNode* cur = head;
    while (cur) { printf("%d", cur->val); if (cur->next) printf(","); cur = cur->next; }
    printf("]\\n");
}` : ""}

${hasTreeNode ? `static void printTree(struct TreeNode* root) {
    printf("[");
    if (!root) { printf("]\\n"); return; }
    struct TreeNode** q = (struct TreeNode**)malloc(100000 * sizeof(struct TreeNode*));
    int qh = 0, qt = 0;
    q[qt++] = root;
    int first = 1;
    while (qh < qt) {
        struct TreeNode* node = q[qh++];
        if (!first) printf(",");
        first = 0;
        if (!node) { printf("null"); continue; }
        printf("%d", node->val);
        q[qt++] = node->left;
        q[qt++] = node->right;
    }
    free(q);
    printf("]\\n");
}` : ""}

int main() {
    ${decls.join("\n    ")}
    ${c.cParsers.join("\n    ")}
    ${call}
    ${printCode}
    return 0;
}`;

  const wrapperImports = [
    "#include <stdio.h>",
    "#include <stdlib.h>",
    "#include <string.h>",
    "#include <stdbool.h>",
    "#include <limits.h>",
  ];
  const preamble = composeImportPreamble(wrapperImports, participantImports, "c");

  return `${preamble}/* Auto-generated judge wrapper */
${dsHelpers}

${body}
/* ===== Participant Solution ===== */
${userCode}
`;
}

export default {
  composeProgram,
  CompilationGenerationError,
};

