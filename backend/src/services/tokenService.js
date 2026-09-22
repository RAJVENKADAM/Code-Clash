import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import Session from "../models/Session.js";
import config from "../config/env.js";

const ACCESS_TOKEN_EXPIRY = config.JWT_EXPIRY || "15m";
const REFRESH_TOKEN_EXPIRY = parseInt(
  (config.JWT_REFRESH_EXPIRY || "7d").replace("d", "") * 24 * 60 * 60 * 1000,
  10
);

export function generateAccessToken(userId, role) {
  return jwt.sign(
    { userId, role, type: "access" },
    config.JWT_SECRET,
    {
      expiresIn: ACCESS_TOKEN_EXPIRY,
      issuer: config.JWT_ISSUER,
    }
  );
}

/**
 * Issue a stateless 12-hour signed JWT binding the user's ID, email, and
 * verified organization directly inside the cryptographic payload.
 *
 * This satisfies the "stateless 12-hour signed JWT" requirement while keeping
 * the existing access/refresh token flow intact. The returned token is used as
 * the login/access token for the session.
 *
 * @param {string} userId - Mongo ObjectId of the user
 * @param {string} email - verified user email
 * @param {string} organization - verified organization name
 * @param {string} role - user role
 * @returns {string} signed JWT
 */
export function generateLoginToken(userId, email, organization, role) {
  return jwt.sign(
    {
      userId,
      email,
      organization,
      role,
      type: "login"
      // ❌ REMOVED: iss: config.JWT_ISSUER,
    },
    config.JWT_SECRET,
    {
      expiresIn: "12h",
      issuer: config.JWT_ISSUER, //  Keep this here; jsonwebtoken adds 'iss' automatically
    }
  );
}


export function generateRefreshToken() {
  return randomBytes(64).toString("hex");
}

export function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    // Accept both the short-lived access token and the 12h login token.
    if (decoded.type !== "access" && decoded.type !== "login") {
      throw new Error("Invalid token type");
    }
    return decoded;
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new Error("Access token expired");
    }
    if (error.name === "JsonWebTokenError") {
      throw new Error("Invalid access token");
    }
    throw error;
  }
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, config.JWT_REFRESH_SECRET);
}

export async function createSession(userId, deviceInfo = "", ipAddress = "", userAgent = "") {
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY);

  const session = new Session({
    userId,
    refreshToken,
    deviceInfo,
    ipAddress,
    userAgent,
    expiresAt,
  });

  await session.save();
  return session;
}

export async function rotateRefreshToken(oldRefreshToken) {
  const session = await Session.findOne({ refreshToken: oldRefreshToken, isActive: true });
  if (!session) {
    throw new Error("Invalid refresh token");
  }

  const newRefreshToken = generateRefreshToken();
  session.refreshToken = newRefreshToken;
  session.lastUsedAt = new Date();
  session.expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY);
  await session.save();

  return session;
}

export async function revokeSession(sessionId) {
  await Session.findByIdAndUpdate(sessionId, { isActive: false });
}

export async function revokeAllUserSessions(userId, excludeSessionId = null) {
  const query = { userId, isActive: true };
  if (excludeSessionId) {
    query._id = { $ne: excludeSessionId };
  }
  await Session.updateMany(query, { isActive: false });
}

export async function getActiveSessions(userId) {
  return Session.find({ userId, isActive: true })
    .sort({ lastUsedAt: -1 })
    .lean();
}
