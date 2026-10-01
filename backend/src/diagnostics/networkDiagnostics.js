// PHASE 1 & 2: Environment verification and network diagnostics
import dotenv from "dotenv";
dotenv.config();

import { performance } from "perf_hooks";

console.log("========== PHASE 1: ENVIRONMENT ==========");
console.log("Node version:", process.version);
console.log("fetch implementation:", typeof fetch);
console.log("AbortController:", typeof AbortController);
console.log("HTTPS module:", typeof globalThis.fetch);
console.log("Platform:", process.platform, process.arch);

const engineUrl = process.env.SECURE_CODE_ENGINE_URL || "https://secure-code-engine.onrender.com/api/v1/execute";
const timeout = process.env.SECURE_CODE_ENGINE_TIMEOUT_MS || "120000";
const apiKey = process.env.SECURE_CODE_ENGINE_API_KEY || "";
console.log("ENGINE_URL:", engineUrl);
console.log("TIMEOUT_MS:", timeout);
console.log("API_KEY present:", !!apiKey, "length:", apiKey.length);
console.log("API_KEY first 8 chars:", apiKey ? apiKey.slice(0, 8) + "..." : "(missing)");

// List all SECURE_CODE_ENGINE related env vars (without values)
console.log("\nEngine-related env vars set:");
for (const k of Object.keys(process.env)) {
  if (k.toUpperCase().includes("ENGINE") || k.toUpperCase().includes("SECURE")) {
    console.log(`  ${k} = ${k.toUpperCase().includes("KEY") ? "(redacted)" : process.env[k]}`);
  }
}

// DNS resolution
console.log("\n========== DNS RESOLUTION ==========");
async function dnsResolve(host) {
  const t0 = performance.now();
  try {
    const addrs = await new Promise((resolve, reject) => {
      const dns = require("dns");
      dns.resolve4(host, (err, addresses) => (err ? reject(err) : resolve(addresses)));
    });
    const t1 = performance.now();
    return { ok: true, addrs, ms: (t1 - t0).toFixed(2) };
  } catch (e) {
    return { ok: false, err: e.message, ms: (performance.now() - t0).toFixed(2) };
  }
}

async function measureEndpoint(label, url, { method = "GET", body = null, headers = {}, timeoutMs = 15000 } = {}) {
  console.log(`\n--- ${label} ---`);
  console.log(`URL: ${url}`);
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = performance.now();
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const t1 = performance.now();
    const text = await res.text();
    const t2 = performance.now();
    console.log(`  Status: ${res.status} ${res.statusText}`);
    console.log(`  Headers:`);
    for (const [k, v] of res.headers.entries()) {
      console.log(`    ${k}: ${v}`);
    }
    console.log(`  Content-Length (header): ${res.headers.get("content-length")}`);
    console.log(`  Transfer-Encoding: ${res.headers.get("transfer-encoding")}`);
    console.log(`  Connection: ${res.headers.get("connection")}`);
    console.log(`  TTFB: ${(t1 - t0).toFixed(2)} ms`);
    console.log(`  Total time: ${(t2 - t0).toFixed(2)} ms`);
    console.log(`  Body (first 300): ${text.slice(0, 300)}`);
    return { ok: true, status: res.status, ms: (t2 - t0).toFixed(2) };
  } catch (e) {
    const t1 = performance.now();
    console.log(`  ERROR: ${e.name}: ${e.message}`);
    console.log(`  Time to error: ${(t1 - t0).toFixed(2)} ms`);
    return { ok: false, err: e.message, ms: (t1 - t0).toFixed(2) };
  } finally {
    clearTimeout(tid);
  }
}

async function main() {
  console.log("\n========== PHASE 2: NETWORK DIAGNOSTICS ==========");

  const urlHost = new URL(engineUrl).hostname;
  const dns = await dnsResolve(urlHost);
  console.log(`\nDNS resolve ${urlHost}:`, dns.ok ? dns.addrs.join(", ") + ` (${dns.ms} ms)` : `FAILED: ${dns.err}`);

  // 1. google.com
  await measureEndpoint("1. google.com", "https://google.com", { timeoutMs: 15000 });

  // 2. engine root
  await measureEndpoint("2. engine root", `https://${urlHost}`, { timeoutMs: 15000 });

  // 3. actuator health
  await measureEndpoint("3. actuator/health", `https://${urlHost}/actuator/health`, { timeoutMs: 15000 });

  // 4. execute endpoint - GET (no payload)
  await measureEndpoint("4. execute endpoint (GET)", engineUrl, { timeoutMs: 15000 });

  // 5. execute endpoint - POST with small payload
  const payload = {
    language: "JAVA",
    code: "public class Main { public static void main(String[] args) { System.out.println(42); } }",
    timeLimit: 2000,
    memoryLimit: 65536,
    testCases: [{ input: "", expectedOutput: "42" }],
  };
  await measureEndpoint("5. execute endpoint (POST small)", engineUrl, {
    method: "POST",
    body: payload,
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    timeoutMs: 60000,
  });

  console.log("\n========== PHASE 2 COMPLETE ==========");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
