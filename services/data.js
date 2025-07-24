async function fetchAllData(connection) {
    try {
        const [customer_rows] = await connection.execute("SELECT * FROM customers");
        const [milestone_rows] = await connection.execute("SELECT * FROM milestones");
        const [project_rows] = await connection.execute("SELECT * FROM projects");
        const [invoice_rows] = await connection.execute("SELECT * FROM invoices");
        
        return { 
            customers: customer_rows, 
            milestones: milestone_rows, 
            projects: project_rows, 
            invoices: invoice_rows 
        };
    } catch (error) {
        console.error("Error fetching data from database:", error);
        throw error;
    }
}

module.exports = { fetchAllData };