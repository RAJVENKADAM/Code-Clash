import mongoose from "mongoose";

const suspicionScoreSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    submissionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Submission",
      index: true,
    },
    totalScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    level: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: "LOW",
    },
    factors: [
      {
        type: {
          type: String,
          required: true,
        },
        weight: {
          type: Number,
          default: 1,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        description: {
          type: String,
          default: "",
        },
      },
    ],
    violationCount: {
      type: Number,
      default: 0,
    },
    lastViolationAt: {
      type: Date,
    },
    flagged: {
      type: Boolean,
      default: false,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
    reviewNotes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

suspicionScoreSchema.index({ totalScore: -1 });
suspicionScoreSchema.index({ level: 1, flagged: 1 });

suspicionScoreSchema.methods.calculateLevel = function () {
  if (this.totalScore >= 70) {
    this.level = "CRITICAL";
  } else if (this.totalScore >= 40) {
    this.level = "HIGH";
  } else if (this.totalScore >= 20) {
    this.level = "MEDIUM";
  } else {
    this.level = "LOW";
  }
  this.flagged = this.totalScore >= 40;
};

suspicionScoreSchema.methods.addFactor = function (factorType, weight = 1, description = "") {
  this.factors.push({
    type: factorType,
    weight,
    timestamp: new Date(),
    description,
  });
  this.totalScore = Math.min(100, Math.max(0, this.totalScore + weight));
  this.violationCount = this.factors.length;
  this.lastViolationAt = new Date();
  this.calculateLevel();
};

suspicionScoreSchema.methods.toJSON = function () {
  return {
    id: this._id,
    userId: this.userId,
    submissionId: this.submissionId,
    totalScore: this.totalScore,
    level: this.level,
    factors: this.factors,
    violationCount: this.violationCount,
    flagged: this.flagged,
    reviewedBy: this.reviewedBy,
    reviewedAt: this.reviewedAt,
    reviewNotes: this.reviewNotes,
    createdAt: this.createdAt,
  };
};

export default mongoose.model("SuspicionScore", suspicionScoreSchema);
