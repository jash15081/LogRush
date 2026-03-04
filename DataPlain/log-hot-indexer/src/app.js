import { startConsumer } from './kafka/consumer.js';

startConsumer().catch(err => {
  console.error('HOT INDEXER FAILED:', err);
  process.exit(1);
});
