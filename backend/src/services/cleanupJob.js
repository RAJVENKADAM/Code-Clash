import cron from "node-cron";
import User from "../models/User.js";
import Organization from "../models/Organization.js";
import Otp from "../models/Otp.js";
import BattleRoom from "../models/BattleRoom.js";
import BattleRoomSubmission from "../models/BattleRoomSubmission.js";
import { sendBattleRoomResultEmail } from "../services/emailService.js";

export function startCleanupJobs() {
  // Run every hour at minute 0 — defensive sweep for any OTP documents that
  // outlived their TTL index (e.g. due to a restart or index failure). The
  // primary cleanup is handled by MongoDB's TTL monitor on the Otp collection.
  cron.schedule("0 * * * *", async () => {
    console.log("[CleanupJob] Running defensive OTP TTL sweep...");
    try {
      const cutoff = new Date(Date.now() - 300 * 1000);
      const result = await Otp.deleteMany({ createdAt: { $lte: cutoff } });
      if (result.deletedCount > 0) {
        console.log(
          `[CleanupJob] Removed ${result.deletedCount} expired OTP records.`,
        );
      }
    } catch (error) {
      console.error("[CleanupJob] OTP cleanup failed:", error.message);
    }
  });

  // Run daily at midnight to update organization metrics
  cron.schedule("0 0 * * *", async () => {
    console.log(
      "[CleanupJob] Running daily organization metrics recalibration...",
    );
    try {
      const organizations = await Organization.find({}).sort({
        bayesianScore: -1,
      });
      for (let i = 0; i < organizations.length; i++) {
        organizations[i].rank = i + 1;
        await organizations[i].save();
      }
      console.log(
        `[CleanupJob] Recalibrated ${organizations.length} organization rankings.`,
      );
    } catch (error) {
      console.error(
        "[CleanupJob] Organization recalibration failed:",
        error.message,
      );
    }
  });

  // Run every minute to close expired battle rooms
  cron.schedule("* * * * *", async () => {
    console.log("[CleanupJob] Checking for expired battle rooms...");
    try {
      const now = new Date();
      const expiredRooms = await BattleRoom.find({
        status: "ACTIVE",
        endTime: { $lte: now },
        isActive: true,
        isDeleted: false,
      });

      for (const room of expiredRooms) {
        console.log(
          `[CleanupJob] Auto-closing battle room: ${room.roomCode} - ${room.title}`,
        );

        // Auto-submit any pending submissions
        const pendingSubmissions = await BattleRoomSubmission.find({
          roomId: room._id,
          status: "PENDING",
        });

        for (const sub of pendingSubmissions) {
          sub.status = "COMPLETED";
          sub.submittedAt = new Date();
          const totalTime = Math.floor(
            (sub.submittedAt - sub.startTime) / 1000,
          );
          sub.codingBehavior.timePerQuestion =
            sub.totalQuestions > 0 ? totalTime / sub.totalQuestions : 0;
          sub.codingBehavior.editFrequency =
            sub.codingBehavior.totalEdits > 0
              ? sub.codingBehavior.totalEdits / (totalTime / 60)
              : 0;
          sub.codingBehavior.completedEarly = false;
          await sub.save();
        }

        room.status = "CLOSED";
        await room.save();

        // Send result emails
        const allSubmissions = await BattleRoomSubmission.find({
          roomId: room._id,
          status: "COMPLETED",
        })
          .populate("userId", "name email")
          .sort({ totalScore: -1, totalPassed: -1 })
          .lean();

        const totalParticipants = allSubmissions.length;

        for (let i = 0; i < allSubmissions.length; i++) {
          const sub = allSubmissions[i];
          const user = sub.userId;
          if (user && user.email) {
            sendBattleRoomResultEmail({
              email: user.email,
              userName: user.name,
              roomTitle: room.title,
              totalScore: sub.totalScore,
              totalPassed: sub.totalPassed,
              totalQuestions: sub.totalQuestions,
              codingBehavior: sub.codingBehavior,
              rank: i + 1,
              totalParticipants,
              roomCode: room.roomCode,
            }).catch((err) => {
              console.error(
                `[CleanupJob] Failed to send email to ${user.email}:`,
                err.message,
              );
            });
          }
        }

        console.log(
          `[CleanupJob] Closed battle room ${room.roomCode} with ${totalParticipants} participants.`,
        );
      }
    } catch (error) {
      console.error("[CleanupJob] Battle room cleanup failed:", error.message);
    }
  });

  // Run daily to soft-delete battle rooms inactive for more than 1 year
  cron.schedule("0 3 * * *", async () => {
    console.log("[CleanupJob] Checking for battle rooms older than 1 year...");
    try {
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const oldRooms = await BattleRoom.find({
        isActive: true,
        isDeleted: false,
        $or: [
          { expiresAt: { $lte: nowRef() } },
          { createdAt: { $lte: oneYearAgo } },
        ],
      });

      for (const room of oldRooms) {
        room.isDeleted = true;
        room.deletedAt = new Date();
        await room.save();
        console.log(
          `[CleanupJob] Auto-deleted inactive battle room: ${room.roomCode} - ${room.title}`,
        );
      }
    } catch (error) {
      console.error(
        "[CleanupJob] Battle room auto-deletion failed:",
        error.message,
      );
    }
  });

  // Run every minute to purge leaderboard/submission data for rooms whose
  // time has ended (CLOSED). Per the product requirement, once a room's time
  // ends all of its data must be deleted so the leaderboard is no longer
  // visible for that room.
  cron.schedule("* * * * *", async () => {
    console.log("[CleanupJob] Purging battle room data for ended rooms...");
    try {
      const now = new Date();
      const endedRooms = await BattleRoom.find({
        status: "CLOSED",
        isActive: true,
        isDeleted: false,
        endTime: { $lte: now },
      }).select("_id roomCode title endTime");

      for (const room of endedRooms) {
        // Delete all submissions for the room (leaderboard data).
        const delResult = await BattleRoomSubmission.deleteMany({
          roomId: room._id,
        });
        // Soft-delete the room so it is no longer accessible.
        await BattleRoom.updateOne(
          { _id: room._id },
          {
            $set: {
              isDeleted: true,
              deletedAt: now,
              isActive: false,
              status: "CLOSED",
            },
          },
        );
        console.log(
          `[CleanupJob] Purged room ${room.roomCode} (${room.title}) data: removed ${delResult.deletedCount} submissions.`,
        );
      }
    } catch (error) {
      console.error(
        "[CleanupJob] Battle room data purge failed:",
        error.message,
      );
    }
  });

  console.log("[CleanupJob] Scheduled cleanup jobs started.");
}

function nowRef() {
  return new Date();
}
