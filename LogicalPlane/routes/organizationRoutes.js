import express from 'express';
import pool from '../config/db.js';
import { createOrganization } from '../controllers/organizationController.js';
const organizationRouter = express.Router();

// Define organization-related routes here
organizationRouter.get('/', async (req, res) => {
   
});
organizationRouter.post('/', createOrganization);

export default organizationRouter;