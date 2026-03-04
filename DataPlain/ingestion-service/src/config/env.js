import "dotenv/config";

export const env = {
  port: process.env.PORT || 4100,
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,

  apiKeyCacheTTL: Number(process.env.API_KEY_CACHE_TTL || 60),
  maxRequestSizeMB: Number(process.env.MAX_REQUEST_SIZE_MB || 2),
  maxLogsPerBatch: Number(process.env.MAX_LOGS_PER_BATCH || 200),
  maxBufferSize: Number(process.env.MAX_BUFFER_SIZE || 50000),
};
