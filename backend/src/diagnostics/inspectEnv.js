import fs from "fs";

const env = fs.readFileSync(".env", "utf8");
const lines = env.split(/\r?\n/);
for (const l of lines) {
  const i = l.indexOf("=");
  if (i < 0) continue;
  const k = l.slice(0, i).trim();
  if (/EMAIL|NODE_ENV/i.test(k)) {
    const v = l.slice(i + 1);
    console.log(k + " = byteLen " + v.length + " | repr " + JSON.stringify(v));
  }
}

