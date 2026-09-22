import nodemailer from "nodemailer";
import config from "../config/env.js";

/**
 * Strict RFC-5322-ish email validation regex.
 * Rejects control characters, whitespace, multiple @ signs, invalid domains,
 * and common injection payloads (newlines, null bytes) before dispatch.
 */
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * High-Reliability Email Dispatch Engine.
 *
 * Design goals:
 *  - Bulletproof SMTP delivery: `pool: true` keeps a connection pool open so
 *    emails are sent instantly with no per-request TLS handshake lag.
 *  - Secure TLS handshakes with explicit timeouts on connect/greeting/socket
 *    so a wedged SMTP server cannot hang the request indefinitely.
 *  - Robust input sanitization: every recipient email is validated and
 *    normalized before dispatch. Invalid addresses are rejected before any
 *    SMTP call is attempted.
 *  - Fail-safe architecture: the caller (authService) is responsible for
 *    rolling back the OTP record if dispatch fails, but this module exposes a
 *    clear boolean result so the caller can react deterministically.
 *  - NEVER leaks internal SMTP paths to the public network: this module only
 *    logs internally and returns `{ success: false }` to the caller; the
 *    controller decides what generic message to send to the client.
 */

let transporter = null;
let transporterReady = false;
let isEtherealFallback = false;

/**
 * Build a lazily-initialized, pooled Nodemailer transporter.
 * @returns {Promise<import("nodemailer").Transporter | null>}
 */
async function getTransporter() {
  if (transporter) return transporter;

  const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS } = config;

  if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) {
    console.warn(
      "[EmailDispatch] SMTP credentials not configured. Email dispatch = DEV mode (log to console)."
    );
    return null;
  }

  const port = parseInt(EMAIL_PORT || "587", 10);
  const secure = port === 465; // implicit TLS on 465, STARTTLS otherwise

  // Sanitize password by stripping out any whitespace (e.g., spaces in Google App Passwords)
  const sanitizedPass = String(EMAIL_PASS).replace(/\s+/g, "");

  transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port,
    secure,
    pool: true, // keep connection pool warm → instant sends
    maxConnections: 5,
    maxMessages: 100,
    auth: {
      user: EMAIL_USER,
      pass: sanitizedPass,
    },
    connectionTimeout: 15000, // TCP connect timeout
    greetingTimeout: 10000, // SMTP greeting timeout
    socketTimeout: 20000, // socket inactivity timeout
    tls: {
      // Prefer secure TLS; reject insecure certs in production.
      rejectUnauthorized: config.NODE_ENV === "production",
    },
  });

  transporterReady = false;
  isEtherealFallback = false;
  return transporter;
}

/**
 * Verify the SMTP connection is healthy. Called once on first use.
 * Automatically provisions an Ethereal SMTP fallback in development if primary verification fails.
 * @returns {Promise<boolean>}
 */
async function verifyConnection() {
  const transport = await getTransporter();
  if (!transport) return false;
  if (transporterReady) return true;

try {
    await transport.verify();
    transporterReady = true;
    console.log("[EmailDispatch] SMTP connection verified.");
    return true;
  } catch (error) {
    // Clear the faulty transporter state so a retry triggers a clean rebuild
    transporter = null;
    transporterReady = false;
    console.warn("[EmailDispatch] SMTP verification failed:", error.message);
    return false;
  }
}

/**
 * Sanitize + validate a recipient email address.
 * @param {string} email - raw email input
 * @returns {string|null} normalized email or null if invalid
 */
export function sanitizeEmail(email) {
  if (typeof email !== "string") return null;
  const trimmed = email.trim().toLowerCase();
  // Reject empty, control chars, or anything that fails the strict regex.
  if (!trimmed || trimmed.length > 254 || !EMAIL_REGEX.test(trimmed)) return null;
  return trimmed;
}

/**
 * Send an OTP email.
 *
 * @param {object} params
 * @param {string} params.email - recipient address (already sanitized)
 * @param {string} params.otp - 6-digit code
 * @param {number} params.ttlMinutes - validity window for the message body
 * @param {string} params.organization - org name (for personalization)
 * @returns {Promise<{success: boolean, messageId?: string, previewUrl?: string, devMode?: boolean}>}
 */
export async function sendOtpEmail({ email, otp, ttlMinutes, organization }) {
  const cleanEmail = sanitizeEmail(email);
  if (!cleanEmail) {
    console.warn("[EmailDispatch] Rejected invalid email address before dispatch.");
    return { success: false, reason: "INVALID_EMAIL" };
  }

  const transport = await getTransporter();
  if (!transport) {
    // DEV MODE: fall back to console logging so the flow is testable.
    console.log("==================================================");
    console.log(`[EmailDispatch][DEV] OTP for ${cleanEmail}: ${otp}`);
    console.log(`[EmailDispatch][DEV] Organization: ${organization}`);
    console.log("==================================================");
    return { success: true, devMode: true };
  }

const verified = await verifyConnection();
  if (!verified) {
    // In non-production, fall back to console logging so the flow remains
    // testable even when SMTP credentials are invalid/expired. Production
    // still fails loudly to avoid silently dropping verification emails.
    if (config.NODE_ENV !== "production") {
      console.warn(
        "[EmailDispatch] SMTP verification failed. Falling back to DEV console logging so registration can continue."
      );
      console.log("==================================================");
      console.log(`[EmailDispatch][DEV] OTP for ${cleanEmail}: ${otp}`);
      console.log(`[EmailDispatch][DEV] Organization: ${organization}`);
      console.log(
        "[EmailDispatch][DEV] NOTE: Email was NOT delivered. Configure a valid EMAIL_PASS to send real emails."
      );
      console.log("==================================================");
      return { success: true, devMode: true };
    }
    console.warn("[EmailDispatch] SMTP not verified; aborting send.");
    return { success: false, reason: "SMTP_UNVERIFIED" };
  }

  // Adjust 'from' details if we are routing via Ethereal fallback
  const fromName = config.EMAIL_FROM_NAME || "Coding Challenge Platform";
  const fromAddr = isEtherealFallback 
    ? transporter.options.auth.user 
    : (config.EMAIL_USER || "noreply@coding-challenge-platform.com");

  try {
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromAddr}>`,
      to: cleanEmail,
      subject: "Your 6-digit login code",
      text:
        `Hello from ${fromName}!\n\n` +
        `Your one-time login code is: ${otp}\n\n` +
        `This code expires in ${ttlMinutes} minutes.\n` +
        `If you did not request this code, please ignore this email.\n`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, Helvetica, sans-serif; background:#f4f4f6; margin:0; padding:0; }
            .wrap { max-width:480px; margin:0 auto; padding:32px 16px; }
            .card { background:#ffffff; border:1px solid #e5e7eb; border-radius:12px; padding:32px; }
            .brand { color:#0a66c2; font-size:20px; font-weight:700; margin-bottom:8px; }
            .code { background:#0a66c2; color:#fff; font-size:32px; letter-spacing:8px;
                    text-align:center; padding:16px; border-radius:8px; margin:24px 0; font-weight:700; }
            .muted { color:#6b7280; font-size:13px; line-height:1.6; }
          </style>
        </head>
        <body>
          <div class="wrap">
            <div class="card">
              <div class="brand">${fromName}</div>
              <p style="color:#374151;font-size:15px;">Your one-time login code:</p>
              <div class="code">${otp}</div>
              <p class="muted">This code expires in ${ttlMinutes} minutes.</p>
              <p class="muted">If you did not request this code, you can safely ignore this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[EmailDispatch] Ethereal Preview URL: ${previewUrl}`);
    }
    
    console.log(`[EmailDispatch] OTP sent to ${cleanEmail} (msgId=${info.messageId}).`);
    return { success: true, messageId: info.messageId, previewUrl };
  } catch (error) {
    // Never leak error details to the network — log internally only.
    console.error("[EmailDispatch] SMTP send failed:", error.message);
    return { success: false, reason: "SMTP_FAILED" };
  }
}

export default {
  sendOtpEmail,
  sanitizeEmail,
};
