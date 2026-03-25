import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";

import organizationRouter from "./routes/organizationRoutes.js";
import userRouter from "./routes/userRoutes.js";
import apikeyRouter from "./routes/apikeyRoutes.js";
import applicationRouter from "./routes/applicationRoutes.js";
import logRouter from "./routes/logRoutes.js";
import cors from "cors";

const app = express();

app.use(
  cors({
    origin: [
      "http://127.0.0.1:5500",
      "http://localhost:5173",
      "http://localhost:5174",
    ],
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.use("/organization", organizationRouter);
app.use("/user", userRouter);
app.use("/apikey", apikeyRouter);
app.use("/application", applicationRouter);
app.use("/logs", logRouter);

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
