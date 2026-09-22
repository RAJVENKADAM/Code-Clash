import Submission from "../models/Submission.js";
import Challenge from "../models/Challenge.js";
import User from "../models/User.js";

function calculateScore(passed, total, timeToSolve, executionTime, memoryUsed) {
  const passRatio = total > 0 ? passed / total : 0;
  const timePenalty = timeToSolve * 0.5;
  const executionPenalty = executionTime * 0.1;
  const memoryPenalty = memoryUsed * 0.05;

  const score = passRatio * 1000 - timePenalty - executionPenalty - memoryPenalty;
  return Math.max(0, Math.round(score * 100) / 100);
}

function parseExecutionResult(result) {
  const defaultResult = {
    status: "ERROR",
    accepted: false,
    passed: 0,
    failed: 0,
    total: 0,
    output: "",
    error: "No execution result received.",
    executionTime: 0,
    memoryUsed: 0,
    results: [],
  };

  if (!result) return defaultResult;

  try {
    const parsed = typeof result === "string" ? JSON.parse(result) : result;

    const results = (parsed.results || []).map((r, idx) => ({
      testCase: r.testCase || idx + 1,
      status: r.status || "ERROR",
      executionTime: r.executionTime || 0,
      memoryUsed: r.memoryUsed || 0,
      output: r.output || "",
      expectedOutput: r.expectedOutput || "",
    }));

    const passed = results.filter((r) => r.status === "PASSED").length;
    const failed = results.filter((r) => r.status === "FAILED" || r.status === "ERROR").length;
    const total = parsed.total || results.length;

    return {
      status: parsed.status || (passed === total && total > 0 ? "ACCEPTED" : "REJECTED"),
      accepted: parsed.accepted || (passed === total && total > 0),
      passed,
      failed,
      total,
      output: parsed.output || "",
      error: parsed.error || "",
      executionTime: parsed.executionTime || results.reduce((sum, r) => sum + r.executionTime, 0),
      memoryUsed: parsed.memoryUsed || results.reduce((sum, r) => sum + r.memoryUsed, 0),
      results,
    };
  } catch (e) {
    return { ...defaultResult, error: "Failed to parse execution result." };
  }
}

export async function createSubmission(userId, challengeId, code, language, timeToSolve) {
  const existingSubmission = await Submission.findOne({ userId, challengeId });
  if (existingSubmission) {
    throw new Error("You have already submitted a solution for this challenge. Each challenge allows only one submission.");
  }

  const challenge = await Challenge.findById(challengeId);
  if (!challenge) {
    throw new Error("Challenge not found.");
  }

  const submission = new Submission({
    userId,
    challengeId,
    code,
    language: language || "javascript",
    status: "PENDING",
    timeToSolve: timeToSolve || 0,
    total: challenge.testCases.length,
  });

  await submission.save();
  return submission;
}

export async function processSubmissionResult(submissionId, executionResult) {
  const submission = await Submission.findById(submissionId);
  if (!submission) {
    throw new Error("Submission not found.");
  }

  const parsed = parseExecutionResult(executionResult);

  submission.status = parsed.status;
  submission.passed = parsed.passed;
  submission.failed = parsed.failed;
  submission.total = parsed.total;
  submission.output = parsed.output;
  submission.error = parsed.error;
  submission.executionTime = parsed.executionTime;
  submission.memoryUsed = parsed.memoryUsed;
  submission.results = parsed.results;

  submission.score = calculateScore(
    parsed.passed,
    parsed.total,
    submission.timeToSolve,
    parsed.executionTime,
    parsed.memoryUsed
  );

  await submission.save();

  await updateUserStats(submission.userId, parsed.accepted, submission.score);
  await updateChallengeStats(submission.challengeId, parsed.accepted);

  return submission.toPublicJSON();
}

export async function disqualifySubmission(submissionId) {
  const submission = await Submission.findById(submissionId);
  if (!submission) {
    throw new Error("Submission not found.");
  }

  submission.status = "DISQUALIFIED";
  submission.isDisqualified = true;
  submission.score = 0;
  submission.passed = 0;
  submission.failed = 0;
  await submission.save();

  return submission.toPublicJSON();
}

export async function getSubmission(userId, challengeId) {
  return await Submission.findOne({ userId, challengeId }).sort({ createdAt: -1 });
}

async function updateUserStats(userId, accepted, score) {
  const user = await User.findById(userId);
  if (!user) return;

  if (accepted) {
    user.challengesCompleted += 1;
  }
  user.totalScore += score;
  user.lastActiveDate = new Date();
  await user.save();
}

async function updateChallengeStats(challengeId, accepted) {
  await Challenge.findByIdAndUpdate(challengeId, {
    $inc: {
      totalSubmissions: 1,
      ...(accepted ? { totalAccepted: 1 } : {}),
    },
  });
}

