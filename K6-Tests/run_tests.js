import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname);

function run(command) {
  console.log(`\n=== Running: ${command}`);
  execSync(command, { cwd: root, stdio: "inherit", env: process.env });
}

try {
  run("node scripts/fetch_orgs.js");

  // run selected K6 tests after org file is generated
  run("k6 run tests/4_data_driven_test.js");

  // optionally you can include other tests, uncomment below:
  // run('k6 run tests/1_smoke_test.js');
  // run('k6 run tests/2_invalid_key_test.js');
  // run('k6 run tests/3_scale_demo_test.js');

  console.log("\nAll tests finished.");
} catch (error) {
  console.error("\nAutomated test pipeline failed:", error.message);
  process.exit(1);
}
