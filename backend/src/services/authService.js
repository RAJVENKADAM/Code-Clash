import User from "../models/User.js";
import Otp from "../models/Otp.js";
import config from "../config/env.js";
import { sendOtpEmail, sanitizeEmail } from "./emailDispatchService.js";

/**
 * Password-based auth service.
 *
 * Registration flow:
 *   1. User provides name, email, password.
 *   2. An OTP is emailed for verification.
 *   3. On OTP verification the account is created (password bcrypt-hashed).
 *
 * Login flow:
 *   User provides email + password. On success a login token + session is issued.
 *
 * Super admin: helloamux@gmail.com registers as a normal person but is
 * automatically promoted to the ADMIN role.
 */
const SUPER_ADMIN_EMAIL = (
  config.SUPER_ADMIN_EMAIL || "helloamux@gmail.com"
).toLowerCase();

const OTP_TTL_SECONDS = parseInt(config.OTP_TTL_SECONDS || "300", 10);
const OTP_MAX_ATTEMPTS = parseInt(config.OTP_MAX_ATTEMPTS || "3", 10);
const OTP_RESEND_COOLDOWN_SECONDS = parseInt(
  config.OTP_RESEND_COOLDOWN_SECONDS || "30",
  10,
);

/**
 * Convert a name to Sentence case (e.g. "jOhN dOE" -> "John Doe").
 * @param {string} name
 * @returns {string}
 */
function toSentenceCase(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function normalizeOrganization(org) {
  return String(org || "")
    .trim()
    .toLowerCase();
}

// ---- Lightweight in-memory per-IP cooldown (defense in depth) -------------
const cooldownMap = new Map(); // ip -> timestamp (ms)
function isRateLimited(ip) {
  const now = Date.now();
  const last = cooldownMap.get(ip) || 0;
  if (now - last < OTP_RESEND_COOLDOWN_SECONDS * 1000) return true;
  cooldownMap.set(ip, now);
  if (cooldownMap.size > 10000) {
    for (const [k, v] of cooldownMap) {
      if (now - v > 60000) cooldownMap.delete(k);
    }
  }
  return false;
}

/**
 * Register a new user (name, email, password) and email an OTP for verification.
 * The user document is created immediately with the hashed password but
 * `isVerified` is false until the OTP is confirmed.
 *
 * If the email already exists, the flow is reused for login OTP verification.
 */
export async function requestOtp({ email, organization, name, password, ip }) {
  const cleanEmail = sanitizeEmail(email);
  if (!cleanEmail) throw new Error("Invalid email format.");

  const org = normalizeOrganization(organization);

  if (ip && isRateLimited(ip)) {
    throw new Error(
      `Please wait ${OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting a new OTP.`,
    );
  }

  let user = await User.findOne({ email: cleanEmail });

  if (!user) {
    // New registration — a password is mandatory.
    if (!password || String(password).length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }
    const displayName = name ? toSentenceCase(name) : cleanEmail.split("@")[0];
    const isSuperAdmin = cleanEmail === SUPER_ADMIN_EMAIL;
    user = new User({
      email: cleanEmail,
      name: displayName,
      organization: org || "Unspecified",
      password, // hashed via pre-save hook
      role: isSuperAdmin ? "ADMIN" : "USER",
      isVerified: false,
    });
    await user.save();
  } else {
    // Existing user — never overwrite the (already-hashed) password here.
    // Password changes are handled by the dedicated login flow.
  }

  // Guarantee a single live code per user.
  await Otp.deleteMany({ email: cleanEmail });

  const code = Otp.generateCode();
  const codeHash = Otp.hashCode(code);

  const otpDoc = new Otp({
    codeHash,
    email: cleanEmail,
    organization: org,
    userId: user._id,
    attempts: 0,
    ip: ip || "",
    userAgent: "",
  });
  await otpDoc.save();

  const ttlMinutes = Math.max(1, Math.round(OTP_TTL_SECONDS / 60));
  const sendResult = await sendOtpEmail({
    email: cleanEmail,
    otp: code,
    ttlMinutes,
    organization: org,
  });

  if (!sendResult.success) {
    await Otp.deleteOne({ _id: otpDoc._id }).catch(() => {});
    console.error(
      `[AuthService] Email dispatch failed for ${cleanEmail}; OTP rolled back.`,
    );
    throw new Error("Unable to send OTP at this time. Please try again.");
  }

  return { userId: user._id.toString(), email: cleanEmail };
}

/**
 * Verify an OTP and mark the user as verified.
 */
export async function verifyOtp({ userId, organization, otp }) {
  if (!/^\d{6}$/.test(String(otp || ""))) {
    throw new Error("Invalid OTP.");
  }
  if (!userId) {
    throw new Error("User ID is required.");
  }

  const user = await User.findById(userId);
  if (!user) throw new Error("User not found.");

  const org = normalizeOrganization(organization);

  const otpDoc = await Otp.findOne({
    email: user.email,
    organization: org,
  }).sort({ createdAt: -1 });

  if (!otpDoc) {
    throw new Error("No OTP found. Please request a new one.");
  }

  if (!otpDoc.matches(String(otp))) {
    otpDoc.attempts = (otpDoc.attempts || 0) + 1;
    if (otpDoc.attempts >= OTP_MAX_ATTEMPTS) {
      await Otp.deleteOne({ _id: otpDoc._id });
      throw new Error("Too many invalid attempts. Please request a new OTP.");
    }
    await otpDoc.save();
    const remaining = OTP_MAX_ATTEMPTS - otpDoc.attempts;
    throw new Error(`Invalid OTP. ${remaining} attempt(s) remaining.`);
  }

  // SUCCESS: delete the OTP so it can never be reused.
  await Otp.deleteOne({ _id: otpDoc._id });

  user.organization = org || user.organization || "Unspecified";
  user.isVerified = true;

  // Promote super admin if the email matches.
  const isSuperAdmin = user.email.toLowerCase() === SUPER_ADMIN_EMAIL;
  if (isSuperAdmin) {
    user.role = "ADMIN";
  }

  await user.save();
  return user;
}

/**
 * Password login for all users.
 */
export async function loginWithPassword({ email, password }) {
  const cleanEmail = sanitizeEmail(email);
  if (!cleanEmail) throw new Error("Invalid email format.");

  const user = await User.findOne({ email: cleanEmail }).select("+password");
  if (!user) {
    throw new Error("Invalid credentials.");
  }

  if (!user.isVerified) {
    throw new Error("Account not verified. Please verify your email first.");
  }

  const matches = await user.comparePassword(password);
  if (!matches) {
    throw new Error("Invalid credentials.");
  }

  // Promote super admin.
  if (cleanEmail === SUPER_ADMIN_EMAIL && user.role !== "ADMIN") {
    user.role = "ADMIN";
  }
  user.isVerified = true;
  await user.save();

  return user;
}

/**
 * Backward-compatible resend handler.
 */
export async function resendOtp({ email, organization, userId, ip }) {
  let targetEmail = email;
  if (!targetEmail && userId) {
    const found = await User.findById(userId);
    if (!found) throw new Error("User not found.");
    targetEmail = found.email;
  }
  if (!targetEmail) throw new Error("Email is required.");

  // Reuse the existing user's password so the OTP can be re-sent without the
  // user having to re-enter it (password is required for the request flow).
  const found = await User.findOne({ email: targetEmail }).select("+password");
  const name = found?.name || "";
  const password = found?.password || "";
  return requestOtp({ email: targetEmail, organization, name, password, ip });
}

export default {
  requestOtp,
  verifyOtp,
  loginWithPassword,
  resendOtp,
};
