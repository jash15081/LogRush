export default {
  kafka: {
    clientId: "log-hot-indexer",
    brokers: ["redpanda:29092"],
    groupId: "log-hot-indexer",
  },
  opensearch: {
    node: "http://opensearch:9200",
  },
  indexing: {
    batchSize: 50,
    flushIntervalMs: 2000,
  },
};
