import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/coding-challenge-platform";

let isConnected = false;
let connectionAttempted = false;

export async function connectDB() {
  if (isConnected) return true;
  if (connectionAttempted) return isConnected;

  // Disable Mongoose buffering to fail fast when DB is disconnected
  mongoose.set("bufferCommands", false);

  connectionAttempted = true;

  try {
    const db = await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });

    isConnected = db.connections[0].readyState === 1;
    if (isConnected) {
      console.log(`MongoDB connected: ${db.connection.host}`);
      // Ensure the OTP TTL index using the configured TTL seconds.
      const { ensureOtpTtlIndex } = await import("../models/ensureIndexes.js");
      await ensureOtpTtlIndex();
    }
    return isConnected;
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    console.log("Server will continue without database. Some features will be unavailable.");
    isConnected = false;
    return false;
  }
}

export function getConnectionStatus() {
  return isConnected;
}

mongoose.connection.on("disconnected", () => {
  isConnected = false;
  console.log("MongoDB disconnected");
});

mongoose.connection.on("error", (err) => {
  console.error("MongoDB error:", err.message);
});

export default mongoose;
