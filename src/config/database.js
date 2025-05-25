// import mysql from 'mysql2/promise';
// const dbConfig = {
//   host: process.env.DB_HOST || 'localhost',
//   user: process.env.DB_USER || 'root',
//   password: process.env.DB_PASSWORD || '',
//   database: process.env.DB_NAME || 'abdulmalik_portfolio',
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0
// };

// // Create connection pool
// const pool = mysql.createPool(dbConfig);

// // Test connection
// const testConnection = async () => {
//   try {
//     const connection = await pool.getConnection();
//     console.log('Database connection established successfully');
//     connection.release();
//   } catch (error) {
//     console.error('Database connection failed:', error.message);
//     process.exit(1);
//   }
// };

// testConnection();

// export default pool;
import mysql from 'mysql2/promise';

// Database configuration using URL only
const dbConfig = {
  uri: process.env.DATABASE_URL || 'mysql://root:@localhost:3306/abdulmalik_portfolio',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test connection
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Database connection established successfully');
    connection.release();
  } catch (error) {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  }
};

testConnection();

export default pool;