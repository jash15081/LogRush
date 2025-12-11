// log_gen.js
// super simple log batch generator using axios

const express = require("express");
const axios = require("axios");
const { randomUUID } = require("crypto");
require("dotenv").config();
// -----------------------
// CONFIG (change these)
// -----------------------
const TARGET_URL = process.env.TARGET_URL;                          // API to send logs to
const BATCH_SIZE = process.env.BATCH_SIZE;                              // logs per POST
const EMIT_INTERVAL_MS = process.env.EMIT_INTERVAL_MS;                       // generate one log every X ms
const FLUSH_INTERVAL_MS = process.env.FLUSH_INTERVAL_MS;                     // force-send every X ms
const PORT = process.env.PORT;                                  // port for the generator app
// -----------------------

const app = express();
app.get("/", (req, res) => res.json({ running: true, TARGET_URL, BATCH_SIZE }));

// generator state
let buffer = [];
let stats = { generated: 0, sentBatches: 0, sentLogs: 0, failedRequests: 0 };

// simple synthetic log
function makeLog() {
  return {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    level: ["INFO", "WARN", "ERROR"][Math.floor(Math.random() * 3)],
    message: "Sample log line",
    meta: { requestId: randomUUID() }
  };
}

// POST batch using axios
async function sendBatch(batch) {
  try {
    const res = await axios.post(TARGET_URL, batch, {
      headers: { "Content-Type": "application/json" },
      timeout: 5000
    });

    // treat any 2xx as success
    if (res.status >= 200 && res.status < 300) {
      stats.sentBatches++;
      stats.sentLogs += batch.length;
      console.log(`Sent batch ${stats}`);
    } else {
      throw new Error(`Bad status: ${res.status}`);
    }
  } catch (err) {
    stats.failedRequests++;
    console.error("POST failed:", err.message || err);
  }
}

// generate one log and maybe flush batch
function emitLog() {
  const log = makeLog();
  buffer.push(log);
  stats.generated++;
  console.log(`Generated log #${stats}`);
  if (buffer.length >= BATCH_SIZE) {
    const batch = buffer.splice(0, buffer.length); // take all
    sendBatch(batch);
  }
}

// force flush (even if batch not full)
function flush() {
  if (buffer.length > 0) {
    const batch = buffer.splice(0, buffer.length);
    sendBatch(batch);
  }
}

// intervals
setInterval(emitLog, EMIT_INTERVAL_MS);
setInterval(flush, FLUSH_INTERVAL_MS);

// start http server for simple health check
app.listen(PORT, () => console.log(`Log generator running at http://localhost:${PORT}`));
