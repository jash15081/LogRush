import express from 'express';
import { createUser, userLogin } from '../controllers/userController.js';
import { authAdmin } from '../middlewares/auth.js';

const userRouter = express.Router();


userRouter.post('/login', userLogin );
userRouter.post('/create',authAdmin, createUser)

export default userRouter;