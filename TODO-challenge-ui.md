# Battle Room Challenge UI Refactor - TODO

## Goals

- Fullscreen challenge (hide Navbar & Footer)
- LeetCode-style expandable question details (examples shown below description)
- Hide Share Key & Leaderboard during challenge
- Fix Console expandability (fixed bottom, expandable)
- Submit → execute → score → end test flow
- Remove unwanted UI

## Status

- [x] Backend: `endTest` endpoint in battleRoomController.js
- [x] Backend: `/end` route in battleRoomRoutes.js
- [x] Frontend: `endTest` service in battleRoomService.js
- [x] AppRouter: fullscreen layout for battle-room challenge routes
- [x] BattleRoomChallenge: LeetCode-style expandable question list (accordion)
- [x] BattleRoomChallenge: hide Share Key & Leaderboard during challenge
- [x] Console: proper fixed-bottom expandable console (controlled height)
- [x] BattleRoomChallenge: submit → score → End Test flow
- [x] Challenge.jsx: fix 100vh height (fullscreen) + controlled console expandability
- [x] Challenge.jsx: show challenge description/details (description, examples, constraints) before Start Assessment, then start
- [x] Build verification (frontend `vite build` passed; backend `node --check` passed)
- [x] Fix 429 rate limiting (skip OPTIONS preflight; raise auth=100, submissions=30, general=300)
- [x] Fix GET /api/challenges/today 404 (route exists; requires backend restart to pick up)
- [x] Fix admin "can't create" (rate limiter was blocking POST /api/challenges; now relaxed)
- [ ] Restart backend server to load rate-limit & route changes
