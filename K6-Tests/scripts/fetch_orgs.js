import "dotenv/config";
import fs from "fs";
import path from "path";
import pkg from "pg";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { Pool } = pkg;

const outputPath = path.resolve(__dirname, "../tests/orgs.json");
console.log(process.env.DATABASE_USERNAME);
const pool = new Pool({
  user: process.env.DATABASE_USERNAME || process.env.DB_USER || "postgres",
  host: process.env.DATABASE_HOST || "localhost",
  database: process.env.DATABASE_NAME || "your_database_name",
  password:
    process.env.DATABASE_PASSWORD ||
    process.env.DB_PASS ||
    "your_database_password",
  port: Number(process.env.DATABASE_PORT || process.env.DB_PORT || 5432),
});

async function fetchOrganizations() {
  try {
    let result;

    // Prefer org table if stores `api_key` directly
    try {
      result = await pool.query(`
        SELECT id AS org_id, name, api_key
        FROM organizations
        WHERE api_key IS NOT NULL
      `);
    } catch (err) {
      console.warn(
        "Unable to query organizations.api_key directly, will try api_keys table.",
        err.message,
      );
      result = null;
    }

    let rows = [];

    if (result && result.rows && result.rows.length > 0) {
      rows = result.rows;
    } else {
      console.log("Falling back to api_keys lookup.");
      // This assumes api_keys may have full key or a column 'raw_key'.
      let keyRows;
      try {
        keyRows = await pool.query(`
          SELECT
            o.id AS org_id,
            o.name,
            k.key AS api_key,
            k.api_key_id
          FROM organizations o
          JOIN api_keys k ON k.organization_id = o.id
          WHERE k.api_key IS NOT NULL OR k.key_hash IS NOT NULL
          LIMIT 100
        `);
      } catch (err) {
        console.warn(
          "Fallback api_keys select failed, try minimal join:",
          err.message,
        );
        keyRows = await pool.query(`
          SELECT
            o.id AS org_id,
            o.name,
            k.*
          FROM organizations o
          JOIN api_keys k ON k.organization_id = o.id
          LIMIT 100
        `);
      }

      if (keyRows && keyRows.rows && keyRows.rows.length > 0) {
        rows = keyRows.rows.map((row) => ({
          org_id: row.org_id,
          name: row.name,
          api_key: row.api_key || row.key || row.key_hash || "",
        }));
      }
    }

    if (rows.length === 0) {
      throw new Error("No organization API keys discovered in database");
    }

    const payload = rows.map((row) => ({
      name: row.name,
      org_id: String(row.org_id),
      apiKey: row.api_key,
      applications: ["auth-service", "payment-service"],
      environments: ["production", "staging"],
    }));

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf8");

    console.log(`Wrote ${payload.length} organizations to ${outputPath}`);
  } catch (err) {
    console.error("Error fetching organizations from database:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fetchOrganizations();
