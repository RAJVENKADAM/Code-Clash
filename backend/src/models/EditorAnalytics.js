import mongoose from "mongoose";

const editorAnalyticsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    challengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Challenge",
      required: true,
      index: true,
    },
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Submission",
    },
    sessionId: {
      type: String,
      default: "",
    },
    // Editor metadata (NOT keystrokes - only aggregate analytics)
    typingDuration: { type: Number, default: 0 }, // ms
    idleDuration: { type: Number, default: 0 }, // ms
    cursorMovementCount: { type: Number, default: 0 },
    selectionCount: { type: Number, default: 0 },
    undoCount: { type: Number, default: 0 },
    redoCount: { type: Number, default: 0 },
    runCount: { type: Number, default: 0 },
    submitCount: { type: Number, default: 0 },
    autosaveCount: { type: Number, default: 0 },
    focusChanges: { type: Number, default: 0 },
    fullscreenExits: { type: Number, default: 0 },
    windowBlurCount: { type: Number, default: 0 },
    visibilityChanges: { type: Number, default: 0 },
    resizeCount: { type: Number, default: 0 },
    refreshCount: { type: Number, default: 0 },
    networkReconnects: { type: Number, default: 0 },
    editorRecoveryEvents: { type: Number, default: 0 },
    pasteCount: { type: Number, default: 0 },
    copyCount: { type: Number, default: 0 },
    // Timing metadata
    editorOpenTime: { type: Date },
    firstEditTime: { type: Date },
    lastEditTime: { type: Date },
    // Typing pattern metadata (aggregate only, no keystrokes stored)
    totalCharactersTyped: { type: Number, default: 0 },
    averageTypingSpeed: { type: Number, default: 0 }, // chars per minute
    maxTypingSpeed: { type: Number, default: 0 },
    minTypingSpeed: { type: Number, default: 0 },
    typingConsistencyScore: { type: Number, default: 0 }, // 0-100, lower = more erratic
    correctionCount: { type: Number, default: 0 },
    // Mouse movement (aggregate only)
    mouseMoveCount: { type: Number, default: 0 },
    mouseClickCount: { type: Number, default: 0 },
    noMouseMovementDetected: { type: Boolean, default: false },
    // Automation risk
    automationRiskScore: { type: Number, default: 0, min: 0, max: 100 },
    zeroCorrections: { type: Boolean, default: false },
    veryRegularIntervals: { type: Boolean, default: false },
    longInactivityThenRapidEdits: { type: Boolean, default: false },
    // Timeline (timestamps of key events, not content)
    eventTimeline: [
      {
        type: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Suspicion flags (immutable after submission)
    finalSuspicionLevel: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: "LOW",
    },
  },
  {
    timestamps: true,
  }
);

editorAnalyticsSchema.index({ userId: 1, challengeId: 1 }, { unique: true });
editorAnalyticsSchema.index({ submissionId: 1 });
editorAnalyticsSchema.index({ automationRiskScore: -1 });

// TTL: auto-delete analytics older than 1 year
editorAnalyticsSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export default mongoose.model("EditorAnalytics", editorAnalyticsSchema);

