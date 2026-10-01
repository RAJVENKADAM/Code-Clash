// Isolate the exact hanging request. Uses a SHORT timeout (25s) to avoid long waits.
import dotenv from "dotenv";
dotenv.config();

const apiKey = process.env.SECURE_CODE_ENGINE_API_KEY;
const url = process.env.SECURE_CODE_ENGINE_URL;

const SHORT_TIMEOUT = 25000;

async function probe(label, payload) {
  console.log(`\n===== ${label} =====`);
  console.log(`Payload size: ${Buffer.byteLength(JSON.stringify(payload), "utf8")} bytes`);
  console.log(`Code size: ${Buffer.byteLength(payload.code, "utf8")} bytes`);
  console.log(`Test cases: ${payload.testCases.length}`);
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), SHORT_TIMEOUT);
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const t1 = Date.now();
    const text = await res.text();
    const t2 = Date.now();
    console.log(`STATUS: ${res.status} | TTFB: ${t1 - t0} ms | Total: ${t2 - t0} ms`);
    console.log(`BODY: ${text.slice(0, 400)}`);
    return { ok: true, ms: t2 - t0 };
  } catch (e) {
    const t1 = Date.now();
    console.log(`ERROR: ${e.name}: ${e.message} | after ${t1 - t0} ms`);
    if (e.name === "AbortError") console.log(">>> TIMED OUT (aborted)");
    return { ok: false, ms: t1 - t0 };
  } finally {
    clearTimeout(tid);
  }
}

const simpleJava = `public class Main {
  public static void main(String[] args) {
    System.out.println("hello");
  }
}`;

const composedJava = `import java.util.*; import java.io.*;
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

const tcs = [{ input: "[1,2,3]", expectedOutput: "3" }];

async function main() {
  // 1. Simple JAVA program (no test cases / no reads)
  await probe("JAVA simple (no stdin read)", {
    language: "JAVA", code: simpleJava, timeLimit: 2000, memoryLimit: 65536,
    testCases: [{ input: "", expectedOutput: "hello" }],
  });

  // 2. Composed JAVA (reads stdin)
  await probe("JAVA composed (reads stdin)", {
    language: "JAVA", code: composedJava, timeLimit: 2000, memoryLimit: 65536,
    testCases: tcs,
  });

  console.log("\n===== DONE =====");
  process.exit(0);
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
