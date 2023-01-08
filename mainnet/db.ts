import { createPool } from 'mariadb';

require('dotenv').config();
const db_config = {
    host: process.env.DB_ADDRESS,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 3,
    connectionTimeout: 600000
}

export const pool = createPool(db_config);
