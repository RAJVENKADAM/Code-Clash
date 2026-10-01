import { timingSafeEqual } from "node:crypto";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import config from "../config/env.js";

const skipPreflight = (req) => req.method === "OPTIONS";

/**
 * Dedicated limiter for code execution endpoints (run/submit) to protect the
 * execution engine from abuse while still allowing legitimate rapid iterations.
 */
export const executionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipPreflight,
  message: {
    error: "Too many code execution requests. Please wait a moment and retry.",
  },
});

/**
 * Limiter for room join attempts to prevent brute-forcing room keys.
 */
export const joinLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipPreflight,
  message: {
    error: "Too many join attempts. Please wait a moment and retry.",
  },
});

/**
 * Limiter for report / PDF generation (expensive, multi-query operations).
 */
export const reportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipPreflight,
  message: {
    error: "Too many report requests. Please wait a moment and retry.",
  },
});

export function requireJudgeCallbackSecret(req, res, next) {
  const configuredSecret = config.JUDGE_CALLBACK_SECRET;
  if (!configuredSecret) {
    return res.status(503).json({
      error: "Judge callback authentication is not configured.",
    });
  }

  const suppliedSecret = req.headers["x-judge-callback-key"];
  if (
    typeof suppliedSecret !== "string" ||
    Buffer.byteLength(suppliedSecret) !== Buffer.byteLength(configuredSecret) ||
    !timingSafeEqual(Buffer.from(suppliedSecret), Buffer.from(configuredSecret))
  ) {
    return res.status(401).json({ error: "Invalid judge callback credentials." });
  }
  next();
}

export function securityMiddleware(app) {
  // Helmet with strict CSP
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            "'unsafe-eval'",
            "cdn.jsdelivr.net",
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "cdn.jsdelivr.net",
            "fonts.googleapis.com",
          ],
          fontSrc: ["'self'", "fonts.gstatic.com", "cdn.jsdelivr.net"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: [
            "'self'",
            config.CLIENT_URL,
            "https://code-executor.onrender.com",
          ],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    }),
  );

  // Rate limiting
  // Skip OPTIONS preflight requests (they carry no auth and browsers send them
  // before every CORS request). Counting them exhausts the limiter quickly.
  const generalLimiter = rateLimit({
    windowMs: parseInt(config.RATE_LIMIT_WINDOW_MS),
    max: parseInt(config.RATE_LIMIT_MAX),
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipPreflight,
    message: {
      error: "Too many requests, please try again later.",
    },
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipPreflight,
    message: {
      error: "Too many authentication attempts, please try again later.",
    },
  });

  const submissionLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipPreflight,
    message: {
      error: "Too many submission attempts, please slow down.",
    },
  });

  app.use("/api", generalLimiter);
  app.use("/api/auth", authLimiter);
  app.use("/api/submissions", submissionLimiter);

  // CORS hardening
  const allowedOrigins = [
    config.CLIENT_URL,
    ...(config.NODE_ENV === "production"
      ? []
      : ["http://localhost:5173", "http://localhost:3000"]),
  ].filter(Boolean);

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    } else if (!origin) {
      res.setHeader("Access-Control-Allow-Origin", config.CLIENT_URL || "*");
    }
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Guest-ID, X-Creator-Credential, X-Judge-Callback-Key, X-Request-Id, X-CSRF-Token",
    );
    res.setHeader("Access-Control-Expose-Headers", "X-Request-Id");

    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }
    next();
  });
}

// Input sanitization middleware
export function sanitizeInput(req, res, next) {
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === "string") {
        // Strip null bytes and control characters
        req.body[key] = req.body[key].replace(
          /[\x00-\x08\x0B\x0C\x0E-\x1F]/g,
          "",
        );
        // Trim whitespace
        req.body[key] = req.body[key].trim();
      }
    }
  }
  next();
}

// Secure error handler
export function errorHandler(err, req, res, next) {
  const requestId = req.requestId || "unknown";

  console.error(`[Error][${requestId}]`, {
    message: err.message,
    stack: config.NODE_ENV === "development" ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  if (err.name === "ValidationError") {
    return res.status(400).json({
      error: "Validation failed",
      details: err.message,
      requestId,
    });
  }

  if (err.name === "CastError") {
    return res.status(400).json({
      error: "Invalid ID format",
      requestId,
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      error: "Duplicate entry",
      requestId,
    });
  }

  if (err.name === "MulterError") {
    return res.status(400).json({
      error: "File upload error",
      details: err.message,
      requestId,
    });
  }

  const statusCode = err.statusCode || 500;
  const response = {
    error: statusCode === 500 ? "Internal server error" : err.message,
    requestId,
  };

  if (config.NODE_ENV === "development" && statusCode === 500) {
    response.details = err.message;
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}
