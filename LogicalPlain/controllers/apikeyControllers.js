import crypto from "crypto";
import pool from "../config/db.js"; // adjust path if needed

export async function generateApiKey(req, res) {
  const { name, rateLimitPerSec, expiresAt } = req.body;
  const { organizationId } = req.user;

  if (!name) {
    return res.status(400).json({
      error: "API key name is required",
    });
  }

  try {
    const rawApiKey = `lk_${crypto.randomBytes(32).toString("hex")}`;

    const keyHash = crypto.createHash("sha256").update(rawApiKey).digest("hex");

    const result = await pool.query(
      `
      INSERT INTO api_keys (
        organization_id,
        key_hash,
        name,
        rate_limit_per_sec,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        name,
        rate_limit_per_sec AS "rateLimitPerSec",
        created_at AS "createdAt",
        expires_at AS "expiresAt"
      `,
      [
        organizationId,
        keyHash,
        name,
        rateLimitPerSec ?? 1000,
        expiresAt ?? null,
      ],
    );

    return res.status(201).json({
      message: "API key created successfully",
      apiKey: rawApiKey,
      key: result.rows[0],
      warning:
        "Store this API key securely. You will not be able to see it again.",
    });
  } catch (err) {
    console.error("Generate API key error:", err);

    if (err.code === "23505") {
      return res.status(409).json({
        error: "API key already exists",
      });
    }

    return res.status(500).json({
      error: "Internal server error",
    });
  }
}

export async function listApiKeys(req, res) {
  const { organizationId } = req.user;

  try {
    const result = await pool.query(
      `
      SELECT
        id,
        name,
        rate_limit_per_sec AS "rateLimitPerSec",
        created_at AS "createdAt",
        expires_at AS "expiresAt"
      FROM api_keys
      WHERE organization_id = $1
      ORDER BY created_at DESC
      `,
      [organizationId],
    );

    return res.status(200).json({
      apiKeys: result.rows,
    });
  } catch (err) {
    console.error("List API keys error:", err);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
}

export async function updateApiKey(req, res) {
  const { apiKeyId, name, rateLimitPerSec, expiresAt } = req.body;
  const { organizationId } = req.user;

  if (!apiKeyId) {
    return res.status(400).json({
      error: "apiKeyId is required",
    });
  }

  try {
    const result = await pool.query(
      `
      UPDATE api_keys
      SET name = COALESCE($1, name), rate_limit_per_sec = COALESCE($2, rate_limit_per_sec), expires_at = COALESCE($3, expires_at)
      WHERE id = $4 AND organization_id = $5
      RETURNING
        id,
        name,
        rate_limit_per_sec AS "rateLimitPerSec",
        created_at AS "createdAt",
        expires_at AS "expiresAt"
      `,
      [name, rateLimitPerSec, expiresAt, apiKeyId, organizationId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "API key not found",
      });
    }

    return res.status(200).json({
      message: "API key updated successfully",
      key: result.rows[0],
    });
  } catch (err) {
    console.error("Update API key error:", err);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
}

export async function revokeApiKey(req, res) {
  const { apiKeyId } = req.body;
  const { organizationId } = req.user;
  if (!apiKeyId) {
    return res.status(400).json({
      error: "apiKeyId is required",
    });
  }
  try {
    const result = await pool.query(
      `
        DELETE FROM api_keys
        WHERE id = $1 AND organization_id = $2
        RETURNING id
        `,
      [apiKeyId, organizationId],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "API key not found",
      });
    }
    return res.status(200).json({
      message: "API key revoked successfully",
    });
  } catch (err) {
    console.error("Revoke API key error:", err);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
}
