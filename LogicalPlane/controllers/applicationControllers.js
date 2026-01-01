import pool from '../config/db.js';

export async function createApplication(req, res) {
    const { name, description } = req.body;
    const { organizationId } = req.user;

    if (!name) {
        return res.status(400).json({ error: "Application name is required" });
    }
    try {
        const result = await pool.query(
            `
        INSERT INTO applications (organization_id, name, description)
        VALUES ($1, $2, $3)
        RETURNING id, name, description, created_at
        `,
            [organizationId, name, description || null]
        );
        const newApplication = result.rows[0];
        return res.status(201).json({
            message: "Application created successfully",
            application: newApplication,
        });
    }
    catch (err) {
        console.error("Create application error:", err);
        return res.status(500).json({
            error: "Internal server error",
        });
    }
}

export async function deleteApplication(req, res) {
    const { applicationId } = req.body;
    const { organizationId } = req.user;
    if (!applicationId) {
        return res.status(400).json({
            error: "applicationId is required",
        });
    }
    try {
        const result = await pool.query(
            `
        DELETE FROM applications
        WHERE id = $1 AND organization_id = $2
        RETURNING id
        `,
            [applicationId, organizationId]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({
                error: "Application not found",
            });
        }
        return res.status(200).json({
            message: "Application deleted successfully",
        });
    }
    catch (err) {
        console.error("Delete application error:", err);
        return res.status(500).json({
            error: "Internal server error",
        });
    }
}

export async function listApplications(req, res) {
    const { organizationId } = req.user;
    try {
        const result = await pool.query(
            `
        SELECT id, name, description, created_at
        FROM applications
        WHERE organization_id = $1
        ORDER BY created_at DESC
        `,
            [organizationId]
        );
        return res.status(200).json({
            applications: result.rows,
        });
    }
    catch (err) {
        console.error("List applications error:", err);
        return res.status(500).json({
            error: "Internal server error",
        });
    }
}

export async function createEnvironment(req, res) {
    const { name, applicationId } = req.body;

    if (!name || !applicationId) {
        return res.status(400).json({ error: "Environment name and ApllicationId is required" });
    }
    if (name != "prod" && name != "staging" && name != "dev" && name != "test") {
        return res.status(400).json({ error: "Environment name must be one of: production, staging, development" });
    }
    try {
        const result = await pool.query(
            `
        INSERT INTO environments (application_id, name)
        VALUES ($1, $2)
        RETURNING id, name, created_at
        `,
            [applicationId, name]
        );
        const newEnvironment = result.rows[0];
        return res.status(201).json({
            message: "Environment created successfully",
            environment: newEnvironment,
        });
    }
    catch (err) {
        console.error("Create environment error:", err);
        return res.status(500).json({
            error: "Internal server error",
        });
    }
}

export async function deleteEnvironment(req, res) {
    const { environmentId } = req.body;
    if (!environmentId) {
        return res.status(400).json({
            error: "environmentId is required",
        });
    }
    try {
        const result = await pool.query(
            `
        DELETE FROM environments
        WHERE id = $1
        RETURNING id
        `,
            [environmentId]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({
                error: "Environment not found",
            });
        }
        return res.status(200).json({
            message: "Environment deleted successfully",
        });
    }
    catch (err) {
        console.error("Delete environment error:", err);
        return res.status(500).json({
            error: "Internal server error",
        });
    }
}

export async function listEnvironments(req, res) {
    const { applicationId } = req.body;
    if (!applicationId) {
        return res.status(400).json({ error: "ApllicationId is required" });
    }
    try {
        const result = await pool.query(
            `
        SELECT id, name, created_at
        FROM environments
        WHERE application_id = $1
        ORDER BY created_at DESC
        `,
            [applicationId]
        );
        return res.status(200).json({
            environments: result.rows,
        });
    }
    catch (err) {
        console.error("List environments error:", err);
        return res.status(500).json({
            error: "Internal server error",
        });
    }
}
