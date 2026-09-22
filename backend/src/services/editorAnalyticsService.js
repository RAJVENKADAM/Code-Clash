import EditorAnalytics from "../models/EditorAnalytics.js";
import Violation from "../models/Violation.js";
import SuspicionScore from "../models/SuspicionScore.js";

const AUTOMATION_WEIGHTS = {
  NO_MOUSE_MOVEMENT: 25,
  VERY_REGULAR_TYPING_INTERVALS: 20,
  ZERO_CORRECTIONS: 15,
  HIGH_TYPING_SPEED: 10,
  LONG_INACTIVITY_THEN_RAPID_EDITS: 20,
  CONSISTENT_PERFECT_TIMING: 15,
  NO_TYPING_THEN_SOLUTION: 30,
};

/**
 * Process editor analytics metadata and calculate automation risk score.
 * Never stores actual keystrokes or code content.
 */
export async function processEditorAnalytics(userId, challengeId, analytics, submissionId = null) {
  // Find existing or create new analytics record
  let record = await EditorAnalytics.findOne({ userId, challengeId });

  if (!record) {
    record = new EditorAnalytics({
      userId,
      challengeId,
      editorOpenTime: new Date(),
    });
  }

  // Update aggregate metadata (never keystrokes)
  if (analytics.typingDuration !== undefined) record.typingDuration = analytics.typingDuration;
  if (analytics.idleDuration !== undefined) record.idleDuration = analytics.idleDuration;
  if (analytics.cursorMovementCount !== undefined) record.cursorMovementCount = analytics.cursorMovementCount;
  if (analytics.selectionCount !== undefined) record.selectionCount = analytics.selectionCount;
  if (analytics.undoCount !== undefined) record.undoCount = analytics.undoCount;
  if (analytics.redoCount !== undefined) record.redoCount = analytics.redoCount;
  if (analytics.runCount !== undefined) record.runCount = analytics.runCount;
  if (analytics.submitCount !== undefined) record.submitCount = analytics.submitCount;
  if (analytics.autosaveCount !== undefined) record.autosaveCount = analytics.autosaveCount;
  if (analytics.focusChanges !== undefined) record.focusChanges = analytics.focusChanges;
  if (analytics.fullscreenExits !== undefined) record.fullscreenExits = analytics.fullscreenExits;
  if (analytics.windowBlurCount !== undefined) record.windowBlurCount = analytics.windowBlurCount;
  if (analytics.visibilityChanges !== undefined) record.visibilityChanges = analytics.visibilityChanges;
  if (analytics.resizeCount !== undefined) record.resizeCount = analytics.resizeCount;
  if (analytics.refreshCount !== undefined) record.refreshCount = analytics.refreshCount;
  if (analytics.networkReconnects !== undefined) record.networkReconnects = analytics.networkReconnects;
  if (analytics.editorRecoveryEvents !== undefined) record.editorRecoveryEvents = analytics.editorRecoveryEvents;
  if (analytics.pasteCount !== undefined) record.pasteCount = analytics.pasteCount;
  if (analytics.copyCount !== undefined) record.copyCount = analytics.copyCount;
  if (analytics.totalCharactersTyped !== undefined) record.totalCharactersTyped = analytics.totalCharactersTyped;
  if (analytics.mouseMoveCount !== undefined) record.mouseMoveCount = analytics.mouseMoveCount;
  if (analytics.mouseClickCount !== undefined) record.mouseClickCount = analytics.mouseClickCount;

  // Timing metadata
  if (analytics.firstEditTime) record.firstEditTime = new Date(analytics.firstEditTime);
  if (analytics.lastEditTime) record.lastEditTime = new Date(analytics.lastEditTime);

  // Typing speed analysis
  if (analytics.averageTypingSpeed !== undefined) record.averageTypingSpeed = analytics.averageTypingSpeed;
  if (analytics.maxTypingSpeed !== undefined) record.maxTypingSpeed = analytics.maxTypingSpeed;
  if (analytics.minTypingSpeed !== undefined) record.minTypingSpeed = analytics.minTypingSpeed;
  if (analytics.typingConsistencyScore !== undefined) record.typingConsistencyScore = analytics.typingConsistencyScore;
  if (analytics.correctionCount !== undefined) record.correctionCount = analytics.correctionCount;

  // Automation detection flags
  if (analytics.noMouseMovementDetected !== undefined) record.noMouseMovementDetected = analytics.noMouseMovementDetected;
  if (analytics.zeroCorrections !== undefined) record.zeroCorrections = analytics.zeroCorrections;
  if (analytics.veryRegularIntervals !== undefined) record.veryRegularIntervals = analytics.veryRegularIntervals;
  if (analytics.longInactivityThenRapidEdits !== undefined) record.longInactivityThenRapidEdits = analytics.longInactivityThenRapidEdits;

  if (submissionId) {
    record.submissionId = submissionId;
  }

  // Calculate automation risk score
  record.automationRiskScore = calculateAutomationRisk(record);

  // Calculate final suspicion level
  if (record.automationRiskScore >= 70) {
    record.finalSuspicionLevel = "CRITICAL";
  } else if (record.automationRiskScore >= 40) {
    record.finalSuspicionLevel = "HIGH";
  } else if (record.automationRiskScore >= 20) {
    record.finalSuspicionLevel = "MEDIUM";
  } else {
    record.finalSuspicionLevel = "LOW";
  }

  // Add event to timeline
  if (analytics.eventType) {
    record.eventTimeline.push({
      type: analytics.eventType,
      timestamp: new Date(),
    });
  }

  await record.save();

  // If suspicion level is high or critical, update SuspicionScore
  if (record.finalSuspicionLevel === "HIGH" || record.finalSuspicionLevel === "CRITICAL") {
    await updateSuspicionScore(userId, submissionId, record);
  }

  return record;
}

function calculateAutomationRisk(record) {
  let risk = 0;

  // No mouse movement at all is suspicious
  if (record.noMouseMovementDetected && record.mouseMoveCount === 0) {
    risk += AUTOMATION_WEIGHTS.NO_MOUSE_MOVEMENT;
  }

  // Zero corrections suggests automated paste
  if (record.zeroCorrections && record.totalCharactersTyped > 100) {
    risk += AUTOMATION_WEIGHTS.ZERO_CORRECTIONS;
  }

  // Very regular typing intervals suggest automation
  if (record.veryRegularIntervals) {
    risk += AUTOMATION_WEIGHTS.VERY_REGULAR_TYPING_INTERVALS;
  }

  // Very high typing speed (over 300 CPM) suggests automation
  if (record.averageTypingSpeed > 300 && record.totalCharactersTyped > 200) {
    risk += AUTOMATION_WEIGHTS.HIGH_TYPING_SPEED;
  }

  // Long inactivity followed by rapid edits
  if (record.longInactivityThenRapidEdits) {
    risk += AUTOMATION_WEIGHTS.LONG_INACTIVITY_THEN_RAPID_EDITS;
  }

  // Very consistent typing speed (high consistency score) suggests automation
  if (record.typingConsistencyScore > 90 && record.totalCharactersTyped > 200) {
    risk += AUTOMATION_WEIGHTS.CONSISTENT_PERFECT_TIMING;
  }

  return Math.min(100, risk);
}

async function updateSuspicionScore(userId, submissionId, analytics) {
  try {
    let suspicion = await SuspicionScore.findOne({ userId });

    if (!suspicion) {
      suspicion = new SuspicionScore({
        userId,
        submissionId,
        totalScore: 0,
        level: "LOW",
      });
    }

    const factorDescriptions = {
      NO_MOUSE_MOVEMENT: "No mouse movement detected during entire session",
      VERY_REGULAR_TYPING_INTERVALS: "Typing intervals are unrealistically consistent",
      ZERO_CORRECTIONS: "Zero corrections made despite typing over 100 characters",
      HIGH_TYPING_SPEED: "Average typing speed exceeds 300 CPM",
      LONG_INACTIVITY_THEN_RAPID_EDITS: "Long period of inactivity followed by rapid code changes",
      CONSISTENT_PERFECT_TIMING: "Typing speed consistency score exceeds 90%",
    };

    const factors = [];

    if (analytics.noMouseMovementDetected && analytics.mouseMoveCount === 0) {
      factors.push({ type: "NO_MOUSE_MOVEMENT", weight: AUTOMATION_WEIGHTS.NO_MOUSE_MOVEMENT, description: factorDescriptions.NO_MOUSE_MOVEMENT });
    }
    if (analytics.zeroCorrections && analytics.totalCharactersTyped > 100) {
      factors.push({ type: "ZERO_CORRECTIONS", weight: AUTOMATION_WEIGHTS.ZERO_CORRECTIONS, description: factorDescriptions.ZERO_CORRECTIONS });
    }
    if (analytics.veryRegularIntervals) {
      factors.push({ type: "VERY_REGULAR_TYPING_INTERVALS", weight: AUTOMATION_WEIGHTS.VERY_REGULAR_TYPING_INTERVALS, description: factorDescriptions.VERY_REGULAR_TYPING_INTERVALS });
    }
    if (analytics.averageTypingSpeed > 300 && analytics.totalCharactersTyped > 200) {
      factors.push({ type: "HIGH_TYPING_SPEED", weight: AUTOMATION_WEIGHTS.HIGH_TYPING_SPEED, description: factorDescriptions.HIGH_TYPING_SPEED });
    }
    if (analytics.longInactivityThenRapidEdits) {
      factors.push({ type: "LONG_INACTIVITY_THEN_RAPID_EDITS", weight: AUTOMATION_WEIGHTS.LONG_INACTIVITY_THEN_RAPID_EDITS, description: factorDescriptions.LONG_INACTIVITY_THEN_RAPID_EDITS });
    }
    if (analytics.typingConsistencyScore > 90 && analytics.totalCharactersTyped > 200) {
      factors.push({ type: "CONSISTENT_PERFECT_TIMING", weight: AUTOMATION_WEIGHTS.CONSISTENT_PERFECT_TIMING, description: factorDescriptions.CONSISTENT_PERFECT_TIMING });
    }

    for (const factor of factors) {
      suspicion.addFactor(factor.type, factor.weight, factor.description);
    }

    await suspicion.save();
  } catch (error) {
    console.error("[EditorAnalytics] Failed to update suspicion score:", error.message);
  }
}

/**
 * Track a violation event from editor analytics.
 */
export async function trackViolation(userId, challengeId, submissionId, type, severity = "MEDIUM", details = {}) {
  try {
    const violation = new Violation({
      userId,
      submissionId,
      challengeId,
      type,
      severity,
      details,
      timestamp: new Date(),
    });
    await violation.save();

    // Update suspicion score
    let suspicion = await SuspicionScore.findOne({ userId });
    if (!suspicion) {
      suspicion = new SuspicionScore({ userId, submissionId });
    }

    const weightMap = {
      LOW: 5,
      MEDIUM: 10,
      HIGH: 20,
      CRITICAL: 30,
    };

    suspicion.addFactor(type, weightMap[severity] || 10, `Violation: ${type} (${severity})`);
    await suspicion.save();

    return violation;
  } catch (error) {
    console.error("[EditorAnalytics] Failed to track violation:", error.message);
  }
}

/**
 * Get analytics for a specific submission.
 */
export async function getSubmissionAnalytics(submissionId) {
  return EditorAnalytics.findOne({ submissionId }).lean();
}

/**
 * Get all suspicious submissions for admin review.
 */
export async function getSuspiciousSubmissions(level = "HIGH", limit = 50) {
  return EditorAnalytics.find({
    finalSuspicionLevel: { $in: ["HIGH", "CRITICAL"] },
    automationRiskScore: { $gte: 40 },
  })
    .populate("userId", "name email organization")
    .populate("challengeId", "title slug")
    .sort({ automationRiskScore: -1 })
    .limit(limit)
    .lean();
}
