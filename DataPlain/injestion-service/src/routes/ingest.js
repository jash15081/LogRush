import express from "express";
import { hashApiKey } from "../utils/hash.js";
import { verifyApiKey } from "../auth/apiKeyVerifier.js";
import { checkRateLimit } from "../auth/rateLimiter.js";
import { validateIngestBody } from "../auth/ingestionValidator.js";
import { env } from "../config/env.js";
import { log } from "console";

const router = express.Router();

router.post("/ingest", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing API key" });
    }
    
    const rawKey = auth.split(" ")[1];
    const apiKeyHash = hashApiKey(rawKey);

    const apiKey = await verifyApiKey(apiKeyHash);
    if (!apiKey) {
      console.error("API key verification failed");
      return res.status(401).json({ error: "Invalid API key" });
    }
   
    const allowed = await checkRateLimit(
      apiKey.api_key_id,
      apiKey.rate_limit_per_sec
    );
    if (!allowed) {
      console.error("Rate limit exceeded for API key:", apiKey.api_key_id);
      return res.status(429).json({ error: "Rate limit exceeded" });
    }
    
    const error = validateIngestBody(req.body, env.maxLogsPerBatch);
    if (error) {
      console.error("Ingestion validation error:", error);
      return res.status(400).json({ error });
    }

    
    const enrichedLogs = req.body.logs.map((log) => ({
      organization_id: apiKey.organization_id,
      api_key_id: apiKey.api_key_id,
      application: req.body.application,
      environment: req.body.environment,
      received_at: new Date().toISOString(),
      log,
    }));

    console.log(`Received ${enrichedLogs.length} logs for app ${req.body.application}`);

    return res.status(202).json({ status: "accepted" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal error" });
  }
});

export default router;
