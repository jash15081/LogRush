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
      [organizationName]
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
      [organization.id, adminUsername, passwordHash]
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

