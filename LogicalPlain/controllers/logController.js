import opensearchClient from "../config/opensearch.js";

function normalizeDateTimeParam(value) {
  if (!value) return undefined;
  // If frontend sends `datetime-local` (e.g. 2026-03-25T13:45), convert to ISO.
  // If it already includes timezone (Z or ±hh:mm), keep it as-is.
  const hasTimezone = /[zZ]|[+-]\d{2}:\d{2}$/.test(value);
  if (hasTimezone) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value; // let OpenSearch handle/err
  return d.toISOString();
}

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
  console.log(req.query)
  const index = process.env.OPENSEARCH_INDEX_PATTERN || "logs-*";

  const must = [{ term: { organization_id: organizationId } }];
 
  if (level) {
    // Stored levels are uppercase (e.g. INFO/WARN/ERROR)
    const normalizedLevel = String(level).trim().toUpperCase();
    must.push({
      bool: {
        should: [
          { term: { "level.keyword": { value: normalizedLevel, case_insensitive: true } } },
          { term: { level: { value: normalizedLevel, case_insensitive: true } } },
          { match_phrase: { level: normalizedLevel } },
        ],
        minimum_should_match: 1,
      },
    });
  }

  if (application) {
    const v = String(application).trim();
    must.push({
      bool: {
        should: [
          { term: { "application.keyword": { value: v, case_insensitive: true } } },
          { term: { application: { value: v, case_insensitive: true } } },
          { match_phrase: { application: v } },
        ],
        minimum_should_match: 1,
      },
    });
  }

  if (environment) {
    const v = String(environment).trim();
    must.push({
      bool: {
        should: [
          { term: { "environment.keyword": { value: v, case_insensitive: true } } },
          { term: { environment: { value: v, case_insensitive: true } } },
          { match_phrase: { environment: v } },
        ],
        minimum_should_match: 1,
      },
    });
  }

  if (q) {
    const trimmed = String(q).trim();
    must.push({
      bool: {
        should: [
          // Full-text search on message (text field)
          {
            match: {
              message: {
                query: trimmed,
                operator: "or",
                fuzziness: "AUTO",
              },
            },
          },
          // Wildcard on message for partial/single-char matches
          {
            wildcard: {
              message: {
                value: `*${trimmed.toLowerCase()}*`,
                case_insensitive: true,
              },
            },
          },
          // keyword fields need term/wildcard, NOT full-text queries
         
         
        ],
        minimum_should_match: 1,
      },
    });
  }

  const range = {};
  if (startTime) {
    range.gte = normalizeDateTimeParam(startTime);
  }
  if (endTime) {
    range.lte = normalizeDateTimeParam(endTime);
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
    console.log("Q VALUE:", JSON.stringify(q));
  console.log("MUST ARRAY:", JSON.stringify(must, null, 2));
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
