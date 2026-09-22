import config from "../config/env.js";

console.log("=== EMAIL CONFIG DIAGNOSTIC ===");
console.log("EMAIL_HOST =", config.EMAIL_HOST);
console.log("EMAIL_PORT =", config.EMAIL_PORT);
console.log("EMAIL_USER =", config.EMAIL_USER ? `"${config.EMAIL_USER}"` : "(empty)");
console.log("EMAIL_PASS =", config.EMAIL_PASS ? "(set / non-empty)" : "(empty)");
console.log("EMAIL_FROM_NAME =", config.EMAIL_FROM_NAME);
console.log("NODE_ENV =", config.NODE_ENV);
console.log("================================");

