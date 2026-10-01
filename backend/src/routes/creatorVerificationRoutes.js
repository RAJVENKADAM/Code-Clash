import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  requestCreatorOtpHandler,
  verifyCreatorOtpHandler,
} from "../controllers/creatorVerificationController.js";

const router = Router();

const requestOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many code requests. Try again later." },
});

const verifyOtpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many verification attempts. Try again later." },
});

router.post("/request-otp", requestOtpLimiter, requestCreatorOtpHandler);
router.post("/verify-otp", verifyOtpLimiter, verifyCreatorOtpHandler);

export default router;
