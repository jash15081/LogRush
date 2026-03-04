import { redis } from "../redis/client.js";
import { pool } from "../db/postgress.js";
import { env } from "../config/env.js";

export async function verifyApiKey(apiKeyHash) {
  const cacheKey = `api_key:${apiKeyHash}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    const data = JSON.parse(cached);
    if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
    return data;
  }
  let result;
  try{
    result = await pool.query(
    `
    SELECT id, organization_id, rate_limit_per_sec, expires_at
    FROM api_keys
    WHERE key_hash = $1
    `,
    [apiKeyHash]
    );
  }
  catch(err){
    console.error("Database query error in verifyApiKey:", err);
    return null
  }
 


  if (result.rowCount === 0) return null;

  const row = result.rows[0];
  if (row.expires_at && new Date(row.expires_at) < new Date()) return null;

  const payload = {
    api_key_id: row.id,
    organization_id: row.organization_id,
    rate_limit_per_sec: row.rate_limit_per_sec,
    expires_at: row.expires_at,
  };

  await redis.setex(cacheKey, env.apiKeyCacheTTL, JSON.stringify(payload));

  return payload;
}
