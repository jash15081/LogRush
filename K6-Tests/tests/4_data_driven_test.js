import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

const BASE_URL = "http://localhost:4100/ingest";

const rawOrgs = JSON.parse(open("./test-data.json"));

const ORGS = rawOrgs.organizations;

// Extract all API keys from all organizations
const ALL_API_KEYS = ORGS.flatMap((org) =>
  org.apiKeys.map((key) => key.rawKey),
);

const ingestDuration = new Trend("ingest_duration_ms", true);
const successRate = new Rate("ingest_success_rate");
const totalLogs = new Counter("total_logs_ingested");

const BATCH_SIZE = 5;

export const options = {
  stages: [
    { duration: "20s", target: 10 },
    { duration: "20s", target: 50 },
    { duration: "20s", target: 100 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    ingest_duration_ms: ["p(95)<1500"],
    ingest_success_rate: ["rate>0.95"],
    http_req_failed: ["rate<0.05"],
  },
};

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeLogs() {
  const levels = ["INFO", "INFO", "INFO", "WARN", "ERROR"];
  return Array.from({ length: BATCH_SIZE }, () => {
    const level = randomChoice(levels);
    return {
      timestamp: new Date().toISOString(),
      level,
      message: `[${level}] Service event from data-driven ingestion test`,
      trace_id: Math.random().toString(16).slice(2, 18),
      metadata: {
        latency_ms: Math.floor(Math.random() * 400),
        user_id: `user_${Math.floor(Math.random() * 1000)}`,
        request_id: crypto.randomUUID(),
      },
    };
  });
}

export default function () {
  const org = ORGS[__VU % ORGS.length];
  const application = randomChoice(org.applications);
  const environment = randomChoice(org.environments);
  const apiKey = ALL_API_KEYS[__VU % ALL_API_KEYS.length];

  const payload = JSON.stringify({
    application,
    environment,
    host: `${application}-${environment}-01`,
    version: "1.0.0",
    logs: makeLogs(),
  });

  const res = http.post(BASE_URL, payload, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  });

  const success = res.status === 200;
  ingestDuration.add(res.timings.duration);
  successRate.add(success);
  totalLogs.add(BATCH_SIZE);

  check(res, {
    "status 200": (r) => r.status === 200,
    "response < 1.5s": (r) => r.timings.duration < 1500,
  });

  sleep(0.05);
}
