import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = "http://localhost:3000";

// Test data to generate
const TEST_DATA = {
  organizations: [
    {
      name: "TechCorp",
      adminUsername: "admin_techcorp",
      adminPassword: "TechCorp123!",
      applications: ["web-app", "mobile-app", "api-gateway"],
      environments: ["development", "staging", "production"],
      apiKeys: [
        { name: "dev-key", rateLimit: 100 },
        { name: "staging-key", rateLimit: 500 },
        { name: "prod-key", rateLimit: 1000 },
      ],
    },
    {
      name: "DataFlow Inc",
      adminUsername: "admin_dataflow",
      adminPassword: "DataFlow456!",
      applications: ["analytics-engine", "data-pipeline", "dashboard"],
      environments: ["dev", "test", "prod"],
      apiKeys: [
        { name: "analytics-key", rateLimit: 200 },
        { name: "pipeline-key", rateLimit: 300 },
        { name: "dashboard-key", rateLimit: 150 },
      ],
    },
    {
      name: "CloudSync",
      adminUsername: "admin_cloudsync",
      adminPassword: "CloudSync789!",
      applications: ["sync-service", "backup-agent", "monitoring"],
      environments: ["development", "staging", "production"],
      apiKeys: [
        { name: "sync-key", rateLimit: 250 },
        { name: "backup-key", rateLimit: 100 },
        { name: "monitor-key", rateLimit: 50 },
      ],
    },
    {
      name: "LogAnalyzer Pro",
      adminUsername: "admin_loganalyzer",
      adminPassword: "LogAnalyzer101!",
      applications: ["log-processor", "alert-system", "reporting"],
      environments: ["dev", "staging", "prod"],
      apiKeys: [
        { name: "processor-key", rateLimit: 300 },
        { name: "alert-key", rateLimit: 100 },
        { name: "report-key", rateLimit: 200 },
      ],
    },
    {
      name: "DevOps Central",
      adminUsername: "admin_devopscentral",
      adminPassword: "DevOps2024!",
      applications: ["ci-cd", "monitoring", "deployment"],
      environments: ["development", "staging", "production"],
      apiKeys: [
        { name: "ci-key", rateLimit: 400 },
        { name: "monitor-key", rateLimit: 150 },
        { name: "deploy-key", rateLimit: 250 },
      ],
    },
  ],
};

async function login(username, password) {
  const response = await fetch(`${BASE_URL}/user/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status} ${response.statusText}`);
  }

  const cookies = response.headers.get("set-cookie");
  if (!cookies) {
    throw new Error("No auth cookie received");
  }

  // Extract the auth_token from cookies
  const authToken = cookies
    .split(";")
    .find((cookie) => cookie.trim().startsWith("auth_token="))
    ?.split("=")[1];

  if (!authToken) {
    throw new Error("Auth token not found in cookies");
  }

  return authToken;
}

async function createOrganization(orgData) {
  console.log(`Creating organization: ${orgData.name}`);

  const response = await fetch(`${BASE_URL}/organization/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      organizationName: orgData.name,
      adminUsername: orgData.adminUsername,
      adminPassword: orgData.adminPassword,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Failed to create organization: ${response.status} - ${error}`,
    );
  }

  const result = await response.json();
  console.log(
    `✅ Organization created: ${result.organization.name} (ID: ${result.organization.id})`,
  );

  return {
    ...result.organization,
    adminUsername: orgData.adminUsername,
    adminPassword: orgData.adminPassword,
  };
}

async function createApplication(authToken, appName, description = "") {
  console.log(`  Creating application: ${appName}`);

  const response = await fetch(`${BASE_URL}/application/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `auth_token=${authToken}`,
    },
    body: JSON.stringify({
      name: appName,
      description: description || `${appName} application`,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Failed to create application: ${response.status} - ${error}`,
    );
  }

  const result = await response.json();
  console.log(
    `  ✅ Application created: ${result.application.name} (ID: ${result.application.id})`,
  );

  return result.application;
}

async function createApiKey(authToken, keyName, rateLimit) {
  console.log(`  Creating API key: ${keyName}`);

  const response = await fetch(`${BASE_URL}/apikey/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `auth_token=${authToken}`,
    },
    body: JSON.stringify({
      name: keyName,
      rateLimitPerSec: rateLimit,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create API key: ${response.status} - ${error}`);
  }

  const result = await response.json();
  console.log(
    `  ✅ API key created: ${result.key.name} (Rate limit: ${result.key.rateLimitPerSec}/sec)`,
  );

  return {
    id: result.key.id,
    name: result.key.name,
    rawKey: result.apiKey,
    rateLimitPerSec: result.key.rateLimitPerSec,
    createdAt: result.key.createdAt,
    expiresAt: result.key.expiresAt,
  };
}

async function generateTestData() {
  const results = {
    organizations: [],
    generatedAt: new Date().toISOString(),
  };

  console.log("🚀 Starting test data generation...\n");

  for (const orgData of TEST_DATA.organizations) {
    try {
      // Create organization
      const organization = await createOrganization(orgData);

      // Login as admin
      const authToken = await login(
        orgData.adminUsername,
        orgData.adminPassword,
      );
      console.log(`  🔐 Logged in as ${orgData.adminUsername}`);

      // Create applications
      const applications = [];
      for (const appName of orgData.applications) {
        const application = await createApplication(authToken, appName);
        applications.push(application);
      }

      // Create API keys
      const apiKeys = [];
      for (const keyData of orgData.apiKeys) {
        const apiKey = await createApiKey(
          authToken,
          keyData.name,
          keyData.rateLimit,
        );
        apiKeys.push(apiKey);
      }

      // Store results
      results.organizations.push({
        ...organization,
        applications,
        environments: orgData.environments,
        apiKeys,
      });

      console.log(`✅ Completed organization: ${orgData.name}\n`);
    } catch (error) {
      console.error(
        `❌ Failed to create organization ${orgData.name}:`,
        error.message,
      );
      // Continue with next organization
    }
  }

  // Save to JSON file
  const outputPath = path.resolve(__dirname, "test-data.json");
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

  console.log(`💾 Test data saved to: ${outputPath}`);
  console.log(
    `📊 Generated ${results.organizations.length} organizations with applications and API keys`,
  );

  return results;
}

// Run the script
generateTestData()
  .then(() => {
    console.log("🎉 Test data generation completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Test data generation failed:", error);
    process.exit(1);
  });
