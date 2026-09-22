import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { verifyAccessToken } from "../services/tokenService.js";
import config from "../config/env.js";

const JWT_SECRET = config.JWT_SECRET || "challenge-platform-jwt-secret-change-in-production";

export async function authenticate(req, res, next) {
  try {
    // Battle rooms are intentionally open: the browser supplies a stable,
    // non-secret guest id so submissions can still be attributed to a
    // participant and room ownership can be enforced.
    const guestId = req.headers["x-guest-id"];
    if (guestId && /^[a-f0-9-]{16,64}$/i.test(guestId)) {
      const email = `guest-${guestId.toLowerCase()}@guest.codeclash.local`;
      let guest = await User.findOne({ email });
      if (!guest) {
        guest = await User.create({
          email,
          name: req.headers["x-guest-name"] || "Guest participant",
          role: "USER",
          isVerified: true,
        });
      }
      req.user = guest;
      req.userId = guest._id;
      req.tokenPayload = { guest: true, guestId };
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Access denied. No token provided.", code: "NO_TOKEN" });
    }

    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (error) {
      if (error.message === "Access token expired") {
        return res.status(401).json({ error: "Token expired.", code: "TOKEN_EXPIRED" });
      }
      return res.status(401).json({ error: "Invalid token.", code: "INVALID_TOKEN" });
    }

    const user = await User.findById(decoded.userId);
if (!user) {
  return res.status(401).json({ error: "User not found.", code: "USER_NOT_FOUND" });
}

if (!user.isVerified) {
  return res.status(403).json({ error: "Account not verified.", code: "NOT_VERIFIED" });
}


    req.user = user;
    req.userId = user._id;
    req.tokenPayload = decoded;
    next();
  } catch (error) {
    return res.status(500).json({ error: "Authentication failed." });
  }
}

export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = verifyAccessToken(token);
    User.findById(decoded.userId)
      .then((user) => {
        if (user) {
          req.user = user;
          req.userId = user._id;
          req.tokenPayload = decoded;
        }
        next();
      })
      .catch(() => next());
  } catch {
    next();
  }
}

export function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "24h" });
}

export function generateOTPToken(userId) {
  return jwt.sign({ userId, purpose: "otp" }, JWT_SECRET, { expiresIn: "10m" });
}

export function verifyApiKey(req, res, next) {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      message: "API Key is required.",
    });
  }

  if (apiKey !== process.env.API_KEY) {
    return res.status(403).json({
      success: false,
      message: "Invalid API Key.",
    });
  }

  next();
}
