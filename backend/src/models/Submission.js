import mongoose from "mongoose";

const testResultSchema = new mongoose.Schema(
  {
    testCaseId: String,
    testCase: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: [
        "PASSED", "ACCEPTED", "FAILED", "ERROR", "PENDING", "PROCESSING",
        "WRONG_ANSWER", "COMPILATION_ERROR", "RUNTIME_ERROR",
        "TIME_LIMIT_EXCEEDED", "MEMORY_LIMIT_EXCEEDED", "SYSTEM_ERROR",
      ],
      default: "PENDING",
    },
    input: { type: String, default: "" },
    executionTime: {
      type: Number,
      default: 0,
    },
    memoryUsed: {
      type: Number,
      default: 0,
    },
    output: {
      type: String,
      default: "",
    },
    expectedOutput: {
      type: String,
      default: "",
    },
    error: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const submissionSchema = new mongoose.Schema(
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
    code: {
      type: String,
      required: true,
    },
    language: {
      type: String,
      default: "java",
      enum: ["java"],
    },
    status: {
      type: String,
      enum: [
        "PENDING", "PROCESSING", "ACCEPTED", "WRONG_ANSWER",
        "COMPILATION_ERROR", "RUNTIME_ERROR", "TIME_LIMIT_EXCEEDED",
        "MEMORY_LIMIT_EXCEEDED", "SYSTEM_ERROR", "REJECTED", "ERROR",
        "DISQUALIFIED",
      ],
      default: "PENDING",
      index: true,
    },
    score: {
      type: Number,
      default: 0,
    },
    passed: {
      type: Number,
      default: 0,
    },
    failed: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      default: 0,
    },
    executionTime: {
      type: Number,
      default: 0,
    },
    memoryUsed: {
      type: Number,
      default: 0,
    },
    timeToSolve: {
      type: Number,
      default: 0,
    },
    output: {
      type: String,
      default: "",
    },
    error: {
      type: String,
      default: "",
    },
    results: [testResultSchema],
    violationCount: {
      type: Number,
      default: 0,
    },
    isDisqualified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

submissionSchema.index({ userId: 1, challengeId: 1 }, { unique: true });
submissionSchema.index({ userId: 1, createdAt: -1 });
submissionSchema.index({ challengeId: 1, status: 1 });
submissionSchema.index({ score: -1 });

submissionSchema.methods.toPublicJSON = function ({ includeTestCaseDetails = false } = {}) {
  return {
    submissionId: this._id,
    submittedAt: this.createdAt,
    status: this.status,
    accepted: this.status === "ACCEPTED",
    passed: this.passed,
    failed: this.failed,
    total: this.total,
    output: this.output,
    error: this.error,
    executionTime: this.executionTime,
    memoryUsed: this.memoryUsed,
    results: this.results.map((r) => ({
      ...(includeTestCaseDetails
        ? {
            testCaseId: r.testCaseId,
            input: r.input,
            output: r.output,
            expectedOutput: r.expectedOutput,
            error: r.error,
          }
        : {}),
      testCase: r.testCase,
      status: r.status,
      executionTime: r.executionTime,
      memoryUsed: r.memoryUsed,
    })),
  };
};

export default mongoose.model("Submission", submissionSchema);
