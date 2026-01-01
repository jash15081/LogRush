import express from 'express';
import { authAdmin, authUser } from '../middlewares/auth.js';
import { createApplication, createEnvironment, deleteApplication, deleteEnvironment, listApplications, listEnvironments } from '../controllers/applicationControllers.js';

const applicationRouter = express.Router();
// Define application-related routes here
applicationRouter.get('/',authUser,listApplications);
applicationRouter.post('/create',authAdmin,createApplication);
applicationRouter.delete('/delete',authAdmin,deleteApplication);

applicationRouter.get('/envs',authUser,listEnvironments);
applicationRouter.post('/envs/create',authAdmin,createEnvironment);
applicationRouter.delete('/envs/delete',authAdmin,deleteEnvironment);

export default applicationRouter;