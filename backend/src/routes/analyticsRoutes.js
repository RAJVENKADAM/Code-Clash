import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { isAdmin } from "../middleware/rbac.js";
import { validateNonce } from "../middleware/nonce.js";
import {
  flushEditorAnalytics,
  getSubmissionAnalytics,
  listSuspiciousSubmissions,
  exportChallengeAnalytics,
} from "../controllers/analyticsController.js";

const router = Router();

// Flush editor analytics metadata (authenticated users)
router.post("/flush", authenticate, validateNonce, flushEditorAnalytics);

// Get analytics for a specific submission (admin only)
router.get("/submission/:submissionId", authenticate, isAdmin, getSubmissionAnalytics);

// List suspicious submissions (admin only)
router.get("/suspicious", authenticate, isAdmin, listSuspiciousSubmissions);

// Export analytics for a challenge (admin only)
router.get("/challenge/:challengeId", authenticate, isAdmin, exportChallengeAnalytics);

export default router;
