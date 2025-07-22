const mysql = require("mysql2/promise");

let connection = null;

async function setupDatabase() {
    // Database will be initialized when user logs in
    return null;
}

async function createConnection(username, password) {
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: username,
            password: password,
            database: "invoice",
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
        return connection;
    } catch (error) {
        throw new Error("Invalid Credentials");
    }
}

function getConnection() {
    return connection;
}

function closeConnection() {
    if (connection) {
        connection.end();
        connection = null;
    }
}

module.exports = { 
    setupDatabase, 
    createConnection, 
    getConnection, 
    closeConnection 
};