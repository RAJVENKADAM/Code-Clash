// isolate2.js - Writes results to a log file. Tests fetch vs https, language case, java vs python.
import dotenv from "dotenv";
dotenv.config();
import { writeFileSync, appendFileSync } from "fs";
import https from "https";
import { performance } from "perf_hooks";

const LOG = "backend/src/diagnostics/diag2.log";
const apiKey = process.env.SECURE_CODE_ENGINE_API_KEY;
const url = process.env.SECURE_CODE_ENGINE_URL;

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  appendFileSync(LOG, line + "\n");
}

// Proxy/env check
log("=== ENV ===");
log("API_KEY present: " + !!apiKey + " len:" + (apiKey ? apiKey.length : 0));
for (const k of ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "NO_PROXY", "no_proxy", "NODE_TLS_REJECT_UNAUTHORIZED", "NODE_EXTRA_CA_CERTS"]) {
  log(`  ${k}=${process.env[k] ? "(set, len " + process.env[k].length + ")" : "(unset)"}`);
}

const javaCode = `public class Main {
  public static void main(String[] args) {
    System.out.println("hello");
  }
}`;

async function withFetch(label, opts) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 20000);
  const t0 = performance.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify(opts.payload),
      signal: controller.signal,
    });
    const t1 = performance.now();
    const text = await res.text();
    const t2 = performance.now();
    log(`${label} -> STATUS ${res.status} | TTFB ${(t1 - t0).toFixed(0)}ms | TOTAL ${(t2 - t0).toFixed(0)}ms | BODY: ${text.slice(0, 200)}`);
  } catch (e) {
    const t1 = performance.now();
    log(`${label} -> ERROR ${e.name}: ${e.message} | after ${(t1 - t0).toFixed(0)}ms${e.name === "AbortError" ? " *** TIMED OUT ***" : ""}`);
  } finally {
    clearTimeout(t);
  }
}

function withHttps(label) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const payload = { language: "JAVA", code: javaCode, timeLimit: 2000, memoryLimit: 65536, testCases: [{ input: "", expectedOutput: "hello" }] };
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "Content-Length": Buffer.byteLength(body) },
      timeout: 15000,
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => { log(`${label} -> STATUS ${res.statusCode} | BODY: ${data.slice(0, 200)}`); resolve(); });
    });
    req.on("timeout", () => { log(`${label} -> REQUEST TIMEOUT after 15s`); req.destroy(); resolve(); });
    req.on("error", (e) => { log(`${label} -> ERROR ${e.message}`); resolve(); });
    req.write(body);
    req.end();
  });
}

const pyCode = "print(42)";

async function main() {
  log("\n=== fetch: JAVA uppercase ===");
  await withFetch("fetch JAVA(up)", { payload: { language: "JAVA", code: javaCode, timeLimit: 2000, memoryLimit: 65536, testCases: [{ input: "", expectedOutput: "hello" }] } });

  log("\n=== fetch: JAVA lowercase ===");
  await withFetch("fetch java(low)", { payload: { language: "java", code: javaCode, timeLimit: 2000, memoryLimit: 65536, testCases: [{ input: "", expectedOutput: "hello" }] } });

  log("\n=== fetch: no testCases ===");
  await withFetch("fetch JAVA (no tc)", { payload: { language: "JAVA", code: javaCode, timeLimit: 2000, memoryLimit: 65536, testCases: [] } });

  log("\n=== https module: JAVA ===");
  await withHttps("https JAVA");

  log("\n=== fetch: PYTHON uppercase ===");
  await withFetch("fetch PYTHON(up)", { payload: { language: "PYTHON", code: pyCode, timeLimit: 2000, memoryLimit: 65536, testCases: [{ input: "", expectedOutput: "42" }] } });

  log("\n=== fetch: PYTHON lowercase ===");
  await withFetch("fetch python(low)", { payload: { language: "python", code: pyCode, timeLimit: 2000, memoryLimit: 65536, testCases: [{ input: "", expectedOutput: "42" }] } });

  log("\n=== DONE ===");
  try { writeFileSync("backend/src/diagnostics/diag2.complete", "yes"); } catch {}
  process.exit(0);
}

main().catch((e) => {
  log("FATAL: " + e.message);
  process.exit(1);
});
