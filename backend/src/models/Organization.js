import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    participants: {
      type: Number,
      default: 0,
    },
    totalScore: {
      type: Number,
      default: 0,
    },
    averageScore: {
      type: Number,
      default: 0,
    },
    bayesianScore: {
      type: Number,
      default: 0,
    },
    topKScore: {
      type: Number,
      default: 0,
    },
    rank: {
      type: Number,
      default: 0,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

organizationSchema.index({ bayesianScore: -1 });
organizationSchema.index({ rank: 1 });

organizationSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    name: this.name,
    participants: this.participants,
    averageScore: Math.round(this.averageScore * 100) / 100,
    bayesianScore: Math.round(this.bayesianScore * 100) / 100,
    rank: this.rank,
    lastUpdated: this.lastUpdated,
  };
};

export default mongoose.model("Organization", organizationSchema);

