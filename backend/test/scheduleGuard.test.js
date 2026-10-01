import assert from "node:assert/strict";
import test from "node:test";
import {
  getRoomWindowState,
  ROOM_WINDOW_STATE,
} from "../src/services/scheduleGuard.js";

test("scheduled room boundaries use a start-inclusive, end-exclusive window", () => {
  const startTime = new Date("2026-01-15T15:00:00.000Z");
  const endTime = new Date("2026-01-15T16:00:00.000Z");
  const room = { startTime, endTime, status: "UPCOMING" };

  assert.equal(
    getRoomWindowState(room, new Date(startTime.getTime() - 1)).state,
    ROOM_WINDOW_STATE.NOT_STARTED,
  );
  assert.equal(
    getRoomWindowState(room, startTime).state,
    ROOM_WINDOW_STATE.ACTIVE,
  );
  assert.equal(
    getRoomWindowState(room, new Date(endTime.getTime() - 1)).state,
    ROOM_WINDOW_STATE.ACTIVE,
  );
  assert.equal(
    getRoomWindowState(room, endTime).state,
    ROOM_WINDOW_STATE.ENDED,
  );
});

test("unscheduled and deleted rooms are not active", () => {
  assert.equal(
    getRoomWindowState({}).state,
    ROOM_WINDOW_STATE.UNSCHEDULED,
  );
  assert.equal(
    getRoomWindowState({ isDeleted: true }).state,
    ROOM_WINDOW_STATE.CLOSED,
  );
});

test("room schedule countdowns are calculated from the supplied server time", () => {
  const now = new Date("2026-01-15T15:00:00.000Z");
  const startTime = new Date("2026-01-15T15:05:00.000Z");
  const state = getRoomWindowState(
    { startTime, endTime: new Date("2026-01-15T16:00:00.000Z") },
    now,
  );

  assert.equal(state.msUntilStart, 5 * 60 * 1000);
  assert.equal(state.msUntilEnd, 60 * 60 * 1000);
});
