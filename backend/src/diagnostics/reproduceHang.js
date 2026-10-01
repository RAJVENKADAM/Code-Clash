// PHASE 3: Reproduce the hang using the REAL ExecutionService with realistic payloads
import dotenv from "dotenv";
dotenv.config();
import { ExecutionService } from "../services/executionService.js";

// Re-instantiate so we control the singleton
const service = new ExecutionService(
  process.env.SECURE_CODE_ENGINE_URL,
  Number(process.env.SECURE_CODE_ENGINE_TIMEOUT_MS || 120000),
  process.env.SECURE_CODE_ENGINE_API_KEY
);

console.log("Service URL:", service.engineUrl);
console.log("Service timeout:", service.timeoutMs);
console.log("Service API key present:", !!service.apiKey);

// A realistic Java solution program (as composed by the wrapper generator)
const javaProgram = `import java.util.*; import java.io.*;
public class Main {
    private static BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
    public static void main(String[] args) {
        try {
            int[] nums = parseIntArray();
            Solution sol = new Solution();
            int result = sol.solution(nums);
            System.out.println(serialize(result));
        } catch (Exception e) { e.printStackTrace(); }
    }
    private static int[] parseIntArray() throws IOException {
        String line = reader.readLine();
        if (line == null || line.isEmpty() || line.equals("[]")) return new int[0];
        String[] parts = line.replaceAll("[\\\\[\\\\]]", "").split(",");
        int[] res = new int[parts.length];
        for (int i = 0; i < parts.length; i++) res[i] = Integer.parseInt(parts[i].trim());
        return res;
    }
    private static String serialize(Object obj) { return String.valueOf(obj); }
}
class Solution {
    public int solution(int[] nums) { return nums.length; }
}`;

const testCases = [
  { input: "[1,2,3]", expectedOutput: "3" },
  { input: "[10,20]", expectedOutput: "2" },
];

async function runTest(lang, code, tcs) {
  console.log(`\n========== TEST: ${lang.toUpperCase()} ==========`);
  console.log("STEP 1: Before payload generation");
  const payload = {
    language: lang.toUpperCase(),
    code,
    timeLimit: 2000,
    memoryLimit: 65536,
    testCases: tcs.map((tc) => ({ input: String(tc.input), expectedOutput: String(tc.expectedOutput) })),
  };
  const payloadSize = Buffer.byteLength(JSON.stringify(payload), "utf8");
  console.log(`STEP 2: Payload generated. Size: ${payloadSize} bytes, code size: ${Buffer.byteLength(code, "utf8")} bytes, test cases: ${tcs.length}`);
  console.log("STEP 3: Before fetch()");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), service.timeoutMs);
  const t0 = Date.now();
  try {
    const response = await fetch(service.engineUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": service.apiKey },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    console.log(`STEP 4: Connection opened. Status: ${response.status} (${Date.now() - t0} ms)`);
    const responseText = await response.text();
    console.log(`STEP 5: Body received. Length: ${responseText.length} (${Date.now() - t0} ms)`);
    console.log("STEP 6: JSON parsing...");
    let body;
    try { body = JSON.parse(responseText); } catch { body = { error: responseText }; }
    console.log("STEP 7: JSON parsed. Keys:", Object.keys(body));
    console.log("STEP 8: Response normalized");
    console.log("RESULT:", JSON.stringify({ status: body.status, error: body.error, passed: body.passed, failed: body.failed, total: body.total }).slice(0, 500));
  } catch (e) {
    console.log(`STEP X: ERROR at ${Date.now() - t0} ms`);
    console.log("  name:", e.name);
    console.log("  message:", e.message);
    if (e.name === "AbortError") console.log("  >>> TIMED OUT after", service.timeoutMs, "ms");
  } finally {
    clearTimeout(timeoutId);
  }
}

async function main() {
  // Test with the actual composed java program
  await runTest("java", javaProgram, testCases);

  // Test a LARGE payload (simulate a real full program ~50KB)
  const bigProgram = "class Solution { public int solution(int[] n) { return 1; } }";
  const pad = "//".padEnd(45000, "x");
  await runTest("java", bigProgram + "\n" + pad, testCases);

  console.log("\n===== DONE =====");
  process.exit(0);
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
