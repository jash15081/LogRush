import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';

import organizationRouter from './routes/organizationRoutes.js';
import userRouter from './routes/userRoutes.js';
import apikeyRouter from './routes/apikeyRoutes.js';
import applicationRouter from './routes/applicationRoutes.js';

const app = express();


app.use(express.json());
app.use(cookieParser());


app.use('/organization',organizationRouter)
app.use('/user',userRouter)
app.use('/apikey',apikeyRouter)
app.use('/application',applicationRouter)

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});