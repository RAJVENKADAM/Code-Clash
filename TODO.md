# Battle Room Challenge UI Fixes

## Goals

1. Hide navbar & footer during the challenge (full-screen layout).
2. Show examples below the description; only expand full details (description, constraints, examples, test cases) when the question is touched (LeetCode-style list).
3. Hide Share Key & Leaderboard while in an active challenge.
4. Make the console properly expandable from the bottom (fixed at bottom, resize upward).
5. On submit, actually execute code, compute a score, then end the test.
6. Remove unwanted UI and handle functions like LeetCode.

## Status

- [ ] Add `endTest` to battleRoomService.js
- [ ] Add `endTest` handler to battleRoomController.js
- [ ] Add `POST /:roomCode/end-test` route
- [ ] Route battle room challenge through full-screen (no navbar/footer) layout
- [ ] Wire up submit to execute, score, and end test in BattleRoomChallenge.jsx
- [ ] Ensure question list expands details only when touched (LeetCode-style)
- [ ] Verify frontend build + backend syntax
