import client from "../opensearch/client.js";

export default async function bulkIndex(logs) {
  if (!logs.length) return;

  const batchSize = logs.length;

  console.log(`[INDEXER] Preparing bulk indexing for ${batchSize} logs`);

  const body = [];

  for (const log of logs) {
    const indexName = "logs-" + log.timestamp.slice(0, 10).replace(/-/g, ".");

    body.push({ index: { _index: indexName } });

    body.push({
      "@timestamp": log.timestamp,
      timestamp: log.timestamp,
      ingested_at: log.ingested_at,
      organization_id: log.organization_id,
      api_key_id: log.api_key_id,
      application: log.application,
      environment: log.environment,
      host: log.host,
      version: log.version,
      level: log.level,
      message: log.message,
      trace_id: log.trace_id,
      metadata: log.metadata,
    });
  }

  console.log(`[OPENSEARCH] Sending bulk request with ${batchSize} logs`);

  const response = await client.bulk({ body });

  if (response.body.errors) {
    console.error(`[OPENSEARCH] Bulk indexing completed with errors`);
    throw new Error("OpenSearch bulk indexing failed");
  }

  console.log(
    `[OPENSEARCH] Successfully indexed ${batchSize} logs into daily index`,
  );
}
