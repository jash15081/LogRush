import opensearchClient from "../config/opensearch.js";

export async function queryLogs(req, res) {
  const organizationId = req.user?.organizationId;

  if (!organizationId) {
    return res.status(401).json({ error: "Organization context required" });
  }

  const {
    level,
    application,
    environment,
    startTime,
    endTime,
    q,
    page = 1,
    perPage = 50,
  } = req.query;

  const index = process.env.OPENSEARCH_INDEX_PATTERN || "logs-*";

  const must = [{ term: { organization_id: organizationId } }];

  if (level) {
    must.push({ term: { level } });
  }

  if (application) {
    must.push({ match_phrase: { application } });
  }

  if (environment) {
    must.push({ match_phrase: { environment } });
  }

  if (q) {
    must.push({
      query_string: {
        query: q,
        fields: ["message", "metadata.*", "application", "environment"],
        default_operator: "AND",
      },
    });
  }

  const range = {};
  if (startTime) {
    range.gte = startTime;
  }
  if (endTime) {
    range.lte = endTime;
  }

  if (Object.keys(range).length > 0) {
    must.push({
      range: {
        "@timestamp": {
          ...range,
        },
      },
    });
  }

  const pageNum = parseInt(page, 10) || 1;
  const size = Math.min(parseInt(perPage, 10) || 50, 200);

  try {
    const response = await opensearchClient.search({
      index,
      body: {
        query: {
          bool: {
            must,
          },
        },
        sort: [{ "@timestamp": { order: "desc" } }],
        from: (pageNum - 1) * size,
        size,
      },
    });

    const hits = response.body.hits?.hits || [];
    const total = response.body.hits?.total?.value ?? 0;

    const logs = hits.map((hit) => ({ id: hit._id, ...hit._source }));

    return res.status(200).json({
      total,
      page: pageNum,
      perPage: size,
      logs,
    });
  } catch (error) {
    console.error("Error querying logs from OpenSearch:", error);
    return res.status(500).json({ error: "Failed to query logs" });
  }
}
