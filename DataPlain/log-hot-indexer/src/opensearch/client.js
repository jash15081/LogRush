import { Client } from '@opensearch-project/opensearch';
import config from '../config/config.js';

const client = new Client({
  node: config.opensearch.node
});

export default client;
