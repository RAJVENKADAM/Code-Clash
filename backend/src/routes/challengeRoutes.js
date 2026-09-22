import { Router } from "express";
import {
  createChallenge,
  updateChallenge,
  deleteChallenge,
  archiveChallenge,
  publishChallenge,
  duplicateChallenge,
  getTodayChallenge,
  getChallengeById,
  getAllChallenges,
  getChallengeStats,
} from "../controllers/challengeController.js";
import { authenticate } from "../middleware/auth.js";
import { isAdmin } from "../middleware/rbac.js";

const router = Router();

router.get("/today", authenticate, getTodayChallenge);
router.get("/", authenticate, getAllChallenges);
router.get("/:id", authenticate, getChallengeById);
router.get("/:id/stats", authenticate, getChallengeStats);

router.post("/", authenticate, isAdmin, createChallenge);
router.put("/:id", authenticate, isAdmin, updateChallenge);
router.delete("/:id", authenticate, isAdmin, deleteChallenge);
router.put("/:id/archive", authenticate, isAdmin, archiveChallenge);
router.put("/:id/publish", authenticate, isAdmin, publishChallenge);
router.post("/:id/duplicate", authenticate, isAdmin, duplicateChallenge);

export default router;

