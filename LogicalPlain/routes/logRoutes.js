import express from "express";
import { authUser } from "../middlewares/auth.js";
import { queryLogs } from "../controllers/logController.js";

const logRouter = express.Router();

logRouter.get("/", authUser, queryLogs);

export default logRouter;
