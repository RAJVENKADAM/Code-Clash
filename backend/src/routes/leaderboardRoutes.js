import { Router } from "express";
import {
  getChallengeLeaderboard,
  getGlobalLeaderboard,
  getUserRank,
  getUserRankToday,
  getUserSubmissionStatus,
} from "../controllers/leaderboardController.js";
import { authenticate, optionalAuth } from "../middleware/auth.js";

const router = Router();

// Global leaderboard is public (based on today's challenge only).
router.get("/global", optionalAuth, getGlobalLeaderboard);
router.get("/user/rank", authenticate, getUserRank);
router.get("/user/rank-today", authenticate, getUserRankToday);
router.get("/challenge/:challengeId", authenticate, getChallengeLeaderboard);
router.get(
  "/submission/:challengeId/status",
  authenticate,
  getUserSubmissionStatus,
);

export default router;
