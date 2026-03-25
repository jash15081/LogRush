/**
 * Configuration for Log Generator
 * --------------------------------
 * Modify this file to change traffic patterns
 * without touching generator logic.
 */
import "dotenv/config";
export const INGESTION_URL = "http://localhost:4100/ingest";
//
/**
 * Traffic control
 * ----------------
 * SEND_INTERVAL_MS → how often a batch is sent
 * BATCH_SIZE       → number of logs per request
 */
export const TRAFFIC_CONFIG = {
  SEND_INTERVAL_MS: Number(process.env.SEND_INTERVAL_MS || 500),
  BATCH_SIZE: Number(process.env.BATCH_SIZE || 10),
};

/**
 * Organizations configuration
 * ----------------------------
 * API keys are NOT tied to environments.
 * Any environment/application can send logs using any API key.
 */
export const ORGANIZATIONS = [
  {
    name: "TechCorp",
    apiKeys: [
      {
        key: "lk_f94ef8de3b105f04c8518104ebf56fb839139774c589b1fde9b1d6ac029afe8b",
        rps: 200,
      },
      // {
      //   key: "lk_35780e69f262fd667b10da3aad014312e4c5745445a8a9d0c56f8c6bb9591e8f",
      //   rps: 100,
      // },
    ],
    applications: ["web-app"],
    environments: ["dev"],
  },
  // {
  //   name: "SDNA",
  //   apiKeys: [
  //     {
  //       key: "lk_62b839fffeec14099e862b08eacda9c6d0626937e692eddb312f6f6e7f2ab9d5",
  //       rps: 40,
  //     },
  //   ],
  //   applications: ["recommendation-service"],
  //   environments: ["dev"],
  // },
];

/**
 * Log message templates
 * --------------------
 * Repetitive but realistic messages (like real systems)
 */
export const LOG_MESSAGES = {
  INFO: [
    "Request received",
    "Request processed successfully",
    "User authenticated",
    "Cache hit",
    "Background job completed",
  ],
  WARN: [
    "External service response slow",
    "Cache miss detected",
    "Retrying failed operation",
  ],
  ERROR: [
    "Database connection timeout",
    "Payment processing failed",
    "Authentication error",
    "Unhandled exception occurred",
  ],
};
