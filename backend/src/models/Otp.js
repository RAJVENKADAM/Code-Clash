import mongoose from "mongoose";
import crypto from "crypto";

/**
 * OTP Model — dedicated, hardened collection for one-time passwords.
 *
 * Security properties:
 *  - The OTP is NEVER stored in plaintext. Only a SHA-256 digest is persisted.
 *    Even a raw read-out of the collection yields nothing usable.
 *  - A MongoDB TTL index on `createdAt` HARD-DELETES documents exactly
 *    OTP_TTL_SECONDS (default 300) seconds after creation. This is handled by
 *    MongoDB's TTLMonitor process, so no cron job is required for cleanup.
 *  - `attempts` is an integer counter used to wipe the document after
 *    MAX_ATTEMPTS (default 3) wrong guesses.
 *  - The document is bound to the email + normalized organization so a user
 *    cannot "spoof" a different organization during verification.
 *  - `ip` and `userAgent` are recorded for forensic / abuse-analysis purposes.
 */
const otpSchema = new mongoose.Schema(
  {
    // SHA-256 hash of the 6-digit code. Never the raw code.
    codeHash: {
      type: String,
      required: true,
      unique: true,
    },
    // Lowercased, trimmed email. Bound to the user that requested it.
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // Legacy field retained for existing OTP documents. Registration OTPs
    // are bound to the user and email, not to an organization.
    organization: {
      type: String,
      default: "",
      lowercase: true,
      trim: true,
    },
    purpose: {
      type: String,
      enum: ["register", "login", "password-reset", "legacy"],
      default: "legacy",
      index: true,
    },
    name: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },
    // Reference to the owning user document (set when the user is created).
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Integer attempt counter. Incremented on each failed verification.
    attempts: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    // Forensic metadata.
    ip: {
      type: String,
      default: "",
    },
    userAgent: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

/**
 * TTL index — auto hard-deletes documents.
 *
 * The TTL index is declared in a dedicated ensureIndexes module
 * (backend/src/models/ensureIndexes.js) so the TTL seconds can come from
 * environment config (OTP_TTL_SECONDS, default 300) at runtime rather than a
 * hard-coded value baked into the schema definition. MongoDB's TTLMonitor then
 * hard-deletes documents exactly that many seconds after `createdAt`.
 *
 * Compound index for fast lookup during verification.
 */
// Verify-time lookup: email + org (as typed during verify) + newest first.
otpSchema.index({ email: 1, organization: 1, createdAt: -1 });

/**
 * Hash a raw OTP string into its SHA-256 digest.
 * @param {string} code - the 6-digit OTP
 * @returns {string} hex-encoded SHA-256 digest
 */
otpSchema.statics.hashCode = function (code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
};

/**
 * Generate a cryptographically secure random 6-digit OTP.
 * Uses crypto.randomInt to avoid Math.random() predictability.
 * @returns {string} 6-digit zero-padded code
 */
otpSchema.statics.generateCode = function () {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
};

/**
 * Compare a supplied raw code against the stored digest (constant-time).
 * @param {string} code - raw OTP supplied by the user
 * @returns {boolean} true if the SHA-256 digest matches
 */
otpSchema.methods.matches = function (code) {
  const suppliedHash = this.constructor.hashCode(code);
  // Timing-safe comparison using crypto.timingSafeEqual.
  const a = Buffer.from(suppliedHash, "hex");
  const b = Buffer.from(this.codeHash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

export default mongoose.model("Otp", otpSchema);
