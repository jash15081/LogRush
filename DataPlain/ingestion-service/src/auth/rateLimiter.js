import { redis } from "../redis/client.js";
import fs from "fs";
import path from "path";

// Load Lua script once
const luaScript = fs.readFileSync(
  path.resolve("src/auth/tokenBucket.lua"),
  "utf8"
);

export async function checkRateLimit(apiKeyId, limitPerSec) {
  const redisKey = `token_bucket:${apiKeyId}`;

  const rate = limitPerSec;        // tokens per second
  const capacity = limitPerSec; // allow 2x burst
  const now = Date.now();

  const allowed = await redis.eval(
    luaScript,
    1,              // number of keys
    redisKey,       // KEYS[1]
    rate,           // ARGV[1]
    capacity,       // ARGV[2]
    now             // ARGV[3]
  );

  return allowed === 1;
}
