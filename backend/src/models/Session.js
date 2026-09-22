import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    refreshToken: {
      type: String,
      required: true,
    },
    deviceInfo: {
      type: String,
      default: "",
    },
    ipAddress: {
      type: String,
      default: "",
    },
    userAgent: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 },
    },
  },
  {
    timestamps: true,
  }
);

sessionSchema.index({ userId: 1, isActive: 1 });
sessionSchema.index({ refreshToken: 1 });

sessionSchema.methods.toJSON = function () {
  return {
    id: this._id,
    userId: this.userId,
    deviceInfo: this.deviceInfo,
    ipAddress: this.ipAddress,
    userAgent: this.userAgent,
    isActive: this.isActive,
    lastUsedAt: this.lastUsedAt,
    createdAt: this.createdAt,
  };
};

export default mongoose.model("Session", sessionSchema);
