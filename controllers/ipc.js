const { ipcMain } = require("electron");
const { createConnection } = require('./db');
const { checkInvoicesDueToday } = require('../services/notification');
const { createCustomer, fetchCustomers } = require('../services/customer');
const { insertMilestone, fetchProjects, fetchMilestones, getAllProjects, getProjectMilestones, updateProject } = require('../services/project');
const { createInvoice, createForm, payInvoice, getSummaryData, getInvoiceData, getInvoiceStatusData } = require('../services/invoice');
const { fetchAllData } = require('../services/data');

let connection;

function setupIpcHandlers(win, dbConnection) {
    connection = dbConnection;

    // Login handler
    ipcMain.on("login", async (event, data) => {
        try {
            const { username, password } = data;
            connection = await createConnection(username, password);
            event.reply('loginResponse', { success: true, message: "Login successful" });
            win.reload();
            await checkInvoicesDueToday(connection);
        } catch (error) {
            event.reply('loginResponse', { success: false, message: "Invalid Credentials" });
        }
    });

    // Load main content
    ipcMain.on("load-main-content", () => {
        win.loadFile("public/index.html");
    });

    // Customer handlers
    ipcMain.on("createCustomer", async (event, data) => {
        const { customerData } = data;
        const result = await createCustomer(connection, customerData);
        if (result.success) {
            win.reload();
        }
        event.reply('createCustomerResponse', result);
    });

    ipcMain.handle("fetchCustomer", async (event) => {
        return await fetchCustomers(connection);
    });

    // Project handlers
    ipcMain.on("insertMilestone", async (event, data) => {
        const result = await insertMilestone(connection, data);
        if (result.success) {
            win.reload();
        }
        event.reply('createProjectResponse', result);
    });

    ipcMain.handle("fetchProject", async (event, companyName) => {
        return await fetchProjects(connection, companyName);
    });

    ipcMain.handle("fetchMilestones", async (event, selectedProjectId) => {
        return await fetchMilestones(connection, selectedProjectId);
    });

    ipcMain.handle('get-projects', async () => {
        return await getAllProjects(connection);
    });

    ipcMain.handle('get-milestones', async (event, projectdata) => {
        return await getProjectMilestones(connection, projectdata);
    });

    ipcMain.handle('update-project', async (event, projectData) => {
        return await updateProject(connection, projectData);
    });

    // Invoice handlers
    ipcMain.on("createInvoice", async (event, data) => {
        await createInvoice(connection, data.selectedMilestones);
        event.reply('invoiceCreated');
    });

    ipcMain.on("createForm", async (event, data) => {
        try {
            await createForm(connection, data);
            win.reload();
        } catch (error) {
            console.error(error);
        }
    });

    ipcMain.handle('payInvoice', async (event, milestone_id) => {
        try {
            await payInvoice(connection, milestone_id);
            win.reload();
        } catch (error) {
            console.error('Error updating milestone status:', error);
            throw error;
        }
    });

    // Data handlers
    ipcMain.handle("fetchData", async (event) => {
        return await fetchAllData(connection);
    });

    // Analytics handlers
    ipcMain.handle('get-summary-data', async () => {
        return await getSummaryData(connection);
    });

    ipcMain.handle('get-invoice-data', async () => {
        return await getInvoiceData(connection);
    });

    ipcMain.handle('get-invoice-status-data', async () => {
        return await getInvoiceStatusData(connection);
    });
}

module.exports = { setupIpcHandlers };