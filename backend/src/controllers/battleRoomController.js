import BattleRoom from "../models/BattleRoom.js";
import BattleRoomSubmission from "../models/BattleRoomSubmission.js";
import { executionService } from "../services/executionService.js";
import { sendBattleRoomResultEmail } from "../services/emailService.js";
import { composeProgram } from "../services/wrapperGenerator.js";
import {
  getStoredSignature,
  validateSignature,
} from "../services/signatureParser.js";
import { composeStarterFile } from "../services/languageTemplates.js";
import {
  getRoomReportData,
  streamCompleteRoomPDF,
  streamParticipantReportPDF,
} from "../services/reportService.js";
import {
  getRoomWindowState,
  isCodeExecutionAllowed,
  buildBlockedRoomPayload,
  ROOM_WINDOW_STATE,
} from "../services/scheduleGuard.js";

// Only languages supported by the Secure Code Engine.
const SUPPORTED_LANGUAGES = ["java"];
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function isValidLanguage(lang) {
  return SUPPORTED_LANGUAGES.includes(lang);
}

/**
 * Robustly parse date, time, and timezone parameters into UTC Date objects.
 *
 * IMPORTANT: Room scheduling is ALWAYS stored as UTC Date objects in MongoDB.
 * Comparison with server time `new Date()` is timezone-safe because both are
 * in UTC epoch milliseconds, regardless of browser or server timezone.
 *
 * Timezone string is stored for reference only (for the UI to display back to
 * the creator what timezone they selected), but is never used for access
 * control decisions. All access decisions use UTC Date comparison only.
 *
 * Handles:
 * 1. ISO 8601 timestamps (direct pass-through)
 * 2. Date picker + time string inputs with timezone conversion
 *    Examples: "2026-01-15", "03:30 PM", "15:30" (24h), timezone="Asia/Kolkata"
 */
function parseSchedule({
  startTime,
  endTime,
  scheduledDate,
  scheduledStartTime,
  scheduledEndTime,
  timezone = "UTC",
  durationMinutes = 60,
}) {
  const now = new Date();
  const tz = timezone || "UTC";

  // 1. Direct ISO 8601 strings or timestamp inputs (highest priority)
  if (startTime && endTime) {
    const s = new Date(startTime);
    const e = new Date(endTime);
    if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
      return { start: s, end: e, timezone: tz };
    }
  }

  // 2. Scheduled Date + Time string inputs (date picker workflow)
  if (scheduledDate && scheduledStartTime) {
    const parseTimeString = (dateStr, timeStr) => {
      const trimmed = (timeStr || "").trim();
      // Match "3:30 PM", "3:30", "15:30", "15:30 PM" (12h and 24h formats)
      const match = trimmed.match(/^(\d{1,2}):(\d{2})(?:\s*([aApP][mM]))?$/);
      if (!match) return null;
      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const meridiem = match[3] ? match[3].toUpperCase() : null;

      // Convert 12-hour to 24-hour if meridiem is specified
      if (meridiem === "PM" && hours < 12) hours += 12;
      if (meridiem === "AM" && hours === 12) hours = 0;

      const pad = (n) => String(n).padStart(2, "0");
      // ISO format: YYYY-MM-DDTHH:mm:ss
      const localIso = `${dateStr}T${pad(hours)}:${pad(minutes)}:00`;

      // Handle known timezones directly
      if (tz === "UTC") {
        return new Date(`${localIso}Z`);
      }
      if (tz === "Asia/Kolkata" || tz === "IST") {
        // IST is UTC+05:30
        return new Date(`${localIso}+05:30`);
      }

      // For other timezones, use Intl API to get offset (best-effort)
      try {
        const targetDate = new Date(`${dateStr}T12:00:00Z`);
        const formatter = new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          timeZoneName: "longOffset",
        });
        const parts = formatter.formatToParts(targetDate);
        const tzPart = parts.find((p) => p.type === "timeZoneName");
        // Extract offset like "GMT+05:30" or "GMT-08:00"
        const offsetMatch = tzPart?.value?.match(/GMT([+-]\d{2}):(\d{2})/);
        if (offsetMatch) {
          return new Date(`${localIso}${offsetMatch[1]}:${offsetMatch[2]}`);
        }
      } catch (err) {
        // Intl API failed, fall through to default
      }

      // Fallback: treat as UTC if we can't determine offset
      return new Date(`${localIso}Z`);
    };

    const s = parseTimeString(scheduledDate, scheduledStartTime);
    let e = scheduledEndTime
      ? parseTimeString(scheduledDate, scheduledEndTime)
      : null;

    if (s && !isNaN(s.getTime())) {
      // If end time not provided or invalid, compute it from duration
      if (!e || isNaN(e.getTime()) || e <= s) {
        e = new Date(s.getTime() + (durationMinutes || 60) * 60 * 1000);
      }
      return { start: s, end: e, timezone: tz };
    }
  }

  // 3. Fallback: No schedule provided. Start immediately with given duration.
  const start = now;
  const end = new Date(now.getTime() + (durationMinutes || 60) * 60 * 1000);
  return { start, end, timezone: tz };
}

/**
 * Shared execution helper for authoring-format questions.
 * Uses the stored structured signature for composition.
 * Stateless: only touches the execution engine, never the DB.
 */
async function executeComposedQuestion(question, code, language, testCases) {
  const sig = question.signature;
  if (!sig || !sig.name) {
    throw new Error("Question has no valid function signature.");
  }
  const parsedSig = getStoredSignature(sig);
  const program = composeProgram(
    { signature: parsedSig, problemType: question.problemType || "array" },
    code,
    language,
    { isFullProgram: true },
  );
  return executionService.execute(program, testCases, language, {
    timeLimit: 5000,
    memoryLimit: 131072,
  });
}

/**
 * Generate fresh starter code for all 4 languages from a question's signature.
 */
function generateFreshStarters(question) {
  if (!question.signature || !question.signature.name) return {};
  const sig = getStoredSignature(question.signature);
  const starters = {};
  for (const lang of SUPPORTED_LANGUAGES) {
    starters[lang] = composeStarterFile(sig, lang);
  }
  return starters;
}

export async function createRoom(req, res) {
  try {
    const {
      title,
      description,
      questions,
      timeLimit,
      timeLimitUnit,
      maxParticipants,
      languages,
      moderationAction,
      allowLeaderboard,
      allowReuse,
      scheduledDate,
      scheduledStartTime,
      scheduledEndTime,
      timezone,
      // Accept direct ISO start/end overrides from frontend
      startTime: rawStartTime,
      endTime: rawEndTime,
    } = req.body;
    const userId = req.userId;

    if (!title || !questions || questions.length === 0) {
      return res
        .status(400)
        .json({ error: "Title and at least one question are required." });
    }

    if (questions.length > 20) {
      return res
        .status(400)
        .json({ error: "Maximum 20 questions per battle room." });
    }

    const tUnit = timeLimitUnit || "minutes";
    const allowedUnits = ["minutes", "hours", "days", "weeks"];
    if (!allowedUnits.includes(tUnit)) {
      return res.status(400).json({ error: "Invalid time limit unit." });
    }
    const tValue = timeLimit || 60;
    const durationMinutes =
      tValue *
      (tUnit === "hours"
        ? 60
        : tUnit === "days"
          ? 1440
          : tUnit === "weeks"
            ? 10080
            : 1);
    if (tValue < 1 || durationMinutes > 2000 * 7 * 24) {
      return res
        .status(400)
        .json({ error: "Time limit is out of valid range." });
    }

    const roomLanguages = ["java"];

    // Validate each question
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.title || !q.description) {
        return res.status(400).json({
          error: `Question ${i + 1} must have a title and description.`,
        });
      }
      if (!q.visibleTestCases || q.visibleTestCases.length === 0) {
        return res.status(400).json({
          error: `Question ${i + 1} must have at least one visible test case.`,
        });
      }
      if (!q.hiddenTestCases || q.hiddenTestCases.length === 0) {
        return res.status(400).json({
          error: `Question ${i + 1} must have at least one hidden test case.`,
        });
      }
      for (const tc of q.visibleTestCases) {
        if (!tc.input || tc.expectedOutput === undefined) {
          return res.status(400).json({
            error: `Question ${i + 1} has invalid visible test case format.`,
          });
        }
      }
      for (const tc of q.hiddenTestCases) {
        if (!tc.input || tc.expectedOutput === undefined) {
          return res.status(400).json({
            error: `Question ${i + 1} has invalid hidden test case format.`,
          });
        }
      }
    }

    // Generate unique room code
    let roomCode = generateRoomCode();
    let existing = await BattleRoom.findOne({
      roomCode,
      isActive: true,
      isDeleted: false,
    });
    let attempts = 0;
    while (existing && attempts < 10) {
      roomCode = generateRoomCode();
      existing = await BattleRoom.findOne({
        roomCode,
        isActive: true,
        isDeleted: false,
      });
      attempts++;
    }

    if (attempts >= 10) {
      return res.status(500).json({
        error: "Failed to generate unique room code. Please try again.",
      });
    }

    // Process each question: store structured signature, generate fresh starter code
    const processedQuestions = [];
    for (const q of questions) {
      let starterCodeByLanguage = q.starterCodeByLanguage || {};
      let functionName = q.functionName || "";
      let signature = q.signature || null;

      // If a raw functionSignature is provided, parse it into structured signature.
      if (q.functionSignature && !signature) {
        const sigResult = validateSignature(q.functionSignature);
        if (sigResult.valid) {
          signature = sigResult.parsed;
          functionName = sigResult.parsed.name;
        }
      }

      // Generate fresh starter code from signature (never persisted — generated on room read)
      if (signature && signature.name) {
        functionName = signature.name;
        starterCodeByLanguage = {}; // Fresh starters will be generated on room read
      }

      processedQuestions.push({
        title: q.title,
        description: q.description,
        explanation: q.explanation || "",
        constraints: q.constraints || "",
        difficulty: q.difficulty || "MEDIUM",
        category: q.category || "Custom",
        tags: q.tags || [],
        examples: q.examples || [],
        hints: q.hints || [],
        signature: signature,
        starterCode:
          q.starterCode ||
          starterCodeByLanguage["python"] ||
          starterCodeByLanguage["java"] ||
          "",
        starterCodeByLanguage, // Will be populated on read with fresh starters
        visibleTestCases: q.visibleTestCases.map((tc) => ({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          description: tc.description || "",
          parameterValues: tc.parameterValues || null,
        })),
        hiddenTestCases: q.hiddenTestCases.map((tc) => ({
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          parameterValues: tc.parameterValues || null,
        })),
        points: q.points || 100,
        problemType: q.problemType || "array",
        functionSignature: q.functionSignature || "",
        functionName,
        expectedOutputSource: q.expectedOutputSource || "manual",
        referenceSolution: q.referenceSolution || "",
        referenceSolutionLanguage: q.referenceSolutionLanguage || "python",
        wrapperByLanguage: q.wrapperByLanguage || {},
      });
    }

    const now = new Date();

    // Parse scheduled start/end into UTC Date objects using the shared helper
    const { start: parsedStartTime, end: parsedEndTime } = parseSchedule({
      startTime: rawStartTime || null,
      endTime: rawEndTime || null,
      scheduledDate: scheduledDate || null,
      scheduledStartTime: scheduledStartTime || null,
      scheduledEndTime: scheduledEndTime || null,
      timezone: timezone || "UTC",
      durationMinutes,
    });

    const room = new BattleRoom({
      roomCode,
      title,
      description: description || "",
      createdBy: userId,
      questions: processedQuestions,
      languages: roomLanguages,
      timeLimit: tValue,
      timeLimitUnit: tUnit,
      status: "UPCOMING",
      maxParticipants: maxParticipants || 100,
      moderationAction:
        moderationAction === "DISQUALIFY" ? "DISQUALIFY" : "FLAG",
      allowLeaderboard: allowLeaderboard !== false,
      allowReuse: allowReuse !== false,
      scheduledDate: scheduledDate || "",
      scheduledStartTime: scheduledStartTime || "",
      scheduledEndTime: scheduledEndTime || "",
      timezone: timezone || "UTC",
      startTime: parsedStartTime || null,
      endTime: parsedEndTime || null,
      expiresAt: new Date(now.getTime() + ONE_YEAR_MS),
    });

    await room.save();

    return res.status(201).json({
      message: "Battle room created successfully!",
      room: room.toCreatorJSON(),
      roomKey: room.roomCode,
    });
  } catch (error) {
    console.error("Create battle room error:", error.message);
    return res.status(500).json({ error: "Failed to create battle room." });
  }
}

/**
 * Attach fresh starter code to a question object.
 */
function attachFreshStartersToQuestion(q) {
  if (q.signature && q.signature.name) {
    const freshStarters = generateFreshStarters(q);
    q.starterCodeByLanguage = freshStarters;
    q.starterCode =
      freshStarters[q.starterCodeLanguage || "python"] ||
      freshStarters["java"] ||
      q.starterCode ||
      "";
  }
  return q;
}

// Reuse the immutable question set while requiring the owner to explicitly
// choose fresh restrictions for the new battle instance.
export async function reuseRoom(req, res) {
  try {
    const source = await BattleRoom.findOne({
      roomCode: req.params.roomCode.toUpperCase(),
      createdBy: req.userId,
      isDeleted: false,
    });
    if (!source)
      return res.status(404).json({ error: "Battle room not found." });
    if (!source.allowReuse)
      return res
        .status(403)
        .json({ error: "Reuse is disabled for this room." });
    const {
      timeLimit,
      timeLimitUnit,
      maxParticipants,
      languages,
      moderationAction,
      allowLeaderboard,
      allowReuse,
    } = req.body;
    let roomCode = generateRoomCode();
    while (await BattleRoom.exists({ roomCode })) roomCode = generateRoomCode();
    const room = new BattleRoom({
      roomCode,
      title: source.title,
      description: source.description,
      createdBy: req.userId,
      questions: source.questions.map((question) => question.toObject()),
      timeLimit: timeLimit || source.timeLimit,
      timeLimitUnit: timeLimitUnit || source.timeLimitUnit,
      maxParticipants: maxParticipants || source.maxParticipants,
      languages:
        Array.isArray(languages) && languages.length
          ? languages
          : source.languages,
      moderationAction:
        moderationAction === "DISQUALIFY" ? "DISQUALIFY" : "FLAG",
      allowLeaderboard: allowLeaderboard !== false,
      allowReuse: allowReuse !== false,
      status: "UPCOMING",
      expiresAt: new Date(Date.now() + ONE_YEAR_MS),
    });
    await room.save();
    return res.status(201).json({
      message: "Battle room reused.",
      room: room.toCreatorJSON(),
      roomKey: room.roomCode,
    });
  } catch (error) {
    console.error("Reuse battle room error:", error.message);
    return res.status(500).json({ error: "Failed to reuse battle room." });
  }
}

export async function startRoom(req, res) {
  try {
    const { roomCode } = req.params;
    const userId = req.userId;

    const room = await BattleRoom.findOne({
      roomCode: roomCode.toUpperCase(),
      isActive: true,
      isDeleted: false,
    });
    if (!room) {
      return res.status(404).json({ error: "Battle room not found." });
    }

    if (room.createdBy.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ error: "Only the room creator can start the battle." });
    }

    if (room.status !== "UPCOMING") {
      return res
        .status(400)
        .json({ error: "Battle room has already started or ended." });
    }

    const now = new Date();
    const durationMinutes = room.getDurationMinutes();
    room.status = "ACTIVE";
    room.startTime = now;
    room.endTime = new Date(now.getTime() + durationMinutes * 60 * 1000);
    await room.save();

    // Auto-join the creator so they can submit solutions and get a score.
    const existingCreatorSubmission = await BattleRoomSubmission.findOne({
      roomId: room._id,
      userId,
    });
    if (!existingCreatorSubmission) {
      const creatorSubmission = new BattleRoomSubmission({
        roomId: room._id,
        userId,
        participantName: req.user?.name || "Participant",
        participantOrganization: req.user?.organization || "Unspecified",
        questionResults: room.questions.map((q) => ({
          questionId: q._id,
          questionTitle: q.title,
          status: "PENDING",
          score: 0,
          passed: 0,
          failed: 0,
          total: q.visibleTestCases.length + q.hiddenTestCases.length,
        })),
        totalQuestions: room.questions.length,
        status: "PENDING",
        startTime: now,
      });
      await creatorSubmission.save();
      await BattleRoom.findByIdAndUpdate(room._id, {
        $inc: { participantCount: 1 },
      });
    }

    return res.status(200).json({
      message: "Battle room started!",
      room: room.toCreatorJSON(),
      roomKey: room.roomCode,
    });
  } catch (error) {
    console.error("Start battle room error:", error.message);
    return res.status(500).json({ error: "Failed to start battle room." });
  }
}

export async function getRoomByCode(req, res) {
  try {
    const { roomCode } = req.params;
    const userId = req.userId;

    const room = await BattleRoom.findOne({
      roomCode: roomCode.toUpperCase(),
      isActive: true,
      isDeleted: false,
    });
    if (!room) {
      return res
        .status(404)
        .json({ error: "Battle room not found or has been deleted." });
    }

    const isCreator = room.createdBy.toString() === userId.toString();

    // Authoritative schedule check computed on the server. Never trust the
    // client clock or the mutable `status` field to gate room access.
    const windowState = getRoomWindowState(room);

    // The creator always retains access for review and reporting, regardless
    // of the schedule window.
    if (!isCreator && windowState.state !== ROOM_WINDOW_STATE.ACTIVE) {
      const userSubmission = await BattleRoomSubmission.findOne({
        roomId: room._id,
        userId,
      })
        .select("status totalScore submittedAt")
        .lean();

      return res.status(200).json({
        room: buildBlockedRoomPayload(room, windowState),
        isCreator: false,
        isParticipant: !!userSubmission,
        questionsVisible: false,
        timeRemaining: 0,
        userSubmission: userSubmission
          ? {
              status: userSubmission.status,
              totalScore: userSubmission.totalScore,
              submittedAt: userSubmission.submittedAt,
            }
          : null,
      });
    }

    const userSubmission = await BattleRoomSubmission.findOne({
      roomId: room._id,
      userId,
    }).lean();
    const isParticipant = !!userSubmission;

    const roomData = isCreator ? room.toCreatorJSON() : room.toPublicJSON();

    // Attach fresh starter code to each question
    if (roomData.questions) {
      roomData.questions = roomData.questions.map(
        attachFreshStartersToQuestion,
      );
    }

    return res.status(200).json({
      room: roomData,
      isCreator,
      isParticipant,
      questionsVisible: isCreator || windowState.state === ROOM_WINDOW_STATE.ACTIVE,
      roomKey: isCreator ? room.roomCode : undefined,
      userSubmission: userSubmission
        ? {
            status: userSubmission.status,
            totalScore: userSubmission.totalScore,
            submittedAt: userSubmission.submittedAt,
          }
        : null,
      timeRemaining: room.endTime
        ? Math.max(0, Math.floor((room.endTime - new Date()) / 1000))
        : null,
    });
  } catch (error) {
    console.error("Get battle room error:", error.message);
    return res.status(500).json({ error: "Failed to get battle room." });
  }
}

export async function joinRoom(req, res) {
  try {
    const { roomCode, name, organization } = req.body;
    const userId = req.userId;

    if (!roomCode) {
      return res.status(400).json({ error: "Room key is required." });
    }
    if (!String(name || "").trim() || !String(organization || "").trim()) {
      return res
        .status(400)
        .json({ error: "Name and organisation are required." });
    }

    const room = await BattleRoom.findOne({
      roomCode: roomCode.toUpperCase(),
      isActive: true,
      isDeleted: false,
    });
    if (!room) {
      return res
        .status(404)
        .json({ error: "Battle room not found. Check the key and try again." });
    }

    // Authoritative schedule gate: a participant may only join inside the
    // scheduled window, independent of the mutable `status` field.
    const joinWindow = getRoomWindowState(room);
    if (
      joinWindow.state === ROOM_WINDOW_STATE.ENDED ||
      joinWindow.state === ROOM_WINDOW_STATE.CLOSED
    ) {
      return res.status(400).json({
        error: "This battle has already ended.",
        windowState: joinWindow.state,
      });
    }
    if (joinWindow.state !== ROOM_WINDOW_STATE.ACTIVE) {
      return res.status(400).json({
        error: "This challenge has not started yet.",
        windowState: joinWindow.state,
        msUntilStart: Math.max(0, joinWindow.msUntilStart || 0),
        startTime: room.startTime,
        timezone: room.timezone || "UTC",
      });
    }

    if (room.participantCount >= room.maxParticipants) {
      return res.status(400).json({ error: "Battle room is full." });
    }

    const existingSubmission = await BattleRoomSubmission.findOne({
      roomId: room._id,
      userId,
    });

    if (
      existingSubmission &&
      (existingSubmission.status === "COMPLETED" ||
        existingSubmission.status === "DISQUALIFIED")
    ) {
      return res.status(400).json({
        error:
          "You have already completed or been disqualified from this battle and cannot re-enter.",
      });
    }

    if (!existingSubmission) {
      const submission = new BattleRoomSubmission({
        roomId: room._id,
        userId,
        participantName: String(name).trim(),
        participantOrganization: String(organization).trim(),
        questionResults: room.questions.map((q) => ({
          questionId: q._id,
          questionTitle: q.title,
          status: "PENDING",
          score: 0,
          passed: 0,
          failed: 0,
          total: q.visibleTestCases.length + q.hiddenTestCases.length,
        })),
        totalQuestions: room.questions.length,
        status: "PENDING",
        startTime: new Date(),
      });

      await submission.save();
      await BattleRoom.findByIdAndUpdate(room._id, {
        $inc: { participantCount: 1 },
      });
    }

    return res.status(200).json({
      message: "Successfully joined the battle room!",
      room: room.toPublicJSON(),
      timeRemaining: room.endTime
        ? Math.max(0, Math.floor((room.endTime - new Date()) / 1000))
        : null,
    });
  } catch (error) {
    console.error("Join battle room error:", error.message);
    return res.status(500).json({ error: "Failed to join battle room." });
  }
}

/**
 * STATELESS RUN
 * POST /api/battle-rooms/:roomCode/run
 * - Read-only wrt the database (uses .lean() everywhere).
 * - Fetches visible test cases, calls the engine, returns results.
 * - Persists NOTHING.
 */
export async function runQuestionSolution(req, res) {
  try {
    const { roomCode } = req.params;
    const { questionId, code, language } = req.body;
    const userId = req.userId;

    if (!questionId || !code) {
      return res
        .status(400)
        .json({ error: "Question ID and code are required." });
    }

    const room = await BattleRoom.findOne(
      { roomCode: roomCode.toUpperCase(), isActive: true, isDeleted: false },
      {
        roomCode: 1,
        status: 1,
        isDeleted: 1,
        startTime: 1,
        endTime: 1,
        languages: 1,
        questions: 1,
      },
    ).lean();
    if (!room) {
      return res.status(404).json({ error: "Battle room not found." });
    }

    // Server-authoritative window check. Blocks runs before the start time and
    // after the end time even if the client clock or payload is manipulated.
    if (!isCodeExecutionAllowed(room)) {
      const win = getRoomWindowState(room);
      return res.status(403).json({
        error:
          win.state === ROOM_WINDOW_STATE.NOT_STARTED
            ? "Challenge has not started yet."
            : "Time is up! The battle has ended.",
        windowState: win.state,
        serverTime: win.now.toISOString(),
        msUntilStart: Math.max(0, win.msUntilStart || 0),
      });
    }

    const lang = language || "java";
    if (!isValidLanguage(lang)) {
      return res.status(400).json({
        error: "Only Java is supported in battle rooms.",
      });
    }

    const roomLangs = room.languages || ["all"];
    if (!roomLangs.includes("all") && !roomLangs.includes(lang)) {
      return res
        .status(400)
        .json({ error: `Language "${lang}" is not allowed for this battle.` });
    }

    const question = room.questions.find(
      (q) => q._id.toString() === questionId,
    );
    if (!question) {
      return res
        .status(404)
        .json({ error: "Question not found in this room." });
    }

    const visibleTestCases = (question.visibleTestCases || [])
      .filter((tc) => tc.input)
      .map((tc) => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput ?? "",
        description: tc.description || "",
      }));

    if (visibleTestCases.length === 0) {
      return res
        .status(400)
        .json({ error: "No visible test cases available for this question." });
    }

    let executionResult;
    if (question.signature && question.signature.name) {
      executionResult = await executeComposedQuestion(
        question,
        code,
        lang,
        visibleTestCases,
      );
    } else {
      executionResult = await executionService.execute(
        code,
        visibleTestCases,
        lang,
        {
          timeLimit: 5000,
          memoryLimit: 131072,
        },
      );
    }

    const runResults = (executionResult.results || []).map((r) => ({
      testCase: r.testCase,
      status: r.status,
      executionTime: r.executionTime || 0,
      memoryUsed: r.memoryUsed || 0,
      output: r.output || "",
      expectedOutput: r.expectedOutput ?? "",
      isHidden: false,
    }));
    const visiblePassed = runResults.filter(
      (r) => r.status === "PASSED",
    ).length;
    const visibleFailed = runResults.filter(
      (r) => r.status !== "PASSED",
    ).length;

    return res.status(200).json({
      status: "RUN_COMPLETED",
      passed: executionResult.passed || 0,
      failed: executionResult.failed || 0,
      total: executionResult.total || visibleTestCases.length,
      output: executionResult.output || "",
      error: executionResult.error || "",
      executionTime: executionResult.executionTime || 0,
      memoryUsed: executionResult.memoryUsed || 0,
      visiblePassed,
      visibleFailed,
      results: runResults,
    });
  } catch (error) {
    const message =
      error?.message ||
      "Secure Code Engine is currently unavailable. Please try again in a few moments.";
    console.error("Run question solution error:", message);
    return res.status(502).json({ error: message });
  }
}

/**
 * LIGHTWEIGHT SUBMIT
 * POST /api/battle-rooms/:roomCode/submit
 * - Never stores raw user code.
 * - Persists only competition metadata via atomic updateOne ($set / $inc / $addToSet).
 * - The version checker (__v) is bypassed entirely, so a concurrent proctoring
 *   disqualification merges cleanly without throwing a VersionError.
 */
export async function submitQuestionSolution(req, res) {
  try {
    const { roomCode } = req.params;
    const { questionId, code, language } = req.body;
    const userId = req.userId;

    if (!questionId || !code) {
      return res
        .status(400)
        .json({ error: "Question ID and code are required." });
    }

    const room = await BattleRoom.findOne(
      { roomCode: roomCode.toUpperCase(), isActive: true, isDeleted: false },
      {
        roomCode: 1,
        status: 1,
        isDeleted: 1,
        startTime: 1,
        endTime: 1,
        languages: 1,
        questions: 1,
      },
    ).lean();
    if (!room) {
      return res.status(404).json({ error: "Battle room not found." });
    }

    // Server-authoritative window check. Prevents submissions before the start
    // time and after the end time regardless of client clock or payload.
    if (!isCodeExecutionAllowed(room)) {
      const win = getRoomWindowState(room);
      return res.status(403).json({
        error:
          win.state === ROOM_WINDOW_STATE.NOT_STARTED
            ? "Challenge has not started yet."
            : "Time is up! The battle has ended.",
        windowState: win.state,
        serverTime: win.now.toISOString(),
        msUntilStart: Math.max(0, win.msUntilStart || 0),
      });
    }

    const lang = language || "java";
    if (!isValidLanguage(lang)) {
      return res.status(400).json({
        error: "Only Java is supported in battle rooms.",
      });
    }

    const roomLangs = room.languages || ["all"];
    if (!roomLangs.includes("all") && !roomLangs.includes(lang)) {
      return res
        .status(400)
        .json({ error: `Language "${lang}" is not allowed for this battle.` });
    }

    // Read-only snapshot of the submission for validation + position lookup.
    const submission = await BattleRoomSubmission.findOne(
      { roomId: room._id, userId },
      {
        status: 1,
        totalScore: 1,
        totalPassed: 1,
        totalFailed: 1,
        totalQuestions: 1,
        startTime: 1,
        questionResults: 1,
        codingBehavior: 1,
      },
    ).lean();
    if (!submission) {
      return res
        .status(400)
        .json({ error: "You haven't joined this battle yet." });
    }
    if (submission.status === "COMPLETED") {
      return res.status(400).json({
        error:
          "You have already completed this battle and cannot attempt again.",
      });
    }
    if (submission.status === "DISQUALIFIED") {
      return res
        .status(400)
        .json({ error: "You have been disqualified. Your score is 0." });
    }

    const question = room.questions.find(
      (q) => q._id.toString() === questionId,
    );
    if (!question) {
      return res
        .status(404)
        .json({ error: "Question not found in this room." });
    }

    const qrIndex = submission.questionResults.findIndex(
      (qr) => qr.questionId.toString() === questionId,
    );
    if (qrIndex === -1) {
      return res
        .status(400)
        .json({ error: "Question not found in your submission." });
    }

    const timeToSolve = Math.floor((new Date() - submission.startTime) / 1000);

    const allTestCases = [
      ...question.visibleTestCases.map((tc) => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
      })),
      ...question.hiddenTestCases.map((tc) => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
      })),
    ];

    // Stateless execution (no DB writes during the engine call).
    let executionResult;
    if (question.signature && question.signature.name) {
      executionResult = await executeComposedQuestion(
        question,
        code,
        lang,
        allTestCases,
      );
    } else {
      executionResult = await executionService.execute(
        code,
        allTestCases,
        lang,
        {
          timeLimit: 5000,
          memoryLimit: 131072,
        },
      );
    }

    const visibleCount = question.visibleTestCases.length;
    const hiddenCount = question.hiddenTestCases.length;
    const totalCount = visibleCount + hiddenCount;

    const passedCount = executionResult.results.filter(
      (r) => r.status === "PASSED",
    ).length;
    const failedCount = totalCount - passedCount;

    // Score is based on visible test cases passing — full visible pass = full
    // question points. Hidden test cases still count toward the breakdown.
    const visiblePassed = executionResult.results
      .slice(0, visibleCount)
      .filter((r) => r.status === "PASSED").length;
    const questionScore = question.points * (visiblePassed / visibleCount);

    // Keep the submitted source with the result so the room owner can audit
    // the complete battle record after the battle.
    const qr = {
      questionId: question._id,
      questionTitle: question.title,
      code,
      language: lang,
      status: executionResult.accepted ? "ACCEPTED" : "REJECTED",
      score: Math.round(questionScore * 100) / 100,
      passed: passedCount,
      failed: failedCount,
      total: totalCount,
      executionTime: executionResult.executionTime || 0,
      memoryUsed: executionResult.memoryUsed || 0,
      timeToSolve,
      output: executionResult.output || "",
      error: executionResult.error || "",
      results: executionResult.results.map((r, idx) => ({
        testCase: idx + 1,
        status: r.status,
        executionTime: r.executionTime || 0,
        memoryUsed: r.memoryUsed || 0,
        output: r.output || "",
        expectedOutput: idx < visibleCount ? r.expectedOutput : "",
        isHidden: idx >= visibleCount,
      })),
    };

    const hiddenResults = executionResult.results.slice(visibleCount);
    const hiddenPassed = hiddenResults.filter(
      (r) => r.status === "PASSED",
    ).length;
    const hiddenFailed = hiddenResults.length - hiddenPassed;

    // Recompute totals from the snapshot (fresh lean doc) + this question.
    const qrResults = [...submission.questionResults];
    qrResults[qrIndex] = qr;
    const newTotalScore = qrResults.reduce((sum, q) => sum + (q.score || 0), 0);
    const newTotalPassed = qrResults.reduce(
      (sum, q) => sum + (q.passed || 0),
      0,
    );
    const newTotalFailed = qrResults.reduce(
      (sum, q) => sum + (q.failed || 0),
      0,
    );

    const allCompleted = qrResults.every((q) => q.status !== "PENDING");

    const lines = code.split("\n").length;
    const codingBehavior = submission.codingBehavior || {};
    const totalEdits = (codingBehavior.totalEdits || 0) + 1;

    // Build the atomic update operator.
    const update = {
      $set: {
        [`questionResults.${qrIndex}`]: qr,
        totalScore: newTotalScore,
        totalPassed: newTotalPassed,
        totalFailed: newTotalFailed,
        ...(allCompleted
          ? { status: "COMPLETED", submittedAt: new Date() }
          : {}),
      },
      $inc: {
        "codingBehavior.totalLinesWritten": lines,
        "codingBehavior.totalEdits": 1,
      },
      $addToSet: {
        "codingBehavior.languagesUsed": lang,
      },
    };

    // Atomic merge.
    // If a proctoring event already set DISQUALIFIED (or the user completed),
    // this filter matches nothing and we return a clean conflict instead of
    // crashing with a VersionError.
    const result = await BattleRoomSubmission.updateOne(
      { _id: submission._id, status: { $in: ["PENDING", "PROCESSING"] } },
      update,
    );

    if (result.matchedCount === 0) {
      const current = await BattleRoomSubmission.findOne(
        { _id: submission._id },
        { status: 1, totalScore: 1 },
      ).lean();
      return res.status(409).json({
        error:
          current && current.status === "DISQUALIFIED"
            ? "You have been disqualified. Your score is 0."
            : "Your submission was modified concurrently. Refresh to see your current status.",
        status: current?.status || "CONFLICT",
        totalScore: current?.totalScore || 0,
      });
    }

    // SECURITY: never expose hidden test case inputs, expected outputs, or
    // actual outputs to the participant. Visible cases keep full detail; hidden
    // cases are reduced to pass/fail only. Top-level stdout is suppressed on
    // submit because it may contain output produced from hidden inputs. The
    // full record (including code and hidden results) remains persisted
    // server-side for the creator report.
    const safeResults = qr.results.map((r) =>
      r.isHidden
        ? {
            testCase: r.testCase,
            status: r.status,
            executionTime: r.executionTime,
            memoryUsed: r.memoryUsed,
            isHidden: true,
          }
        : r,
    );
    const visiblePassedCount = qr.results
      .slice(0, visibleCount)
      .filter((r) => r.status === "PASSED").length;

    return res.status(200).json({
      message: "Solution submitted!",
      questionResult: {
        questionId: qr.questionId,
        questionTitle: qr.questionTitle,
        language: qr.language,
        status: qr.status,
        score: qr.score,
        passed: qr.passed,
        failed: qr.failed,
        total: qr.total,
        executionTime: qr.executionTime,
        memoryUsed: qr.memoryUsed,
        timeToSolve: qr.timeToSolve,
        // Compiler/runtime diagnostics are the participant's own code output
        // and are safe (and necessary) to surface.
        output: "",
        error: qr.error || "",
        visiblePassed: visiblePassedCount,
        visibleFailed: visibleCount - visiblePassedCount,
        hiddenCount,
        hiddenPassed,
        hiddenFailed,
        results: safeResults,
      },
      status: qr.status,
      score: qr.score,
      passed: qr.passed,
      failed: qr.failed,
      total: qr.total,
      executionTime: qr.executionTime,
      memoryUsed: qr.memoryUsed,
      hiddenPassed,
      hiddenFailed,
      totalScore: newTotalScore,
      totalPassed: newTotalPassed,
      totalFailed: newTotalFailed,
      submissionStatus: allCompleted ? "COMPLETED" : submission.status,
      allCompleted,
    });
  } catch (error) {
    const message =
      error?.message ||
      "Secure Code Engine is currently unavailable. Please try again in a few moments.";
    console.error("Submit question solution error:", message);
    return res.status(502).json({ error: message });
  }
}

/**
 * ATOMIC DISQUALIFY
 * POST /api/battle-rooms/:roomCode/disqualify
 * - Uses updateOne with $set (no .save(), no version check).
 * - Idempotent: re-disqualifying an already disqual/completed submission is a no-op.
 * - Merges cleanly with a concurrently running submit (submit's filter will not
 *   overwrite a DISQUALIFIED status).
 */
export async function disqualifyRoomSubmission(req, res) {
  try {
    const { roomCode } = req.params;
    const { reason, code, language } = req.body;
    const userId = req.userId;

    const room = await BattleRoom.findOne(
      { roomCode: roomCode.toUpperCase(), isActive: true, isDeleted: false },
      { roomCode: 1, status: 1, questions: 1, moderationAction: 1 },
    ).lean();
    if (!room) {
      return res.status(404).json({ error: "Battle room not found." });
    }

    if (room.status !== "ACTIVE") {
      return res.status(400).json({ error: "Battle is not active." });
    }

    // Ensure a submission exists for the user (idempotent join-like upsert).
    let submission = await BattleRoomSubmission.findOne({
      roomId: room._id,
      userId,
    }).lean();
    if (!submission) {
      const created = new BattleRoomSubmission({
        roomId: room._id,
        userId,
        questionResults: room.questions.map((q) => ({
          questionId: q._id,
          questionTitle: q.title,
          status: "PENDING",
          score: 0,
          passed: 0,
          failed: 0,
          total: q.visibleTestCases.length + q.hiddenTestCases.length,
        })),
        totalQuestions: room.questions.length,
        status: "PENDING",
        startTime: new Date(),
      });
      await created.save();
      submission = created.toObject();
      await BattleRoom.updateOne(
        { _id: room._id },
        { $inc: { participantCount: 1 } },
      );
    }

    if (
      submission.status === "DISQUALIFIED" ||
      submission.status === "COMPLETED"
    ) {
      return res.status(200).json({
        message: "Submission already finalized.",
        status: submission.status,
        totalScore: submission.totalScore || 0,
      });
    }

    if (room.moderationAction === "FLAG") {
      const flag = {
        reason: reason || "Owner-configured review flag",
        code: code || "",
        language: language || "",
        createdAt: new Date(),
      };
      await BattleRoomSubmission.updateOne(
        { _id: submission._id },
        { $push: { moderationFlags: flag } },
      );
      return res.status(200).json({
        message: "Activity flagged for owner review. Submission was preserved.",
        status: submission.status,
        flagged: true,
      });
    }

    // Recompute questionResults for the atomic update (PENDING -> REJECTED, score 0).
    const questionResults = (submission.questionResults || []).map((qr) => ({
      ...qr,
      status: qr.status === "PENDING" ? "REJECTED" : qr.status,
      score: 0,
      results: [],
    }));

    const now = new Date();
    await BattleRoomSubmission.updateOne(
      { _id: submission._id, status: { $in: ["PENDING", "PROCESSING"] } },
      {
        $set: {
          status: "DISQUALIFIED",
          submittedAt: now,
          totalScore: 0,
          totalPassed: 0,
          totalFailed: 0,
          disqualifyReason: reason || "Proctoring violation detected",
          questionResults,
          "codingBehavior.completedEarly": false,
        },
      },
    );

    return res.status(200).json({
      message: "Submission disqualified. Score set to 0.",
      status: "DISQUALIFIED",
      totalScore: 0,
    });
  } catch (error) {
    console.error("Disqualify room submission error:", error.message);
    return res.status(500).json({ error: "Failed to disqualify submission." });
  }
}

/**
 * END TEST
 * POST /api/battle-rooms/:roomCode/end-test
 * - Finalizes the user's submission (marks COMPLETED if not already final),
 *   recomputes the total score, and returns the final result.
 * - Safe to call multiple times (idempotent).
 */
export async function endTest(req, res) {
  try {
    const { roomCode } = req.params;
    const userId = req.userId;

    const room = await BattleRoom.findOne(
      { roomCode: roomCode.toUpperCase(), isActive: true, isDeleted: false },
      { roomCode: 1, status: 1, endTime: 1, questions: 1 },
    ).lean();
    if (!room) {
      return res.status(404).json({ error: "Battle room not found." });
    }

    const submission = await BattleRoomSubmission.findOne({
      roomId: room._id,
      userId,
    }).lean();
    if (!submission) {
      return res
        .status(400)
        .json({ error: "You haven't joined this battle yet." });
    }

    if (
      submission.status === "COMPLETED" ||
      submission.status === "DISQUALIFIED"
    ) {
      return res.status(200).json({
        message: "Test already finalized.",
        status: submission.status,
        totalScore: submission.totalScore || 0,
        totalPassed: submission.totalPassed || 0,
        totalFailed: submission.totalFailed || 0,
      });
    }

    // Recompute totals from the current questionResults.
    const qrResults = submission.questionResults || [];
    const newTotalScore = qrResults.reduce((sum, q) => sum + (q.score || 0), 0);
    const newTotalPassed = qrResults.reduce(
      (sum, q) => sum + (q.passed || 0),
      0,
    );
    const newTotalFailed = qrResults.reduce(
      (sum, q) => sum + (q.failed || 0),
      0,
    );

    const totalTime = Math.max(
      1,
      Math.floor((new Date() - submission.startTime) / 1000),
    );
    const totalEdits = submission.codingBehavior?.totalEdits || 0;

    await BattleRoomSubmission.updateOne(
      { _id: submission._id, status: { $in: ["PENDING", "PROCESSING"] } },
      {
        $set: {
          status: "COMPLETED",
          submittedAt: new Date(),
          totalScore: newTotalScore,
          totalPassed: newTotalPassed,
          totalFailed: newTotalFailed,
          "codingBehavior.timePerQuestion":
            submission.totalQuestions > 0
              ? totalTime / submission.totalQuestions
              : 0,
          "codingBehavior.editFrequency": totalEdits / (totalTime / 60),
          "codingBehavior.completedEarly": !!(
            room.endTime && new Date() < room.endTime
          ),
        },
      },
    );

    return res.status(200).json({
      message: "Test ended. Your score has been finalized.",
      status: "COMPLETED",
      totalScore: newTotalScore,
      totalPassed: newTotalPassed,
      totalFailed: newTotalFailed,
    });
  } catch (error) {
    console.error("End test error:", error.message);
    return res.status(500).json({ error: "Failed to end the test." });
  }
}

export async function getRoomLeaderboard(req, res) {
  try {
    const { roomCode } = req.params;
    const userId = req.userId;

    const room = await BattleRoom.findOne({
      roomCode: roomCode.toUpperCase(),
      isActive: true,
      isDeleted: false,
    });
    if (!room) {
      return res.status(404).json({ error: "Battle room not found." });
    }

    const isCreator = room.createdBy.toString() === userId.toString();
    if (room.status === "CLOSED" && !isCreator) {
      return res.status(403).json({
        error: "This battle has ended and only the creator can view it.",
      });
    }

    const submissions = await BattleRoomSubmission.find({
      roomId: room._id,
      status: { $in: ["PENDING", "PROCESSING", "COMPLETED", "DISQUALIFIED"] },
    })
      .populate("userId", "name email organization")
      .lean();

    submissions.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.totalPassed !== a.totalPassed) return b.totalPassed - a.totalPassed;
      if (a.totalFailed !== b.totalFailed) return a.totalFailed - b.totalFailed;
      const aTime = a.questionResults.reduce(
        (s, q) => s + (q.timeToSolve || 0),
        0,
      );
      const bTime = b.questionResults.reduce(
        (s, q) => s + (q.timeToSolve || 0),
        0,
      );
      return aTime - bTime;
    });

    const leaderboard = submissions.map((sub, index) => {
      const totalTime = sub.questionResults.reduce(
        (s, q) => s + (q.timeToSolve || 0),
        0,
      );
      const isCurrentUser = sub.userId?._id?.toString() === userId.toString();
      // Privacy: emails and moderation internals are only visible to the room
      // creator, or to the participant themselves. Other participants only see
      // public ranking data.
      const canSeePrivate = isCreator || isCurrentUser;
      return {
        rank: index + 1,
        userId: canSeePrivate ? sub.userId?._id : undefined,
        name: sub.participantName || sub.userId?.name || "Unknown",
        email: canSeePrivate ? sub.userId?.email || "" : undefined,
        organization:
          sub.participantOrganization || sub.userId?.organization || "Unknown",
        totalScore: sub.totalScore,
        totalPassed: sub.totalPassed,
        totalFailed: sub.totalFailed,
        totalQuestions: sub.totalQuestions,
        status: sub.status,
        submittedAt: sub.submittedAt,
        timeToSolve: totalTime,
        disqualifyReason: canSeePrivate
          ? sub.disqualifyReason || null
          : undefined,
        moderationFlags: canSeePrivate ? sub.moderationFlags || [] : undefined,
        flagCount: canSeePrivate
          ? (sub.moderationFlags || []).length
          : undefined,
        completedEarly: sub.codingBehavior?.completedEarly || false,
        isCurrentUser,
      };
    });

    return res.status(200).json({
      room: room.toLeaderboardJSON(),
      leaderboard,
      isCreator,
      isActive: room.status === "ACTIVE",
      hasEnded: room.status === "CLOSED",
    });
  } catch (error) {
    console.error("Get battle room leaderboard error:", error.message);
    return res.status(500).json({ error: "Failed to get leaderboard." });
  }
}

export async function getUserResult(req, res) {
  try {
    const { roomCode } = req.params;
    const userId = req.userId;

    const room = await BattleRoom.findOne({
      roomCode: roomCode.toUpperCase(),
      isActive: true,
      isDeleted: false,
    });
    if (!room) {
      return res.status(404).json({ error: "Battle room not found." });
    }

    const isCreator = room.createdBy.toString() === userId.toString();
    if (room.status === "CLOSED" && !isCreator) {
      return res.status(403).json({
        error: "This battle has ended and only the creator can view it.",
      });
    }

    const submission = await BattleRoomSubmission.findOne({
      roomId: room._id,
      userId,
    }).populate("userId", "name email organization");
    if (!submission) {
      return res
        .status(404)
        .json({ error: "No submission found for you in this room." });
    }

    const allSubmissions = await BattleRoomSubmission.find({
      roomId: room._id,
      status: { $in: ["COMPLETED", "DISQUALIFIED"] },
    }).lean();

    allSubmissions.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.totalPassed !== a.totalPassed) return b.totalPassed - a.totalPassed;
      if (a.totalFailed !== b.totalFailed) return a.totalFailed - b.totalFailed;
      const aTime = a.questionResults.reduce(
        (s, q) => s + (q.timeToSolve || 0),
        0,
      );
      const bTime = b.questionResults.reduce(
        (s, q) => s + (q.timeToSolve || 0),
        0,
      );
      return aTime - bTime;
    });

    const rank =
      allSubmissions.findIndex(
        (s) => s.userId.toString() === userId.toString(),
      ) + 1;

    return res.status(200).json({
      room: {
        title: room.title,
        roomCode: room.roomCode,
        status: room.status,
        startTime: room.startTime,
        endTime: room.endTime,
        timeLimit: room.timeLimit,
        timeLimitUnit: room.timeLimitUnit,
        questionCount: room.questions.length,
      },
      submission: submission.toPublicJSON(),
      rank,
      totalParticipants: allSubmissions.length,
    });
  } catch (error) {
    console.error("Get user result error:", error.message);
    return res.status(500).json({ error: "Failed to get user result." });
  }
}

export async function closeRoom(req, res) {
  try {
    const { roomCode } = req.params;
    const userId = req.userId;

    const room = await BattleRoom.findOne({
      roomCode: roomCode.toUpperCase(),
      isActive: true,
      isDeleted: false,
    });
    if (!room) {
      return res.status(404).json({ error: "Battle room not found." });
    }

    if (room.createdBy.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ error: "Only the room creator can close the battle." });
    }

    if (room.status === "CLOSED") {
      return res.status(400).json({ error: "Battle room is already closed." });
    }

    const pendingSubmissions = await BattleRoomSubmission.find({
      roomId: room._id,
      status: "PENDING",
    }).lean();

    for (const sub of pendingSubmissions) {
      const totalTime = Math.max(
        1,
        Math.floor((new Date() - sub.startTime) / 1000),
      );
      await BattleRoomSubmission.updateOne(
        { _id: sub._id, status: "PENDING" },
        {
          $set: {
            status: "COMPLETED",
            submittedAt: new Date(),
            "codingBehavior.timePerQuestion":
              sub.totalQuestions > 0 ? totalTime / sub.totalQuestions : 0,
            "codingBehavior.editFrequency":
              (sub.codingBehavior?.totalEdits || 0) > 0
                ? (sub.codingBehavior.totalEdits || 0) / (totalTime / 60)
                : 0,
            "codingBehavior.completedEarly": false,
          },
        },
      );
    }

    room.status = "CLOSED";
    await room.save();

    const allSubmissions = await BattleRoomSubmission.find({
      roomId: room._id,
      status: "COMPLETED",
    })
      .populate("userId", "name email")
      .lean();

    allSubmissions.sort((a, b) => b.totalScore - a.totalScore);
    const totalParticipants = allSubmissions.length;

    for (let i = 0; i < allSubmissions.length; i++) {
      const sub = allSubmissions[i];
      const user = sub.userId;
      if (user && user.email) {
        sendBattleRoomResultEmail({
          email: user.email,
          userName: user.name,
          roomTitle: room.title,
          totalScore: sub.totalScore,
          totalPassed: sub.totalPassed,
          totalQuestions: sub.totalQuestions,
          codingBehavior: sub.codingBehavior,
          rank: i + 1,
          totalParticipants,
          roomCode: room.roomCode,
        }).catch((err) => {
          console.error(`Failed to send email to ${user.email}:`, err.message);
        });
      }
    }

    return res.status(200).json({
      message:
        "Battle room closed! Results have been sent to all participants via email.",
      totalParticipants,
      emailsSent: allSubmissions.length,
    });
  } catch (error) {
    console.error("Close battle room error:", error.message);
    return res.status(500).json({ error: "Failed to close battle room." });
  }
}

export async function getLeaderboardByRoomCodePublic(req, res) {
  try {
    const { roomCode } = req.params;

    const room = await BattleRoom.findOne({
      roomCode: roomCode.toUpperCase(),
      isActive: true,
      isDeleted: false,
    });
    if (!room) {
      return res.status(404).json({ error: "Battle room not found." });
    }

    if (room.status === "CLOSED") {
      return res.status(403).json({
        error:
          "This battle has ended and the leaderboard is only available to the creator.",
      });
    }

    const submissions = await BattleRoomSubmission.find({
      roomId: room._id,
      status: { $in: ["COMPLETED", "DISQUALIFIED"] },
    })
      .populate("userId", "name organization")
      .lean();

    submissions.sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.totalPassed !== a.totalPassed) return b.totalPassed - a.totalPassed;
      if (a.totalFailed !== b.totalFailed) return a.totalFailed - b.totalFailed;
      const aTime = a.questionResults.reduce(
        (s, q) => s + (q.timeToSolve || 0),
        0,
      );
      const bTime = b.questionResults.reduce(
        (s, q) => s + (q.timeToSolve || 0),
        0,
      );
      return aTime - bTime;
    });

    const leaderboard = submissions.map((sub, index) => ({
      rank: index + 1,
      name: sub.userId?.name || "Unknown",
      organization: sub.userId?.organization || "Unknown",
      totalScore: sub.totalScore,
      totalPassed: sub.totalPassed,
      totalFailed: sub.totalFailed,
      totalQuestions: sub.totalQuestions,
      status: sub.status,
      submittedAt: sub.submittedAt,
      timeToSolve: sub.questionResults.reduce(
        (s, q) => s + (q.timeToSolve || 0),
        0,
      ),
    }));

    return res.status(200).json({
      room: room.toLeaderboardJSON(),
      leaderboard,
      isActive: room.status === "ACTIVE",
      hasEnded: room.status === "CLOSED",
    });
  } catch (error) {
    console.error("Get public leaderboard error:", error.message);
    return res.status(500).json({ error: "Failed to get leaderboard." });
  }
}

export async function getMyRooms(req, res) {
  try {
    const userId = req.userId;

    const rooms = await BattleRoom.find({
      createdBy: userId,
      isActive: true,
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const roomsWithStats = await Promise.all(
      rooms.map(async (room) => {
        const participantCount = await BattleRoomSubmission.countDocuments({
          roomId: room._id,
        });
        return {
          ...room,
          participantCount: participantCount || room.participantCount,
        };
      }),
    );

    return res.status(200).json({
      rooms: roomsWithStats.map((r) => ({
        id: r._id,
        roomCode: r.roomCode,
        title: r.title,
        status: r.status,
        timeLimit: r.timeLimit,
        timeLimitUnit: r.timeLimitUnit,
        questionCount: r.questions?.length || 0,
        participantCount: r.participantCount,
        startTime: r.startTime,
        endTime: r.endTime,
        expiresAt: r.expiresAt,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    console.error("Get my rooms error:", error.message);
    return res.status(500).json({ error: "Failed to get your rooms." });
  }
}

export async function getJoinedRooms(req, res) {
  try {
    const userId = req.userId;

    const submissions = await BattleRoomSubmission.find({ userId })
      .populate(
        "roomId",
        "title roomCode status timeLimit timeLimitUnit startTime endTime",
      )
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const rooms = submissions
      .filter((s) => s.roomId && !s.roomId.isDeleted)
      .map((s) => ({
        id: s.roomId._id,
        roomCode: s.roomId.roomCode,
        title: s.roomId.title,
        status: s.roomId.status,
        timeLimit: s.roomId.timeLimit,
        timeLimitUnit: s.roomId.timeLimitUnit,
        startTime: s.roomId.startTime,
        endTime: s.roomId.endTime,
        totalScore: s.totalScore,
        totalPassed: s.totalPassed,
        totalQuestions: s.totalQuestions,
        submissionStatus: s.status,
        submittedAt: s.submittedAt,
      }));

    return res.status(200).json({ rooms });
  } catch (error) {
    console.error("Get joined rooms error:", error.message);
    return res.status(500).json({ error: "Failed to get joined rooms." });
  }
}

export async function deleteRoom(req, res) {
  try {
    return res
      .status(403)
      .json({ error: "Battle rooms are permanent and cannot be deleted." });
    const { roomCode } = req.params;
    const userId = req.userId;

    const room = await BattleRoom.findOne({
      roomCode: roomCode.toUpperCase(),
      isActive: true,
      isDeleted: false,
    });
    if (!room) {
      return res
        .status(404)
        .json({ error: "Battle room not found or already deleted." });
    }

    if (room.createdBy.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ error: "Only the room creator can delete this battle room." });
    }

    room.isDeleted = true;
    room.deletedAt = new Date();
    await room.save();

    return res.status(200).json({
      message: "Battle room deleted successfully.",
      roomCode: room.roomCode,
    });
  } catch (error) {
    console.error("Delete battle room error:", error.message);
    return res.status(500).json({ error: "Failed to delete battle room." });
  }
}

export async function shareKey(req, res) {
  try {
    const { roomCode } = req.params;
    const userId = req.userId;

    const room = await BattleRoom.findOne({
      roomCode: roomCode.toUpperCase(),
      isActive: true,
      isDeleted: false,
    });
    if (!room) {
      return res.status(404).json({ error: "Battle room not found." });
    }

    if (room.createdBy.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ error: "Only the room creator can share the key." });
    }

    return res.status(200).json({
      message: "Room key retrieved.",
      roomKey: room.roomCode,
      room: room.toCreatorJSON(),
    });
  } catch (error) {
    console.error("Share key error:", error.message);
    return res.status(500).json({ error: "Failed to get room key." });
  }
}

/**
 * GET /api/battle-rooms/:roomCode/report
 * Creator-only structured JSON report. Authorization (room ownership) is
 * enforced inside reportService.getRoomReportData to prevent IDOR.
 */
export async function getRoomReport(req, res) {
  try {
    const data = await getRoomReportData(req.params.roomCode, req.userId);
    return res.status(200).json(data);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error("Get room report error:", error.message);
    return res
      .status(status)
      .json({ error: error.message || "Failed to generate room report." });
  }
}

/**
 * GET /api/battle-rooms/:roomCode/report/pdf
 * Creator-only complete room report PDF, streamed to avoid blocking.
 */
export async function downloadRoomReportPDF(req, res) {
  try {
    await streamCompleteRoomPDF(req.params.roomCode, req.userId, res);
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error("Room report PDF error:", error.message);
    if (res.headersSent) return res.end();
    return res
      .status(status)
      .json({ error: error.message || "Failed to generate room report." });
  }
}

/**
 * GET /api/battle-rooms/:roomCode/report/participant/:participantId/pdf
 * Creator-only individual participant report PDF, streamed.
 */
export async function downloadParticipantReportPDF(req, res) {
  try {
    await streamParticipantReportPDF(
      req.params.roomCode,
      req.params.participantId,
      req.userId,
      res,
    );
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500)
      console.error("Participant report PDF error:", error.message);
    if (res.headersSent) return res.end();
    return res.status(status).json({
      error: error.message || "Failed to generate participant report.",
    });
  }
}
