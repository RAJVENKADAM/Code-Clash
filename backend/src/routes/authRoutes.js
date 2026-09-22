import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  requestOTP,
  verifyOTP,
  resendOTPHandler,
  refreshToken,
  logout,
  logoutAllDevices,
  getSessions,
  getProfile,
  loginWithPasswordHandler,
} from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";
import {
  validateEmail,
  validateOTP,
  validateUserId,
  validateOrganization,
  handleValidationErrors,
} from "../middleware/validate.js";
import { auditLogin, auditLogout } from "../middleware/auditLog.js";

const router = Router();

/**
 * API Gateway Rate Limiters (IP-keyed).
 *
 *  - `/request-otp`: max 3 requests / 15 minutes / IP
 *    → throttles email-bombing and API-exhaustion scripts.
 *  - `/verify-otp`: max 5 requests / 5 minutes / IP
 *    → throttles brute-forcing of 6-digit codes.
 *
 * `standardHeaders: true` sends RFC 7766 `RateLimit-*` headers.
 * `legacyHeaders: false` disables the deprecated `X-RateLimit-*` headers.
 * `skipSuccessfulRequests` is used on verify-otp so only FAILED attempts
 * count toward the brute-force budget.
 */
const requestOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // 3 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many OTP requests. Please try again in 15 minutes.",
  },
});

const verifyOtpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // 5 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // only count failed attempts
  message: {
    error:
      "Too many failed verification attempts. Please try again in 5 minutes.",
  },
});

const resendOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many resend requests. Please try again later.",
  },
});

router.post("/login-password", loginWithPasswordHandler);
router.post(
  "/request-otp",
  requestOtpLimiter,
  validateEmail,
  validateOrganization,
  handleValidationErrors,
  requestOTP,
);
router.post(
  "/verify-otp",
  verifyOtpLimiter,
  validateUserId,
  validateOrganization,
  validateOTP,
  handleValidationErrors,
  verifyOTP,
  auditLogin,
);
router.post(
  "/resend-otp",
  resendOtpLimiter,
  validateOrganization,
  handleValidationErrors,
  resendOTPHandler,
);
router.post("/refresh-token", refreshToken);
router.post("/logout", authenticate, logout, auditLogout);
router.post("/logout-all", authenticate, logoutAllDevices);
router.get("/sessions", authenticate, getSessions);
router.get("/profile", authenticate, getProfile);

export default router;
