import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'medicare_hms',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Helper connection checker
pool.getConnection()
    .then(conn => {
        console.log('✅ Connected to MySQL database successfully on port ' + (process.env.DB_PORT || 3306));
        conn.release();
    })
    .catch(err => {
        console.error('❌ Failed to connect to MySQL database:', err.message);
    });

export default pool;
