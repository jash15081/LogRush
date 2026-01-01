import express from 'express';
import pool from '../config/db.js';
import { createOrganization,deleteOrganization } from '../controllers/organizationController.js';
import { authAdmin } from '../middlewares/auth.js';
const organizationRouter = express.Router();


organizationRouter.post('/create', createOrganization);
organizationRouter.delete('/delete', authAdmin,deleteOrganization);

export default organizationRouter;