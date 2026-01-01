import {Pool} from 'pg';



const pool = new Pool({
    user: process.env.DATABASE_USERNAME,
    host: 'localhost',
    database: process.env.DATABASE_NAME,
    password: process.env.DATABASE_PASSWORD,
    port: process.env.DATABASE_PORT,
});

export default pool;