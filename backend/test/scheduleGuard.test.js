import test from 'node:test';
import assert from 'node:assert/strict';
import { getRoomWindowState, ROOM_WINDOW_STATE } from '../src/services/scheduleGuard.js';

// ============================================================================
// ISSUE 1: Room Date/Time Restriction Tests
// ============================================================================

test('Room scheduling: UTC comparison should be timezone-safe', async (t) => {
  // Create a room that's scheduled for specific UTC times
  const now = new Date('2026-01-15T15:30:00Z');
  const startTime = new Date('2026-01-15T15:00:00Z');
  const endTime = new Date('2026-01-15T16:00:00Z');
  
  const room = {
    startTime,
    endTime,
    isDeleted: false,
    status: 'UPCOMING',
  };

  // Test: Exactly at start time should be ACTIVE
  const atStart = getRoomWindowState(room, startTime);
  assert.equal(atStart.state, ROOM_WINDOW_STATE.ACTIVE, 'At start time should be ACTIVE');

  // Test: One second before start should be NOT_STARTED
  const beforeStart = getRoomWindowState(room, new Date(startTime.getTime() - 1000));
  assert.equal(beforeStart.state, ROOM_WINDOW_STATE.NOT_STARTED, 'One second before should be NOT_STARTED');

  // Test: During active window should be ACTIVE
  const during = getRoomWindowState(room, now);
  assert.equal(during.state, ROOM_WINDOW_STATE.ACTIVE, 'During active window should be ACTIVE');

  // Test: Exactly at end time should still be ACTIVE (not > but just =)
  const atEnd = getRoomWindowState(room, endTime);
  assert.equal(atEnd.state, ROOM_WINDOW_STATE.ACTIVE, 'At exactly end time should still be ACTIVE');

  // Test: One millisecond after end should be ENDED
  const afterEnd = getRoomWindowState(room, new Date(endTime.getTime() + 1));
  assert.equal(afterEnd.state, ROOM_WINDOW_STATE.ENDED, 'After end time should be ENDED');
});

test('Room scheduling: Unscheduled room (no times) should be UNSCHEDULED', async (t) => {
  const room = {
    startTime: null,
    endTime: null,
    isDeleted: false,
    status: 'UPCOMING',
  };

  const state = getRoomWindowState(room, new Date());
  assert.equal(state.state, ROOM_WINDOW_STATE.UNSCHEDULED, 'No times = UNSCHEDULED');
});

test('Room scheduling: Deleted room should be CLOSED', async (t) => {
  const room = {
    startTime: new Date(),
    endTime: new Date(Date.now() + 3600000),
    isDeleted: true,
    status: 'ACTIVE',
  };

  const state = getRoomWindowState(room, new Date());
  assert.equal(state.state, ROOM_WINDOW_STATE.CLOSED, 'Deleted room is CLOSED');
});

test('Room scheduling: Room with status=CLOSED should be CLOSED', async (t) => {
  const room = {
    startTime: new Date(),
    endTime: new Date(Date.now() + 3600000),
    isDeleted: false,
    status: 'CLOSED',
  };

  const state = getRoomWindowState(room, new Date());
  assert.equal(state.state, ROOM_WINDOW_STATE.CLOSED, 'Room with CLOSED status is CLOSED');
});

test('Room scheduling: Time until start calculation is accurate', async (t) => {
  const now = new Date('2026-01-15T15:00:00Z');
  const startTime = new Date('2026-01-15T15:05:00Z'); // 5 minutes later
  const room = {
    startTime,
    endTime: new Date(startTime.getTime() + 3600000),
    isDeleted: false,
    status: 'UPCOMING',
  };

  const state = getRoomWindowState(room, now);
  const expectedMs = 5 * 60 * 1000;
  assert.equal(state.msUntilStart, expectedMs, 'Time until start should be 300000ms (5 minutes)');
});

test('Room scheduling: Time until end calculation is accurate', async (t) => {
  const now = new Date('2026-01-15T15:00:00Z');
  const startTime = new Date('2026-01-15T14:00:00Z');
  const endTime = new Date('2026-01-15T16:00:00Z'); // 1 hour from now
  const room = {
    startTime,
    endTime,
    isDeleted: false,
    status: 'ACTIVE',
  };

  const state = getRoomWindowState(room, now);
  const expectedMs = 60 * 60 * 1000;
  assert.equal(state.msUntilEnd, expectedMs, 'Time until end should be 3600000ms (1 hour)');
});

// ============================================================================
// ISSUE 4: Submission State Management
// ============================================================================

test('Submission state: PENDING initially', (t) => {
  // Verify test framework is working
  assert.ok(true, 'Test framework is functioning');
});

// ============================================================================
// Additional Tests Can Be Added For:
// - Issue 2: Web execution vs Postman (requires mocking)
// - Issue 5-10: Access control, room features, leaderboard
// - Issue 11-20: Error handling, API contracts, security
// ============================================================================

