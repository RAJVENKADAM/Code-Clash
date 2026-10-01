import {
  createSubmission,
  processSubmissionResult,
} from "../services/submissionService.js";
import Submission from "../models/Submission.js";
import Challenge from "../models/Challenge.js";
import AuditLog from "../models/AuditLog.js";
import { composeProgram } from "../services/wrapperGenerator.js";
import { getStoredSignature } from "../services/signatureParser.js";
import { executionService } from "../services/executionService.js";
import { getChallengeTestCaseGroups } from "../services/challengeTestCases.js";

function isJavaLanguage(language) {
  return !language || String(language).toLowerCase() === "java";
}

/**
 * Run code (unlimited, does NOT create final submission).
 * Only runs against example/public test cases.
 * Does NOT count as a submission.
 */
export async function runCode(req, res) {
  try {
    const { code, language, challengeId } = req.body;
    const userId = req.userId;

    if (!code || !challengeId) {
      return res
        .status(400)
        .json({ error: "Code and challenge ID are required." });
    }

    if (!isJavaLanguage(language)) {
      return res.status(400).json({ error: "Only Java submissions are supported." });
    }

    if (code.length > 50000) {
      return res
        .status(400)
        .json({ error: "Code exceeds maximum length of 50000 characters." });
    }

    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found." });
    }

    if (!challenge.isActive) {
      return res
        .status(403)
        .json({ error: "This challenge is no longer active." });
    }

    const { visible: visibleChallengeCases } =
      getChallengeTestCaseGroups(challenge);
    const visibleTestCases = visibleChallengeCases
      .map((tc) => ({
        ...(tc._id ? { _id: tc._id } : {}),
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        description: tc.description || "",
      }));

    if (visibleTestCases.length === 0) {
      return res.status(200).json({
        status: "SYSTEM_ERROR",
        passed: 0,
        failed: 0,
        total: 0,
        executionTime: 0,
        memoryUsed: 0,
        error: "No public test cases are available for this challenge.",
        results: [],
        message: "No public test cases available for this challenge.",
      });
    }

    // Run visible test cases for the run (test) action.
    const localResult = await executeAgainstChallenge(
      code,
      challenge,
      visibleTestCases,
      "java",
      false,
    );

    AuditLog.create({
      userId,
      action: "CODE_RUN",
      resource: "challenge",
      resourceId: challengeId,
      details: {
        language: "java",
        testCasesRun: localResult.total,
      },
      requestId: req.requestId,
    }).catch(() => {});

    const visiblePassedFromCases = (localResult.results || []).filter(
      (r) => r.status === "PASSED" || r.status === "ACCEPTED",
    ).length;
    const visiblePassed = localResult.results?.length
      ? visiblePassedFromCases
      : Math.min(visibleTestCases.length, localResult.passed);
    const visibleFailed = localResult.results?.length
      ? (localResult.results || []).filter(
      (r) => r.status !== "PASSED" && r.status !== "ACCEPTED",
        ).length
      : Math.min(visibleTestCases.length - visiblePassed, localResult.failed);

    return res.status(200).json({
      status: localResult.status,
      passed: localResult.passed,
      failed: localResult.failed,
      total: localResult.total,
      output: localResult.output,
      error: localResult.error,
      executionTime: localResult.executionTime,
      memoryUsed: localResult.memoryUsed,
      visiblePassed,
      visibleFailed,
      results: localResult.results.map((r) => ({
        ...(r.testCaseId ? { testCaseId: r.testCaseId } : {}),
        testCase: r.testCase,
        input: r.input,
        status: r.status,
        executionTime: r.executionTime,
        memoryUsed: r.memoryUsed,
        output: r.output,
        expectedOutput: r.expectedOutput,
        error: r.error,
        isHidden: false,
      })),
    });
  } catch (error) {
    const message =
      error?.message ||
      "Secure Code Engine is currently unavailable. Please try again in a few moments.";
    console.error("Run code error:", message);
    return res.status(502).json({ error: message });
  }
}

/**
 * Submit solution (single, final submission).
 * Only one submission allowed per challenge per user.
 * Runs ALL test cases (including hidden ones).
 */
export async function submitCode(req, res) {
  try {
    const { code, language, challengeId, timeToSolve, nonce } = req.body;
    const userId = req.userId;

    if (!code || !challengeId) {
      return res
        .status(400)
        .json({ error: "Code and challenge ID are required." });
    }

    if (!isJavaLanguage(language)) {
      return res.status(400).json({ error: "Only Java submissions are supported." });
    }

    if (code.length > 50000) {
      return res
        .status(400)
        .json({ error: "Code exceeds maximum length of 50000 characters." });
    }

    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found." });
    }

    const now = new Date();
    const activeDate = new Date(challenge.activeDate);
    const contestEnd = new Date(activeDate);
    contestEnd.setHours(contestEnd.getHours() + 24);

    if (now < activeDate || now > contestEnd) {
      return res.status(403).json({
        error: "Submission window is closed.",
        code: "CONTEST_CLOSED",
      });
    }

    if (!challenge.isActive) {
      return res.status(403).json({
        error: "This challenge is no longer active.",
        code: "CHALLENGE_INACTIVE",
      });
    }

    const existing = await Submission.findOne({ userId, challengeId });
    if (existing) {
      return res.status(409).json({
        error: "You have already submitted a solution for this challenge.",
        code: "ALREADY_SUBMITTED",
      });
    }

    const submission = await createSubmission(
      userId,
      challengeId,
      code,
      "java",
      timeToSolve || 0,
    );

    const testCaseGroups = getChallengeTestCaseGroups(challenge);
    const allTestCases = [
      ...testCaseGroups.visible,
      ...testCaseGroups.hidden,
    ].map((tc) => ({
      ...(tc._id ? { _id: tc._id } : {}),
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      description: tc.description || "",
      isHidden: !!tc.isHidden,
    }));
    const executionResult = await executeAgainstChallenge(
      code,
      challenge,
      allTestCases,
      "java",
      true,
    );

    const result = await processSubmissionResult(
      submission._id,
      executionResult,
    );

    const hiddenCount = testCaseGroups.hidden.length;
    const publicCount = testCaseGroups.visible.length;

    AuditLog.create({
      userId,
      action: "SUBMISSION_CREATE",
      resource: "submission",
      resourceId: submission._id,
      details: {
        challengeId,
        language: "java",
        passed: executionResult.passed,
        total: executionResult.total,
      },
      requestId: req.requestId,
    }).catch(() => {});

    const visibleResults = result.results.slice(0, publicCount).map((r) => ({
      ...r,
      isHidden: false,
    }));
    const hiddenResults = result.results.slice(publicCount).map((r) => ({
      testCase: r.testCase,
      status: r.status,
      executionTime: r.executionTime,
      memoryUsed: r.memoryUsed,
      isHidden: true,
    }));

    const visiblePassed = visibleResults.length
      ? visibleResults.filter(
      (r) => r.status === "PASSED" || r.status === "ACCEPTED",
        ).length
      : Math.min(publicCount, result.passed);
    const visibleFailed = visibleResults.length
      ? visibleResults.filter(
      (r) => r.status !== "PASSED" && r.status !== "ACCEPTED",
        ).length
      : Math.min(publicCount - visiblePassed, result.failed);
    const hiddenPassed = hiddenResults.length
      ? hiddenResults.filter(
      (r) => r.status === "PASSED" || r.status === "ACCEPTED",
        ).length
      : Math.min(hiddenCount, Math.max(0, result.passed - visiblePassed));
    const hiddenFailed = hiddenResults.length
      ? hiddenResults.filter(
      (r) => r.status !== "PASSED" && r.status !== "ACCEPTED",
        ).length
      : Math.min(hiddenCount, Math.max(0, result.failed - visibleFailed));

    return res.status(201).json({
      ...result,
      output: hiddenCount > 0 ? "" : result.output,
      results: [...visibleResults, ...hiddenResults],
      visiblePassed,
      visibleFailed,
      hiddenPassed,
      hiddenFailed,
      hiddenTestCases: hiddenCount > 0 ? hiddenCount : undefined,
      message:
        hiddenCount > 0
          ? `Solution evaluated. ${result.passed} of ${result.total} tests passed (${hiddenCount} hidden).`
          : `Solution evaluated. ${result.passed} of ${result.total} tests passed.`,
    });
  } catch (error) {
    const message =
      error?.message ||
      "Secure Code Engine is currently unavailable. Please try again in a few moments.";
    if (message.includes("already submitted")) {
      return res
        .status(409)
        .json({ error: message, code: "ALREADY_SUBMITTED" });
    }
    if (message.includes("not found")) {
      return res.status(404).json({ error: message });
    }
    console.error("Submit code error:", message);
    return res.status(502).json({ error: message });
  }
}

/**
 * Execute code against test cases using the secure engine.
 * Uses the stored structured signature for composition.
 */
async function executeAgainstChallenge(
  code,
  challenge,
  testCases,
  language,
  includeHidden,
) {
  const normalizedLanguage = (language || "java").toLowerCase();

  // Use stored structured signature if available.
  const storedSig = challenge.signature;
  if (storedSig && storedSig.name) {
    const sig = getStoredSignature(storedSig);
    const program = composeProgram(
      { signature: sig },
      code,
      normalizedLanguage,
      { isFullProgram: true },
    );
    const executionResult = await executionService.execute(
      program,
      testCases,
      normalizedLanguage,
      { timeLimit: 2000, memoryLimit: 65536 },
    );
    const safeResults = (executionResult.results || []).map((r, index) => ({
      ...(r.testCaseId ? { testCaseId: r.testCaseId } : {}),
      testCase: r.testCase ?? index + 1,
      input: r.input ?? testCases[index]?.input ?? "",
      status: r.status,
      executionTime: r.executionTime ?? 0,
      memoryUsed: r.memoryUsed ?? 0,
      output: r.output ?? "",
      expectedOutput: r.expectedOutput ?? "",
      error: r.error ?? "",
    }));
    return {
      status:
        executionResult.status ||
        (executionResult.accepted ? "ACCEPTED" : "REJECTED"),
      accepted: executionResult.accepted ?? false,
      passed: executionResult.passed ?? 0,
      failed: executionResult.failed ?? 0,
      total: executionResult.total ?? testCases.length,
      output: executionResult.output ?? "",
      error: executionResult.error ?? "",
      executionTime: executionResult.executionTime ?? 0,
      memoryUsed: executionResult.memoryUsed ?? 0,
      results: safeResults,
    };
  }

  // Fallback: legacy raw signatures.
  const signature =
    challenge.functionSignatures?.java || challenge.functionSignature;

  let program = code;
  let executionResult;

  if (signature) {
    const { validateSignature } =
      await import("../services/signatureParser.js");
    const sigResult = validateSignature(signature);
    if (sigResult.valid) {
      program = composeProgram({ signature: sigResult.parsed }, code, "java", {
        isFullProgram: true,
      });
      executionResult = await executionService.execute(
        program,
        testCases,
        "java",
        { timeLimit: 2000, memoryLimit: 65536 },
      );
    } else {
      executionResult = {
        status: "ERROR",
        accepted: false,
        passed: 0,
        failed: testCases.length,
        total: testCases.length,
        output: "",
        error: sigResult.error,
        executionTime: 0,
        memoryUsed: 0,
        results: [],
      };
    }
  } else {
    executionResult = await executionService.execute(
      code,
      testCases,
      normalizedLanguage,
      { timeLimit: 2000, memoryLimit: 65536 },
    );
  }

  const safeResults = (executionResult.results || []).map((r, index) => ({
    ...(r.testCaseId ? { testCaseId: r.testCaseId } : {}),
    testCase: r.testCase ?? index + 1,
    input: r.input ?? testCases[index]?.input ?? "",
    status: r.status,
    executionTime: r.executionTime ?? 0,
    memoryUsed: r.memoryUsed ?? 0,
    output: r.output ?? "",
    expectedOutput: r.expectedOutput ?? "",
    error: r.error ?? "",
  }));
  return {
    status:
      executionResult.status ||
      (executionResult.accepted ? "ACCEPTED" : "REJECTED"),
    accepted: executionResult.accepted ?? false,
    passed: executionResult.passed ?? 0,
    failed: executionResult.failed ?? 0,
    total: executionResult.total ?? testCases.length,
    output: executionResult.output ?? "",
    error: executionResult.error ?? "",
    executionTime: executionResult.executionTime ?? 0,
    memoryUsed: executionResult.memoryUsed ?? 0,
    results: safeResults,
  };
}

export async function judgeHealth(req, res) {
  return res.status(200).json({
    status: "available",
    service: "code-execution-engine",
    version: "1.0.0",
  });
}
