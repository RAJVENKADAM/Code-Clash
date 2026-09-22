import {
  requestOtp,
  verifyOtp,
  loginWithPassword,
  resendOtp,
} from "../services/authService.js";
import { generateLoginToken, createSession } from "../services/tokenService.js";

/**
 * Passwordless OTP Auth Controller.
 *
 * Security notes:
 *  - SANITIZED inputs: email + organization are validated & normalized before use.
 *  - GENERIC RESPONSES: never reveal whether an email exists (anti-enumeration).
 *  - NO LEAKAGE: internal SMTP errors are never surfaced to the client; a clean,
 *    generic message is returned instead. Detailed logs stay server-side.
 *  - 12-HOUR STATELESS JWT: on success, a signed JWT binding userId + email +
 *    verified organization is issued alongside the existing session/refresh flow.
 */

/**
 * POST /request-otp
 * Body: { email, organization }
 */
export async function requestOTP(req, res) {
  try {
    const { email, organization, name, password } = req.body || {};
    const ip = req.ip || req.connection?.remoteAddress || "";

    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    const result = await requestOtp({ email, organization, name, password, ip });

    // Generic success — do not reveal whether the account was new or existing.
    return res.status(200).json({
      message: "If an account exists, an OTP has been sent.",
      userId: result.userId,
      email: result.email,
    });
  } catch (error) {
    if (error.message && error.message.includes("wait")) {
      return res.status(429).json({ error: error.message });
    }
    if (error.message === "Invalid email format.") {
      return res.status(400).json({ error: error.message });
    }
    // Generic failure — never leak SMTP internals.
    console.error("[AuthController] request-otp failed:", error.message);
    return res
      .status(500)
      .json({ error: "Unable to send OTP at this time. Please try again." });
  }
}

/**
 * POST /login-password
 * Body: { email, password }
 * Super admin password login (complements the OTP flow).
 */
export async function loginWithPasswordHandler(req, res) {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required." });
    }

    const user = await loginWithPassword({ email, password });

    const loginToken = generateLoginToken(
      user._id.toString(),
      user.email,
      user.organization,
      user.role,
    );

    const deviceInfo = req.headers["user-agent"] || "Unknown";
    const ipAddress = req.ip || req.connection?.remoteAddress || "";
    const userAgent = req.headers["user-agent"] || "";
    const session = await createSession(
      user._id,
      deviceInfo,
      ipAddress,
      userAgent,
    );

return res.status(200).json({
      message: "Login successful.",
      token: loginToken,
      refreshToken: session.refreshToken,
      sessionId: session._id,
      user: user.toPublicJSON(),
    });
  } catch (error) {
    const msg = error.message || "";
    if (
      msg.includes("Invalid email") ||
      msg.includes("Invalid credentials") ||
      msg.includes("not verified") ||
      msg.includes("verify")
    ) {
      return res.status(401).json({ error: msg });
    }
    console.error("[AuthController] login-password failed:", error.message);
    return res.status(500).json({ error: "Login failed. Please try again." });
  }
}

/**
 * POST /verify-otp
 * Body: { userId, organization, otp }
 */
export async function verifyOTP(req, res) {
  try {
    const { userId, organization, otp } = req.body || {};

    if (!userId || !otp) {
      return res.status(400).json({ error: "UserId and OTP are required." });
    }

    // Verify against the exact user + the organization typed at THIS request.
    // The typed org is cross-checked against the org bound to the OTP record —
    // if they differ, no matching record exists and verification fails.
    const user = await verifyOtp({ userId, organization, otp });

    // Issue the stateless 12-hour login JWT binding userId + email + org.
    const loginToken = generateLoginToken(
      user._id.toString(),
      user.email,
      user.organization,
      user.role,
    );

    // Create a session for refresh-token flow (keeps existing frontend intact).
    const deviceInfo = req.headers["user-agent"] || "Unknown";
    const ipAddress = req.ip || req.connection?.remoteAddress || "";
    const userAgent = req.headers["user-agent"] || "";
    const session = await createSession(
      user._id,
      deviceInfo,
      ipAddress,
      userAgent,
    );

    return res.status(200).json({
      message: "Login successful.",
      token: loginToken, // 12h stateless JWT
      refreshToken: session.refreshToken,
      sessionId: session._id,
      user: user.toPublicJSON(),
    });
  } catch (error) {
    const msg = error.message || "";
    if (
      msg.includes("OTP") ||
      msg.includes("attempt") ||
      msg.includes("Invalid") ||
      msg.includes("not found") ||
      msg.includes("No OTP")
    ) {
      return res.status(401).json({ error: msg });
    }
    console.error("[AuthController] verify-otp failed:", error.message);
    return res
      .status(500)
      .json({ error: "Verification failed. Please try again." });
  }
}

/**
 * Backward-compatible resend handler.
 * Accepts either `{ email, organization }` or `{ userId }` (looked up from DB).
 */
export async function resendOTPHandler(req, res) {
  try {
    const { email, organization, userId } = req.body || {};
    const ip = req.ip || req.connection?.remoteAddress || "";

    const result = await resendOtp({ email, organization, userId, ip });
    return res.status(200).json({
      message: "If an account exists, a new OTP has been sent.",
      userId: result.userId,
      email: result.email,
    });
  } catch (error) {
    if (error.message && error.message.includes("wait")) {
      return res.status(429).json({ error: error.message });
    }
    console.error("[AuthController] resend-otp failed:", error.message);
    return res
      .status(500)
      .json({ error: "Unable to send OTP at this time. Please try again." });
  }
}

export async function refreshToken(req, res) {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      return res.status(400).json({ error: "Refresh token is required." });
    }

    const { rotateRefreshToken } = await import("../services/tokenService.js");
    const session = await rotateRefreshToken(token);
    const User = (await import("../models/User.js")).default;
    const user = await User.findById(session.userId);
    if (!user) {
      return res.status(401).json({ error: "User not found." });
    }

    const loginToken = generateLoginToken(
      user._id.toString(),
      user.email,
      user.organization,
      user.role,
    );

    return res.status(200).json({
      token: loginToken,
      refreshToken: session.refreshToken,
      sessionId: session._id,
    });
  } catch (error) {
    if (error.message === "Invalid refresh token") {
      return res
        .status(401)
        .json({ error: "Invalid refresh token. Please login again." });
    }
    console.error("[AuthController] refresh-token failed:", error.message);
    return res.status(500).json({ error: "Failed to refresh token." });
  }
}

export async function logout(req, res) {
  try {
    const { sessionId } = req.body;
    const { revokeSession, revokeAllUserSessions } =
      await import("../services/tokenService.js");
    if (sessionId) {
      await revokeSession(sessionId);
    } else {
      await revokeAllUserSessions(req.userId);
    }
    return res.status(200).json({ message: "Logged out successfully." });
  } catch (error) {
    console.error("[AuthController] logout failed:", error.message);
    return res.status(500).json({ error: "Failed to logout." });
  }
}

export async function logoutAllDevices(req, res) {
  try {
    const { sessionId } = req.body;
    const { revokeAllUserSessions } =
      await import("../services/tokenService.js");
    await revokeAllUserSessions(req.userId, sessionId);
    return res.status(200).json({ message: "Logged out from all devices." });
  } catch (error) {
    console.error("[AuthController] logout-all failed:", error.message);
    return res
      .status(500)
      .json({ error: "Failed to logout from all devices." });
  }
}

export async function getSessions(req, res) {
  try {
    const { getActiveSessions } = await import("../services/tokenService.js");
    const sessions = await getActiveSessions(req.userId);
    return res.status(200).json({ sessions });
  } catch (error) {
    console.error("[AuthController] get-sessions failed:", error.message);
    return res.status(500).json({ error: "Failed to get sessions." });
  }
}

export async function getProfile(req, res) {
  try {
    const user = req.user;
    return res.status(200).json({ user: user.toPublicJSON() });
  } catch (error) {
    console.error("[AuthController] get-profile failed:", error.message);
    return res.status(500).json({ error: "Failed to get profile." });
  }
}
