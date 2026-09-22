import Challenge from "../models/Challenge.js";

// Contest window: 6:00 PM today to 6:00 PM next day
function getContestWindow() {
  const now = new Date();
  const today6PM = new Date(now);
  today6PM.setHours(18, 0, 0, 0);

  const tomorrow6PM = new Date(today6PM);
  tomorrow6PM.setDate(tomorrow6PM.getDate() + 1);

  // If current time is before today 6PM, window is yesterday 6PM to today 6PM
  if (now < today6PM) {
    const yesterday6PM = new Date(today6PM);
    yesterday6PM.setDate(yesterday6PM.getDate() - 1);
    return { start: yesterday6PM, end: today6PM };
  }

  return { start: today6PM, end: tomorrow6PM };
}

export async function validateContestWindow(req, res, next) {
  try {
    const { challengeId } = req.body;
    if (!challengeId) {
      return res.status(400).json({ error: "Challenge ID is required." });
    }

    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found." });
    }

    const { start, end } = getContestWindow();
    const challengeDate = new Date(challenge.activeDate);

    // Validate that the challenge is active and within the contest window
    const now = new Date();
    if (now < start || now > end) {
      return res.status(403).json({
        error: "Submission window is closed. Challenges are available from 6:00 PM to 6:00 PM next day.",
        code: "CONTEST_CLOSED",
      });
    }

    // Validate challenge is active
    if (!challenge.isActive) {
      return res.status(403).json({
        error: "This challenge is no longer active.",
        code: "CHALLENGE_INACTIVE",
      });
    }

    req.contestChallenge = challenge;
    next();
  } catch (error) {
    console.error("[Contest] Validation error:", error.message);
    return res.status(500).json({ error: "Failed to validate contest window." });
  }
}

export function getContestEndTime() {
  const { end } = getContestWindow();
  return end;
}

export function isContestActive() {
  const { start, end } = getContestWindow();
  const now = new Date();
  return now >= start && now <= end;
}
