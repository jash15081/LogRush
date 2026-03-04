import express from "express";
import ingestRouter from "./routes/ingest.js";
import { env } from "./config/env.js";
import { producer } from "./kafka/client.js";

export async function startKafka() {
  await producer.connect();
  console.log("Kafka producer connected");
}

startKafka().catch((error) => {
  console.error("Error connecting Kafka producer:", error);
  process.exit(1);
});

export const app = express();

app.use(express.json({ limit: `${env.maxRequestSizeMB}mb` }));
app.use(ingestRouter);
