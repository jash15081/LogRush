import {Pool} from 'pg';


console.log('Database Config Loaded',process.env.DATABASE_PASSWORD);
const pool = new Pool({
    user: process.env.DATABASE_USERNAME,
    host: 'localhost',
    database: process.env.DATABASE_NAME,
    password: process.env.DATABASE_PASSWORD,
    port: process.env.DATABASE_PORT,
});

export default pool;