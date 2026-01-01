/**
 * Log Generator
 * -------------
 * Simulates realistic multi-tenant log traffic.
 * Supports per–API-key RPS control.
 */

import fetch from "node-fetch";
import crypto from "crypto";

import {
  INGESTION_URL,
  ORGANIZATIONS,
  LOG_MESSAGES,
  TRAFFIC_CONFIG
} from "./config.js";

/* =========================
   UTILITY FUNCTIONS
   ========================= */

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function nowISO() {
  return new Date().toISOString();
}

function generateTraceId() {
  return crypto.randomBytes(8).toString("hex");
}

/* =========================
   LOG GENERATION
   ========================= */

function pickLogLevel() {
  const r = Math.random();
  if (r < 0.7) return "INFO";
  if (r < 0.9) return "WARN";
  return "ERROR";
}

function generateLog(traceId) {
  const level = pickLogLevel();

  return {
    timestamp: nowISO(),
    level,
    message: randomChoice(LOG_MESSAGES[level]),
    trace_id: traceId,
    metadata: {
      latency_ms: Math.floor(Math.random() * 400),
      user_id: `user_${Math.floor(Math.random() * 1000)}`,
      request_id: crypto.randomUUID()
    }
  };
}

function generateLogBatch(batchSize) {
  const traceId = generateTraceId();
  const logs = [];

  for (let i = 0; i < batchSize; i++) {
    logs.push(generateLog(traceId));
  }

  return logs;
}

/* =========================
   REQUEST BUILDER
   ========================= */

function buildRequest(org, apiKey) {
  const application = randomChoice(org.applications);
  const environment = randomChoice(org.environments);

  return {
    apiKey,
    payload: {
      application,
      environment,
      host: `${application}-${environment}-01`,
      version: "1.0.0",
      logs: generateLogBatch(TRAFFIC_CONFIG.BATCH_SIZE)
    }
  };
}

/* =========================
   SEND LOGS
   ========================= */

async function sendLogs(org, apiKey) {
  const { payload } = buildRequest(org, apiKey);

  try {
    const res = await fetch(INGESTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    console.log(
      `[${org.name}] key=${apiKey.slice(0, 6)}… | ` +
      `${payload.application} (${payload.environment}) | ` +
      `batch=${payload.logs.length} | status=${res.status}`
    );
  } catch (err) {
    console.error("Failed to send logs:", err.message);
  }
}

/* =========================
   PER-API-KEY TRAFFIC LOOPS
   ========================= */

function startApiKeyTraffic(org, apiKeyConfig) {
  const { key, rps } = apiKeyConfig;

  const intervalMs = Math.max(1, Math.floor(1000 / rps));

  console.log(
    `▶ Starting traffic | org=${org.name} | key=${key.slice(0, 6)}… | ${rps} RPS`
  );

  setInterval(() => {
    sendLogs(org, key);
  }, intervalMs);
}

/* =========================
   START GENERATOR
   ========================= */

console.log("🚀 Log generator started");
console.log(`➡️  Ingestion URL: ${INGESTION_URL}`);
console.log(`➡️  Batch size: ${TRAFFIC_CONFIG.BATCH_SIZE}`);
console.log("-----------------------------------");

for (const org of ORGANIZATIONS) {
  for (const apiKeyConfig of org.apiKeys) {
    startApiKeyTraffic(org, apiKeyConfig);
  }
}
