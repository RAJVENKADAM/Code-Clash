import Nonce from "../models/Nonce.js";

/**
 * Middleware to validate and consume a nonce for replay protection.
 * The client must send a unique nonce per request.
 * Once consumed, the same nonce cannot be used again.
 */
export async function validateNonce(req, res, next) {
  try {
    const nonceValue = req.headers["x-nonce"];
    const action = req.headers["x-nonce-action"];

    if (!nonceValue || !action) {
      return res.status(400).json({
        error: "Missing anti-replay headers. Include X-Nonce and X-Nonce-Action.",
        code: "MISSING_NONCE",
      });
    }

    // Nonce must be a hex string (64 chars from 32 random bytes)
    if (!/^[a-f0-9]{64}$/.test(nonceValue)) {
      return res.status(400).json({
        error: "Invalid nonce format.",
        code: "INVALID_NONCE",
      });
    }

    const allowedActions = [
      "SUBMIT",
      "RUN",
      "CONTEST_START",
      "CONTEST_END",
      "ANALYTICS_FLUSH",
    ];

    if (!allowedActions.includes(action)) {
      return res.status(400).json({
        error: "Invalid nonce action.",
        code: "INVALID_NONCE_ACTION",
      });
    }

    const userId = req.userId;
    const resourceId = req.body?.challengeId || req.params?.challengeId || "";

    const isValid = await Nonce.validateAndConsume(userId, nonceValue, action, resourceId);

    if (!isValid) {
      return res.status(429).json({
        error: "Duplicate request detected. This nonce has already been used.",
        code: "REPLAY_DETECTED",
      });
    }

    next();
  } catch (error) {
    console.error("[Nonce] Validation error:", error.message);
    return res.status(500).json({ error: "Failed to validate request nonce." });
  }
}

/**
 * Generate a nonce for the client to use.
 */
export async function generateNonce(req, res) {
  try {
    const userId = req.userId;
    const action = req.query.action || "SUBMIT";

    const nonce = await Nonce.generate(userId, action);
    return res.status(200).json({ nonce });
  } catch (error) {
    console.error("[Nonce] Generation error:", error.message);
    return res.status(500).json({ error: "Failed to generate nonce." });
  }
}
