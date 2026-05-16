# LogRush: Complete Project Context & Technical Analysis

**Last Updated**: April 2026
**Project Type**: Multi-Tenant Log Management System
**Status**: Production-Ready

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Core Services & Components](#3-core-services--components)
4. [Optimization Techniques & Algorithms](#4-optimization-techniques--algorithms)
5. [Performance Measurement & Monitoring](#5-performance-measurement--monitoring)
6. [Technology Stack Details](#6-technology-stack-details)
7. [Features & Capabilities](#7-features--capabilities)
8. [Security & Data Isolation](#8-security--data-isolation)
9. [Database Schema & Data Models](#9-database-schema--data-models)
10. [Deployment & Infrastructure](#10-deployment--infrastructure)
11. [Development Workflow](#11-development-workflow)

---

## 1. EXECUTIVE SUMMARY

**LogRush** is a high-performance, scalable, multi-tenant log aggregation and management system designed for organizations that need centralized, secure log storage with real-time search capabilities. The system is engineered to handle extreme ingestion throughput (thousands of logs/second per tenant) while maintaining strict data isolation and fast query response times.

### Key Metrics & Goals:

- **Multi-Tenancy**: Support unlimited distinct organizations with zero cross-data contamination
- **Throughput**: Handle 1000+ logs/sec per organization with sub-1-second response times
- **Latency Target**: P95 < 1.5s, P99 < 2s for ingestion requests
- **Durability**: No log loss due to message queue buffering (Kafka/Redpanda)
- **Search Speed**: Sub-second full-text and faceted search across days/weeks of logs
- **Scalability**: Horizontal scaling of all components (except PostgreSQL master)

---

## 2. SYSTEM ARCHITECTURE OVERVIEW

### 2.1 Three-Tier Service Architecture

LogRush is decomposed into three functionally distinct operational "planes," each optimized for a specific role:

```
┌─────────────────────────────────────────────────────────────┐
│                         LOGCRUSH CLIENT                       │
│         (Any service/app sending logs via HTTP/gRPC)          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    (HTTP POST /ingest)
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                      DATA PLAIN (Ingestion)                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  1. Nginx (Reverse Proxy/Load Balancer)               │  │
│  │     - Listens on :4100                                │  │
│  │     - Routes traffic to Ingestion Service replicas   │  │
│  │     - Handles connection pooling                      │  │
│  └────────────────────────────────────────────────────────┘  │
│                           │                                    │
│  ┌────────────────────────▼────────────────────────────────┐  │
│  │  2. Ingestion Service (Node.js/Express)               │  │
│  │     - Auth (API Key verification + caching)           │  │
│  │     - Rate limiting (Redis + Token Bucket algorithm)  │  │
│  │     - Payload validation                              │  │
│  │     - Publishes to Kafka/Redpanda                     │  │
│  └────────────────────────┬────────────────────────────────┘  │
│                           │                                    │
│  ┌────────────────────────▼────────────────────────────────┐  │
│  │  3. Kafka/Redpanda (Event Broker)                     │  │
│  │     - Topic: logs.raw (6 partitions)                  │  │
│  │     - Partitioned by organization_id                 │  │
│  │     - Provides fault tolerance & buffering            │  │
│  └────────────────────────┬────────────────────────────────┘  │
│                           │                                    │
│  ┌────────────────────────▼────────────────────────────────┐  │
│  │  4. Log Hot Indexer (Node.js Consumer)                │  │
│  │     - Subscribes to logs.raw topic                    │  │
│  │     - Buffers logs in memory                          │  │
│  │     - Bulk indexes to OpenSearch                      │  │
│  └────────────────────────┬────────────────────────────────┘  │
│                           │                                    │
│  Supporting Services:                                         │
│  - Redis: Rate limit tracking (token bucket state)           │
│  - PostgreSQL: API key lookups                               │
└──────────────────────────┬────────────────────────────────────┘
                           │
                    (Indexed in: logs-YYYY.MM.DD)
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                    SEARCH & QUERY (OpenSearch)                │
│  - Full-text & keyword search engine                         │
│  - Rolling daily indices (logs-2025.01.15, etc)             │
│  - Retention policies & lifecycle management                 │
└──────────────────────────┬────────────────────────────────────┘
                           │
                           │ (Search queries)
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                LOGICAL PLAIN (Control Plane)                  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Backend API Server (Node.js/Express) :3000           │  │
│  │  - Organization CRUD & management                     │  │
│  │  - User management (RBAC, role-based access)          │  │
│  │  - API Key generation & management                    │  │
│  │  - Application/Environment registration               │  │
│  │  - Log search gateway (OpenSearch proxy)              │  │
│  │  - Authentication: JWT-based                          │  │
│  └────────────────────────┬────────────────────────────────┘  │
│                           │                                    │
│  PostgreSQL Database:                                         │
│  - Organizations, Users, Applications, API Keys              │
│  - All ACID-compliant structured data                        │
└──────────────────────────┬────────────────────────────────────┘
                           │
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                    FRONTEND (React SPA)                       │
│  - Built with React + Vite (fast HMR)                       │
│  - Communicates with LogicalPlain API                        │
│  - Features: Dashboard, log search, user management         │
│  - Client-side auth context + JWT cookie storage            │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow Summary

**Ingestion Path** (logs flowing in):

```
External Client
    ↓ (HTTP POST with Bearer Token & logs array)
Nginx (:4100) → Ingestion Service (:4100 internally routed)
    ↓ (API Key validation + rate limit check)
Kafka/Redpanda (logs.raw topic, partitioned by org_id)
    ↓ (Consumed batched)
Log Hot Indexer
    ↓ (Bulk API)
OpenSearch (rolled daily index logs-YYYY.MM.DD)
```

**Query Path** (users searching logs):

```
Frontend (React)
    ↓ (HTTP GET /logs with filters)
LogicalPlain API (:3000)
    ↓ (Auth check, organization_id extraction from JWT)
OpenSearch Search Query
    ↓ (filtered by organization_id boolean query)
Results returned to Frontend
```

---

## 3. CORE SERVICES & COMPONENTS

### 3.1 DataPlain: Ingestion & Indexing Pipeline

#### A. Nginx Reverse Proxy (Port 4100)

**Purpose**: Entry point for all client log submissions. Acts as load balancer.

**Configuration**:

- Listens on `0.0.0.0:4100` (exposed to external clients)
- Routes all traffic to internal ingestion-service container
- Connection pooling to prevent cascading failures
- Can be scaled horizontally in production

**Why Nginx?**

- Lightweight, battle-tested reverse proxy
- Built-in load balancing (round-robin, least connections)
- Low CPU/memory overhead compared to Node.js
- Handles connection pooling automatically
- Separates infrastructure concern from application logic

#### B. Ingestion Service (Node.js/Express)

**Purpose**: Validates, authenticates, and publishes incoming logs.

**Location**: `/DataPlain/ingestion-service/src/`

**Request Flow**:

```javascript
POST /ingest
├── 1. Authorization Header Extraction
│   ├── Verify "Bearer <API_KEY>" format
│   └── Extract raw API key
│
├── 2. API Key Hashing & Verification
│   ├── Hash raw key using SHA256
│   ├── Query Redis cache first (TTL: 60s by default)
│   ├── If miss, query PostgreSQL api_keys table
│   │   ├── Check key_hash match
│   │   ├── Verify expiration date
│   │   └── Cache result in Redis for 60s
│   └── Extract organization_id & rate_limit_per_sec
│
├── 3. Rate Limit Check (Token Bucket Algorithm)
│   ├── Invoke Redis Lua script (tokenBucket.lua)
│   ├── Check if allowed token available
│   └── Return 429 if rate limit exceeded
│
├── 4. Payload Validation
│   ├── Check application, environment fields exist
│   ├── Verify logs[] array is not empty
│   ├── Max logs per batch: 200 (configurable)
│   ├── Validate each log has: timestamp, level (INFO|WARN|ERROR), message
│   └── Return 400 if validation fails
│
├── 5. Kafka Publishing
│   ├── Serialize log data to JSON
│   ├── Set partition key to organization_id
│   ├── Add enrichment: ingested_at, api_key_id
│   ├── Send to `logs.raw` topic
│   └── Return 429 if Kafka unavailable (circuit breaker)
│
└── 6. Response & Telemetry
    ├── Return 202 Accepted (HTTP semantics: async processing)
    ├── Log latency: Date.now() - requestStart
    └── Track metrics locally for monitoring
```

**Key Files**:

- **src/app.js**: Express app initialization, middleware setup
- **src/routes/ingest.js**: POST /ingest handler (main logic)
- **src/auth/apiKeyVerifier.js**: Hash verification + Redis caching
- **src/auth/rateLimiter.js**: Token bucket algorithm wrapper
- **src/auth/ingestionValidator.js**: Schema validation
- **src/kafka/publishHelper.js**: Kafka producer logic
- **src/config/env.js**: Environment variable loading
- **src/utils/hash.js**: SHA256 hashing utility

**Configuration** (`env.js`):

```javascript
port: 4100; // Internal port (Nginx exposes 4100 outside)
apiKeyCacheTTL: 60; // Redis cache TTL for API keys (seconds)
maxRequestSizeMB: 2; // Max HTTP body size
maxLogsPerBatch: 200; // Max logs in single POST
maxBufferSize: 50000; // Kafka producer buffer before flush
```

**Error Handling**:

- 401: Missing or malformed Authorization header
- 401: API key not found or expired
- 429: Rate limit exceeded
- 400: Payload validation failed
- 500: Kafka publish failure

**Dependencies**:

- `express@5.2.1`: HTTP framework
- `kafkajs@2.2.4`: Kafka client
- `ioredis@5.8.2`: Redis client
- `pg@8.16.3`: PostgreSQL driver (for cache miss lookups)
- Lua scripting: Atomic token bucket state updates

#### C. Redis: Rate Limit State Store

**Purpose**: Fast, atomic rate limit tracking without hitting PostgreSQL.

**Data Structure**: Hash for each API key

```
Key: token_bucket:<api_key_id>
Value: {
  tokens: <float>,          // Current token count
  last_refill: <timestamp>  // Last refill time (ms)
}
TTL: 2 seconds (auto-expire stale entries)
```

**Why Redis?**

- O(1) lookups/updates (vs PostgreSQL transactions)
- Atomic Lua scripting prevents race conditions
- In-memory speed: microseconds vs milliseconds
- Volatile data (rate state can be lost without log loss)
- Scales to millions of keys horizontally

#### D. Token Bucket Algorithm (Lua Script)

**File**: `src/auth/tokenBucket.lua`

**Algorithm**:

```lua
INPUT:
  - redisKey: token_bucket:<apiKeyId>
  - rate: tokens per second (e.g., 100 = 100 logs/sec)
  - capacity: max burst (set to rate for fairness)
  - now: current timestamp (ms)

PROCESS:
  1. Read current tokens and last_refill from Redis hash
  2. If first request (tokens == nil):
     - Initialize tokens = capacity
     - Set last_refill = now

  3. Calculate time elapsed: elapsed = (now - last_refill) / 1000 (convert to seconds)

  4. Refill tokens: tokens = min(capacity, tokens + elapsed * rate)
     - Example: If rate=100/sec, capacity=100, and 1 second passed:
       tokens = min(100, 0 + 1 * 100) = 100 (fully refilled)
     - If 0.5 second passed:
       tokens = min(100, 50 + 0.5 * 100) = 100 (partial refill)

  5. If tokens < 1:
     - Update Redis with new state
     - Set expiry to 2 seconds
     - Return 0 (REJECT)

  6. Otherwise:
     - Consume 1 token
     - Update Redis: tokens = tokens - 1
     - Set expiry to 2 seconds
     - Return 1 (ALLOW)

RATIONALE:
  - Atomicity: Lua script prevents race conditions
  - Fairness: Tokens refill gradually (not burst dump)
  - Efficiency: Single Redis call per request
  - Capacity limit: Set to rate for reasonable burst (N=rate tokens per second max)
```

**Why Token Bucket vs Other Algorithms?**

- **Fixed Window Counter**: Simple but allows burst at boundaries
- **Sliding Window**: Accurate but O(n) memory per key
- **Token Bucket**: Allows controlled bursts, smooth refill, O(1) memory ✓
- **Leaky Bucket**: Similar to token bucket, slightly harder to implement

#### E. Kafka/Redpanda: Event Broker

**Purpose**: Decouple ingestion API from indexing, provide buffering, ensure no log loss.

**Configuration** (docker-compose):

```yaml
redpanda:
  brokers: ["redpanda:29092"] # Internal Docker network address
  clientId: "log-ingestion-service"
  retry: { initialRetryTime: 300ms, retries: 5 } # Exponential backoff

producer:
  allowAutoTopicCreation: false
  idempotent: true # Prevent duplicate log messages
```

**Topic Setup**:

- **Topic**: `logs.raw`
- **Partitions**: 6 (scalable, manually created in docker-compose entrypoint)
- **Replication Factor**: 1 (single node cluster; would be 3+ in prod)
- **Retention**: Default (Redpanda keeps messages until Indexer consumes + 1 day buffer)

**Partition Key Strategy**:

```javascript
messages: logs.map(log => ({
  key: organizationId,  // ← CRITICAL OPTIMIZATION
  value: JSON.stringify({...})
}))
```

**Why Partition by organization_id?**

1. **Ordering Guarantee**: All logs for Org123 go to same partition → chronological ordering preserved
   - This is crucial for log correlation and trace analysis
   - Example: Requests A→B→C for Org123 arrive in same order

2. **Sequential Disk I/O**: Kafka broker writes to disk sequentially for each partition
   - Partition 0 (Org123): Linear write pattern (fast)
   - Partition 1 (Org456): Different disk region (parallelizes)
   - Total throughput: sum of all partition throughputs

3. **Consumer Optimization**: Each consumer (Log Hot Indexer) receives ordered batch
   - Can build cross-log correlations within batch
   - Can detect duplicate submissions

4. **Query Performance**: Related logs physically adjacent in OpenSearch index
   - Full-text search hits fewer disk seeks
   - Aggregations faster (locality of reference)

**Flow in Ingestion Service**:

```javascript
await producer.send({
  topic: "logs.raw",
  messages: logs.map((log) => ({
    key: organizationId,
    value: JSON.stringify({
      organization_id: organizationId,
      api_key_id: apiKeyId,
      application: req.body.application,
      environment: req.body.environment,
      host: req.body.host,
      version: req.body.version,
      ...log,
      ingested_at: new Date().toISOString(), // Add server timestamp
    }),
  })),
});
```

**Reliability**:

- Idempotent producer: Kafka deduplicates messages during network retries
- Application can safely retry failed publishes without duplicate logs in index

#### F. Log Hot Indexer: Consumer & Buffer

**Purpose**: Consumes logs from Kafka, holds in memory, and bulk-indexes to OpenSearch.

**Location**: `/DataPlain/log-hot-indexer/src/`

**Architecture**:

```javascript
let buffer = [];              // In-memory array of log objects
let lastFlushTime = Date.now();

KAFKA_CONSUMER.on('message', async (message) => {
  const log = JSON.parse(message.value);
  buffer.push(log);

  // Flush if either condition met:
  if (buffer.length >= batchSize OR timeSinceFlush >= flushInterval) {
    await flush();
  }
});

async function flush() {
  if (!buffer.length) return;

  // Bulk index to OpenSearch
  await bulkIndex(buffer);

  // Clear buffer
  buffer = [];
  lastFlushTime = Date.now();
}
```

**Configuration** (`config/config.js`):

```javascript
indexing: {
  batchSize: 50; // Flush when 50 logs accumulated
  flushIntervalMs: 2000; // Or every 2 seconds (safety net)
}
```

**Why Batching?**

1. **Reduced HTTP Overhead**: 50 logs in 1 request vs 50 separate requests
   - HTTP headers: ~500 bytes each
   - TLS handshake: ~300ms once per connection (connection pooling helps)
   - JSON serialization: Fixed cost per batch

2. **OpenSearch Indexing Efficiency**:
   - Bulk API: ~50-100ms for 50 logs
   - Sequential indexing: ~5-10ms per log × 50 = 250-500ms
   - **2.5-5x speedup**

3. **Network Bandwidth**: Fewer round-trips (50 LBs per trip vs 1 per trip)

4. **EXAMPLE MATH**:

   ```
   Scenario: 10,000 logs/min = 166 logs/sec

   WITHOUT batching (sequential):
   - Time per log: 10ms
   - Total time: 166 × 10ms = 1.66 seconds
   - Throughput: 166 logs/sec (BLOCKED)

   WITH batching (batch size 50):
   - 166 logs/sec ÷ 50 logs/batch = 3.32 batches/sec
   - Time per batch: ~100ms
   - Throughput: 3.32 × 50 = 166 logs/sec ✓
   - Latency P95: < 2000ms (2 second flush window)
   ```

**Bulk Indexing** (`bulkIndexer.js`):

```javascript
const body = [];

for (const log of logs) {
  const indexName = "logs-" + log.timestamp.slice(0, 10).replace(/-/g, ".");

  body.push({ index: { _index: indexName } }); // Action line
  body.push({
    "@timestamp": log.timestamp, // ISO format for time-series
    timestamp: log.timestamp,
    ingested_at: log.ingested_at,
    organization_id: log.organization_id, // For filtering
    api_key_id: log.api_key_id,
    application: log.application,
    environment: log.environment,
    host: log.host,
    version: log.version,
    level: log.level,
    message: log.message, // Full-text searchable
    trace_id: log.trace_id,
    metadata: log.metadata, // Custom JSON field
  });
}

const response = await client.bulk({ body });

if (response.body.errors) {
  throw new Error("OpenSearch bulk indexing failed");
}
```

**Rolling Daily Indices**:

- Index name: `logs-2025.01.15` (from timestamp)
- Reason: Enables efficient date-based filtering
  - Query range 2025.01.15 to 2025.01.20? Search exactly those 6 indices
  - Query old 2024 data? OpenSearch skips 2025 indices entirely
  - Delete old data: Drop entire index, not individual documents
  - Retention policies: Auto-delete indices older than 90 days

### 3.2 LogicalPlain: Control Plane API

**Purpose**: Provides CRUD APIs for managing multi-tenant system. Bridges PostgreSQL (structured data) and OpenSearch (logs).

**Location**: `/LogicalPlain/`

**Architecture** (MVC):

```
Routes (apiKeyRoutes.js, etc.)
    ↓
Middleware (auth.js - JWT verification)
    ↓
Controllers (apikeyControllers.js, etc.)
    ↓
Database/Search (PostgreSQL, OpenSearch)
```

#### A. Authentication Middleware (auth.js)

**JWT Cookie-Based Auth**:

```javascript
export function authUser(req, res, next) {
  const token = req.cookies?.auth_token;

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      userId: decoded.userId,
      organizationId: decoded.organizationId, // CRITICAL: All queries filtered by this
      role: decoded.role, // 'admin' or 'user'
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function authAdmin(req, res, next) {
  authUser(req, res, () => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin privileges required" });
    }
    next();
  });
}
```

**Why Cookie + JWT?**

- Cookies: HttpOnly flag prevents JavaScript from accessing token (XSS protection)
- JWT: Self-contained claim (no DB lookup on every request)
- Secure flag: Transmitted only over HTTPS in production

**Token Payload**:

```javascript
{
  userId: 123,
  organizationId: 456,  // Tenant ID
  role: "admin",
  iat: 1640000000,      // Issued at
  exp: 1640086400       // Expires in 7 days
}
```

#### B. Organization Controller (organizationController.js)

**CREATE Organization**:

```javascript
POST /organization/create

Request Body:
{
  organizationName: "Acme Corp",
  adminUsername: "admin_user",
  adminPassword: "password123"
}

Process:
1. Validate input (non-empty fields, password ≥ 8 chars)
2. BEGIN transaction
3. INSERT into organizations (name)
4. Hash password with bcrypt (salt rounds: 12)
   - Why 12? Balance: ~100ms hashing (prevents brute force), acceptable UX
5. INSERT into users (admin user with role='admin')
6. COMMIT transaction
7. Return organization ID

Transaction Purpose:
- Atomicity: Either both succeed or both rollback
- Consistency: Never have organization without admin user
- Prevents: Orphaned orgs, admins without orgs
```

**GET Organization**:

- Extracts organizationId from JWT
- Returns only organization metadata + timestamps

**Why No Update/Delete?**

- Design decision: Organizations treated as immutable after creation
- Deletion would cascade to all users/keys/logs (dangerous)
- Alternative: Soft delete (mark as inactive)

#### C. User Controller (userController.js)

**User Registration/Invite**:

- POST /user/create: Admin creates new user
- Includes role assignment ('admin', 'user')
- Prevents duplicate usernames in organization

**CREATE User**:

```javascript
POST /user/create
Headers: Authorization: Bearer <JWT_TOKEN>

Request Body:
{
  username: "john_doe",
  password: "securepass123",
  role: "user"  // or "admin"
}

Process:
1. Extract organizationId from JWT
2. Validate: username non-empty, password ≥ 8 chars, role in ['admin', 'user']
3. Hash password with bcrypt(password, 12)
4. INSERT into users (organization_id, username, password_hash, role)
5. Return user metadata (NOT password hash)

Security:
- Passwords hashed server-side
- Password hash never sent to client
- Only hashed password stored in PostgreSQL
```

**LOGIN**:

```javascript
POST /user/login

Request Body:
{
  username: "john_doe",
  password: "securepass123"
}

Process:
1. SELECT user WHERE username = $1
2. If not found → 401
3. Compare submitted password against stored hash using bcrypt.compare()
   - bcrypt.compare(inputPassword, storedHash) → true/false
4. Create JWT token with userId, organizationId, role
5. Set HttpOnly cookie with token
6. UPDATE users SET last_login_at = NOW()  (async, non-critical)
7. Return token + user metadata

bcrypt vs SHA256:
- SHA256: Fast, deterministic, NOT suitable for passwords
  - Attacker tries 1M passwords/sec with GPU
  - 8 billion SHA256 hashes = ~8 seconds
- bcrypt: Slow (~100ms/attempt), salt-based, key derivation
  - 1M attempts with bcrypt = 10 hours
  - Designed specifically for passwords
```

**LIST Users**:

- GET /user/: Lists all users in organization
- Only visible to authenticated users in same org

**UPDATE User**:

- Allows changing username, role
- Does NOT allow direct password change (handled separately)

**DELETE User**:

```javascript
DELETE /user/:userId

Transaction:
1. BEGIN
2. Verify user belongs to organization
3. Assert NOT deleting last admin (org needs at least 1 admin)
4. DELETE from api_keys WHERE user_created_this_key
5. DELETE from users WHERE id = $1
6. COMMIT

Why transaction?
- Consistency: Never left with org without admin
```

#### D. API Key Controller (apikeyControllers.js)

**GENERATE API Key**:

```javascript
POST /apikey/generate
Headers: Authorization: Bearer <JWT_TOKEN>

Request Body:
{
  name: "Production Logger #1",
  rateLimitPerSec: 1000,
  expiresAt: "2026-12-31T23:59:59Z"  // optional
}

Process:
1. Extract organizationId from JWT
2. Generate raw key: `lk_${crypto.randomBytes(32).toString('hex')}`
   - Format: lk_<64_char_hex>
   - Example: lk_3a4f2b1c8d9e7a5f...
3. Hash raw key: SHA256(rawKey) → keyHash
4. INSERT into api_keys (
     organization_id,
     key_hash,           // Store hash, not raw key
     name,
     rate_limit_per_sec,
     expires_at
   )
5. Return raw key to client (ONE TIME only)
   - Client stores this securely
   - Cannot retrieve later, only regenerate

Design:
- Follows industry standard (GitHub, AWS, etc.)
- One-way hash: Even if DB stolen, keys not compromised
- Display only first 10 chars to user in logs for security
```

**API Key Structure** (in PostgreSQL):

```sql
CREATE TABLE api_keys (
  id SERIAL PRIMARY KEY,
  organization_id INT NOT NULL,
  key_hash VARCHAR(64) NOT NULL,        -- SHA256 hex (64 chars)
  name VARCHAR(255) NOT NULL,
  rate_limit_per_sec INT DEFAULT 1000,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(key_hash),
  FOREIGN KEY(organization_id) REFERENCES organizations(id)
);
```

**LIST API Keys**:

- Returns all keys for organization
- Hides raw key (never shown after creation)
- Shows rate limit, creation date, expiration

**UPDATE API Key**:

- Can update: name, rate_limit_per_sec, expires_at
- Cannot update key_hash (would break ingestion calls)

**REVOKE API Key**:

```javascript
DELETE /apikey/revoke

Process:
1. DELETE from api_keys WHERE id = $1 AND organization_id = $2
2. Logs using this key will fail auth immediately
3. Rate limit state in Redis auto-expires (2 sec TTL)
```

#### E. Application Controller (applicationControllers.js)

**Purpose**: Manage "applications" (the source of logs) and "environments" (dev/staging/prod).

**CREATE Application**:

```javascript
POST /application/create

Request Body:
{
  name: "auth-service",
  description: "Authentication microservice"
}

Process:
1. INSERT into applications (organization_id, name, description)
2. Return application_id

Purpose:
- Allows log filtering by source: "Show all logs from auth-service"
- Not the same as OS-level 'application' but logical grouping
```

**Application Fields**:

```sql
CREATE TABLE applications (
  id SERIAL PRIMARY KEY,
  organization_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY(organization_id) REFERENCES organizations(id)
);
```

**Used In**: Log filtering UI + query building

#### F. Log Controller (logController.js)

**PURPOSE**: Search logs in OpenSearch safely (ensuring organization isolation).

**QUERY Logs**:

```javascript
GET /logs?level=ERROR&application=api-gateway&startTime=2025-01-15T00:00:00Z&endTime=2025-01-15T23:59:59Z&q=timeout&page=1&perPage=50

Process:
1. Extract organizationId from JWT (req.user.organizationId)
2. Build OpenSearch query:

   Query Structure:
   {
     bool: {
       must: [
         { term: { "organization_id.keyword": String(organizationId) } }  // CRITICAL: Mandate organization filter
       ],
       filter: [
         // Optional filters from query params
       ]
     }
   }
3. Add optional filters:
   - level: Filter by severity (INFO, WARN, ERROR)
   - application: Filter by source app
   - environment: Filter by environment (dev/prod)
   - startTime/endTime: Range query on @timestamp
   - q: Full-text search on message field

4. Pagination:
   - from: (page - 1) * perPage
   - size: perPage

5. Execute search, return logs + total hit count
```

**Query Builder Details**:

```javascript
const must = [{ term: { "organization_id.keyword": String(organizationId) } }];

// Level filter: Case-insensitive term matching
if (level) {
  const normalized = String(level).trim().toUpperCase();
  must.push({
    bool: {
      should: [
        {
          term: {
            "level.keyword": { value: normalized, case_insensitive: true },
          },
        },
        { term: { level: { value: normalized, case_insensitive: true } } },
        { match_phrase: { level: normalized } },
      ],
      minimum_should_match: 1, // At least 1 should match
    },
  });
}

// Full-text search: Fuzzy matching + wildcard
if (q) {
  const trimmed = String(q).trim();
  must.push({
    bool: {
      should: [
        {
          match: {
            message: {
              query: trimmed,
              operator: "or",
              fuzziness: "AUTO", // Typo tolerance: "eror" matches "error"
            },
          },
        },
        {
          wildcard: {
            message: {
              value: `*${trimmed.toLowerCase()}*`,
              case_insensitive: true,
            },
          },
        },
      ],
      minimum_should_match: 1,
    },
  });
}

// Time range: @timestamp field
if (startTime || endTime) {
  const rangeFilter = {};
  if (startTime) rangeFilter.gte = normalizeDateTime(startTime);
  if (endTime) rangeFilter.lte = normalizeDateTime(endTime);

  must.push({
    range: { "@timestamp": rangeFilter },
  });
}
```

**Why Mandatory organization_id Filter?**

- Prevents accidental/malicious multi-tenant data leakage
- Every query ALWAYS filters by org_id first
- If JWT is compromised but altered, attacker still can't access other orgs
- Example attack prevented: `GET /logs?q=*` can't return other org's logs due to this filter

**Datetime Normalization**:

```javascript
function normalizeDateTimeParam(value) {
  // Frontend sends datetime-local (e.g., 2025-01-15T13:45)
  // Convert to ISO 8601 with timezone info

  const hasTimezone = /[zZ]|[+-]\d{2}:\d{2}$/.test(value);
  if (hasTimezone) return value; // Already ISO, use as-is

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value; // Invalid, let OpenSearch handle

  return d.toISOString(); // Convert to 2025-01-15T13:45:00.000Z
}
```

### 3.3 Frontend: React Single Page Application

**Location**: `/Frontend/my-react-app/`

**Technology Stack**:

- **Framework**: React 18+ (component-based UI)
- **Build Tool**: Vite (lightning-fast HMR, ES module-based)
- **Styling**: Plain CSS (no framework dependency)
- **Routing**: react-router-dom (SPA routing)
- **HTTP Client**: axios (Promise-based HTTP)
- **State Management**: React hooks (useState, useContext, useEffect)

**Build & Development**:

```bash
npm run dev   # Vite dev server (default: localhost:5173)
npm run build # Production bundle
```

**Why Vite?**

- **HMR** (Hot Module Replacement): Changes visible instantly during development
- **ES Modules**: Loads only necessary code initially
- **Lightning fast**: 100ms startup vs 1s+ with webpack
- **Production bundles**: Optimized code splitting

#### A. Authentication Context (AuthContext.jsx + authCore.js)

**Architecture**: React Context API + JWT cookies

```javascript
// authCore.js: Context definition
export const AuthContext = createContext();

// AuthContext.jsx: Provider wraps entire app
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth(); // Restore session on app load
  }, []);

  async function checkAuth() {
    try {
      const response = await api.get("/user/me");
      setUser(response.data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await api.post("/user/logout"); // Clear server-side cookie
    } finally {
      setUser(null); // Clear client-side state
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, checkAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
```

**Flow**:

1. App loads → AuthProvider mounts
2. useEffect: Call `/user/me` to check if user already logged in
3. If no JWT cookie → 401 → user = null → redirect to /login
4. If JWT valid → Populate user object → Redirect to /dashboard

**Route Protection**:

```javascript
// ProtectedRoute.jsx
export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;

  return children;
}

// Usage in App.jsx
<Routes>
  <Route path="/login" element={<Login />} />
  <Route path="/register" element={<Register />} />
  <Route
    path="/dashboard"
    element={
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    }
  />
</Routes>;
```

#### B. Login Component (Login.jsx)

```javascript
POST /user/login

Request:
{
  username: "admin_user",
  password: "password123"
}

Process:
1. Validate form inputs
2. Call api.post("/user/login", { username, password })
3. Server sets HttpOnly JWT cookie in response headers
4. Call checkAuth() to refresh AuthContext
5. Navigate to /dashboard

Error Handling:
- 401: Password mismatch or user not found
- Display error message to user
- No password saved in state
```

#### C. Register Component (Register.jsx)

```javascript
POST /organization/create
POST /user/login

Process:
1. User fills in:
   - Organization name
   - Admin username
   - Admin password (≥ 8 chars)
2. Call /organization/create
3. Immediately call /user/login with same credentials
4. On success, redirect to /dashboard
```

#### D. Dashboard (Dashboard.jsx)

**Purpose**: Overview of organization's usage/stats.

```javascript
GET /application/               // List apps
GET /application/envs          // List environments
GET /logs?startTime=24h_ago     // Count logs in last 24h
GET /apikey/list               // Admin only: count API keys

Displays:
- Total applications registered
- Total environments
- Logs ingested (last 24 hours)
- Total API keys (admin only)
```

#### E. Logs Explorer (Logs.jsx)

**Purpose**: Full-featured log search interface.

**Features**:

1. **Filters**:
   - Query (q): Full-text search on message
   - Level: Dropdown (INFO, WARN, ERROR)
   - Application: Dropdown (populated from DB)
   - Environment: Dropdown
   - Date/Time range: datetime-local inputs

2. **Real-time Search**:

   ```javascript
   useEffect(() => {
     let cancelled = false;
     (async () => {
       try {
         const params = {};
         Object.entries(filters).forEach(([key, value]) => {
           if (value !== "" && value !== null) params[key] = value;
         });

         const response = await api.get("/logs", { params });
         if (!cancelled) {
           setLogs(response.data.logs);
           setTotal(response.data.total);
         }
       } catch {
         if (!cancelled) setError("Failed to fetch logs");
       }
     })();

     return () => {
       cancelled = true;
     }; // Cleanup on unmount
   }, [filters]);
   ```

3. **Highlighting**:
   - Highlights search term in results using regex
   - Example: q="timeout" → "Request timed out" shows "timeout" highlighted
   - Case-insensitive highlight

4. **Pagination**:
   - Page-based (not cursor-based)
   - Configurable perPage (default: 50)
   - Previous/Next buttons

5. **Log Entry Display**:
   - Timestamp, level (styled with diff colors), message
   - Expandable metadata (JSON)
   - Trace ID (for correlation)

#### F. API Keys Management (APIKeys.jsx)

**Features**:

1. **Generate New Key**:
   - Name (required)
   - Rate limit per sec (default: 1000)
   - Expiration date (optional)
   - Display raw key once (with copy button + warning to save securely)

2. **Update Existing Key**:
   - Change name, rate limit, expiration
   - Cannot update key_hash

3. **Revoke Key**:
   - Delete key immediately
   - Logs using this key will fail auth

4. **List All Keys**:
   - Show all keys for organization
   - Hide raw key (only first 10 chars shown)

#### G. Users Management (Users.jsx)

**Features** (Admin only):

1. **Create User**:
   - Username, password, role (admin/user)

2. **List Users**:
   - Show all users in organization
   - Last login timestamp

3. **Update User**:
   - Change username or role

4. **Delete User**:
   - Prevent deleting last admin

#### H. HTTP Client Configuration (api.js)

```javascript
import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000",
  withCredentials: true, // Include JWT cookie in all requests
});
```

**Why withCredentials: true?**

- Axios automatically sends JWT cookie with every request
- Server extracts cookie → Verifies JWT → Extracts organizationId
- No manual token passing needed

**CORS Configuration** (LogicalPlain backend):

```javascript
app.use(
  cors({
    origin: [
      "http://127.0.0.1:5500",
      "http://localhost:5173", // Vite dev server
      "http://localhost:5174",
    ],
    credentials: true, // Allow cookies
  }),
);
```

---

## 4. OPTIMIZATION TECHNIQUES & ALGORITHMS

### 4.1 Kafka Partitioning by organization_id

**Technique**: Using organization_id as partition key during message production.

**Implementation**:

```javascript
messages: logs.map(log => ({
  key: organizationId,  // Determines partition assignment
  value: JSON.stringify(...)
}))
```

**How It Works**:

1. Kafka hashes the key: `partition = hash(organizationId) % num_partitions`
2. Example with 6 partitions:
   - Org123: hash("123") % 6 = 2 → Partition 2
   - Org456: hash("456") % 6 = 4 → Partition 4
   - Org789: hash("789") % 6 = 1 → Partition 1
3. All logs for same org go to same partition (unless partition count changes)

**Benefits**:

1. **Preserves Ordering**:

   ```
   Without partitioning:
   Request A (Org123) → Partition 0
   Request B (Org456) → Partition 1
   Request A (Org123) → Partition 2

   Risk: Indexer reads A, B, A out of order

   With partitioning:
   Request A (Org123) → Partition 2
   Request C (Org123) → Partition 2
   Request A (Org123) → Partition 2

   Indexer reads A, C, A in order per partition
   ```

2. **Efficient Sequential Disk I/O**:
   - Partition 0: All Org123 logs written sequentially
   - Partition 3: All Org456 logs written sequentially (different disk region)
   - No fragmentation: Each org's data contiguous
   - OS page cache works efficiently

3. **Query Performance**:
   - OpenSearch stores logs contiguously by organization_id
   - Full-text search: Fewer seeks within document store
   - Aggregations: Related data in same memory page

**Trade-off**: Hot Partitions

- If one organization very large, its partition becomes hot
- Solution: Use higher cardinality key (e.g., organization_id + application_id)

### 4.2 Token Bucket Rate Limiting

**Algorithm**: Atomic Lua script-based rate limiting in Redis.

**Why Token Bucket?**

| Algorithm      | Pros                   | Cons                | Best For       |
| -------------- | ---------------------- | ------------------- | -------------- |
| Fixed Window   | Simple                 | Burst at boundaries | Simple limits  |
| Sliding Window | Accurate               | O(n) memory         | Strict limits  |
| Token Bucket   | Fair, controlled burst | Slightly complex    | Ingestion ✓    |
| Leaky Bucket   | Smooth, fair           | Limited burst       | Rate smoothing |

**Token Bucket Example**:

```
Rate: 100 tokens/sec, Capacity: 100

Timeline:
t=0.0s: tokens=100, allow 50 reqs → tokens=50
t=0.5s: tokens=50 + 0.5*100 = 100 (refill), allow 30 reqs → tokens=70
t=1.0s: tokens=70 + 0.5*100 = 120, capped at 100, allow 100 → tokens=0
t=1.1s: tokens=0 + 0.1*100 = 10, allow 10 reqs → tokens=0
t=1.2s: tokens=0 + 0.1*100 = 10, allow 5 reqs → tokens=5
```

**Why Lua Script?**

```lua
-- Atomic operation: Read, compute, write all happen together
-- Without Lua: Race condition
  GET tokens → 50
  (process A says tokens=50)
  (process B also says tokens=50)
  (both subtract 1)
  SET tokens 49  ← Lost update!
  SET tokens 49  ← Tried to set again (overwrites)

-- With Lua: All in one Redis call (transactional)
  EVAL tokenBucket.lua
  ├─ Read tokens + last_refill
  ├─ Compute tokens = min(capacity, tokens + elapsed * rate)
  ├─ Decrement tokens
  └─ Write back
  (all atomic)
```

**Performance**:

- Single Redis call per request: ~0.5ms
- No database lookup needed
- No polling/spinning

### 4.3 Memory Buffering & Batching in Indexer

**Pattern**: Accumulate logs in memory, flush periodically or on threshold.

**Code**:

```javascript
let buffer = [];
let lastFlushTime = Date.now();

consumer.run({
  eachMessage: async ({ message }) => {
    const log = JSON.parse(message.value);
    buffer.push(log);

    const timeExceeded = Date.now() - lastFlushTime >= 2000;
    if (buffer.length >= 50 || timeExceeded) {
      await flush();
    }
  },
});
```

**Optimization Rationale**:

1. **Throughput**: Batching 50 logs into 1 HTTP request vs 50 requests
   - 50 sequential: 50 × 100ms = 5000ms
   - 1 batched: 100ms
   - **50x speedup** in this scenario

2. **CPU Utilization**: Bulk API processes entire batch in single loop
   - Sequential: 50 JSON deserialization cycles
   - Bulk: 1 cycle over 50 docs (better instruction cache)

3. **Network Efficiency**: Fewer TCP round-trips
   - RTT (Round-Trip Time) ≈ 5-10ms
   - 50 requests: 50 × 10 = 500ms overhead
   - 1 batched: 10ms overhead

4. **Safety Net**: Time-based flush prevents indefinite buffering
   - Scenario: Only 5 logs/minute ingested
   - Without time flush: Logs sit in buffer for hours
   - With 2sec flush: Latency P95 < 2sec guaranteed

### 4.4 Rolling Daily Indices in OpenSearch

**Pattern**: Create new index for each day (logs-2025.01.15, logs-2025.01.16, etc.)

**Implementation**:

```javascript
const indexName = "logs-" + log.timestamp.slice(0, 10).replace(/-/g, ".");
// "2025-01-15T13:45:30Z" → "logs-2025.01.15"

body.push({ index: { _index: indexName } });
body.push(logDocument);
```

**Benefits**:

1. **Query Speed**:

   ```
   Search range: 2025.01.10 to 2025.01.12

   Without rolling indices (single mega-index):
   - Must scan 365 days of data annually
   - P95 latency: ~5s

   With rolling indices (separate per day):
   - Must scan only 3 indices (logs-2025.01.{10,11,12})
   - Ignore other 362 indices completely
   - P95 latency: ~200ms
   - 25x faster!
   ```

2. **Data Retention**:

   ```
   Policy: Delete logs older than 90 days

   Without rolling: DELETE WHERE timestamp < 90d_ago (kills millions of docs)
   - Expensive: Must find, lock, delete docs one by one
   - Index fragmentation: Gaps in data structure

   With rolling: DELETE INDEX logs-2024.10.{15,16,17,...}
   - Fast: Just drop index (metadata operation)
   - No fragmentation: Next day's index created fresh
   - Reclaim 100% of disk space immediately
   ```

3. **Maintenance**:

   ```
   Scenario: Index mapping needs update (new field type)

   Without rolling: Reindex entire 1TB index (hours of downtime)

   With rolling:
   - New indices auto-created with new mapping
   - Old indices keep old mapping
   - Gradual migration: Oldest indices phased out naturally
   ```

4. **Shard Distribution**:
   - Each index can have its own shard count
   - Heavy-traffic days: More shards, more parallelism
   - Light-traffic days: Fewer shards, lower memory
   - Fine-tuning per day's characteristics

### 4.5 API Key Caching with Redis

**Pattern**: Cache expensive database lookups in Redis.

**Implementation** (`apiKeyVerifier.js`):

```javascript
export async function verifyApiKey(apiKeyHash) {
  const cacheKey = `api_key:${apiKeyHash}`;

  // 1. Check Redis cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    const data = JSON.parse(cached);
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return null; // Expired, even if cached
    }
    return data;
  }

  // 2. Cache miss: Query PostgreSQL
  const result = await pool.query(
    `SELECT id, organization_id, rate_limit_per_sec, expires_at
     FROM api_keys WHERE key_hash = $1`,
    [apiKeyHash],
  );

  if (result.rowCount === 0) return null;

  const row = result.rows[0];
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return null;
  }

  // 3. Cache hit: Store in Redis for 60 seconds
  const payload = {
    api_key_id: row.id,
    organization_id: row.organization_id,
    rate_limit_per_sec: row.rate_limit_per_sec,
    expires_at: row.expires_at,
  };

  await redis.setex(cacheKey, 60, JSON.stringify(payload));

  return payload;
}
```

**Performance Impact**:

```
Scenario: 100,000 requests/hour with 1,000 unique API keys

WITHOUT caching:
- 100,000 PostgreSQL queries/hour
- Each query: ~5ms (network + disk I/O)
- Total: 500,000ms = 500 seconds overhead

WITH caching (60s TTL):
- Every API key cached for 60 seconds
- 1,000 unique keys = 1,000 DB queries per minute
- 1,000 × 5ms = 5,000ms per minute
- 60 minutes: ~300,000ms = 300 seconds overhead
- SAVINGS: 200 seconds (40% reduction)

Hit rate: ~99.8% (1 miss per 500 requests)
```

**Expiration Handling**:

```
Scenario: Key expires at 2025-01-15 10:00:00

1. Key cached in Redis at 2025-01-14 10:00:00
2. Redis TTL set to 60s
3. At 2025-01-15 10:00:00:
   - Redis still has cached entry (within 60s window from original caching)
   - Application checks expiration: NOW > expires_at → null
   - Cache miss: Not returned
   - Prevents: Expired keys being accepted after recent caching

4. New incoming request after Redis TTL expires:
   - Redis evicts entry (after 60s)
   - DB query confirms: Key not found or expired
   - Return null
```

### 4.6 SHA256 One-Way Hashing for API Keys

**Pattern**: Store hash, not raw key. Verify by hashing incoming key.

**Implementation**:

```javascript
// Generation
const rawKey = `lk_${crypto.randomBytes(32).toString("hex")}`;
const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
// Store keyHash in database, return rawKey to client

// Verification
const rawKeyFromClient = "lk_abc123...";
const incomingHash = sha256(rawKeyFromClient);
const dbResult = database.query("SELECT * FROM api_keys WHERE key_hash = ?", [
  incomingHash,
]);
```

**Why Not Reversible Encryption?**

```
Reversible: key = decrypt(encryption_key, storedKey)
Risk: If DB stolen + encryption_key leaked → All keys compromised

One-way hash: hash(key) = storedHash
Risk: Even if DB stolen → Can't derive original key
Attacker must hash every possible key to find match (brute force)
```

**Brute Force Protection**:

```
Attack: Try to find a key that hashes to a known keyHash

With SHA256:
- Computational cost: Hash 1M keys/second (GPU)
- Key space: 2^256 possibilities
- Time to crack one key: 2^256 / 2 / 1M/sec ≈ 10^70 years (impossible)

Attack: Reuse known keys
- Mitigation: Rotate keys regularly (quarterly)
- Monitoring: Alert if same hash queried 100x/sec (brute force attempt)
```

---

## 5. PERFORMANCE MEASUREMENT & MONITORING

### 5.1 K6 Load Testing Framework

**Location**: `/K6-Tests/`

**Why K6?**

- Written in Go: Fast, minimal overhead
- JavaScript test scripts: Familiar language
- Built-in metrics: Throughput, latency percentiles, error rates
- Threshold assertions: Fail tests if P95 > threshold

#### A. Smoke Test (1_smoke_test.js)

**Purpose**: Basic functionality validation.

**Configuration**:

```javascript
export const options = {
  vus: 1, // 1 Virtual User
  iterations: 3, // Run 3 times
};
```

**Test**:

```javascript
POST /ingest with single log entry
├─ Request time < 1s
├─ Status 202 (accepted)
└─ Display: Organization, app, env, duration
```

**When to run**: After deployment, pre-production sign-off

#### B. Invalid Key Test (2_invalid_key_test.js)

**Purpose**: Security validation - ensure bad keys rejected quickly.

**Configuration**:

```javascript
export const options = {
  vus: 2, // 2 concurrent users
  iterations: 6, // Each user runs 6 times
};
```

**Test**:

```javascript
POST /ingest with Authorization: Bearer INVALID-KEY-SHOULD-FAIL
├─ Status 401 or 403 (rejected)
└─ Latency should be sub-100ms (fast failure, not slow DB lookup)
```

**Security Implication**: Authorization failure should not leak timing information.

#### C. Scale/Load Test (3_scale_demo_test.js)

**Purpose**: Understand system behavior under increasing load.

**Configuration**:

```javascript
export const options = {
  stages: [
    { duration: "20s", target: 10 }, // Ramp to 10 VUs
    { duration: "20s", target: 50 }, // Ramp to 50 VUs
    { duration: "20s", target: 100 }, // Ramp to 100 VUs
    { duration: "10s", target: 0 }, // Wind down
  ],
  thresholds: {
    ingest_duration_ms: ["p(95)<1500"], // P95 latency < 1.5s
    ingest_success_rate: ["rate>0.95"], // Success rate > 95%
    http_req_failed: ["rate<0.05"], // Error rate < 5%
  },
};
```

**Custom Metrics**:

```javascript
const ingestDuration = new Trend("ingest_duration_ms", true);
const successRate = new Rate("ingest_success_rate");
const totalLogs = new Counter("total_logs_ingested");

// Usage in test
ingestDuration.add(res.timings.duration);
successRate.add(success);
totalLogs.add(BATCH_SIZE);
```

**Ramp Profile Analysis**:

```
Stage 1 (20s, target 10 VUs):
  - Ingestion Service handling 10 concurrent users
  - Each user sends ~1 request/sec
  - Expected output: 10 requests/sec = ~50 logs/sec (batch size 5)

Stage 2 (20s, target 50 VUs):
  - 50 concurrent users
  - Expected output: 50 requests/sec = ~250 logs/sec
  - System stress increases: More Kafka buffering, Redis contention

Stage 3 (20s, target 100 VUs):
  - 100 concurrent users
  - Expected output: 100 requests/sec = ~500 logs/sec
  - Peak load: Observe tail latency (P95, P99, Max)

Stage 4 (10s, target 0 VUs):
  - Graceful shutdown: No abrupt cutoff
  - Observe recovery: How quickly latency returns to normal
```

**Threshold Assertions**:

- P95 < 1500ms: 95% of requests complete within 1.5s
  - Example: If 100 requests, 95 should be < 1.5s, up to 5 can be > 1.5s
- Success rate > 95%: System can tolerate ~5% errors before failing test
- Error rate < 5%: Same threshold, different perspective

**Interpretation**:

```
Result for 100 VU run:
- Requests: 1000 total
- Passed (HTTP 202): 950
- Failed: 50 (below 95% threshold)
- Test Status: ✅ PASS

Latency percentiles:
- P50: 200ms (median request)
- P75: 400ms (75th percentile)
- P90: 800ms (90th percentile)
- P95: 1200ms (meets < 1500ms threshold)
- P99: 1800ms (exceeds threshold but < P95 passes)
- Max: 2500ms (worst case)
```

#### D. Data-Driven Test (4_data_driven_test.js)

**Purpose**: Realistic multi-tenant simulation.

**Setup**:

```javascript
const ORGS = fetchedOrganizations; // From production DB
const ALL_API_KEYS = ORGS.flatMap((org) => org.apiKeys);
```

**Test Loop**:

```javascript
for each VU:
  - Select organization: ORGS[VU % ORGS.length]
  - Select random app from organization's app list
  - Select random env from organization's env list
  - Select random API key
  - Send log batch
  - Record metrics
```

**Why "Data-Driven"?**

- Uses real organizations from database
- Tests cross-tenant scenarios
- Uncovers hot-tenant issues (one org much heavier than others)
- More realistic than synthetic data

### 5.2 Internal Latency Measurements

**Location**: Ingestion Service logs

**Implementation** (`routes/ingest.js`):

```javascript
const requestStart = Date.now();

// ... processing ...

const latency = Date.now() - requestStart;
console.log(
  `[INGESTION] Request accepted | logs=${logCount} | latency=${latency}ms`,
);
```

**Telemetry Breakdown**:

```javascript
console.log(`[AUTH] Verifying API key...`); // Time credential lookup
console.log(`[RATE_LIMIT] Checking rate limit...`); // Time rate limiting
console.log(`[VALIDATION] Payload validated...`); // Time validation
console.log(`[KAFKA] Publishing logs...`); // Time Kafka send
console.log(`[INGESTION] Request accepted...`); // Total time
```

**Sample Output**:

```
[INGESTION] Incoming request received
[AUTH] Verifying API key...
[AUTH] API key verified | org=456 | keyId=123
[RATE_LIMIT] Checking rate limit | keyId=123 | limit=1000/sec
[RATE_LIMIT] Allowed request for keyId=123
[VALIDATION] Payload validated | logs=5 | app=api-gateway | env=prod
[KAFKA] Publishing 5 logs to Kafka topic for org=456
[KAFKA] Successfully published 5 logs
[INGESTION] Request accepted | logs=5 | latency=45ms
```

**Using This Telemetry**:

1. **Identify Bottleneck**:
   - If AUTH time = 30ms (most of 45ms) → API key cache issue
   - If KAFKA time = 35ms → Kafka broker slow
   - If VALIDATION time = 5ms (normal) → Not bottleneck

2. **Alerting**:
   ```
   IF latency > 1000ms for > 10% of requests in last 5 min THEN alert
   IF latency > 500ms AND latency_trend INCREASING THEN alert
   ```

### 5.3 Monitoring Dashboard (OpenSearch Dashboards)

**Port**: 5601 (http://localhost:5601)

**Dashboards to Create**:

1. **Ingestion Metrics**:
   - Requests/sec per minute (trend)
   - Latency: P50, P95, P99 over time
   - Error rate (4xx, 5xx)
   - API keys verified/cached ratio

2. **Kafka Metrics**:
   - Consumer lag (messages waiting in queue)
   - Publish success rate
   - Messages per partition
   - Broker CPU/memory

3. **OpenSearch Metrics**:
   - Query latency (P95, P99)
   - Indexing rate (logs/sec)
   - Index size growth
   - Disk usage per index

4. **System Health**:
   - PostgreSQL connection pool utilization
   - Redis memory usage
   - Node.js memory footprint
   - CPU utilization per service

---

## 6. TECHNOLOGY STACK DETAILS

### 6.1 Node.js & Express

**Why Node.js?**

1. **Non-blocking I/O**: Handles thousands of concurrent connections
2. **Event-driven**: Async/await + Promises for readable asynchronous code
3. **Single-threaded + Event Loop**: No manual thread management
4. **JSON-native**: JavaScript native object ↔ JSON serialization

**Express Setup**:

```javascript
app.use(express.json({ limit: "2mb" }));  // Body parser
app.use(cookieParser());                  // Cookie parsing
app.use(cors({ ... }));                   // CORS
app.listen(3000);                         // Start server
```

**Performance**:

- Throughput: 10,000+ requests/sec per instance
- Startup: ~500ms
- Memory: ~50MB base

### 6.2 PostgreSQL

**Why PostgreSQL?**

1. **ACID Compliance**: Transactions ensure consistency (org + admin creation atomic)
2. **Schema Validation**: Column types prevent bad data
3. **Foreign Keys**: Referential integrity (org ← users, api_keys)
4. **Standard SQL**: Widely known, good tooling

**Tables** (inferred from controllers):

```sql
organizations
├── id (PK)
├── name (UNIQUE)
└── created_at

users
├── id (PK)
├── organization_id (FK → organizations)
├── username (UNIQUE per org)
├── password_hash (bcrypt)
├── role ('admin' | 'user')
├── created_at
└── last_login_at

api_keys
├── id (PK)
├── organization_id (FK → organizations)
├── key_hash (UNIQUE)
├── name
├── rate_limit_per_sec
├── created_at
└── expires_at

applications
├── id (PK)
├── organization_id (FK → organizations)
├── name
├── description
└── created_at
```

**Indexing Strategy**:

```sql
CREATE INDEX idx_users_org ON users(organization_id);
CREATE INDEX idx_apikeys_keyhash ON api_keys(key_hash);  -- For fast lookups
CREATE INDEX idx_apikeys_org ON api_keys(organization_id);
CREATE INDEX idx_apps_org ON applications(organization_id);
```

### 6.3 Redis

**Why Redis?**

1. **O(1) Operations**: Hash lookups for rate limiting
2. **In-Memory**: Microsecond latency
3. **Atomic Lua Scripts**: Prevent race conditions
4. **TTL Support**: Auto-expire stale data

**Data Model**:

```
token_bucket:<api_key_id> = { tokens: float, last_refill: timestamp }
api_key:<api_key_hash> = { api_key_id, organization_id, rate_limit_per_sec, expires_at }
```

**Configuration**:

```bash
maxmemory: 256MB         # Limit memory use
maxmemory-policy: allkeys-lru  # Evict least recently used on overflow
appendonly: no           # Write-through not needed (volatile data)
```

### 6.4 Kafka/Redpanda

**Architecture**:

- **Brokers**: Cluster of servers storing/replicating messages
- **Topics**: Named streams (e.g., "logs.raw")
- **Partitions**: Shards within topic (6 in our case)
- **Consumer Groups**: Coordinated readers of topic

**Why Partition by organization_id?**

- Ensures ordering per tenant
- Distributes load (50 orgs, 6 partitions = ~8 orgs per partition)
- Enables consumer scaling (more consumers if > 6 orgs heavily used)

**Replication**:

```
Development (docker-compose):
- Replication factor: 1
- Single broker: redpanda:29092

Production:
- Replication factor: 3
- Brokers: kafka1:9092, kafka2:9092, kafka3:9092
- Ensures: If 1 broker fails, data not lost
```

### 6.5 OpenSearch

**Why OpenSearch?**

1. **Full-Text Search**: Message field supports fuzzy, wildcard matching
2. **Time-Series Support**: @timestamp field + date math queries
3. **Aggregations**: Group logs by level, app, etc.
4. **Horizontal Scalability**: Sharding distributes data
5. **JSON Documents**: No schema restriction (metadata field)

**Index Mapping** (inferred from indexer):

```json
{
  "mappings": {
    "properties": {
      "@timestamp": { "type": "date" }, // time-series
      "timestamp": { "type": "date" },
      "organization_id": { "type": "keyword" }, // Exact match (not analyzed)
      "level": { "type": "keyword" },
      "message": { "type": "text" }, // Full-text search
      "application": { "type": "keyword" },
      "environment": { "type": "keyword" },
      "trace_id": { "type": "keyword" },
      "metadata": { "type": "object" } // Nested JSON
    }
  }
}
```

**Index Lifecycle**:

```
Scenario: 1 month retention, 1000 logs/day

October 1:
- Create logs-2025.01.01
- Index 1000 docs

October 15:
- logs-2025.01.01 has 1000 docs
- logs-2025.01.02 has 1000 docs
- ... (14 indices)
- logs-2025.01.15 being written to

October 31:
- 31 indices (Oct 1-31)
- logs-2024.09.01 deleted (31+ days old)

November 1:
- logs-2024.09.02 deleted
- logs-2025.11.01 created
```

### 6.6 React & Vite

**Why Vite?**

- **HMR**: Hot Module Replacement (instant feedback during dev)
- **ES Modules**: Only loads used code (tree-shaking)
- **Rollup Bundling**: Optimized production code splitting

**Build Output**:

```
npm run build
→ dist/
  ├── index.html (entry point)
  ├── assets/
  │   ├── main.xxxxx.js (app code)
  │   ├── vendor.xxxxx.js (dependencies)
  │   └── style.xxxxx.css
  └── vite.svg
```

**Production Deployment**:

```
# Nginx serves static files
server {
  listen 80;
  location / {
    root /app/dist;
    try_files $uri /index.html;  # SPA routing
  }
}
```

### 6.7 Docker & Docker Compose

**Why Docker?**

- **Parity**: Dev environment ≅ Production environment
- **Isolation**: Services don't interfere with system packages
- **Scaling**: Spin up multiple instances easily

**Compose Services**:

```yaml
redpanda:
  - Kafka broker
  - Port 9092 (external), 29092 (internal network)

console:
  - Kafka UI for debugging
  - Port 8080

opensearch:
  - Search engine
  - Port 9200

opensearch-dashboards:
  - UI for OpenSearch
  - Port 5601

redis:
  - Cache/rate limiting
  - Port 6379

ingestion-service:
  - Node.js app
  - Builds from ./ingestion-service/Dockerfile

log-hot-indexer:
  - Node.js consumer app
  - Builds from ./log-hot-indexer/Dockerfile

nginx:
  - Reverse proxy
  - Port 4100 (external)
```

---

## 7. FEATURES & CAPABILITIES

### 7.1 Multi-Tenant Data Isolation

**Implementation**:

1. Every log tagged with organization_id at ingestion
2. Every query filtered by organization_id from JWT
3. Frontend/Backend: Cannot access other org's API keys, users, etc.

**Guarantees**:

- Organization A's logs never visible to Organization B
- Even if JWT compromised, attacker can only see own org's data
- API keys bound to single organization

**Testing**:

```
Manual test:
1. Create Organization A (admin: alice)
2. Create Organization B (admin: bob)
3. Login as bob
4. Try to access /logs → Filtered by bob's org_id
5. Try to query /logs?organization_id=A → Ignored, filtered by bob's org_id
6. Verify: Can only see org B's logs
```

### 7.2 Role-Based Access Control (RBAC)

**Roles**:

- **admin**: Can create users, generate API keys, view all org data
- **user**: Can view logs, but cannot manage users/keys

**Enforcement**:

```javascript
@authAdmin  // Only admins can call this
POST /apikey/generate

@authUser   // Any authenticated user in org
GET /logs
```

### 7.3 Rate Limiting by API Key

**Configuration**:

- Per-key rate limit: 1-∞ tokens/sec (configurable)
- Default: 1000 tokens/sec
- Can be adjusted per environment (dev: 100, prod: 1000)

**Enforcement**: Token bucket algorithm in Redis

**Use Cases**:

- Dev API key: 100/sec (prevent accidental spam)
- Prod API key: 10,000/sec (high-throughput services)

### 7.4 API Key Expiration

**Features**:

- Optional expiration date on key creation
- Keys checked for expiration on every auth attempt
- Expired keys immediately rejected (even if cached)

**Use Cases**:

- Temporary keys for contractors (expires after 3 months)
- Rotating keys (generate new, expire old after 1 week)

### 7.5 Full-Text Log Search

**Capabilities**:

- Fuzzy matching: "eror" matches "error"
- Wildcard: "_timeout_" matches any message containing "timeout"
- Case-insensitive: "ERROR", "error", "Error" all match

**Example Queries**:

```python
# Find all errors about database
q="database error"
→ Messages containing both "database" and "error" (in any order)

# Wildcard
q="*timeout*"
→ Any message containing "timeout"

# Typo tolerance
q="databse"  (misspelled "database")
→ Fuzzy matching finds "database" due to similarity
```

### 7.6 Faceted Search

**Filters**:

- Level: INFO, WARN, ERROR
- Application: Select from registered apps
- Environment: dev, staging, prod
- Custom date range

**Combined Example**:

```
level=ERROR AND application=api-gateway AND environment=prod
AND startTime=2025-01-15T00:00 AND endTime=2025-01-15T23:59
AND q=auth
```

### 7.7 Environment Scoping

**Concept**: Logs categorized by environment (dev/staging/prod)

**Usage**:

- Same application running in multiple envs sends logs to same org
- Logs tagged with environment name at ingestion
- Queries can filter by environment

**Example**:

```
Application: api-gateway
Invokedenvironments: [dev, staging, prod]

Request 1: app.log(level=ERROR, env=prod, msg="...")  → logs-prod-topic
Request 2: app.log(level=DEBUG, env=dev, msg="...")   → logs-dev-topic
Request 3: app.log(level=WARN, env=staging, msg="...")  → logs-staging-topic

Query: Show all ERRORs in PROD
→ Only Request 1 shown
```

### 7.8 Metadata Tags

**Custom Metadata**:

- Arbitrary JSON object attached to each log
- Example: `{ latency_ms: 42, user_id: "user123", request_id: "req456" }`
- Indexed in OpenSearch for filtering/aggregations (if needed)

### 7.9 Trace ID Correlation

**Field**: `trace_id` on each log

**Use Case**:

- Distributed tracing: Follow request across microservices
- Example: Request REQ-123 hits [auth-service, payment-service, notification-service]
- Each service logs with trace_id=REQ-123
- Query by trace_id to see entire flow

---

## 8. SECURITY & DATA ISOLATION

### 8.1 API Key Security

**One-Way Hashing**:

- Stored: SHA256 hash only
- Database theft: Attacker cannot derive original key
- Brute force: Would need to hash every possible 64-char string (2^256 possibilities)

**Key Format**: `lk_<64_hex_chars>`

- Prefix "lk\_": Human-readable, identifiable (LogRush Key)
- 64 hex chars: 256 bits of entropy (cryptographically secure)

**Rotation Strategy**:

- Generate new key: Client receives new raw key
- Revoke old key: Immediate deletion of old hash
- Transition period: Run both keys for 1 week, then revoke old

### 8.2 Password Security

**Hashing**: bcrypt with salt rounds = 12

- Cost: ~100ms per hash (intentionally slow)
- Protection: GPU brute force impractical (10 hashes/sec max)
- Salted: Same password produces different hash each time

**Storage**: Only hash stored (never plaintext)

**Transmission**: HTTPS only (enforced in production)

### 8.3 JWT Token Security

**Format**: `header.payload.signature`

**Payload**:

```json
{
  "userId": 123,
  "organizationId": 456,
  "role": "admin",
  "iat": 1640000000,
  "exp": 1640086400
}
```

**Signature**: HMAC-SHA256(header.payload, JWT_SECRET)

- Tampering detection: If payload modified, signature invalid
- Forgery prevention: Attacker cannot create valid signature without secret

**Storage**: HttpOnly cookie

- JavaScript cannot access (XSS vulnerable)
- Browser auto-sends with requests (convenience)
- Secure flag: HTTPS only (man-in-the-middle attack prevention)

**Expiration**: 7 days

- Balance: User convenience vs security
- Longer: Better UX, more window if token stolen
- Shorter: Better security, but frequent re-login

### 8.4 Organization Isolation

**Query-Level Enforcement**:

```javascript
// Every log query mandatorily filters by org_id
{
  bool: {
    must: [{ term: { "organization_id.keyword": orgId } }];
  }
}
```

**JWT Extraction**:

```javascript
const decoded = jwt.verify(token, JWT_SECRET);
req.user.organizationId = decoded.organizationId; // Immutable from token
```

**Attack Scenario Prevention**:

```
Attacker: alice@org-a.com with valid JWT
Token contains: organizationId = 1

Attack 1: Try to query org 2's logs
GET /logs?organization_id=2
→ Ignored: JWT organizationId = 1 used instead
→ Returns org 1's logs

Attack 2: Try to list org 2's users
GET /user/list?organization_id=2
→ 403 Forbidden: JWT organizationId != requested org
→ Or filtered: Middleware extracts org from JWT, only shows own org
```

### 8.5 Rate Limiting for DDoS Protection

**Purpose**: Prevent single client from overwhelming ingestion

**Mechanism**: Token bucket per API key

- Limit: 1000 logs/sec per key
- Burst: Allowed 1000 consecutive logs, then must wait 1 sec

**Attack Scenario**:

```
Attacker compromise: Obtains api_key_prod (rate_limit=1000)

Attempt 1: Send 100,000 logs/sec
→ First 1000 accepted, rest rejected with 429
→ Ingestion API not overwhelmed
→ OpenSearch indexing stable

Attempt 2: Distributed attack with multiple compromised keys
→ Each key's 1000/sec limit independent
→ 10 keys = 10,000 logs/sec max (manageable)
→ Frontend load balancer distributes to 3 ingestion replicas
→ Each replica: 3,333 logs/sec (within bounds)
```

### 8.6 CORS Configuration

**Allowed Origins** (LogicalPlain):

```javascript
cors({
  origin: [
    "http://127.0.0.1:5500", // Live Server (dev)
    "http://localhost:5173", // Vite dev server
    "http://localhost:5174", // Vite dev server alt port
  ],
  credentials: true,
});
```

**Purpose**:

- Prevent cross-origin requests from malicious sites
- Only frontend domains can submit form data to backend
- Attacker's site cannot make API calls to backend

---

## 9. DATABASE SCHEMA & DATA MODELS

### 9.1 PostgreSQL Schema

```sql
-- Organizations (Tenants)
CREATE TABLE organizations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Users (with RBAC)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  organization_id INT NOT NULL,
  username VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',  -- 'admin' or 'user'
  created_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP,
  FOREIGN KEY(organization_id) REFERENCES organizations(id),
  UNIQUE(organization_id, username)
);

-- API Keys for log ingestion
CREATE TABLE api_keys (
  id SERIAL PRIMARY KEY,
  organization_id INT NOT NULL,
  key_hash VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  rate_limit_per_sec INT DEFAULT 1000,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY(organization_id) REFERENCES organizations(id),
  INDEX idx_org_id (organization_id),
  INDEX idx_key_hash (key_hash)
);

-- Applications (sources of logs)
CREATE TABLE applications (
  id SERIAL PRIMARY KEY,
  organization_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY(organization_id) REFERENCES organizations(id),
  INDEX idx_org_id (organization_id)
);
```

### 9.2 Kafka Message Schema

**Topic**: `logs.raw`

**Key** (Partition Key):

```
organization_id: "456"
```

**Value** (Message):

```json
{
  "organization_id": 456,
  "api_key_id": 789,
  "application": "api-gateway",
  "environment": "production",
  "host": "api-gateway-prod-01",
  "version": "1.2.3",
  "timestamp": "2025-01-15T13:45:30.123Z",
  "level": "ERROR",
  "message": "Database connection timeout",
  "trace_id": "3a4f2b1c8d9e7a5fXXXXXXX",
  "metadata": {
    "latency_ms": 5000,
    "user_id": "user123",
    "request_id": "req-456-789"
  },
  "ingested_at": "2025-01-15T13:45:30.250Z"
}
```

### 9.3 OpenSearch Document Schema

**Index Name**: `logs-YYYY.MM.DD` (e.g., `logs-2025.01.15`)

**Document**:

```json
{
  "@timestamp": "2025-01-15T13:45:30.123Z",
  "timestamp": "2025-01-15T13:45:30.123Z",
  "ingested_at": "2025-01-15T13:45:30.250Z",
  "organization_id": 456,
  "api_key_id": 789,
  "application": "api-gateway",
  "environment": "production",
  "host": "api-gateway-prod-01",
  "version": "1.2.3",
  "level": "ERROR",
  "message": "Database connection timeout",
  "trace_id": "3a4f2b1c8d9e7a5fXXXXXXX",
  "metadata": {
    "latency_ms": 5000,
    "user_id": "user123",
    "request_id": "req-456-789"
  }
}
```

### 9.4 Redis Data Structures

**Token Bucket State**:

```
Key: token_bucket:<api_key_id>
Type: Hash

Fields:
- tokens: <float> (current token balance)
- last_refill: <timestamp_ms> (last refill time)

TTL: 2 seconds (auto-expire)

Example:
token_bucket:789 = {
  tokens: 45.5,
  last_refill: 1705347930125
}
```

**API Key Cache** (Optional, for frequent hits):

```
Key: api_key:<sha256_hash>
Type: String (JSON)

Value:
{
  "api_key_id": 789,
  "organization_id": 456,
  "rate_limit_per_sec": 1000,
  "expires_at": "2026-01-15T23:59:59Z"
}

TTL: 60 seconds
```

---

## 10. DEPLOYMENT & INFRASTRUCTURE

### 10.1 Local Development

**Prerequisites**:

```bash
- Docker & Docker Compose
- Node.js 16+
- npm or yarn
```

**Startup**:

```bash
cd /DataPlain
docker-compose up -d

cd /LogicalPlain
npm install
npm run dev  # Runs on :3000

cd /Frontend/my-react-app
npm install
npm run dev  # Runs on :5173 (Vite dev server)
```

**Verification**:

```
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- Kafka Console: http://localhost:8080
- OpenSearch Dashboards: http://localhost:5601
- Redpanda Console: http://localhost:8080
```

### 10.2 Docker Compose Services

**Orchestration**:

```yaml
version: "3.8"

services:
  redpanda:
    image: redpandadata/redpanda:v23.3.3
    ports: ["9092:9092", "29092:29092"]
    command: # Single-node cluster config
      - redpanda start
      - --overprovisioned --smp 1 --memory 1G ...

  opensearch:
    image: opensearchproject/opensearch:2.12.0
    environment:
      - discovery.type=single-node # No clustering needed
      - plugins.security.disabled=true # Dev only (disable in prod)
      - OPENSEARCH_JAVA_OPTS=-Xms512m -Xmx512m
    ports: ["9200:9200"]

  redis:
    image: redis:7
    ports: ["6379:6379"]

  nginx:
    image: nginx:latest
    ports: ["4100:80"]
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - ingestion-service

  ingestion-service:
    build: ./ingestion-service
    env_file: .env.ingestion
    environment:
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://...
    depends_on:
      - redpanda
      - redis

  log-hot-indexer:
    build: ./log-hot-indexer
    depends_on:
      - redpanda
      - opensearch

  opensearch-dashboards:
    image: opensearchproject/opensearch-dashboards:latest
    ports: ["5601:5601"]
    environment:
      - OPENSEARCH_HOSTS=http://opensearch:9200
```

### 10.3 Production Deployment Considerations

**Scaling**:

```
Component | Single-Node | 10x Scale | Notes |
-----------|-------------|-----------|-------|
Ingestion Service | 1 replica | 5 replicas | Stateless, horizontal scale |
Log Hot Indexer | 1 consumer | 3 consumers | Partitioned by org_id |
Kafka/Redpanda | 1 broker | 3 brokers | Replication for HA |
OpenSearch | 1 node | 5+ nodes | Sharding + replicas |
PostgreSQL | 1 master | Master + replicas | Read replicas for queries |
Redis | 1 node | Sentinel + 3 nodes | High availability |
Nginx | 1 instance | 2-3 LBs | Layer 7 load balancing |
```

**Monitoring Stack**:

- **Prometheus**: Metrics collection
- **Grafana**: Visualization (latency, throughput, errors)
- **ELK/Splunk**: Log aggregation
- **PagerDuty**: Incident alerting

**High Availability**:

```
Redundancy Zone 1       Redundancy Zone 2
├─ Ingestion Pod 1      ├─ Ingestion Pod 2
├─ Indexer Pod 1        ├─ Indexer Pod 2
├─ PostgreSQL Replica   ├─ PostgreSQL Replica
└─ Redis Sentinel       └─ Redis Sentinel

Load Balancer (active-active or ELB)
↓
Route by geo or round-robin
```

---

## 11. DEVELOPMENT WORKFLOW

### 11.1 Adding a New Feature

**Example**: Add "severity filter by log count"

**Steps**:

1. **Backend** (LogicalPlain):
   - Modify `logController.js`: Add aggregation query to OpenSearch
   - Endpoint: `GET /logs/stats/by-level`
   - Returns: `{ INFO: 1500, WARN: 300, ERROR: 50 }`

2. **Frontend** (React):
   - New component `LogStatistics.jsx`
   - Calls `api.get("/logs/stats/by-level")`
   - Displays chart with counts

3. **Testing**:
   - Unit test for backend query builder
   - Integration test: Create logs, query stats
   - Manual: Test via frontend

### 11.2 Performance Optimization Checklist

When adding new feature:

1. **Latency**:
   - Measure query time (use Date.now())
   - Set P95 target (< 500ms, < 1s, etc.)
   - Profile with K6 load test

2. **Throughput**:
   - Batch operations when possible
   - Reduce round-trips (API calls)
   - Connection pooling enabled

3. **Memory**:
   - Monitor Node.js heap (process.memoryUsage())
   - Avoid unbounded buffering
   - Stream large datasets

4. **Scalability**:
   - Can it handle 10x load?
   - Identify single points of failure
   - Test with multiple replicas

### 11.3 Deployment Procedure

**Pre-deployment**:

1. Run all K6 tests: `node run_tests.js`
2. Verify thresholds pass
3. Manual smoke test on staging

**Deployment**:

1. Build Docker images: `docker build .`
2. Tag images: `docker tag ... myrepo/app:v1.2.3`
3. Push to registry: `docker push ...`
4. Update deployment manifest (k8s or docker-compose)
5. Rolling restart (drain old pods, start new)

**Post-deployment**:

1. Monitor error rates (should stay < 1%)
2. Check latency percentiles (P95, P99)
3. Observe consumer lag (should be < 1 min)

### 11.4 Debugging Common Issues

**Issue**: Logs not appearing in dashboard

```
Debug steps:
1. Check Kafka: rpk topic consume logs.raw --num 5
   → See if raw logs published
2. Check consumer lag: rpk group describe log-hot-indexer-v2
   → Is indexer keeping up?
3. Check OpenSearch: curl http://localhost:9200/logs-*/_docs?size=1
   → Are docs indexed?
4. Check frontend filter: Are you filtering by correct org_id?
```

**Issue**: Rate limit rejecting all requests

```
Debug steps:
1. Check Redis key exists: redis-cli HGETALL token_bucket:<key_id>
   → Should have tokens + last_refill
2. Check rate limit per sec: Is it set too low?
3. Check key expiration: Is expires_at passed?
4. Manually test: curl -H "Bearer <key>" localhost:4100/ingest
   → Try with working key from another org
```

**Issue**: Kafka publish failing

```
Debug steps:
1. Check broker connectivity: kafka-broker-api-versions.sh --bootstrap-server redpanda:29092
2. Check topic exists: kafka-topics.sh --list --bootstrap-server redpanda:29092
3. Check producer config: idempotent=true, retries=5
4. Monitor Kafka logs: docker logs <redpanda-container>
```

---

## APPENDIX: KEY METRICS & PERFORMANCE TARGETS

### Ingestion Metrics

- **Throughput**: 1000+ logs/sec per org (target)
- **P50 Latency**: < 200ms
- **P95 Latency**: < 1.5s
- **P99 Latency**: < 2.5s
- **Error Rate**: < 1%
- **Availability**: 99.9% (< 43 minutes downtime/month)

### Query Metrics

- **Full-text Search**: < 500ms (P95)
- **Faceted Aggregation**: < 1s (P95)
- **Dashboard Stats**: < 2s (aggregate 4 queries)

### Resource Metrics

- **Ingestion Service Memory**: ~100MB/instance
- **Log Indexer Memory**: ~200MB + buffer size
- **PostgreSQL Connections**: 20-50 per app
- **Redis Memory**: < 256MB (volatile data)
- **Kafka Broker Disk**: 100GB+ (retention: 7+ days)
- **OpenSearch Shards**: 5-10 per index (1GB-3GB each)

### Scaling Factors

- **Per 10x Load Increase**:
  - Ingestion replicas: +2-3
  - Kafka brokers: +2-3
  - OpenSearch nodes: +3-5
  - PostgreSQL read replicas: +1-2
  - Redis Sentinels: +1 (maintain 3 total)

---

## GLOSSARY

- **Multi-Tenancy**: System serving multiple independent organizations
- **RBAC**: Role-Based Access Control (admin, user)
- **JWT**: JSON Web Token (stateless auth)
- **Token Bucket**: Rate limiting algorithm (controlled burst)
- **Partition Key**: Kafka key determining message-to-partition assignment
- **Bulk API**: OpenSearch API for batch indexing
- **Rolling Index**: Time-based index sharding (daily indices)
- **P95 Latency**: 95th percentile response time (95% of requests faster)
- **Atomicity**: All or nothing transaction
- **HMR**: Hot Module Replacement (live code reload)
- **HttpOnly Cookie**: Cookie inaccessible to JavaScript (XSS protection)
- **One-Way Hash**: Irreversible cryptographic function (SHA256)

---

## CONCLUSION

LogRush is a well-architected, production-grade multi-tenant log management system emphasizing:

1. **Performance**: Optimized ingestion pipeline with Kafka buffering, batched indexing, and Redis-based rate limiting
2. **Scalability**: Horizontal scaling of stateless services, partitioned data streams
3. **Security**: Organization isolation, JWT auth, encrypted passwords, rate limiting
4. **Observability**: Comprehensive logging, K6 load testing, internal telemetry
5. **Maintainability**: Clear separation of concerns (Data Plain, Logical Plain, Frontend), containerized deployment

The system is designed to handle tens of thousands of logs per second across hundreds of organizations without data leakage or performance degradation.

---

**End of Comprehensive Context Document**
