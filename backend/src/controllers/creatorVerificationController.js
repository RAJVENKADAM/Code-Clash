import {
  requestCreatorOtp,
  verifyCreatorOtp,
} from "../services/creatorVerificationService.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function requestCreatorOtpHandler(req, res) {
  const email = String(req.body?.email || "").trim();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }

  try {
    const result = await requestCreatorOtp(email);
    return res.status(200).json({
      message: "A verification code has been sent if email delivery is available.",
      expiresInSeconds: result.expiresInSeconds,
    });
  } catch (error) {
    if (error.status === 429) {
      if (error.retryAfterSeconds) {
        res.set("Retry-After", String(error.retryAfterSeconds));
      }
      return res.status(429).json({ error: error.message });
    }
    console.error("[CreatorVerification] OTP delivery failed:", error.message);
    return res.status(503).json({ error: "Unable to send a verification code right now." });
  }
}

export async function verifyCreatorOtpHandler(req, res) {
  const email = String(req.body?.email || "").trim();
  const code = String(req.body?.code || "").trim();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: "Enter the six-digit verification code." });
  }

  try {
    const result = await verifyCreatorOtp(email, code);
    return res.status(200).json({
      email: result.email,
      token: result.token,
      tokenType: "login",
    });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) {
      console.error("[CreatorVerification] OTP verification failed:", error.message);
    }
    return res.status(status).json({
      error: status === 500 ? "Unable to verify this code right now." : error.message,
    });
  }
}
