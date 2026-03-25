import express from "express";
import { authAdmin } from "../middlewares/auth.js";
import {
  generateApiKey,
  revokeApiKey,
  listApiKeys,
  updateApiKey,
} from "../controllers/apikeyControllers.js";

const apikeyRouter = express.Router();

apikeyRouter.get("/list", authAdmin, listApiKeys);
apikeyRouter.post("/generate", authAdmin, generateApiKey);
apikeyRouter.put("/update", authAdmin, updateApiKey);
apikeyRouter.delete("/revoke", authAdmin, revokeApiKey);
export default apikeyRouter;
