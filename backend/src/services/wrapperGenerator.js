/**
 * wrapperGenerator.js
 * ------------------------------------------------------------------
 * Generates a Java judge wrapper.
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
} from "./languageTemplates.js";
import { sanitizeCode, composeImportPreamble } from "./sanitizer.js";
import { validateProgram } from "./validator.js";
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
export function composeProgram(question, userCode, language = "java") {
  const normLang = (language || "").toLowerCase().trim();
  if (normLang !== "java") {
    throw new CompilationGenerationError(`Unsupported language: ${language}`);
  }
  const signature = question?.signature || {};
  const params = Array.isArray(signature.params) ? signature.params : [];
  const name = signature.name || "solution";
  const returnType = signature.returnType || "void";

  // 1. Sanitize participant/reference code: hoist imports, strip helpers &
  //    duplicate classes, normalize newlines.
  const { imports: participantImports, body: cleanedCode } = sanitizeCode(userCode || "");
  const program = composeJava(signature, params, name, returnType, participantImports, cleanedCode);

  // 2. Validate the composed program before returning it to the caller.
  const validation = validateProgram(program);
  if (!validation.valid) {
    throw new CompilationGenerationError(validation.errors.join(" "));
  }

  return program;
}

// ----------------------------------------------------------------------
// Java wrapper generation
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

  const dsHelpers = getDataStructureHelpers(signature);
  const parsers = buildJavaParsers(usedTypes, hasListNode, hasTreeNode);
  const serializer = buildJavaSerializer(returnType, hasListNode, hasTreeNode);

  const wrapperBody = `public class Main {
    private static BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));

    private static String readNextLine() throws IOException {
        String line = reader.readLine();
        return line == null ? "" : line.trim();
    }

${parsers}

${serializer}

    public static void main(String[] args) throws Exception {
        ${decls}
        ${parseStmts}

        Solution sol = new Solution();
        ${call}
        ${printStmt}
    }
}
`;

  // All imports (wrapper + participant) are hoisted before any class.
  const wrapperImports = ["import java.util.*;", "import java.io.*;"];
  const preamble = composeImportPreamble(wrapperImports, participantImports);

  return `${preamble}// Auto-generated judge wrapper
${dsHelpers}

${wrapperBody}
// ===== Participant Solution =====
${userCode}
`;
}

function buildJavaParserCall(p) {
  const type = (p.type || "int").toLowerCase().trim();
  const parsers = {
    int: "parseInt()",
    long: "parseLong()",
    double: "parseDouble()",
    float: "parseFloat()",
    boolean: "parseBool()",
    bool: "parseBool()",
    string: "parseString()",
    char: "parseChar()",
    "int[]": "parseIntArray()",
    "long[]": "parseLongArray()",
    "double[]": "parseDoubleArray()",
    "float[]": "parseFloatArray()",
    "boolean[]": "parseBooleanArray()",
    "char[]": "parseCharArray()",
    "string[]": "parseStringArray()",
    "int[][]": "parseIntMatrix()",
    "long[][]": "parseLongMatrix()",
    "double[][]": "parseDoubleMatrix()",
    "float[][]": "parseFloatMatrix()",
    "boolean[][]": "parseBooleanMatrix()",
    "char[][]": "parseCharMatrix()",
    "string[][]": "parseStringMatrix()",
    listnode: "parseLinkedList()",
    treenode: "parseTreeNode()",
    "list<integer>": "parseIntegerList()",
    "list<long>": "parseLongList()",
    "list<double>": "parseDoubleList()",
    "list<string>": "parseStringList()",
    "list<boolean>": "parseBooleanList()",
  };
  const parser = parsers[type];
  if (!parser) {
    throw new CompilationGenerationError(
      `Unsupported Java parameter type "${p.type}".`,
    );
  }
  return parser;
}

function buildJavaParsers(usedTypes, hasListNode, hasTreeNode) {
  const parts = [];

  parts.push(`    private static List<String> splitArrayElements(String line) {
        String value = line.trim();
        if (value.startsWith("[") && value.endsWith("]")) {
            value = value.substring(1, value.length() - 1).trim();
        }
        List<String> elements = new ArrayList<>();
        if (value.isEmpty()) return elements;
        StringBuilder current = new StringBuilder();
        boolean quoted = false;
        boolean escaped = false;
        int depth = 0;
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            if (escaped) {
                current.append(c);
                escaped = false;
            } else if (c == '\\\\' && quoted) {
                current.append(c);
                escaped = true;
            } else if (c == '"') {
                quoted = !quoted;
                current.append(c);
            } else if (!quoted && c == '[') {
                depth++;
                current.append(c);
            } else if (!quoted && c == ']') {
                depth--;
                current.append(c);
            } else if (!quoted && depth == 0 && c == ',') {
                elements.add(current.toString().trim());
                current.setLength(0);
            } else {
                current.append(c);
            }
        }
        elements.add(current.toString().trim());
        return elements;
    }
    private static String parseJsonString(String raw) {
        String value = raw.trim();
        if (value.length() < 2 || value.charAt(0) != '"' || value.charAt(value.length() - 1) != '"') return value;
        StringBuilder result = new StringBuilder();
        for (int i = 1; i < value.length() - 1; i++) {
            char c = value.charAt(i);
            if (c == '\\\\' && i + 1 < value.length() - 1) {
                char next = value.charAt(++i);
                if (next == 'n') result.append('\\n');
                else if (next == 'r') result.append('\\r');
                else if (next == 't') result.append('\\t');
                else result.append(next);
            } else result.append(c);
        }
        return result.toString();
    }
    private static String parseString() throws IOException {
        String s = readNextLine();
        return parseJsonString(s);
    }
    private static int parseInt() throws IOException { String s = readNextLine(); return s.isEmpty() ? 0 : Integer.parseInt(s); }
    private static long parseLong() throws IOException { String s = readNextLine(); return s.isEmpty() ? 0L : Long.parseLong(s); }
    private static double parseDouble() throws IOException { String s = readNextLine(); return s.isEmpty() ? 0.0 : Double.parseDouble(s); }
    private static float parseFloat() throws IOException { String s = readNextLine(); return s.isEmpty() ? 0.0f : Float.parseFloat(s); }
    private static boolean parseBool() throws IOException { String s = readNextLine(); return Boolean.parseBoolean(s); }
    private static char parseChar() throws IOException { String s = parseString(); return s.isEmpty() ? ' ' : s.charAt(0); }`);

  const arrayTypes = {
    int: ["int", "Integer.parseInt"],
    long: ["long", "Long.parseLong"],
    double: ["double", "Double.parseDouble"],
    float: ["float", "Float.parseFloat"],
    boolean: ["boolean", "Boolean.parseBoolean"],
    char: ["char", "parseJsonString"],
    string: ["String", "parseJsonString"],
  };
  for (const [type, [javaType, parser]] of Object.entries(arrayTypes)) {
    const oneDimensional = `${type}[]`;
    const twoDimensional = `${type}[][]`;
    if (
      usedTypes.has(oneDimensional) ||
      usedTypes.has(twoDimensional) ||
      (type === "int" && (hasListNode || hasTreeNode))
    ) {
      const name = type[0].toUpperCase() + type.slice(1);
      const parseElement = type === "char"
        ? "String value = parseJsonString(parts.get(i)); result[i] = value.isEmpty() ? ' ' : value.charAt(0);"
        : type === "string"
          ? "result[i] = parseJsonString(parts.get(i));"
          : type === "int"
            ? "String value = parts.get(i).trim(); result[i] = value.equalsIgnoreCase(\"null\") ? Integer.MIN_VALUE : Integer.parseInt(value);"
          : `result[i] = ${parser}(parts.get(i).trim());`;
      parts.push(`    private static ${javaType}[] parse${name}ArrayValue(String line) {
        List<String> parts = splitArrayElements(line);
        ${javaType}[] result = new ${javaType}[parts.size()];
        for (int i = 0; i < parts.size(); i++) { ${parseElement} }
        return result;
    }
    private static ${javaType}[] parse${name}Array() throws IOException {
        return parse${name}ArrayValue(readNextLine());
    }`);
    }
    if (usedTypes.has(twoDimensional)) {
      const name = type[0].toUpperCase() + type.slice(1);
      parts.push(`    private static ${javaType}[][] parse${name}Matrix() throws IOException {
        List<String> rows = splitArrayElements(readNextLine());
        ${javaType}[][] result = new ${javaType}[rows.size()][];
        for (int i = 0; i < rows.size(); i++) result[i] = parse${name}ArrayValue(rows.get(i));
        return result;
    }`);
    }
  }

  const listTypes = {
    integer: ["Integer", "Integer.valueOf"],
    long: ["Long", "Long.valueOf"],
    double: ["Double", "Double.valueOf"],
    string: ["String", "parseJsonString"],
    boolean: ["Boolean", "Boolean.valueOf"],
  };
  for (const [type, [javaType, parser]] of Object.entries(listTypes)) {
    if (!usedTypes.has(`list<${type}>`)) continue;
    const name = type[0].toUpperCase() + type.slice(1);
    const parseElement = type === "string"
      ? `result.add(${parser}(value));`
      : `result.add(${parser}(value));`;
    parts.push(`    private static List<${javaType}> parse${name}List() throws IOException {
        List<${javaType}> result = new ArrayList<>();
        for (String value : splitArrayElements(readNextLine())) { ${parseElement} }
        return result;
    }`);
  }
  if (hasListNode) {
    parts.push(`        private static ListNode parseLinkedList() throws IOException {
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
  const isArrayReturn = retType.endsWith("[]");
  if (isArrayReturn) {
    checks.push(`        return serializeArray(obj);`);
  }

  const arrayHelpers = isArrayReturn
    ? `    private static String quote(String value) {
        return "\\"" + value.replace("\\\\", "\\\\\\\\").replace("\\"", "\\\\\\"")
            .replace("\\n", "\\\\n").replace("\\r", "\\\\r").replace("\\t", "\\\\t") + "\\"";
    }
    private static String serializeArray(Object value) {
        if (value == null) return "null";
        int length = java.lang.reflect.Array.getLength(value);
        StringBuilder result = new StringBuilder("[");
        for (int i = 0; i < length; i++) {
            if (i > 0) result.append(",");
            Object item = java.lang.reflect.Array.get(value, i);
            if (item != null && item.getClass().isArray()) result.append(serializeArray(item));
            else if (item instanceof String || item instanceof Character) result.append(quote(String.valueOf(item)));
            else result.append(String.valueOf(item));
        }
        return result.append("]").toString();
    }`
    : "";

  if (!isArrayReturn && hasListNode) {
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
  if (!isArrayReturn && hasTreeNode) {
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

  if (isArrayReturn) {
    // Array serializers above already emitted their return statement.
  } else if (retType === "boolean") {
    checks.push(`        return String.valueOf(obj);`);
  } else if (retType === "int" || retType === "long" || retType === "double" || retType === "float") {
    checks.push(`        return String.valueOf(obj);`);
  } else {
    checks.push(`        return String.valueOf(obj);`);
  }

  return `${arrayHelpers}
    private static String serialize(Object obj) {
        if (obj == null) return "null";
${checks.join("\n")}
    }`;
}

// ----------------------------------------------------------------------
export default {
  composeProgram,
  CompilationGenerationError,
};
