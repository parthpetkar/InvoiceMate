async function createCustomer(connection, customerData) {
    try {
        const getLastCustomerIdQuery = `
          SELECT customer_id FROM customers 
          WHERE customer_id LIKE 'IEC_%' 
          ORDER BY CAST(SUBSTRING(customer_id, 5) AS UNSIGNED) DESC 
          LIMIT 1
        `;
        const [rows] = await connection.query(getLastCustomerIdQuery);

        let newCustomerId;
        if (rows.length > 0) {
            const latestId = rows[0].customer_id;
            const numericPart = parseInt(latestId.split('_')[1], 10);
            newCustomerId = `IEC_${numericPart + 1}`;
        } else {
            newCustomerId = 'IEC_1';
        }
        
        const insertCustomerQuery = `
          INSERT INTO customers (customer_id, company_name, address1, address2, address3, gstin, pan, cin)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        await connection.query(insertCustomerQuery, [
            newCustomerId,
            customerData.companyName,
            customerData.address1,
            customerData.address2,
            customerData.address3,
            customerData.gstin,
            customerData.pan,
            customerData.cin,
        ]);

        return { success: true, message: "Data inserted successfully", customerId: newCustomerId };
    } catch (error) {
        return { success: false, message: "Error inserting data", error: error.message };
    }
}

async function fetchCustomers(connection) {
    try {
        const [company_name] = await connection.execute(
            "SELECT company_name FROM customers"
        );
        return { company_name };
    } catch (error) {
        console.error("Error fetching data from database:", error);
        throw error;
    }
}

module.exports = { createCustomer, fetchCustomers };