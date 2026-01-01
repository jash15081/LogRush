import pool from "../config/db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export async function userLogin(req, res) {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({
      error: "Username and password are required",
    });
  }

  const result = await pool.query(
    `
    SELECT id, organization_id, username, password_hash, role
    FROM users
    WHERE username = $1
    `,
    [username]
  );

  const user = result.rows[0];

  if (!user) {
    return res.status(401).json({
      error: "Invalid username or password",
    });
  }

  const passwordMatch = await bcrypt.compare(
    password,
    user.password_hash
  );

  if (!passwordMatch) {
    return res.status(401).json({
      error: "Invalid username or password",
    });
  }

  const tokenPayload = {
    userId: user.id,
    organizationId: user.organization_id,
    role: user.role,
  };

  const token = jwt.sign(
    tokenPayload,
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );


  res.cookie("auth_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

 
  pool.query(
    `UPDATE users SET last_login_at = NOW() WHERE id = $1`,
    [user.id]
  ).catch(() => {});

  return res.json({
    message: "Login successful",
  });
}

export async function createUser(req, res) {
    const {username, password, role} = req.body;
    const {organizationId} = req.user;

    if (!username || !password || !role) {
        return res.status(400).json({
            error: "username, password and role are required",
        });
    }
    if (password.length < 8) {
        return res.status(400).json({
            error: "Password must be at least 8 characters long",
        });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    try {
        const result = await pool.query(
            `
            INSERT INTO users (organization_id, username, password_hash, role) 
            VALUES ($1, $2, $3, $4)
            RETURNING id, username, role, created_at
            `,
            [organizationId, username, passwordHash, role]
        );
        const newUser = result.rows[0];
        return res.status(201).json({
            message: "User created successfully",
            user: newUser,
        });
    } catch (err) {
        console.log(err);
        if (err.code === "23505") {
            return res.status(409).json({
                error: "Username already exists",
            });
        }   
        return res.status(500).json({
            error: "Internal server error",
        });
    }
}

export async function deleteUser(req, res) {
    const { userId } = req.body;
    const { organizationId } = req.user;

    if (!userId) {
        return res.status(400).json({ error: "userId is required" });
    }

    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // 1️⃣ Get user role
        const userRes = await client.query(
            `
            SELECT role
            FROM users
            WHERE id = $1 AND organization_id = $2
            `,
            [userId, organizationId]
        );

        if (userRes.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({
                error: "User not found or does not belong to your organization",
            });
        }

        const { role } = userRes.rows[0];

        // 2️⃣ If admin, ensure at least one admin remains
        if (role === "admin") {
            const adminCountRes = await client.query(
                `
                SELECT COUNT(*)::int AS count
                FROM users
                WHERE organization_id = $1 AND role = 'admin'
                `,
                [organizationId]
            );

            if (adminCountRes.rows[0].count <= 1) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    error: "Organization must have at least one admin",
                });
            }
        }

        // 3️⃣ Delete user
        await client.query(
            `
            DELETE FROM users
            WHERE id = $1 AND organization_id = $2
            `,
            [userId, organizationId]
        );

        await client.query("COMMIT");

        return res.json({ message: "User deleted successfully" });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error(err);
        return res.status(500).json({ error: "Internal server error" });
    } finally {
        client.release();
    }
}


