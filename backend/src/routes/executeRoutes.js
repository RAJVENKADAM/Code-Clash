import { Router } from "express";
import {
  runCode,
  submitCode,
  judgeHealth,
} from "../controllers/executeController.js";
import { authenticate } from "../middleware/auth.js";
import { validateNonce, generateNonce } from "../middleware/nonce.js";

const router = Router();

// Generate a nonce for replay-protected actions (submit)
router.get("/nonce", authenticate, generateNonce);

// Run code (unlimited, public test cases only, does NOT create submission)
router.post("/run", authenticate, runCode);

// Submit code (single, all test cases including hidden, creates final submission)
// Requires nonce for replay protection
router.post("/submit", authenticate, validateNonce, submitCode);

// Judge engine health check
router.get("/health", judgeHealth);

export default router;
