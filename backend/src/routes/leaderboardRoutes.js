import { Router } from "express";
import {
  getChallengeLeaderboard,
  getGlobalLeaderboard,
  getUserRank,
  getUserRankToday,
  getUserSubmissionStatus,
} from "../controllers/leaderboardController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.get("/global", authenticate, getGlobalLeaderboard);
router.get("/user/rank", authenticate, getUserRank);
router.get("/user/rank-today", authenticate, getUserRankToday);
router.get("/challenge/:challengeId", authenticate, getChallengeLeaderboard);
router.get(
  "/submission/:challengeId/status",
  authenticate,
  getUserSubmissionStatus,
);

export default router;
