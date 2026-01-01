/**
 * Configuration for Log Generator
 * --------------------------------
 * Modify this file to change traffic patterns
 * without touching generator logic.
 */
import "dotenv/config";
export const INGESTION_URL = "http://localhost:4100/ingest";

/**
 * Traffic control
 * ----------------
 * SEND_INTERVAL_MS → how often a batch is sent
 * BATCH_SIZE       → number of logs per request
 */
export const TRAFFIC_CONFIG = {
  SEND_INTERVAL_MS: Number(process.env.SEND_INTERVAL_MS || 500),
  BATCH_SIZE: Number(process.env.BATCH_SIZE || 10)
};

/**
 * Organizations configuration
 * ----------------------------
 * API keys are NOT tied to environments.
 * Any environment/application can send logs using any API key.
 */
export const ORGANIZATIONS = [
  // {
  //   name: "Simform",
  //   apiKeys: [
  //     { key: "lk_7436843325a4ecfe9eae4ba0bb5c7cb38554381f004fe2ce2e68453c0cedfe46", rps: 200 },
  //     { key: "lk_35780e69f262fd667b10da3aad014312e4c5745445a8a9d0c56f8c6bb9591e8f", rps: 100 }
  //   ],
  //   applications: [
  //     "Hotel Management",
  //     "School Management"
  //   ],
  //   environments: ["dev","test"]
  // },
  {
    name: "SDNA",
    apiKeys: [
      {key:"lk_62b839fffeec14099e862b08eacda9c6d0626937e692eddb312f6f6e7f2ab9d5",rps: 200}
    ],
    applications: [
      "recommendation-service"
    ],
    environments: ["dev"]
  }
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
    "Background job completed"
  ],
  WARN: [
    "External service response slow",
    "Cache miss detected",
    "Retrying failed operation"
  ],
  ERROR: [
    "Database connection timeout",
    "Payment processing failed",
    "Authentication error",
    "Unhandled exception occurred"
  ]
};
