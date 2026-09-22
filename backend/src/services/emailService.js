import nodemailer from "nodemailer";
import config from "../config/env.js";

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (config.EMAIL_USER && config.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
      host: config.EMAIL_HOST || "smtp.ethereal.email",
      port: parseInt(config.EMAIL_PORT || "587"),
      secure: false,
      auth: {
        user: config.EMAIL_USER,
        pass: config.EMAIL_PASS,
      },
    });
  } else {
    // Create Ethereal test account for development
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: "ethereal.user@ethereal.email",
        pass: "ethereal.password",
      },
    });
  }

  return transporter;
}

export async function sendBattleRoomResultEmail({
  email,
  userName,
  roomTitle,
  totalScore,
  totalPassed,
  totalQuestions,
  codingBehavior,
  rank,
  totalParticipants,
  roomCode,
}) {
  try {
    const transport = getTransporter();

    // Generate Ethereal URL if using test account
    let etherealUrl = null;
    if (!config.EMAIL_USER) {
      const testAccount = await nodemailer.createTestAccount();
      transport.options.auth.user = testAccount.user;
      transport.options.auth.pass = testAccount.pass;
    }

    const medalEmoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "🏅";
    const passRate = totalQuestions > 0 ? Math.round((totalPassed / totalQuestions) * 100) : 0;
    const codingStyle = getCodingStyleDescription(codingBehavior);

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Courier New', monospace; background: #0d0d0d; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #1a1a1a; border: 2px solid #333; border-radius: 12px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #1a1a2e, #16213e); padding: 32px; text-align: center; border-bottom: 2px solid #333; }
    .badge { display: inline-block; background: #00ff88; color: #000; padding: 4px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-bottom: 12px; }
    .title { color: #00ff88; font-size: 24px; margin: 0 0 8px; }
    .subtitle { color: #6b7280; font-size: 13px; margin: 0; }
    .content { padding: 24px; }
    .greeting { color: #e5e7eb; font-size: 16px; margin-bottom: 16px; }
    .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
    .stat-box { background: #111; border: 1px solid #2a2a2a; border-radius: 8px; padding: 16px; text-align: center; }
    .stat-label { color: #6b7280; font-size: 11px; text-transform: uppercase; margin-bottom: 4px; }
    .stat-value { color: #00ff88; font-size: 22px; font-weight: bold; }
    .rank-badge { font-size: 32px; margin-bottom: 8px; }
    .behavior-section { background: #111; border: 1px solid #2a2a2a; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
    .behavior-title { color: #9ca3af; font-size: 12px; text-transform: uppercase; margin-bottom: 12px; }
    .behavior-text { color: #d1d5db; font-size: 14px; line-height: 1.6; }
    .non-ai-badge { display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #00ff88, #00b8a3); color: #000; padding: 8px 20px; border-radius: 8px; font-size: 14px; font-weight: bold; margin: 16px 0; }
    .footer { border-top: 1px solid #333; padding: 20px; text-align: center; }
    .footer-text { color: #6b7280; font-size: 11px; }
    .room-code { color: #ffc01e; font-size: 14px; font-weight: bold; }
    hr { border: none; border-top: 1px solid #2a2a2a; margin: 16px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="badge">⚔️ BATTLE COMPLETED</div>
        <h1 class="title">${roomTitle}</h1>
        <p class="subtitle">${medalEmoji} You finished #${rank} out of ${totalParticipants} participants</p>
      </div>
      <div class="content">
        <p class="greeting">Hey ${userName},</p>
        <p style="color: #9ca3af; font-size: 13px; line-height: 1.6; margin-bottom: 20px;">
          The battle has ended! Here's your complete performance summary from the coding war room.
        </p>
        
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-label">Total Score</div>
            <div class="stat-value">${Math.round(totalScore)}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Pass Rate</div>
            <div class="stat-value">${passRate}%</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Tests Passed</div>
            <div class="stat-value">${totalPassed}/${totalQuestions}</div>
          </div>
          <div class="stat-box">
            <div class="stat-label">Rank</div>
            <div class="stat-value">#${rank}</div>
          </div>
        </div>

        <div class="non-ai-badge">
          🤖 Non-AI Coder
        </div>

        <div class="behavior-section">
          <div class="behavior-title">⚡ Your Coding Style</div>
          <div class="behavior-text">${codingStyle}</div>
        </div>

        <hr />

        <div style="text-align: center; margin-bottom: 16px;">
          <p style="color: #6b7280; font-size: 12px; margin-bottom: 8px;">Battle Room Code</p>
          <p style="color: #ffc01e; font-size: 20px; font-weight: bold; letter-spacing: 4px; font-family: monospace;">${roomCode}</p>
        </div>

        <p style="color: #6b7280; font-size: 12px; line-height: 1.5; text-align: center;">
          Share your achievement on LinkedIn with pride. You earned the Non-AI Coder badge by writing clean, original code.
        </p>
      </div>
      <div class="footer">
        <p class="footer-text">Coding Challenge Platform &copy; ${new Date().getFullYear()}</p>
        <p class="footer-text">Built for developers who code with integrity</p>
      </div>
    </div>
  </div>
</body>
</html>`;

    const textContent = `
⚔️ BATTLE COMPLETED - ${roomTitle}
${medalEmoji} You finished #${rank} out of ${totalParticipants} participants

Hey ${userName},

The battle has ended! Here's your performance summary:

Total Score: ${Math.round(totalScore)}
Pass Rate: ${passRate}%
Tests Passed: ${totalPassed}/${totalQuestions}
Rank: #${rank}

🏆 Non-AI Coder

Coding Style: ${codingStyle}

Room Code: ${roomCode}

Share your achievement on LinkedIn with pride!
    `;

    const info = await transport.sendMail({
      from: `"Coding Challenge Platform" <${config.EMAIL_USER || "noreply@coding-challenge-platform.com"}>`,
      to: email,
      subject: `⚔️ Battle Complete! ${roomTitle} - Your Performance (Rank #${rank})`,
      text: textContent,
      html: htmlContent,
    });

    // If using Ethereal, log the preview URL
    if (!config.EMAIL_USER) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log(`[EmailService] Preview URL: ${previewUrl}`);
        return { success: true, previewUrl, messageId: info.messageId };
      }
    }

    console.log(`[EmailService] Result email sent to ${email}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[EmailService] Failed to send email to ${email}:`, error.message);
    return { success: false, error: error.message };
  }
}

function getCodingStyleDescription(behavior) {
  if (!behavior) return "You participated in the battle and submitted your solutions.";

  const parts = [];
  const totalLines = behavior.totalLinesWritten || 0;
  const totalEdits = behavior.totalEdits || 0;
  const timePerQuestion = behavior.timePerQuestion || 0;
  const editFrequency = behavior.editFrequency || 0;
  const completedEarly = behavior.completedEarly || false;
  const languages = behavior.languagesUsed || [];

  if (totalLines > 0) {
    if (totalLines > 200) {
      parts.push("You wrote comprehensive, well-structured code with attention to detail.");
    } else if (totalLines > 100) {
      parts.push("You wrote clean, maintainable code that gets the job done.");
    } else {
      parts.push("You wrote concise, efficient code - minimalism at its finest.");
    }
  }

  if (editFrequency > 0) {
    if (editFrequency > 10) {
      parts.push("You iterated frequently, refining your approach with each edit.");
    } else if (editFrequency > 5) {
      parts.push("You maintained a steady editing pace, balancing thought and action.");
    } else {
      parts.push("You planned your solution carefully before coding.");
    }
  }

  if (timePerQuestion > 0) {
    if (timePerQuestion < 300) {
      parts.push("You solved problems quickly, demonstrating strong problem-solving skills.");
    } else if (timePerQuestion < 900) {
      parts.push("You took a measured approach, solving problems methodically.");
    } else {
      parts.push("You took your time to thoroughly understand and solve each problem.");
    }
  }

  if (completedEarly) {
    parts.push("You completed the battle ahead of time, showcasing efficiency and skill.");
  }

  if (languages.length > 0) {
    const langStr = languages.join(", ");
    parts.push(`You coded in: ${langStr}.`);
  }

  if (parts.length === 0) {
    return "You participated in the battle and submitted your solutions with determination.";
  }

  return parts.join(" ");
}

export default {
  sendBattleRoomResultEmail,
};
