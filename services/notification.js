const { Notification } = require("electron");
const path = require("path");

async function checkInvoicesDueToday(connection) {
    try {
        // Fetch invoices due today and not yet notified
        const [invoices] = await connection.execute('SELECT * FROM invoices WHERE due_date = CURDATE() AND noti_send = "no"');

        if (invoices.length === 0) return;

        // Fetch all necessary related data
        const [customers] = await connection.execute('SELECT * FROM customers');
        const [projects] = await connection.execute('SELECT * FROM projects');
        const [milestones] = await connection.execute('SELECT * FROM milestones');

        // Process each invoice
        for (let invoice of invoices) {
            const customer = customers.find(c => c.customer_id === invoice.customer_id);
            const project = projects.find(p => p.internal_project_id === invoice.internal_project_id);
            const milestone = milestones.find(m => m.milestone_id === invoice.milestone_id);

            if (customer && project && milestone) {
                const data = {
                    customer: customer.company_name,
                    project: project.project_name,
                    milestone: milestone.milestone_name,
                    invoice: invoice
                };

                // Send notification
                sendNotification(data);

                // Update the invoice to mark the notification as sent
                const updatedQuery = 'UPDATE invoices SET noti_send = ? WHERE customer_id = ? AND internal_project_id = ? AND milestone_id = ?';
                await connection.execute(updatedQuery, [
                    'yes',
                    invoice.customer_id,
                    invoice.internal_project_id,
                    invoice.milestone_id
                ]);
            }
        }
    } catch (error) {
        console.error('Error checking due dates:', error);
    }
}

function sendNotification(data) {
    const options = {
        title: 'Invoice Due Today',
        body: `Invoice Pending From Customer ${data.customer} (${data.project}) For Milestone ${data.milestone}`,
        silent: false,
        icon: path.join(__dirname, '../assets/bell-solid.svg'),
        timeoutType: 'never',
        urgency: 'critical',
        closeButtonText: 'Close',
        tag: `invoice_due_${data.customer}_${data.project}`,
    };
    const customNotification = new Notification(options);
    customNotification.show();
}

module.exports = { checkInvoicesDueToday, sendNotification };