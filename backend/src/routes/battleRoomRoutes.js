import { Router } from "express";
import {
  createRoom,
  startRoom,
  getRoomByCode,
  joinRoom,
  submitQuestionSolution,
  runQuestionSolution,
  endTest,
  disqualifyRoomSubmission,
  getRoomLeaderboard,
  getUserResult,
  closeRoom,
  getLeaderboardByRoomCodePublic,
  getMyRooms,
  getJoinedRooms,
  deleteRoom,
  shareKey,
  reuseRoom,
  getRoomReport,
  downloadRoomReportPDF,
  downloadParticipantReportPDF,
} from "../controllers/battleRoomController.js";
import {
  generateSignature,
  generateStarterCode,
  generateOutputs,
  validateQuestionEndpoint,
} from "../controllers/battleRoomAuthoringController.js";
import { authenticate } from "../middleware/auth.js";
import {
  executionLimiter,
  joinLimiter,
  reportLimiter,
} from "../middleware/security.js";

const router = Router();

// Authoring wizard helpers (stateless; do not create rooms)
router.post("/authoring/generate-signature", authenticate, generateSignature);
router.post("/authoring/generate-starter", authenticate, generateStarterCode);
router.post("/authoring/generate-outputs", authenticate, generateOutputs);
router.post("/authoring/validate", authenticate, validateQuestionEndpoint);

// Room management
router.post("/create", authenticate, createRoom);
router.post("/:roomCode/start", authenticate, startRoom);
router.post("/join", authenticate, joinLimiter, joinRoom);
router.get("/my-rooms", authenticate, getMyRooms);
router.get("/joined-rooms", authenticate, getJoinedRooms);
router.get("/:roomCode", authenticate, getRoomByCode);

// Creator-only actions
router.delete("/:roomCode", authenticate, deleteRoom);
router.post("/:roomCode/share-key", authenticate, shareKey);

// Submission (stateless, no raw code persisted)
router.post(
  "/:roomCode/submit",
  authenticate,
  executionLimiter,
  submitQuestionSolution,
);

// Debug run (stateless, read-only, visible test cases only, does NOT create a submission)
router.post(
  "/:roomCode/run",
  authenticate,
  executionLimiter,
  runQuestionSolution,
);

// End test (finalize the user's submission as completed)
router.post("/:roomCode/end", authenticate, endTest);

router.post("/:roomCode/disqualify", authenticate, disqualifyRoomSubmission);

// Leaderboard
router.get("/:roomCode/leaderboard", authenticate, getRoomLeaderboard);
router.get("/:roomCode/public-leaderboard", getLeaderboardByRoomCodePublic);
router.get("/:roomCode/my-result", authenticate, getUserResult);

// Close room (only creator can close)
router.post("/:roomCode/close", authenticate, closeRoom);
router.post("/:roomCode/reuse", authenticate, reuseRoom);

// Creator-only reports (authorization enforced inside reportService)
router.get("/:roomCode/report", authenticate, reportLimiter, getRoomReport);
router.get(
  "/:roomCode/report/pdf",
  authenticate,
  reportLimiter,
  downloadRoomReportPDF,
);
router.get(
  "/:roomCode/report/participant/:participantId/pdf",
  authenticate,
  reportLimiter,
  downloadParticipantReportPDF,
);

export default router;
