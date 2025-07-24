const { app } = require("electron");
const path = require("path");
require("dotenv").config();

// Import modules
const { createWindow } = require('./controllers/windowManger');
const { setupIpcHandlers } = require('./controllers/ipc');
const { setupDatabase } = require('./controllers/db');

let win;
let connection;

// Initialize the application
async function initializeApp() {
    win = createWindow();
    connection = await setupDatabase();
    setupIpcHandlers(win, connection);
}

// App event handlers
if (require('electron-squirrel-startup')) app.quit();

app.whenReady().then(() => {
    initializeApp();
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("quit", () => {
    if (connection) {
        connection.end();
    }
});

module.exports = { win, connection };