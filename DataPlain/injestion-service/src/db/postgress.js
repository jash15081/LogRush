import { Pool } from "pg";
let pool;
console.log('Database Config Loaded', process.env.DATABASE_PASSWORD);
try {
    pool = new Pool({
        user: process.env.DATABASE_USERNAME,
        host: 'localhost',
        database: process.env.DATABASE_NAME,
        password: process.env.DATABASE_PASSWORD,
        port: process.env.DATABASE_PORT,
    });
}
catch (err) {
    console.error("Error creating database pool:", err);
}
export { pool };
