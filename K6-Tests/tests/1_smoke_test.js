import http from "k6/http";
import { check } from "k6";
import { uuidv4 } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";
import { BASE_URL } from "./k6-config.js";

const testData = JSON.parse(open("./test-data.json"));

// Just use the first org for smoke test
const ORG = testData.organizations[0];
const APP = ORG.applications[0];
const ENV = ORG.environments[0];
const API_KEY = ORG.apiKeys[0].rawKey;

console.log(`Using organization: ${ORG.name}`);
console.log(`Using application: ${APP.name}`);
console.log(`Using environment: ${ENV}`);
console.log(`Using API key: ${API_KEY.slice(0, 10)}...`);

export const options = {
  vus: 1,
  iterations: 3,
};

function makePayload() {
  return JSON.stringify({
    application: APP,
    environment: ENV,
    host: `${APP}-${ENV}-01`,
    version: "1.0.0",
    logs: [
      {
        timestamp: new Date().toISOString(),
        level: "INFO",
        message: "✅ Smoke test log — system is alive",
        trace_id: Math.random().toString(16).slice(2, 18),
        metadata: {
          latency_ms: 42,
          user_id: "user_smoke",
          request_id: uuidv4(),
        },
      },
    ],
  });
}

export default function () {
  const res = http.post(BASE_URL, makePayload(), {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
  });

  check(res, {
    "✅ Status 202 (Accepted)": (r) => r.status === 202,
    "✅ Response time < 1s": (r) => r.timings.duration < 1000,
  });

  console.log(
    `[${ORG.name}] status=${res.status} | time=${res.timings.duration.toFixed(0)}ms`,
  );
}
