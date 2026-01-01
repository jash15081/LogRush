import express from "express";
import ingestRouter from "./routes/ingest.js";
import { env } from "./config/env.js";

export const app = express();

app.use(express.json({ limit: `${env.maxRequestSizeMB}mb` }));
app.use(ingestRouter);
