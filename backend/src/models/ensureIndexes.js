import Otp from "./Otp.js";
import config from "../config/env.js";

/**
 * Declares the config-drive TTL index on the Otp collection.
 *
 * The TTL seconds come from environment config (OTP_TTL_SECONDS, default 300)
 * so the hard-delete window is tunable without a code change. Because the
 * model schema already declares a static fallback index, this method ensures
 * the running index matches the configured value by re-creating it.
 *
 * @returns {Promise<void>}
 */
export async function ensureOtpTtlIndex() {
  const ttlSeconds = parseInt(config.OTP_TTL_SECONDS || "300", 10);
  try {
    await Otp.collection.dropIndex("createdAt_1").catch(() => {
      // index may not exist yet — ignore
    });
    await Otp.collection.createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: ttlSeconds, name: "createdAt_1" }
    );
    console.log(`[Models] OTP TTL index ensured (${ttlSeconds}s).`);
  } catch (error) {
    console.error("[Models] Failed to ensure OTP TTL index:", error.message);
  }
}

export default {
  ensureOtpTtlIndex,
};
