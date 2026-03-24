import { Client } from "@opensearch-project/opensearch";

const nodeUrl = process.env.OPENSEARCH_NODE || "http://localhost:9200";

const client = new Client({ node: nodeUrl });

export default client;
