import nodemailer from "nodemailer";
import config from "../config/env.js";

let transporter;

function getTransporter() {
  if (transporter) return transporter;
  if (!config.EMAIL_USER || !config.EMAIL_PASS) {
    throw new Error("Email delivery is not configured.");
  }

  transporter = nodemailer.createTransport({
    host: config.EMAIL_HOST,
    port: Number(config.EMAIL_PORT || 587),
    secure: Number(config.EMAIL_PORT || 587) === 465,
    requireTLS: Number(config.EMAIL_PORT || 587) !== 465,
    auth: { user: config.EMAIL_USER, pass: config.EMAIL_PASS },
  });
  return transporter;
}

export async function sendCreatorVerificationOtp({ email, code, ttlSeconds }) {
  const minutes = Math.max(1, Math.ceil(ttlSeconds / 60));
  return getTransporter().sendMail({
    from: `"${config.EMAIL_FROM_NAME}" <${config.EMAIL_USER}>`,
    to: email,
    subject: "Verify your email to create a CodeClash battle",
    text: `Your CodeClash creator verification code is ${code}. It expires in ${minutes} minute(s). If you did not request this code, you can ignore this email.`,
    html: `<p>Your CodeClash creator verification code is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p><p>It expires in ${minutes} minute(s). If you did not request this code, you can ignore this email.</p>`,
  });
}
