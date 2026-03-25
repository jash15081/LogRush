import express from "express";
import {
  createUser,
  deleteUser,
  userLogin,
  userLogout,
  getCurrentUser,
  listUsers,
  updateUser,
} from "../controllers/userController.js";
import { authAdmin, authUser } from "../middlewares/auth.js";

const userRouter = express.Router();

userRouter.post("/login", userLogin);
userRouter.post("/logout", userLogout);
userRouter.get("/me", authUser, getCurrentUser);
userRouter.get("/list", authAdmin, listUsers);
userRouter.put("/update", authAdmin, updateUser);
userRouter.post("/create", authAdmin, createUser);
userRouter.delete("/delete", authAdmin, deleteUser);
export default userRouter;
