import pool from "../config/db.js";
import bcrypt from "bcrypt";

export async function createOrganization(req, res) {
  const { organizationName, adminUsername, adminPassword } = req.body;

  if (!organizationName || !adminUsername || !adminPassword) {
    return res.status(400).json({
      error: "organizationName, adminUsername and adminPassword are required",
    });
  }

  if (adminPassword.length < 8) {
    return res.status(400).json({
      error: "Password must be at least 8 characters long",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const orgResult = await client.query(
      `
      INSERT INTO organizations (name)
      VALUES ($1)
      RETURNING id, name, created_at
      `,
      [organizationName],
    );

    const organization = orgResult.rows[0];

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    await client.query(
      `
      INSERT INTO users (
        organization_id,
        username,
        password_hash,
        role
      )
      VALUES ($1, $2, $3, 'admin')
      `,
      [organization.id, adminUsername, passwordHash],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Organization created successfully",
      organization,
    });
  } catch (err) {
    await client.query("ROLLBACK");

    if (err.code === "23505") {
      return res.status(409).json({
        error: "Organization name or username already exists",
      });
    }

    console.error("Create organization failed:", err);

    return res.status(500).json({
      error: "Internal server error",
    });
  } finally {
    client.release();
  }
}

export async function getOrganization(req, res) {
  const { organizationId } = req.user;

  try {
    const result = await pool.query(
      `
      SELECT id, name, created_at
      FROM organizations
      WHERE id = $1
      `,
      [organizationId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Organization not found" });
    }

    return res.status(200).json({
      organization: result.rows[0],
    });
  } catch (err) {
    console.error("Get organization error:", err);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
}

export async function updateOrganization(req, res) {
  const { name } = req.body;
  const { organizationId } = req.user;

  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }

  try {
    const result = await pool.query(
      `
      UPDATE organizations
      SET name = $1
      WHERE id = $2
      RETURNING id, name, created_at
      `,
      [name, organizationId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Organization not found" });
    }

    return res.status(200).json({
      message: "Organization updated successfully",
      organization: result.rows[0],
    });
  } catch (err) {
    console.error("Update organization error:", err);
    if (err.code === "23505") {
      return res
        .status(409)
        .json({ error: "Organization name already exists" });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function deleteOrganization(req, res) {
  const { organizationId } = req.body;
  if (!organizationId) {
    return res.status(400).json({
      error: "organizationId is required",
    });
  }
  try {
    const result = await pool.query(
      `
        DELETE FROM organizations
        WHERE id = $1
        RETURNING id
      `,
      [organizationId],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "Organization not found",
      });
    }
    return res.status(200).json({
      message: "Organization deleted successfully",
    });
  } catch (err) {
    console.error("Delete organization error:", err);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
}
