import pool from "../config/db.js";

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
      [organizationId, name, description || null],
    );
    const newApplication = result.rows[0];
    return res.status(201).json({
      message: "Application created successfully",
      application: newApplication,
    });
  } catch (err) {
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
      [applicationId, organizationId],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "Application not found",
      });
    }
    return res.status(200).json({
      message: "Application deleted successfully",
    });
  } catch (err) {
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
      [organizationId],
    );
    return res.status(200).json({
      applications: result.rows,
    });
  } catch (err) {
    console.error("List applications error:", err);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
}

export async function updateApplication(req, res) {
  const { applicationId, name, description } = req.body;
  const { organizationId } = req.user;

  if (!applicationId) {
    return res.status(400).json({ error: "applicationId is required" });
  }

  try {
    const result = await pool.query(
      `
        UPDATE applications
        SET name = COALESCE($1, name), description = COALESCE($2, description)
        WHERE id = $3 AND organization_id = $4
        RETURNING id, name, description, created_at
        `,
      [name, description, applicationId, organizationId],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Application not found" });
    }
    return res.status(200).json({
      message: "Application updated successfully",
      application: result.rows[0],
    });
  } catch (err) {
    console.error("Update application error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function createEnvironment(req, res) {
  const { name, applicationId } = req.body;
  const { organizationId } = req.user;

  if (!name || !applicationId) {
    return res
      .status(400)
      .json({ error: "Environment name and ApllicationId is required" });
  }
  if (name != "prod" && name != "staging" && name != "dev" && name != "test") {
    return res.status(400).json({
      error:
        "Environment name must be one of: production, staging, development",
    });
  }
  try {
    const appCheck = await pool.query(
      `
      SELECT id
      FROM applications
      WHERE id = $1 AND organization_id = $2
      `,
      [applicationId, organizationId],
    );
    if (appCheck.rowCount === 0) {
      return res.status(404).json({ error: "Application not found" });
    }

    const result = await pool.query(
      `
        INSERT INTO environments (application_id, name)
        VALUES ($1, $2)
        RETURNING id, application_id AS "applicationId", name, created_at
        `,
      [applicationId, name],
    );
    const newEnvironment = result.rows[0];
    return res.status(201).json({
      message: "Environment created successfully",
      environment: newEnvironment,
    });
  } catch (err) {
    console.error("Create environment error:", err);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
}

export async function deleteEnvironment(req, res) {
  const { environmentId } = req.body;
  const { organizationId } = req.user;
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
          AND application_id IN (
            SELECT id FROM applications WHERE organization_id = $2
          )
        RETURNING id
        `,
      [environmentId, organizationId],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "Environment not found",
      });
    }
    return res.status(200).json({
      message: "Environment deleted successfully",
    });
  } catch (err) {
    console.error("Delete environment error:", err);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
}

export async function listEnvironments(req, res) {
  const { organizationId } = req.user;
  const applicationId = req.query.applicationId || req.body?.applicationId;

  try {
    let result;
    if (applicationId) {
      result = await pool.query(
        `
        SELECT e.id,
               e.application_id AS "applicationId",
               e.name,
               e.created_at
        FROM environments e
        JOIN applications a ON a.id = e.application_id
        WHERE a.organization_id = $1 AND a.id = $2
        ORDER BY e.created_at DESC
        `,
        [organizationId, applicationId],
      );
    } else {
      result = await pool.query(
        `
        SELECT e.id,
               e.application_id AS "applicationId",
               e.name,
               e.created_at
        FROM environments e
        JOIN applications a ON a.id = e.application_id
        WHERE a.organization_id = $1
        ORDER BY e.created_at DESC
        `,
        [organizationId],
      );
    }
    return res.status(200).json({
      environments: result.rows,
    });
  } catch (err) {
    console.error("List environments error:", err);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
}

export async function updateEnvironment(req, res) {
  const { environmentId, name, applicationId } = req.body;
  const { organizationId } = req.user;

  if (!environmentId) {
    return res.status(400).json({ error: "environmentId is required" });
  }

  if (name && !["prod", "staging", "dev", "test"].includes(name)) {
    return res
      .status(400)
      .json({
        error: "Environment name must be one of: prod, staging, dev, test",
      });
  }

  try {
    const result = await pool.query(
      `
      UPDATE environments
      SET name = COALESCE($1, name),
          application_id = COALESCE($2, application_id)
      WHERE id = $3
        AND application_id IN (
          SELECT id FROM applications WHERE organization_id = $4
        )
      RETURNING id, application_id AS "applicationId", name, created_at
      `,
      [name, applicationId ?? null, environmentId, organizationId],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Environment not found" });
    }
    return res.status(200).json({
      message: "Environment updated successfully",
      environment: result.rows[0],
    });
  } catch (err) {
    console.error("Update environment error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
