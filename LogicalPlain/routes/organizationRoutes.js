import express from "express";
import pool from "../config/db.js";
import {
  createOrganization,
  deleteOrganization,
  getOrganization,
  updateOrganization,
} from "../controllers/organizationController.js";
import { authAdmin, authUser } from "../middlewares/auth.js";
const organizationRouter = express.Router();

organizationRouter.post("/create", createOrganization);
organizationRouter.get("/", authUser, getOrganization);
organizationRouter.put("/update", authAdmin, updateOrganization);
organizationRouter.delete("/delete", authAdmin, deleteOrganization);

export default organizationRouter;
