import nodemailer from "nodemailer";
import config from "../config/env.js";

const port = parseInt(String(config.EMAIL_PORT).replace(";", "").trim(), 10);
const secure = port === 465;
const sanitizedPass = String(config.EMAIL_PASS).replace(/\s+/g, "");

console.log("=== SMTP CONNECTION TEST ===");
console.log("HOST:", config.EMAIL_HOST);
console.log("PORT:", port, "| secure:", secure);
console.log("USER:", config.EMAIL_USER);
console.log("PASS length:", sanitizedPass.length);

const transport = nodemailer.createTransport({
  host: config.EMAIL_HOST,
  port,
  secure,
  auth: { user: config.EMAIL_USER, pass: sanitizedPass },
  connectionTimeout: 15000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
  tls: { rejectUnauthorized: false },
});

try {
  const ok = await transport.verify();
  console.log("VERIFY SUCCESS:", ok);
} catch (err) {
  console.error("VERIFY FAILED:", err.message);
  if (err.response) console.error("SMTP RESPONSE:", err.response);
}

