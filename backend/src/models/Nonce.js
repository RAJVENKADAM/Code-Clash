import mongoose from "mongoose";

/**
 * Nonce model for replay protection.
 * Each nonce is unique per user and expires after use.
 * TTL index auto-deletes after 24 hours.
 */
const nonceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    nonce: {
      type: String,
      required: true,
      unique: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "SUBMIT",
        "RUN",
        "JUDGE_RESULT",
        "CONTEST_START",
        "CONTEST_END",
        "REFRESH_TOKEN",
        "LOGOUT",
        "ANALYTICS_FLUSH",
      ],
    },
    resourceId: {
      type: String,
      default: "",
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 },
    },
    used: {
      type: Boolean,
      default: false,
    },
    consumedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

nonceSchema.index({ userId: 1, nonce: 1 }, { unique: true });
nonceSchema.index({ userId: 1, action: 1, createdAt: -1 });

nonceSchema.methods.consume = async function () {
  if (this.used) {
    throw new Error("Nonce already consumed (replay detected)");
  }
  this.used = true;
  this.consumedAt = new Date();
  await this.save();
};

nonceSchema.statics.generate = async function (userId, action, resourceId = "") {
  const { randomBytes } = await import("crypto");
  const nonceValue = randomBytes(32).toString("hex");
  const nonce = new this({
    userId,
    nonce: nonceValue,
    action,
    resourceId,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hour expiry
  });
  await nonce.save();
  return nonceValue;
};

nonceSchema.statics.validateAndConsume = async function (userId, nonceValue, action, resourceId = "") {
  const nonce = await this.findOne({
    userId,
    nonce: nonceValue,
    action,
    resourceId: resourceId || { $exists: true },
    used: false,
    expiresAt: { $gt: new Date() },
  });

  if (!nonce) {
    return false;
  }

  await nonce.consume();
  return true;
};

export default mongoose.model("Nonce", nonceSchema);
