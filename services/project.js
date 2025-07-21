async function insertMilestone(connection, data) {
    const { milestones, projectData } = data;
    try {
        const [result] = await connection.execute(
            `SELECT customer_id FROM customers WHERE company_name = ?`,
            [projectData.customerName]
        );
        const customer_id = result[0].customer_id;
        
        // Begin transaction
        await connection.beginTransaction();

        const insertProjectQuery = `
          INSERT INTO projects (customer_id, internal_project_id, project_name, project_date, pono, total_prices, taxes)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        await connection.query(insertProjectQuery, [
            customer_id,
            projectData.projectNumber,
            projectData.projectName,
            projectData.projectDate,
            projectData.poNo,
            projectData.totalPrice,
            projectData.taxTypes[0]
        ]);

        // Insert milestones
        for (const [index, milestone] of milestones.entries()) {
            const milestoneNumber = (index + 1).toString().padStart(3, '0');
            const milestone_id = `${projectData.projectNumber}_${milestoneNumber}`;

            const query = `INSERT INTO milestones (customer_id, internal_project_id, milestone_id, milestone_name, claim_percent, amount) 
            VALUES (?, ?, ?, ?, ?, ?)`;
            await connection.query(query, [
                customer_id,
                projectData.projectNumber,
                milestone_id,
                milestone.milestone,
                milestone.claimPercentage,
                milestone.amount
            ]);
        }

        // Commit transaction
        await connection.commit();

        return { success: true, message: "Project created successfully", internalProjectId: projectData.projectNumber };
    } catch (error) {
        console.error("Error inserting project data:", error);
        // Rollback transaction in case of error
        await connection.rollback();
        return { success: false, message: "Error inserting project data", error: error.message };
    }
}

async function fetchProjects(connection, companyName) {
    try {
        const [projects] = await connection.execute(
            "SELECT projects.project_name, projects.internal_project_id FROM projects INNER JOIN customers ON projects.customer_id = customers.customer_id WHERE customers.company_name = ?",
            [companyName]
        );
        return { projects };
    } catch (error) {
        console.error("Error fetching data from database:", error);
        throw error;
    }
}

async function fetchMilestones(connection, selectedProjectId) {
    try {
        const [milestones] = await connection.execute(
            "SELECT * FROM milestones INNER JOIN projects ON milestones.customer_id = projects.customer_id AND milestones.internal_project_id = projects.internal_project_id WHERE projects.internal_project_id = ?",
            [selectedProjectId]
        );
        return { milestones };
    } catch (error) {
        console.error("Error fetching data from database:", error);
        throw error;
    }
}

async function getAllProjects(connection) {
    try {
        const [projects] = await connection.execute(`
            SELECT * FROM projects
        `);
        return projects;
    } catch (error) {
        console.error('Error fetching projects:', error);
        return [];
    }
}

async function getProjectMilestones(connection, projectdata) {
    try {
        const [milestones] = await connection.execute(`
            SELECT * FROM milestones WHERE customer_id = ? AND internal_project_id = ?
        `, [projectdata.customer_id, projectdata.project_id]);

        const [customers] = await connection.execute(`
            SELECT * FROM customers WHERE customer_id = ?
        `, [projectdata.customer_id]);

        return { milestones, customers };
    } catch (error) {
        console.error('Error fetching milestones:', error);
        return { milestones: [], customers: [] };
    }
}

async function updateProject(connection, projectData) {
    await connection.beginTransaction();

    try {
        const { project_id, customer_id, project_name, project_date, pono, total_prices } = projectData;

        // Update the project details
        await connection.execute(
            'UPDATE projects SET project_name = ?, project_date = ?, pono = ?, total_prices = ? WHERE customer_id = ? AND internal_project_id = ?',
            [project_name, project_date, pono, total_prices, customer_id, project_id]
        );

        // Retrieve the milestones for this project
        const [milestones] = await connection.execute(
            'SELECT milestone_id, claim_percent FROM milestones WHERE customer_id = ? AND internal_project_id = ?',
            [customer_id, project_id]
        );

        // Update the milestone amounts based on the new total price
        for (const milestone of milestones) {
            const newAmount = (milestone.claim_percent / 100) * total_prices;
            await connection.execute(
                'UPDATE milestones SET amount = ? WHERE milestone_id = ?',
                [newAmount, milestone.milestone_id]
            );
        }

        await connection.commit();

        return { success: true };
    } catch (error) {
        await connection.rollback();
        console.error('Error updating project:', error);
        throw error;
    }
}

module.exports = { 
    insertMilestone, 
    fetchProjects, 
    fetchMilestones, 
    getAllProjects, 
    getProjectMilestones, 
    updateProject 
};