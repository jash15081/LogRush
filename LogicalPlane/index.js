import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';

import organizationRouter from './routes/organizationRoutes.js';
import userRouter from './routes/userRoutes.js';

const app = express();


app.use(express.json());
app.use(cookieParser());


app.use('/organization',organizationRouter)
app.use('/user',userRouter)

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});