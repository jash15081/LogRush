import { LIMITS } from "../config/limits.js";

export function validateIngestBody(body, maxLogs) {
  if (!body.application || !body.environment || !Array.isArray(body.logs)) {
    return "Invalid payload structure";
  }

  if (body.logs.length === 0 || body.logs.length > maxLogs) {
    return "Invalid log batch size";
  }

  for (const log of body.logs) {
    if (
      !log.timestamp ||
      !LIMITS.LOG_LEVELS.includes(log.level) ||
      !log.message
    ) {
      return "Invalid log entry";
    }
  }

  return null;
}
