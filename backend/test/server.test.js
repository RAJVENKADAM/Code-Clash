import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI ||= "mongodb://127.0.0.1:27017/codeclash-test";
process.env.JWT_SECRET ||= "test-only-access-secret-with-sufficient-length";
process.env.JWT_REFRESH_SECRET ||= "test-only-refresh-secret-with-sufficient-length";

const { default: app } = await import("../src/server.js");

async function withServer(t, run) {
  const server = createServer(app);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(
    () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );

  const address = server.address();
  assert.ok(address && typeof address === "object");
  await run(`http://127.0.0.1:${address.port}`);
}

test("health endpoint reports database readiness and request correlation", async (t) => {
  await withServer(t, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    const body = await response.json();

    assert.equal(response.status, 503);
    assert.equal(body.status, "degraded");
    assert.equal(body.dependencies.database, "disconnected");
    assert.ok(response.headers.get("x-request-id"));
  });
});

test("creator verification endpoint is mounted and validates input", async (t) => {
  await withServer(t, async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/creator-verification/request-otp`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "not-an-email" }),
      },
    );

    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /valid email/i);
  });
});
