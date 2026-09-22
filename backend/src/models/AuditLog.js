import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    resource: {
      type: String,
      default: "",
    },
    resourceId: {
      type: String,
      default: "",
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      default: "",
    },
    userAgent: {
      type: String,
      default: "",
    },
    requestId: {
      type: String,
      default: "",
      index: true,
    },
    status: {
      type: String,
      enum: ["SUCCESS", "FAILURE", "PENDING"],
      default: "SUCCESS",
    },
    severity: {
      type: String,
      enum: ["INFO", "WARN", "ERROR", "CRITICAL"],
      default: "INFO",
    },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

// TTL index: auto-delete logs older than 90 days
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

auditLogSchema.methods.toJSON = function () {
  return {
    id: this._id,
    userId: this.userId,
    action: this.action,
    resource: this.resource,
    resourceId: this.resourceId,
    details: this.details,
    ipAddress: this.ipAddress,
    userAgent: this.userAgent,
    requestId: this.requestId,
    status: this.status,
    severity: this.severity,
    createdAt: this.createdAt,
  };
};

export default mongoose.model("AuditLog", auditLogSchema);
