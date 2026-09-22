const DEFAULT_ENGINE_URL =
  "https://secure-code-engine.onrender.com/api/v1/execute";
const DEFAULT_TIMEOUT_MS = 120000;
const SUPPORTED_EXECUTION_LANGUAGES = ["c", "cpp", "java", "python"];

function normalizeLanguage(language) {
  const lang = String(language || "")
    .trim()
    .toLowerCase();
  if (SUPPORTED_EXECUTION_LANGUAGES.includes(lang)) {
    return lang;
  }
  return "java";
}

/**
 * Normalize the Secure Code Engine response into a consistent shape.
 *
 * Engine contract (from examples):
 *   {
 *     "submissionId": "...",
 *     "status": "ACCEPTED" | "SYSTEM_ERROR" | "WRONG_ANSWER",
 *     "accepted": true/false,
 *     "passed": 1, "failed": 0, "total": 1,
 *     "output": "300",
 *     "executionTime": 602,
 *     "memoryUsed": 0,
 *     "error": "Internal execution error: ...",
 *     "results": [
 *       {
 *         "testCase": 1,
 *         "status": "PASSED" | "FAILED" | "SYSTEM_ERROR",
 *         "expectedOutput": "30",
 *         "actualOutput": "300",
 *         "executionTime": 602,
 *         "memoryUsed": 0
 *       }
 *     ]
 *   }
 */
function normalizeEngineResponse(raw) {
  if (!raw) {
    return {
      status: "SYSTEM_ERROR",
      accepted: false,
      passed: 0,
      failed: 0,
      total: 0,
      output: "",
      error: "No response from execution engine.",
      executionTime: 0,
      memoryUsed: 0,
      results: [],
    };
  }

  const r = typeof raw === "string" ? JSON.parse(raw) : raw;

  const results = (r.results || []).map((tc, idx) => {
    let rawStatus = (tc.status || "ERROR").toUpperCase();
    if (rawStatus === "COMPILE_ERROR") rawStatus = "COMPILATION_ERROR";
    return {
      testCase: tc.testCase || idx + 1,
      status: rawStatus,
      executionTime: tc.executionTime || 0,
      memoryUsed: tc.memoryUsed || 0,
      output: tc.actualOutput !== undefined ? tc.actualOutput : tc.output || "",
      expectedOutput: tc.expectedOutput !== undefined ? tc.expectedOutput : "",
      error: tc.error || "",
    };
  });

  const passed = results.filter(
    (tc) => tc.status === "PASSED" || tc.status === "ACCEPTED",
  ).length;
  const failed = results.filter(
    (tc) => tc.status !== "PASSED" && tc.status !== "ACCEPTED",
  ).length;
  const total = r.total || results.length;

  let status = (r.status || "").toUpperCase();
  if (status === "COMPILE_ERROR") status = "COMPILATION_ERROR";

  if (!status || status === "ERROR") {
    if (r.accepted || (passed === total && total > 0)) {
      status = "ACCEPTED";
    } else if (results.some((tc) => tc.status === "TIME_LIMIT_EXCEEDED")) {
      status = "TIME_LIMIT_EXCEEDED";
    } else if (results.some((tc) => tc.status === "MEMORY_LIMIT_EXCEEDED")) {
      status = "MEMORY_LIMIT_EXCEEDED";
    } else if (results.some((tc) => tc.status === "COMPILATION_ERROR")) {
      status = "COMPILATION_ERROR";
    } else if (results.some((tc) => tc.status === "RUNTIME_ERROR")) {
      status = "RUNTIME_ERROR";
    } else if (failed > 0) {
      status = "WRONG_ANSWER";
    } else if (r.error) {
      const errLower = String(r.error).toLowerCase();
      if (
        errLower.includes("compile") ||
        errLower.includes("compilation") ||
        errLower.includes("syntax")
      ) {
        status = "COMPILATION_ERROR";
      } else if (
        errLower.includes("timeout") ||
        errLower.includes("timed out")
      ) {
        status = "TIME_LIMIT_EXCEEDED";
      } else {
        status = "SYSTEM_ERROR";
      }
    } else {
      status = "WRONG_ANSWER";
    }
  }

  const isAccepted =
    status === "ACCEPTED" ||
    (passed === total &&
      total > 0 &&
      !status.includes("ERROR") &&
      status !== "WRONG_ANSWER");

  return {
    status,
    accepted: isAccepted,
    passed,
    failed,
    total,
    output: r.output || "",
    error: r.error || "",
    executionTime: r.executionTime || 0,
    memoryUsed: r.memoryUsed || 0,
    results,
  };
}

export class ExecutionService {
  constructor(
    engineUrl = process.env.SECURE_CODE_ENGINE_URL || DEFAULT_ENGINE_URL,
    timeoutMs = Number(
      process.env.SECURE_CODE_ENGINE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS,
    ),
    apiKey = process.env.SECURE_CODE_ENGINE_API_KEY || "",
  ) {
    this.engineUrl = engineUrl;
    this.timeoutMs = Number.isFinite(timeoutMs)
      ? timeoutMs
      : DEFAULT_TIMEOUT_MS;
    this.apiKey = apiKey;
  }

  async execute(code, testCases, language, options = {}) {
    const payload = {
      language: normalizeLanguage(language),
      code: code || "",
      timeLimit: Number(options.timeLimit || 2000),
      memoryLimit: Number(options.memoryLimit || 65536),
      testCases: Array.isArray(testCases)
        ? testCases.map((testCase) => ({
            input: String(testCase?.input ?? ""),
            expectedOutput: String(testCase?.expectedOutput ?? ""),
          }))
        : [],
    };

    // Log execution details only in development mode, redacted for security
    if (process.env.NODE_ENV === "development") {
      console.log("[ExecutionService] Request:", {
        url: this.engineUrl,
        language: payload.language,
        codeLength: payload.code.length,
        timeLimit: payload.timeLimit,
        memoryLimit: payload.memoryLimit,
        testCaseCount: payload.testCases.length,
      });
    }

    const controller =
      typeof AbortController !== "undefined" ? new AbortController() : null;

    const timeoutId = controller
      ? setTimeout(() => controller.abort(), this.timeoutMs)
      : null;

    try {
      const response = await fetch(this.engineUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
        },
        body: JSON.stringify(payload),
        signal: controller?.signal,
      });

      let body;

      if (typeof response.text === "function") {
        const responseText = await response.text();
        try {
          body = JSON.parse(responseText);
        } catch {
          body = { error: responseText };
        }
      } else if (typeof response.json === "function") {
        body = await response.json();
      } else {
        body = {
          error: "Unrecognized response interface from execution engine.",
        };
      }

      if (!response.ok) {
        const engineError = body?.error || body?.message || body?.details || "";
        const errorMessage = engineError
          ? `Secure Code Engine error: ${engineError}`
          : `Secure Code Engine returned HTTP ${response.status}`;

        // Log only error info, never expose full response/code
        if (process.env.NODE_ENV === "development") {
          console.error("[ExecutionService] Engine error:", {
            status: response.status,
            error: engineError,
          });
        }

        return {
          status: "SYSTEM_ERROR",
          accepted: false,
          passed: 0,
          failed: 0,
          total: 0,
          output: "",
          error: errorMessage,
          executionTime: 0,
          memoryUsed: 0,
          results: [],
        };
      }

      return normalizeEngineResponse(body);
    } catch (error) {
      // Log error safely, never expose sensitive data
      if (process.env.NODE_ENV === "development") {
        console.error("[ExecutionService] Error:", {
          name: error.name,
          message: error.message,
        });
      }

      if (error.name === "AbortError") {
        throw new Error("Secure Code Engine timed out.");
      }

      throw error;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }
}

export const executionService = new ExecutionService();
