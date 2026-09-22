import { Router } from "express";
import {
  submitSolution,
  getSubmissionResult,
  updateSubmissionResult,
  handleDisqualification,
  getSubmissionHistory,
} from "../controllers/submissionController.js";
import { authenticate, optionalAuth } from "../middleware/auth.js";
import { isAdmin } from "../middleware/rbac.js";

const router = Router();

router.post("/", authenticate, submitSolution);
router.get("/history", authenticate, getSubmissionHistory);
router.get("/:challengeId", authenticate, getSubmissionResult);
router.put("/:submissionId/result", optionalAuth, updateSubmissionResult);
router.put("/:submissionId/disqualify", authenticate, isAdmin, handleDisqualification);

export default router;

