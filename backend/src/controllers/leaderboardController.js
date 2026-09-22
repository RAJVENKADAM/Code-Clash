import {
  calculateUserScores,
  calculateOrganizationScores,
  getGlobalUserLeaderboard,
  getOrganizationLeaderboard,
  getTodayUserRank,
} from "../services/leaderboardAlgorithm.js";
import { getSubmission } from "../services/submissionService.js";
import Challenge from "../models/Challenge.js";
import { getCurrentWindow } from "../utils/challengeWindow.js";

export async function getChallengeLeaderboard(req, res) {
  try {
    const { challengeId } = req.params;

    if (!challengeId) {
      return res.status(400).json({ error: "Challenge ID is required." });
    }

    const userScores = await calculateUserScores(challengeId);
    const organizationScores = await calculateOrganizationScores(challengeId);

    return res.status(200).json({
      challengeId,
      userLeaderboard: userScores,
      organizationLeaderboard: organizationScores,
    });
  } catch (error) {
    console.error("Get challenge leaderboard error:", error.message);
    return res.status(500).json({ error: "Failed to get leaderboard." });
  }
}

export async function getGlobalLeaderboard(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const userLeaderboard = await getGlobalUserLeaderboard(limit);
    const organizationLeaderboard = await getOrganizationLeaderboard(50);

    return res.status(200).json({
      userLeaderboard,
      organizationLeaderboard,
    });
  } catch (error) {
    console.error("Get global leaderboard error:", error.message);
    return res.status(500).json({ error: "Failed to get global leaderboard." });
  }
}

export async function getUserRank(req, res) {
  try {
    const userId = req.userId;
    const leaderboard = await getGlobalUserLeaderboard(10000);
    const userEntry = leaderboard.find(
      (entry) => entry._id.toString() === userId.toString(),
    );

    if (!userEntry) {
      // Return a default instead of 404 so the profile page doesn't break
      // for users who haven't submitted/completed any challenges yet.
      return res.status(200).json({
        rank: null,
        totalScore: 0,
        challengesCompleted: 0,
      });
    }

    return res.status(200).json({
      rank: userEntry.rank,
      totalScore: userEntry.totalScore,
      challengesCompleted: userEntry.challengesCompleted,
    });
  } catch (error) {
    console.error("Get user rank error:", error.message);
    return res.status(500).json({ error: "Failed to get user rank." });
  }
}

export async function getUserRankToday(req, res) {
  try {
    const userId = req.userId;
    const now = new Date();
    const { start, end } = getCurrentWindow(now);

    const todayChallenge = await Challenge.findOne({
      activeDate: { $gte: start, $lt: end },
      isActive: true,
    });

    const result = await getTodayUserRank(userId, todayChallenge?._id);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Get today user rank error:", error.message);
    return res.status(500).json({ error: "Failed to get today's rank." });
  }
}

export async function getUserSubmissionStatus(req, res) {
  try {
    const { challengeId } = req.params;
    const userId = req.userId;

    const submission = await getSubmission(userId, challengeId);
    if (!submission) {
      return res.status(200).json({ submitted: false });
    }

    return res.status(200).json({
      submitted: true,
      status: submission.status,
      isDisqualified: submission.isDisqualified,
      score: submission.score,
      passed: submission.passed,
      total: submission.total,
    });
  } catch (error) {
    console.error("Get submission status error:", error.message);
    return res.status(500).json({ error: "Failed to get submission status." });
  }
}
