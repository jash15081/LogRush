import http from "k6/http";
import { check } from "k6";
import { BASE_URL } from "./k6-config.js";

export const options = {
  vus: 2,
  iterations: 6,
};

function makePayload() {
  return JSON.stringify({
    application: "fake-app",
    environment: "production",
    host: "fake-host",
    version: "1.0.0",
    logs: [
      {
        timestamp: new Date().toISOString(),
        level: "INFO",
        message: "This should be blocked",
        trace_id: "deadbeef",
        metadata: {
          latency_ms: 0,
          user_id: "hacker",
          request_id: crypto.randomUUID(),
        },
      },
    ],
  });
}

export default function () {
  const res = http.post(BASE_URL, makePayload(), {
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer INVALID-KEY-SHOULD-FAIL",
    },
  });

  check(res, {
    "🔒 Invalid key is rejected (401/403)": (r) =>
      r.status === 401 || r.status === 403,
  });

  console.log(`Security check | status=${res.status} (expected 401 or 403)`);
}
