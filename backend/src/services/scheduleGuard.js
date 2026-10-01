/**
 * Server-authoritative schedule enforcement for battle rooms.
 *
 * The platform must never trust the client clock or the mutable `status`
 * field to decide whether a room is open. All scheduled windows are stored as
 * UTC Date values, so comparing them against `new Date()` (also UTC epoch ms)
 * is timezone-safe and DST-safe regardless of the caller's browser timezone.
 */

export const ROOM_WINDOW_STATE = {
  UNSCHEDULED: "UNSCHEDULED",
  NOT_STARTED: "NOT_STARTED",
  ACTIVE: "ACTIVE",
  ENDED: "ENDED",
  CLOSED: "CLOSED",
};

export function hasScheduledWindow(room) {
  return Boolean(
    room?.isScheduled ||
      (room?.scheduledDate && room?.scheduledStartTime),
  );
}

export function getRoomWindowState(room, now = new Date()) {
  const start = room?.startTime ? new Date(room.startTime) : null;
  const end = room?.endTime ? new Date(room.endTime) : null;
  const nowMs = now.getTime();

  if (room?.isDeleted === true || room?.status === "CLOSED") {
    return {
      state: ROOM_WINDOW_STATE.CLOSED,
      now,
      start,
      end,
      msUntilStart: 0,
      msUntilEnd: 0,
    };
  }
  if (!start && !end) {
    return {
      state: ROOM_WINDOW_STATE.UNSCHEDULED,
      now,
      start,
      end,
      msUntilStart: 0,
      msUntilEnd: 0,
    };
  }

  const startMs = start ? start.getTime() : -Infinity;
  const endMs = end ? end.getTime() : Infinity;

  if (nowMs < startMs) {
    return {
      state: ROOM_WINDOW_STATE.NOT_STARTED,
      now,
      start,
      end,
      msUntilStart: startMs - nowMs,
      msUntilEnd: end ? endMs - nowMs : 0,
    };
  }
  if (nowMs >= endMs) {
    return {
      state: ROOM_WINDOW_STATE.ENDED,
      now,
      start,
      end,
      msUntilStart: 0,
      msUntilEnd: nowMs - endMs,
    };
  }
  return {
    state: ROOM_WINDOW_STATE.ACTIVE,
    now,
    start,
    end,
    msUntilStart: 0,
    msUntilEnd: end ? endMs - nowMs : 0,
  };
}

/** Participant may view questions/workspace only inside an active window. */
export function isRoomOpenForParticipants(room, now = new Date()) {
  const { state } = getRoomWindowState(room, now);
  return state === ROOM_WINDOW_STATE.ACTIVE;
}

/** Code execution/submission is permitted only inside an active window. */
export function isCodeExecutionAllowed(room, now = new Date()) {
  return getRoomWindowState(room, now).state === ROOM_WINDOW_STATE.ACTIVE;
}

/** Safe, non-leaking summary returned to callers who cannot access a room. */
export function buildBlockedRoomPayload(room, windowState) {
  return {
    id: room._id,
    roomCode: room.roomCode,
    title: room.title,
    description: room.description,
    status:
      windowState.state === ROOM_WINDOW_STATE.ENDED ? "CLOSED" : "UPCOMING",
    windowState: windowState.state,
    timeLimit: room.timeLimit,
    timeLimitUnit: room.timeLimitUnit,
    maxParticipants: room.maxParticipants,
    participantCount: room.participantCount,
    questionCount: room.questions?.length || 0,
    languages: ["java"],
    startTime: room.startTime,
    endTime: room.endTime,
    timezone: room.timezone || "UTC",
    scheduledDate: room.scheduledDate || "",
    scheduledStartTime: room.scheduledStartTime || "",
    scheduledEndTime: room.scheduledEndTime || "",
    createdAt: room.createdAt,
    serverTime: windowState.now.toISOString(),
    msUntilStart: Math.max(0, windowState.msUntilStart || 0),
    msUntilEnd: Math.max(0, windowState.msUntilEnd || 0),
  };
}
