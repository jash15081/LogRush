import { producer } from "./client.js";

export async function publishLogs({
  organizationId,
  apiKeyId,
  application,
  environment,
  host,
  version,
  logs
}) {
  const messages = logs.map(log => ({
    key: organizationId, // 🔑 PARTITION KEY
    value: JSON.stringify({
      organization_id: organizationId,
      api_key_id: apiKeyId,
      application,
      environment,
      host,
      version,
      ...log,
      ingested_at: new Date().toISOString()
    })
  }));

  await producer.send({
    topic: "logs.raw",
    messages
  });
}
