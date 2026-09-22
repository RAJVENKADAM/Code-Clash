import mongoose from "mongoose";

const violationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Submission",
      index: true,
    },
    challengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Challenge",
      index: true,
    },
    type: {
      type: String,
      enum: [
        "FULLSCREEN_EXIT",
        "TAB_SWITCH",
        "WINDOW_BLUR",
        "VISIBILITY_CHANGE",
        "BROWSER_MINIMIZE",
        "BROWSER_RESIZE",
        "DEVTOOLS_OPEN",
        "CONTEXT_MENU",
        "COPY_ATTEMPT",
        "PASTE_ATTEMPT",
        "KEYBOARD_SHORTCUT",
        "FOCUS_LOSS",
        "RAPID_RELOAD",
        "RAPID_SUBMISSION",
        "IP_CHANGE",
        "TIMEZONE_CHANGE",
        "IMPOSSIBLE_SOLVE_TIME",
        "HIGH_TYPING_SPEED",
        "LOW_TYPING_SPEED",
        "NO_TYPING_THEN_SOLUTION",
        "MULTIPLE_DEVICES",
      ],
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: "MEDIUM",
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

violationSchema.index({ userId: 1, createdAt: -1 });
violationSchema.index({ submissionId: 1, createdAt: -1 });
violationSchema.index({ type: 1, severity: 1 });

// TTL index: auto-delete violations older than 1 year
violationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export default mongoose.model("Violation", violationSchema);
