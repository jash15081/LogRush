-- KEYS[1]  = Redis key (token_bucket:<apiKeyId>)
-- ARGV[1]  = refill rate (tokens per second)
-- ARGV[2]  = capacity (max tokens)
-- ARGV[3]  = current timestamp (ms)

local key = KEYS[1]
local rate = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

-- Read current state
local data = redis.call("HMGET", key, "tokens", "last_refill")
local tokens = tonumber(data[1])
local last_refill = tonumber(data[2])

-- First request: initialize bucket
if tokens == nil then
  tokens = capacity
  last_refill = now
end

-- Calculate how much time passed
local elapsed = (now - last_refill) / 1000

-- Refill tokens based on elapsed time
tokens = math.min(capacity, tokens + elapsed * rate)

-- If no tokens available → reject
if tokens < 1 then
  redis.call("HMSET", key, "tokens", tokens, "last_refill", now)
  redis.call("EXPIRE", key, 2)
  return 0
end

-- Consume one token
tokens = tokens - 1

-- Save updated state
redis.call("HMSET", key, "tokens", tokens, "last_refill", now)
redis.call("EXPIRE", key, 2)

return 1
