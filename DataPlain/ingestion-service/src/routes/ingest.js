import express from "express";
import { hashApiKey } from "../utils/hash.js";
import { verifyApiKey } from "../auth/apiKeyVerifier.js";
import { checkRateLimit } from "../auth/rateLimiter.js";
import { validateIngestBody } from "../auth/ingestionValidator.js";
import { env } from "../config/env.js";
import { publishLogs } from "../kafka/publishHelper.js";

const router = express.Router();

router.post("/ingest", async (req, res) => {
  const requestStart = Date.now();

  try {
    console.log(`[INGESTION] Incoming request received`);

    const auth = req.headers.authorization;

    if (!auth || !auth.startsWith("Bearer ")) {
      console.warn(`[AUTH] Missing or malformed Authorization header`);
      return res.status(401).json({ error: "Missing API key" });
    }

    const rawKey = auth.split(" ")[1];
    const apiKeyHash = hashApiKey(rawKey);

    console.log(`[AUTH] Verifying API key...`);

    const apiKey = await verifyApiKey(apiKeyHash);

    if (!apiKey) {
      console.warn(`[AUTH] API key verification FAILED`);
      return res.status(401).json({ error: "Invalid API key" });
    }

    console.log(
      `[AUTH] API key verified | org=${apiKey.organization_id} | keyId=${apiKey.api_key_id}`,
    );

    console.log(
      `[RATE_LIMIT] Checking rate limit | keyId=${apiKey.api_key_id} | limit=${apiKey.rate_limit_per_sec}/sec`,
    );

    const allowed = await checkRateLimit(
      apiKey.api_key_id,
      apiKey.rate_limit_per_sec,
    );

    if (!allowed) {
      console.warn(
        `[RATE_LIMIT] BLOCKED | keyId=${apiKey.api_key_id} exceeded rate limit`,
      );
      return res.status(429).json({ error: "Rate limit exceeded" });
    }

    console.log(`[RATE_LIMIT] Allowed request for keyId=${apiKey.api_key_id}`);

    const error = validateIngestBody(req.body, env.maxLogsPerBatch);

    if (error) {
      console.warn(`[VALIDATION] Request validation failed: ${error}`);
      return res.status(400).json({ error });
    }

    const logCount = req.body.logs.length;

    console.log(
      `[VALIDATION] Payload validated | logs=${logCount} | app=${req.body.application} | env=${req.body.environment}`,
    );

    try {
      console.log(
        `[KAFKA] Publishing ${logCount} logs to Kafka topic for org=${apiKey.organization_id}`,
      );

      await publishLogs({
        organizationId: apiKey.organization_id,
        apiKeyId: apiKey.api_key_id,
        application: req.body.application,
        environment: req.body.environment,
        host: req.body.host,
        version: req.body.version,
        logs: req.body.logs,
      });

      console.log(`[KAFKA] Successfully published ${logCount} logs`);
    } catch (err) {
      console.error(`[KAFKA] Failed to publish logs`, err);
      return res.status(500).json({ error: "Failed to publish logs" });
    }

    const latency = Date.now() - requestStart;

    console.log(
      `[INGESTION] Request accepted | logs=${logCount} | latency=${latency}ms`,
    );

    return res.status(202).json({ status: "accepted" });
  } catch (err) {
    console.error(`[INGESTION] Unexpected error`, err);
    return res.status(500).json({ error: "Internal error" });
  }
});

export default router;
