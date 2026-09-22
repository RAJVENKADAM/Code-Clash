import PDFDocument from "pdfkit";
import BattleRoom from "../models/BattleRoom.js";
import BattleRoomSubmission from "../models/BattleRoomSubmission.js";

/**
 * Fetch and verify access to room report data.
 * Enforces strict creator / tenant authorization to prevent IDOR.
 */
export async function getRoomReportData(roomCode, userId) {
  const room = await BattleRoom.findOne({
    roomCode: roomCode.toUpperCase(),
    isActive: true,
    isDeleted: false,
  }).populate("createdBy", "name email organization");

  if (!room) {
    const error = new Error("Battle room not found.");
    error.statusCode = 404;
    throw error;
  }

  // Authorization check: creator only
  if (room.createdBy._id.toString() !== userId.toString()) {
    const error = new Error("Unauthorized. Only the room creator can generate or download reports.");
    error.statusCode = 403;
    throw error;
  }

  const submissions = await BattleRoomSubmission.find({
    roomId: room._id,
  })
    .populate("userId", "name email organization")
    .sort({ totalScore: -1, totalPassed: -1 })
    .lean();

  // Compute Analytics
  const totalParticipants = submissions.length;
  const completed = submissions.filter((s) => s.status === "COMPLETED").length;
  const disqualified = submissions.filter((s) => s.status === "DISQUALIFIED").length;
  const inProgress = totalParticipants - completed - disqualified;

  const scores = submissions.map((s) => s.totalScore || 0);
  const highestScore = scores.length ? Math.max(...scores) : 0;
  const lowestScore = scores.length ? Math.min(...scores) : 0;
  const avgScore = scores.length
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
    : 0;

  const sortedScores = [...scores].sort((a, b) => a - b);
  const mid = Math.floor(sortedScores.length / 2);
  const medianScore = sortedScores.length
    ? sortedScores.length % 2 !== 0
      ? sortedScores[mid]
      : Math.round(((sortedScores[mid - 1] + sortedScores[mid]) / 2) * 100) / 100
    : 0;

  // Question Analytics
  const questionStats = (room.questions || []).map((q, idx) => {
    let attempted = 0;
    let accepted = 0;
    for (const sub of submissions) {
      const qr = (sub.questionResults || []).find(
        (r) => r.questionId.toString() === q._id.toString()
      );
      if (qr && qr.status !== "PENDING") {
        attempted++;
        if (qr.status === "ACCEPTED") {
          accepted++;
        }
      }
    }
    const passRate = attempted > 0 ? Math.round((accepted / attempted) * 100) : 0;
    return {
      questionNumber: idx + 1,
      questionId: q._id,
      title: q.title,
      difficulty: q.difficulty,
      points: q.points,
      attempted,
      accepted,
      passRate,
    };
  });

  const participantSummaries = submissions.map((sub, idx) => {
    const totalDurationSeconds = sub.submittedAt && sub.startTime
      ? Math.max(1, Math.floor((new Date(sub.submittedAt) - new Date(sub.startTime)) / 1000))
      : Math.max(1, Math.floor((new Date() - new Date(sub.startTime)) / 1000));

    return {
      rank: idx + 1,
      submissionId: sub._id,
      userId: sub.userId?._id,
      name: sub.participantName || sub.userId?.name || "Anonymous",
      email: sub.userId?.email || "N/A",
      organization: sub.participantOrganization || sub.userId?.organization || "Unspecified",
      totalScore: sub.totalScore || 0,
      totalPassed: sub.totalPassed || 0,
      totalFailed: sub.totalFailed || 0,
      totalQuestions: sub.totalQuestions || room.questions.length,
      status: sub.status,
      startTime: sub.startTime,
      submittedAt: sub.submittedAt,
      durationSeconds: totalDurationSeconds,
      disqualifyReason: sub.disqualifyReason,
      codingBehavior: sub.codingBehavior,
      questionResults: (sub.questionResults || []).map((qr) => ({
        questionId: qr.questionId,
        questionTitle: qr.questionTitle,
        status: qr.status,
        score: qr.score,
        passed: qr.passed,
        failed: qr.failed,
        total: qr.total,
        executionTime: qr.executionTime,
        memoryUsed: qr.memoryUsed,
        language: qr.language,
        code: qr.code || "",
      })),
    };
  });

  return {
    room: {
      id: room._id,
      roomCode: room.roomCode,
      title: room.title,
      description: room.description,
      status: room.status,
      timeLimit: room.timeLimit,
      timeLimitUnit: room.timeLimitUnit,
      startTime: room.startTime,
      endTime: room.endTime,
      timezone: room.timezone || "UTC",
      createdAt: room.createdAt,
      creator: {
        name: room.createdBy?.name || "Organizer",
        organization: room.createdBy?.organization || "Coding Challenge Platform",
      },
      questionCount: room.questions.length,
    },
    analytics: {
      totalParticipants,
      completed,
      inProgress,
      disqualified,
      completionRate: totalParticipants > 0 ? Math.round((completed / totalParticipants) * 100) : 0,
      highestScore,
      lowestScore,
      averageScore: avgScore,
      medianScore,
      questionStats,
    },
    participants: participantSummaries,
  };
}

/**
 * Format duration in seconds to human readable string (e.g. 14m 20s).
 */
function formatSeconds(secs) {
  if (!secs && secs !== 0) return "—";
  secs = Math.round(secs);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Format date to human readable timestamp in UTC or specified timezone.
 */
function formatDateTime(date, tz = "UTC") {
  if (!date) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: tz,
    }).format(new Date(date)) + ` (${tz})`;
  } catch {
    return new Date(date).toUTCString();
  }
}

/**
 * Generate a complete multi-page organizational room report in PDF format.
 */
export async function streamCompleteRoomPDF(roomCode, userId, res) {
  const data = await getRoomReportData(roomCode, userId);
  const { room, analytics, participants } = data;

  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
    bufferPages: true,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="room-report-${roomCode}.pdf"`
  );

  doc.pipe(res);

  const primaryColor = "#0f172a";
  const secondaryColor = "#334155";
  const accentColor = "#2563eb";
  const grayLight = "#f1f5f9";
  const grayBorder = "#cbd5e1";
  const textColor = "#1e293b";
  const successColor = "#16a34a";
  const dangerColor = "#dc2626";

  // ---------------- HEADER ----------------
  doc
    .fillColor(accentColor)
    .fontSize(18)
    .font("Helvetica-Bold")
    .text("CODING CHALLENGE PLATFORM", 40, 40);

  doc
    .fillColor(secondaryColor)
    .fontSize(10)
    .font("Helvetica")
    .text("Official Room Evaluation & Assessment Report", 40, 62);

  doc
    .strokeColor(grayBorder)
    .lineWidth(1)
    .moveTo(40, 80)
    .lineTo(555, 80)
    .stroke();

  // ---------------- ROOM INFO SECTION ----------------
  doc.moveDown(1.5);
  doc
    .fillColor(primaryColor)
    .fontSize(16)
    .font("Helvetica-Bold")
    .text(room.title, 40, 95);

  doc
    .fillColor(secondaryColor)
    .fontSize(10)
    .font("Helvetica")
    .text(`Room Code: ${room.roomCode}  |  Organization: ${room.creator.organization}  |  Organizer: ${room.creator.name}`, 40, 115);

  const startStr = formatDateTime(room.startTime, room.timezone);
  const endStr = formatDateTime(room.endTime, room.timezone);
  doc.text(`Scheduled Window: ${startStr}  ->  ${endStr}`, 40, 130);
  doc.text(`Status: ${room.status}  |  Duration Limit: ${room.timeLimit} ${room.timeLimitUnit || "minutes"}  |  Total Questions: ${room.questionCount}`, 40, 145);

  // ---------------- SUMMARY METRICS CARDS ----------------
  const cardY = 168;
  const cardWidth = 120;
  const cardHeight = 52;
  const cards = [
    { label: "Total Participants", value: String(analytics.totalParticipants) },
    { label: "Completion Rate", value: `${analytics.completionRate}%` },
    { label: "Average Score", value: String(analytics.averageScore) },
    { label: "Top Score", value: String(analytics.highestScore) },
  ];

  cards.forEach((c, i) => {
    const x = 40 + i * (cardWidth + 10);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 4).fill(grayLight).stroke(grayBorder);
    doc
      .fillColor(secondaryColor)
      .fontSize(8)
      .font("Helvetica-Bold")
      .text(c.label.toUpperCase(), x + 8, cardY + 8);
    doc
      .fillColor(accentColor)
      .fontSize(16)
      .font("Helvetica-Bold")
      .text(c.value, x + 8, cardY + 24);
  });

  // ---------------- QUESTION BREAKDOWN TABLE ----------------
  let currentY = 238;
  doc
    .fillColor(primaryColor)
    .fontSize(12)
    .font("Helvetica-Bold")
    .text("Challenge Questions Breakdown", 40, currentY);

  currentY += 18;
  doc.rect(40, currentY, 515, 20).fill(primaryColor);
  doc.fillColor("#ffffff").fontSize(8).font("Helvetica-Bold");
  doc.text("#", 45, currentY + 6);
  doc.text("Question Title", 70, currentY + 6);
  doc.text("Difficulty", 270, currentY + 6);
  doc.text("Max Pts", 350, currentY + 6);
  doc.text("Attempted", 420, currentY + 6);
  doc.text("Pass Rate", 480, currentY + 6);

  currentY += 20;
  analytics.questionStats.forEach((qs, i) => {
    const rowBg = i % 2 === 0 ? "#ffffff" : grayLight;
    doc.rect(40, currentY, 515, 18).fill(rowBg);
    doc.fillColor(textColor).fontSize(8).font("Helvetica");
    doc.text(String(qs.questionNumber), 45, currentY + 5);
    doc.text(qs.title.substring(0, 38), 70, currentY + 5);
    doc.text(qs.difficulty, 270, currentY + 5);
    doc.text(String(qs.points), 350, currentY + 5);
    doc.text(String(qs.attempted), 420, currentY + 5);
    doc.text(`${qs.passRate}% (${qs.accepted})`, 480, currentY + 5);
    currentY += 18;
  });

  // ---------------- PARTICIPANT LEADERBOARD TABLE ----------------
  currentY += 16;
  doc
    .fillColor(primaryColor)
    .fontSize(12)
    .font("Helvetica-Bold")
    .text("Participant Rankings", 40, currentY);

  currentY += 18;
  doc.rect(40, currentY, 515, 20).fill(primaryColor);
  doc.fillColor("#ffffff").fontSize(8).font("Helvetica-Bold");
  doc.text("Rank", 45, currentY + 6);
  doc.text("Participant Name", 80, currentY + 6);
  doc.text("Organization", 220, currentY + 6);
  doc.text("Score", 340, currentY + 6);
  doc.text("Solved", 390, currentY + 6);
  doc.text("Time", 440, currentY + 6);
  doc.text("Status", 490, currentY + 6);

  currentY += 20;
  participants.forEach((p, idx) => {
    if (currentY > 730) {
      doc.addPage();
      currentY = 40;
    }
    const rowBg = idx % 2 === 0 ? "#ffffff" : grayLight;
    doc.rect(40, currentY, 515, 18).fill(rowBg);
    doc.fillColor(textColor).fontSize(8).font("Helvetica");
    doc.text(`#${p.rank}`, 45, currentY + 5);
    doc.text(p.name.substring(0, 24), 80, currentY + 5);
    doc.text(p.organization.substring(0, 20), 220, currentY + 5);
    doc.text(String(p.totalScore), 340, currentY + 5);
    doc.text(`${p.totalPassed}/${p.totalQuestions}`, 390, currentY + 5);
    doc.text(formatSeconds(p.durationSeconds), 440, currentY + 5);

    const statusColor = p.status === "COMPLETED" ? successColor : p.status === "DISQUALIFIED" ? dangerColor : secondaryColor;
    doc.fillColor(statusColor).text(p.status, 490, currentY + 5);
    currentY += 18;
  });

  // ---------------- PARTICIPANT DETAILS & CODE SUBMISSIONS ----------------
  doc.addPage();
  currentY = 40;
  doc
    .fillColor(primaryColor)
    .fontSize(14)
    .font("Helvetica-Bold")
    .text("Participant Submission Code Listings", 40, currentY);

  currentY += 22;

  for (const p of participants) {
    if (currentY > 650) {
      doc.addPage();
      currentY = 40;
    }

    doc
      .fillColor(accentColor)
      .fontSize(11)
      .font("Helvetica-Bold")
      .text(`Rank #${p.rank}: ${p.name} (${p.email}) — Score: ${p.totalScore} pts`, 40, currentY);

    currentY += 14;
    doc
      .fillColor(secondaryColor)
      .fontSize(8)
      .font("Helvetica")
      .text(`Organization: ${p.organization} | Status: ${p.status} | Total Duration: ${formatSeconds(p.durationSeconds)}`, 40, currentY);

    currentY += 14;

    for (const qr of p.questionResults) {
      if (currentY > 680) {
        doc.addPage();
        currentY = 40;
      }

      doc
        .fillColor(textColor)
        .fontSize(9)
        .font("Helvetica-Bold")
        .text(`Question: ${qr.questionTitle} [${qr.status}] — Score: ${qr.score} pts (${qr.passed}/${qr.total} passed, ${qr.executionTime}ms, Lang: ${qr.language})`, 40, currentY);

      currentY += 14;

      const codeContent = qr.code || "// No code submitted";
      const codeLines = codeContent.split("\n").slice(0, 60);

      doc.fillColor(textColor).fontSize(7).font("Courier");
      const blockHeight = Math.min(220, codeLines.length * 9 + 12);

      if (currentY + blockHeight > 750) {
        doc.addPage();
        currentY = 40;
      }

      doc.rect(40, currentY, 515, blockHeight).fill(grayLight).stroke(grayBorder);
      let textY = currentY + 6;
      for (const line of codeLines) {
        if (textY > currentY + blockHeight - 10) break;
        doc.text(line.substring(0, 95), 46, textY);
        textY += 9;
      }
      currentY += blockHeight + 10;
    }

    currentY += 10;
  }

  // ---------------- PAGE NUMBERS & FOOTER ----------------
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .fillColor(secondaryColor)
      .fontSize(8)
      .font("Helvetica")
      .text(
        `Coding Challenge Platform  •  Room ${room.roomCode}  •  Page ${i + 1} of ${range.count}`,
        40,
        800,
        { align: "center", width: 515 }
      );
  }

  doc.end();
}

/**
 * Generate an individual participant evaluation report in PDF format.
 */
export async function streamParticipantReportPDF(roomCode, participantId, userId, res) {
  const data = await getRoomReportData(roomCode, userId);
  const { room, participants } = data;

  const participant = participants.find(
    (p) => String(p.userId) === String(participantId) || String(p.submissionId) === String(participantId)
  );

  if (!participant) {
    const error = new Error("Participant submission not found in this room.");
    error.statusCode = 404;
    throw error;
  }

  const doc = new PDFDocument({
    size: "A4",
    margin: 40,
    bufferPages: true,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="participant-${participant.name.replace(/\s+/g, "_")}-${roomCode}.pdf"`
  );

  doc.pipe(res);

  const primaryColor = "#0f172a";
  const secondaryColor = "#334155";
  const accentColor = "#2563eb";
  const grayLight = "#f1f5f9";
  const grayBorder = "#cbd5e1";
  const textColor = "#1e293b";

  // Header
  doc
    .fillColor(accentColor)
    .fontSize(18)
    .font("Helvetica-Bold")
    .text("CODING CHALLENGE PLATFORM", 40, 40);

  doc
    .fillColor(secondaryColor)
    .fontSize(10)
    .font("Helvetica")
    .text("Individual Candidate Assessment Report", 40, 62);

  doc
    .strokeColor(grayBorder)
    .lineWidth(1)
    .moveTo(40, 80)
    .lineTo(555, 80)
    .stroke();

  // Participant & Room Overview
  doc.moveDown(1.5);
  doc
    .fillColor(primaryColor)
    .fontSize(15)
    .font("Helvetica-Bold")
    .text(`Candidate: ${participant.name}`, 40, 95);

  doc
    .fillColor(secondaryColor)
    .fontSize(10)
    .font("Helvetica")
    .text(`Email: ${participant.email}  |  Organization: ${participant.organization}`, 40, 115);

  doc.text(`Challenge: ${room.title} (Room Key: ${room.roomCode})`, 40, 130);
  doc.text(`Rank: #${participant.rank} of ${participants.length}  |  Total Score: ${participant.totalScore} pts  |  Status: ${participant.status}`, 40, 145);
  doc.text(`Start: ${formatDateTime(participant.startTime, room.timezone)}  |  Finish: ${formatDateTime(participant.submittedAt, room.timezone)}  |  Total Duration: ${formatSeconds(participant.durationSeconds)}`, 40, 160);

  let currentY = 190;
  doc
    .fillColor(primaryColor)
    .fontSize(12)
    .font("Helvetica-Bold")
    .text("Question-by-Question Evaluation", 40, currentY);

  currentY += 18;

  for (const qr of participant.questionResults) {
    if (currentY > 620) {
      doc.addPage();
      currentY = 40;
    }

    doc
      .fillColor(accentColor)
      .fontSize(10)
      .font("Helvetica-Bold")
      .text(`Question: ${qr.questionTitle}`, 40, currentY);

    currentY += 14;
    doc
      .fillColor(textColor)
      .fontSize(8)
      .font("Helvetica")
      .text(`Status: ${qr.status}  |  Score: ${qr.score} pts  |  Test Cases: ${qr.passed}/${qr.total} passed  |  Time: ${qr.executionTime}ms  |  Language: ${qr.language}`, 40, currentY);

    currentY += 14;

    const codeContent = qr.code || "// No code submitted";
    const codeLines = codeContent.split("\n");

    doc.fillColor(textColor).fontSize(7.5).font("Courier");
    const blockHeight = Math.min(250, codeLines.length * 9.5 + 12);

    if (currentY + blockHeight > 750) {
      doc.addPage();
      currentY = 40;
    }

    doc.rect(40, currentY, 515, blockHeight).fill(grayLight).stroke(grayBorder);
    let textY = currentY + 6;
    for (const line of codeLines) {
      if (textY > currentY + blockHeight - 10) break;
      doc.text(line.substring(0, 95), 46, textY);
      textY += 9.5;
    }
    currentY += blockHeight + 16;
  }

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .fillColor(secondaryColor)
      .fontSize(8)
      .font("Helvetica")
      .text(
        `Coding Challenge Platform  •  Candidate Report: ${participant.name}  •  Page ${i + 1} of ${range.count}`,
        40,
        800,
        { align: "center", width: 515 }
      );
  }

  doc.end();
}
