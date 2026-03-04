import { Kafka } from "kafkajs";

export const kafka = new Kafka({
  clientId: "log-ingestion-service",
  brokers: ["redpanda:29092"],
  retry: {
    initialRetryTime: 300,
    retries: 5,
  },
});

export const producer = kafka.producer({
  allowAutoTopicCreation: false,
  idempotent: true,
});
