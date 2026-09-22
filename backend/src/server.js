import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";
import { connectDB } from "./config/db.js";
import config from "./config/env.js";
import { startCleanupJobs } from "./services/cleanupJob.js";
import { securityMiddleware, sanitizeInput, errorHandler } from "./middleware/security.js";
import { requestIdMiddleware } from "./middleware/requestId.js";
import battleRoomRoutes from "./routes/battleRoomRoutes.js";

dotenv.config();

const app = express();
const PORT = config.PORT || 5000;

// Request ID middleware - must be first
app.use(requestIdMiddleware);

// Request logging
app.use(morgan(config.LOG_LEVEL || "dev"));

// Security middleware (Helmet, CORS, Rate Limiting)
securityMiddleware(app);

// Body parsing with size limits
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Input sanitization
app.use(sanitizeInput);

// Health check (no auth required)
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    requestId: req.requestId,
    version: "2.0.0",
  });
});

// API Routes
app.use("/api/battle-rooms", battleRoomRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not found",
    path: req.path,
    requestId: req.requestId,
  });
});

// Error handler (must be last)
app.use(errorHandler);

async function start() {
  const dbConnected = await connectDB();
  if (dbConnected) {
    startCleanupJobs();
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log(`Environment: ${config.NODE_ENV}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

export default app;
