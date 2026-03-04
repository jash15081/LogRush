import { Kafka } from "kafkajs";
import config from "../config/config.js";
import bulkIndex from "../indexer/bulkIndexer.js";

const kafka = new Kafka({
  clientId: config.kafka.clientId,
  brokers: config.kafka.brokers,
});

const consumer = kafka.consumer({
  groupId: config.kafka.groupId,
});

let buffer = [];
let lastFlushTime = Date.now();

async function flush() {
  if (!buffer.length) return;
  await bulkIndex(buffer);
  buffer = [];
  lastFlushTime = Date.now();
}

export async function startConsumer() {
  await consumer.connect();
  await consumer.subscribe({
    topic: "logs.raw",
    fromBeginning: true,
  });

  console.log("Kafka consumer connected and subscribed to logs.raw");
  await consumer.run({
    autoCommit: true,
    eachMessage: async ({ message }) => {
      const log = JSON.parse(message.value.toString());

      buffer.push(log);

      const timeExceeded =
        Date.now() - lastFlushTime >= config.indexing.flushIntervalMs;

      if (buffer.length >= config.indexing.batchSize || timeExceeded) {
        await flush();
      }
    },
  });
}
