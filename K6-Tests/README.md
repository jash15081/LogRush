# LogRush Test Data

This directory contains comprehensive test data for LogRush performance and security testing.

## Test Data Structure

The `test-data.json` file contains a complete test dataset with:

### Organizations (5 total)

- **TechCorp** - Web and mobile applications
- **DataFlow Inc** - Analytics and data processing
- **CloudSync** - Cloud synchronization services
- **LogAnalyzer Pro** - Log processing and analytics
- **DevOps Central** - CI/CD and deployment tools

### For Each Organization:

- **Admin User**: Auto-generated with secure credentials
- **Applications**: 3 applications per organization
- **Environments**: development, staging, production
- **API Keys**: 3 keys with different rate limits (dev: 100/s, staging: 500/s, prod: 1000/s)

## API Keys Format

All API keys follow the format: `lk_{64-character-hex-string}`

- Raw keys are stored in the `rawKey` field
- Keys are hashed with SHA256 before storage in the database
- Each key has configurable rate limits

## Test Scripts

### Individual Tests

- `npm run k6:smoke` - Basic functionality test
- `npm run k6:invalid-key` - Security test with invalid keys
- `npm run k6:scale` - Load testing with multiple VUs
- `npm run k6:data` - Data-driven testing

### Complete Test Suite

- `npm run k6:all` - Runs all tests with fresh data generation

## Data Generation

To generate fresh test data:

```bash
# Start the LogicalPlain server first
cd ../LogicalPlain
npm run dev

# Then generate test data
cd ../K6-Tests
npm run setup-test-data
```

This will:

1. Create 5 organizations with admin users
2. Generate applications for each organization
3. Create API keys with different rate limits
4. Save everything to `tests/test-data.json`

## Test Data Usage

The test scripts automatically load data from `tests/test-data.json`:

```javascript
const testData = JSON.parse(open("./test-data.json"));
const organizations = testData.organizations;

// Access organizations, applications, and API keys
const org = organizations[0];
const app = org.applications[0];
const apiKey = org.apiKeys[0].rawKey;
```

## Security Notes

- Admin passwords are stored in plain text for testing only
- API keys are shown in full (never do this in production!)
- Test data is for development/testing environments only

## Database Integration

The test data integrates with the PostgreSQL database:

- Organizations, users, applications stored in respective tables
- API keys hashed and stored securely
- All relationships properly maintained

## Customization

To modify test data, edit `generate-test-data.js`:

- Change organization names and configurations
- Adjust application counts and names
- Modify API key rate limits
- Add more organizations or environments
