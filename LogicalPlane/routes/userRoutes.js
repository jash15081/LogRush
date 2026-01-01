import express from 'express';
import { createUser, deleteUser, userLogin } from '../controllers/userController.js';
import { authAdmin } from '../middlewares/auth.js';

const userRouter = express.Router();


userRouter.post('/login', userLogin );
userRouter.post('/create',authAdmin, createUser)
userRouter.delete('/delete',authAdmin, deleteUser)
export default userRouter;