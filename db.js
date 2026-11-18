/**
 * db.js – MongoDB connection module.
 *
 * Exports a single function `connectDB` that returns the database instance.
 * The connection string and database name can be overridden with environment
 * variables MONGO_URI and MONGO_DB respectively.
 */

const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const MONGO_DB  = process.env.MONGO_DB  || 'leaguesmarket';

let client;
let db;

/**
 * Opens the MongoDB connection (if not already open) and returns the database
 * instance.  Call once at startup from app.js.
 *
 * @returns {Promise<import('mongodb').Db>}
 */
async function connectDB() {
    if (db) return db;
    client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db(MONGO_DB);
    console.log(`Connected to MongoDB – database "${MONGO_DB}"`);
    return db;
}

module.exports = { connectDB };
