import express from 'express';
import { authAdmin } from '../middlewares/auth.js';
import { generateApiKey, revokeApiKey } from '../controllers/apikeyControllers.js';

const apikeyRouter = express.Router();

apikeyRouter.post('/generate', authAdmin,generateApiKey )
apikeyRouter.delete('/revoke', authAdmin, revokeApiKey )
export default apikeyRouter;