const ExcelJS = require("exceljs");
const { dialog, shell } = require('electron');
const fs = require('fs');
const path = require("path");

async function generateInvoiceNumber(connection) {
    const currentYear = new Date().getFullYear();
    let nextNumber = 1;

    try {
        const [rows] = await connection.query(`
            SELECT MAX(invoice_number) AS lastInvoiceNumber 
            FROM Invoices 
            WHERE invoice_number LIKE '${currentYear}-%'
        `);

        if (rows.length > 0 && rows[0].lastInvoiceNumber) {
            const lastInvoiceNumber = rows[0].lastInvoiceNumber;
            const lastSequentialNumber = parseInt(lastInvoiceNumber.split('-')[1]);
            nextNumber = lastSequentialNumber + 1;
        }
    } catch (error) {
        console.error("Error fetching last invoice number:", error);
    }

    return `${currentYear}-${nextNumber.toString().padStart(3, '0')}`;
}

function calculateDueDate(date) {
    const dueDate = new Date(date);
    dueDate.setDate(dueDate.getDate() + 10);
    return dueDate.toISOString().split('T')[0];
}

async function createInvoice(connection, selectedMilestones) {
    const currentDate = new Date().toISOString().split('T')[0];
    const invoiceNumber = await generateInvoiceNumber(connection);

    for (const milestone of selectedMilestones) {
        try {
            const invoiceDate = milestone.custom_date ? milestone.custom_date : calculateDueDate(currentDate);
            const dueDate = calculateDueDate(invoiceDate);

            await connection.query(`
                INSERT INTO Invoices (customer_id, internal_project_id, invoice_number, company_name, project_name, invoice_date, due_date, total_prices, milestone_id, milestone_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                milestone.customer_id,
                milestone.internal_project_id,
                invoiceNumber,
                milestone.customer_name,
                milestone.project_name,
                invoiceDate,
                dueDate,
                milestone.amount,
                milestone.milestone_id,
                milestone.milestone_name
            ]);

            await connection.query(`
                UPDATE milestones
                SET pending = 'no'
                WHERE milestone_id = ?
            `, [milestone.milestone_id]);

        } catch (error) {
            console.error("Error inserting data or updating milestone:", error);
        }
    }
}

async function loadTemplateConfigs() {
    const data = await fs.promises.readFile(path.join(__dirname, "../templateConfigs.json"), "utf8");
    return JSON.parse(data);
}

function to_date(date) {
    if (!date) return '-';
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

async function createForm(connection, data) {
    const { selectedMilestones, invoiceType } = data;
    try {
        const templateConfigs = await loadTemplateConfigs();

        // Select the template config based on invoice type
        const templateConfig = templateConfigs[invoiceType];
        if (!templateConfig) {
            throw new Error("Invalid invoice type selected.");
        }

        // Retrieve necessary data from the first milestone
        const milestone = selectedMilestones[0];

        // Fetch customer details
        const [customerDetails] = await connection.execute('SELECT company_name, address1, address2, address3, gstin, pan, cin FROM customers WHERE customer_id = ?', [milestone.customer_id]);
        const customer = customerDetails[0];

        // Fetch project details
        const [projectDetails] = await connection.execute('SELECT project_date, pono, total_prices FROM projects WHERE customer_id = ? AND internal_project_id = ?', [milestone.customer_id, milestone.internal_project_id]);
        const project = projectDetails[0];

        // Fetch invoice details
        const [details] = await connection.execute('SELECT invoice_number, invoice_date, due_date FROM invoices WHERE customer_id = ? AND internal_project_id = ?', [milestone.customer_id, milestone.internal_project_id]);
        const detail = details[0];

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(templateConfig.filePath);

        const worksheet = workbook.getWorksheet("Invoice");
        if (!worksheet) {
            throw new Error("Worksheet not found in the Excel file.");
        }

        const cells = templateConfig.cells;

        // Update cells based on template configuration
        if (cells.companyName) {
            const companyCell = worksheet.getCell(cells.companyName);
            companyCell.value = customer.company_name || '-';
            companyCell.font = { name: 'Trebuchet MS', size: 10 };
            companyCell.alignment = { horizontal: 'left', vertical: 'bottom' };
        }

        if (cells.address1) {
            worksheet.getCell(cells.address1).value = customer.address1 || '-';
            worksheet.getCell(cells.address1).font = { name: 'Trebuchet MS', size: 10 };
            worksheet.getCell(cells.address1).alignment = { horizontal: 'left', vertical: 'bottom' };
        }

        if (cells.address2) {
            worksheet.getCell(cells.address2).value = customer.address2 || '-';
            worksheet.getCell(cells.address2).font = { name: 'Trebuchet MS', size: 10 };
            worksheet.getCell(cells.address2).alignment = { horizontal: 'left', vertical: 'bottom' };
        }

        if (cells.address3) {
            worksheet.getCell(cells.address3).value = customer.address3 || '-';
            worksheet.getCell(cells.address3).font = { name: 'Trebuchet MS', size: 10 };
            worksheet.getCell(cells.address3).alignment = { horizontal: 'left', vertical: 'bottom' };
        }

        if (cells.gstin) {
            worksheet.getCell(cells.gstin).value = customer.gstin ? `GST No.- ${customer.gstin}` : '-';
            worksheet.getCell(cells.gstin).font = { name: 'Trebuchet MS', size: 10 };
            worksheet.getCell(cells.gstin).alignment = { horizontal: 'left', vertical: 'bottom' };
        }

        if (cells.cin) {
            worksheet.getCell(cells.cin).value = customer.cin ? `CIN No.- ${customer.cin}` : '-';
            worksheet.getCell(cells.cin).font = { name: 'Trebuchet MS', size: 10 };
            worksheet.getCell(cells.cin).alignment = { horizontal: 'left', vertical: 'bottom' };
        }

        if (cells.pono) {
            worksheet.getCell(cells.pono).value = `PO No. & Date: ${milestone.project_name || '-'} , ${to_date(project.project_date) || '-'}`;
            worksheet.getCell(cells.pono).font = { name: 'Trebuchet MS', size: 10 };
            worksheet.getCell(cells.pono).alignment = { horizontal: 'left', vertical: 'bottom' };
        }

        if (cells.totalPrice) {
            worksheet.getCell(cells.totalPrice).value = project.total_prices || '-';
            worksheet.getCell(cells.totalPrice).font = { name: 'Trebuchet MS', size: 10 };
        }

        if (cells.invoiceNumber) {
            worksheet.getCell(cells.invoiceNumber).value = detail.invoice_number || '-';
            worksheet.getCell(cells.invoiceNumber).font = { name: 'Trebuchet MS', size: 10 };
        }

        if (cells.invoiceDate) {
            worksheet.getCell(cells.invoiceDate).value = to_date(detail.invoice_date) || '-';
            worksheet.getCell(cells.invoiceDate).font = { name: 'Trebuchet MS', size: 10 };
            worksheet.getCell(cells.invoiceDate).alignment = { horizontal: 'center' };
        }

        if (cells.dueDate) {
            worksheet.getCell(cells.dueDate).value = to_date(detail.due_date) || '-';
            worksheet.getCell(cells.dueDate).font = { name: 'Trebuchet MS', size: 10 };
            worksheet.getCell(cells.dueDate).alignment = { horizontal: 'center' };
        }

        // Update milestones if the start row is defined
        if (cells.milestonesStartRow) {
            let row = cells.milestonesStartRow;
            selectedMilestones.forEach((milestone) => {
                worksheet.getCell(`A${row}`).value = milestone.milestone_name || '-';
                worksheet.getCell(`A${row}`).font = { name: 'Trebuchet MS', size: 10 };
                worksheet.getCell(`A${row}`).alignment = { horizontal: 'left', vertical: 'bottom' };

                worksheet.getCell(`D${row}`).value = Number(milestone.claim_percent) ? `${Number(milestone.claim_percent)}%` : '-';
                worksheet.getCell(`D${row}`).font = { name: 'Trebuchet MS', size: 10 };
                worksheet.getCell(`D${row}`).alignment = { horizontal: 'left', vertical: 'bottom' };

                row++;
            });
        }

        const options = {
            title: "Save Invoice",
            defaultPath: `IEC_Invoice_${detail.invoice_number}_${customer.company_name}_${project.pono}.xlsx`,
            buttonLabel: "Save",
            filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
        };

        const result = await dialog.showSaveDialog(null, options);
        if (!result.canceled) {
            const filePath = result.filePath;
            await workbook.xlsx.writeFile(filePath);
            await shell.openPath(filePath);
        }
    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function payInvoice(connection, milestone_id) {
    try {
        await connection.execute('UPDATE invoices SET status = "paid" WHERE milestone_id = ?', [milestone_id]);
    } catch (error) {
        console.error('Error updating milestone status:', error);
        throw error;
    }
}

async function getSummaryData(connection) {
    try {
        const [total] = await connection.execute(`SELECT SUM(total_prices) as total_prices FROM projects`);

        const [paidResults] = await connection.execute(`
            SELECT SUM(total_prices) AS amountCollected FROM invoices WHERE status = 'paid'
        `);

        const [unpaidResults] = await connection.execute(`
            SELECT SUM(total_prices) AS amountPending FROM invoices WHERE status = 'unpaid'
        `);
        const amountCollected = Number(paidResults[0].amountCollected) || 0;
        const amountPending = Number(unpaidResults[0].amountPending) || 0;
        const totalAmount = total[0].total_prices;

        return {
            amountCollected: amountCollected,
            amountPending: amountPending,
            totalAmount: totalAmount
        };
    } catch (error) {
        console.error('Error fetching summary data:', error);
        return { amountCollected: 0, amountPending: 0, totalAmount: 0 };
    }
}

async function getInvoiceData(connection) {
    try {
        const [results] = await connection.execute(`
            SELECT invoice_date, total_prices FROM invoices ORDER BY invoice_date
        `);
        return results;
    } catch (error) {
        console.error('Error fetching invoice data:', error);
        return [];
    }
}

async function getInvoiceStatusData(connection) {
    try {
        const [results] = await connection.execute(`
            SELECT status, COUNT(*) as count FROM invoices GROUP BY status
        `);
        return results;
    } catch (error) {
        console.error('Error fetching invoice status data:', error);
        return [];
    }
}

module.exports = { 
    createInvoice, 
    createForm, 
    payInvoice, 
    getSummaryData, 
    getInvoiceData, 
    getInvoiceStatusData 
};