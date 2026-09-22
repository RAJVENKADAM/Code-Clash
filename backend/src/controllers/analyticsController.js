import { processEditorAnalytics, getSuspiciousSubmissions, trackViolation } from "../services/editorAnalyticsService.js";
import EditorAnalytics from "../models/EditorAnalytics.js";
import Submission from "../models/Submission.js";
import AuditLog from "../models/AuditLog.js";

/**
 * Flush editor analytics metadata from the client.
 * Only stores aggregate metadata, never keystrokes or code content.
 */
export async function flushEditorAnalytics(req, res) {
  try {
    const { challengeId, analytics } = req.body;
    const userId = req.userId;

    if (!challengeId || !analytics) {
      return res.status(400).json({ error: "Challenge ID and analytics data are required." });
    }

    // Validate that analytics is metadata only (no code content)
    const forbiddenFields = ["code", "keystrokes", "input", "solution", "content"];
    for (const field of forbiddenFields) {
      if (analytics[field] !== undefined) {
        return res.status(400).json({
          error: "Analytics data must not contain code content.",
          code: "ANALYTICS_CONTAINS_CODE",
        });
      }
    }

    // Validate field types to prevent injection
    const allowedNumericFields = [
      "typingDuration", "idleDuration", "cursorMovementCount", "selectionCount",
      "undoCount", "redoCount", "runCount", "submitCount", "autosaveCount",
      "focusChanges", "fullscreenExits", "windowBlurCount", "visibilityChanges",
      "resizeCount", "refreshCount", "networkReconnects", "editorRecoveryEvents",
      "pasteCount", "copyCount", "totalCharactersTyped", "mouseMoveCount",
      "mouseClickCount", "averageTypingSpeed", "maxTypingSpeed", "minTypingSpeed",
      "typingConsistencyScore", "correctionCount",
    ];

    const allowedBooleanFields = [
      "noMouseMovementDetected", "zeroCorrections", "veryRegularIntervals",
      "longInactivityThenRapidEdits",
    ];

    const allowedDateFields = ["firstEditTime", "lastEditTime"];

    for (const key of Object.keys(analytics)) {
      if (allowedNumericFields.includes(key)) {
        if (typeof analytics[key] !== "number" || isNaN(analytics[key])) {
          return res.status(400).json({
            error: `Invalid analytics field: ${key} must be a number.`,
            code: "INVALID_ANALYTICS_TYPE",
          });
        }
      } else if (allowedBooleanFields.includes(key)) {
        if (typeof analytics[key] !== "boolean") {
          return res.status(400).json({
            error: `Invalid analytics field: ${key} must be a boolean.`,
            code: "INVALID_ANALYTICS_TYPE",
          });
        }
      } else if (allowedDateFields.includes(key)) {
        if (typeof analytics[key] !== "string" || isNaN(Date.parse(analytics[key]))) {
          return res.status(400).json({
            error: `Invalid analytics field: ${key} must be a valid date string.`,
            code: "INVALID_ANALYTICS_TYPE",
          });
        }
      } else if (key !== "eventType") {
        return res.status(400).json({
          error: `Unknown analytics field: ${key}.`,
          code: "UNKNOWN_ANALYTICS_FIELD",
        });
      }
    }

    // Get submission ID if exists
    let submissionId = null;
    const submission = await Submission.findOne({ userId, challengeId }).sort({ createdAt: -1 });
    if (submission) {
      submissionId = submission._id;
    }

    // Process and store analytics
    const record = await processEditorAnalytics(userId, challengeId, analytics, submissionId);

    // Audit log for suspicious activity
    if (record.finalSuspicionLevel === "HIGH" || record.finalSuspicionLevel === "CRITICAL") {
      AuditLog.create({
        userId,
        action: "ANALYTICS_SUSPICIOUS_FLAG",
        resource: "analytics",
        resourceId: record._id,
        details: {
          suspicionLevel: record.finalSuspicionLevel,
          automationRiskScore: record.automationRiskScore,
          challengeId,
        },
        requestId: req.requestId,
        severity: "WARN",
      }).catch(() => {});
    }

    return res.status(200).json({
      message: "Analytics recorded.",
      suspicionLevel: record.finalSuspicionLevel,
      automationRiskScore: record.automationRiskScore,
    });
  } catch (error) {
    console.error("[Analytics] Flush error:", error.message);
    return res.status(500).json({ error: "Failed to record analytics." });
  }
}

/**
 * Get analytics for a specific submission (admin only).
 */
export async function getSubmissionAnalytics(req, res) {
  try {
    const { submissionId } = req.params;
    const analytics = await EditorAnalytics.findOne({ submissionId })
      .populate("userId", "name email organization")
      .populate("challengeId", "title slug")
      .lean();

    if (!analytics) {
      return res.status(404).json({ error: "No analytics found for this submission." });
    }

    return res.status(200).json({ analytics });
  } catch (error) {
    console.error("[Analytics] Get error:", error.message);
    return res.status(500).json({ error: "Failed to get analytics." });
  }
}

/**
 * List suspicious submissions (admin only).
 */
export async function listSuspiciousSubmissions(req, res) {
  try {
    const level = req.query.level || "HIGH";
    const limit = Math.min(100, parseInt(req.query.limit) || 50);

    const results = await getSuspiciousSubmissions(level, limit);

    return res.status(200).json({
      suspiciousSubmissions: results,
      total: results.length,
    });
  } catch (error) {
    console.error("[Analytics] List suspicious error:", error.message);
    return res.status(500).json({ error: "Failed to list suspicious submissions." });
  }
}

/**
 * Export analytics for a challenge (admin only).
 */
export async function exportChallengeAnalytics(req, res) {
  try {
    const { challengeId } = req.params;

    const analytics = await EditorAnalytics.find({ challengeId })
      .populate("userId", "name email organization")
      .sort({ automationRiskScore: -1 })
      .lean();

    return res.status(200).json({
      challengeId,
      totalParticipants: analytics.length,
      suspiciousCount: analytics.filter((a) => a.finalSuspicionLevel === "HIGH" || a.finalSuspicionLevel === "CRITICAL").length,
      analytics,
    });
  } catch (error) {
    console.error("[Analytics] Export error:", error.message);
    return res.status(500).json({ error: "Failed to export analytics." });
  }
}
