# FreeShow Test Suite

This is a comprehensive test suite for FreeShow, designed to ensure code quality and stability in an open source project.

## 📋 Table of Contents

- [Test Types](#test-types)
- [Setup](#setup)
- [Running Tests](#running-tests)
- [Directory Structure](#directory-structure)
- [Code Coverage](#code-coverage)
- [CI/CD](#cicd)
- [Contributing](#contributing)

## 🧪 Test Types

### 1. Unit Tests (`tests/unit/`)

- Test individual functions and components
- Use Jest as testing framework
- Include mocks for external dependencies
- Cover main functions such as:
    - Show management (`show.test.ts`)
    - Slide handling (`shows.test.ts`)
    - Output system (`output.test.ts`)
    - Media helpers (`media.test.ts`)

### 2. Integration Tests (`tests/integration/`)

- Test interaction between components
- Verify complete workflows
- Include:
    - Complete show management (`showManagement.test.ts`)
    - Output system with multiple displays (`outputSystem.test.ts`)

### 3. End-to-End Tests (`tests/e2e/`)

- Test the complete application using Playwright
- Simulate real user interaction
- Include:
    - Basic application tests (`app.test.ts`)
    - Show workflow tests (`showWorkflows.test.ts`)

## ⚙️ Setup

### Prerequisites

- Node.js 18 or higher
- Python 3.12+ (for native dependencies)
- Visual Studio Build Tools (Windows)

### Installation

```bash
# Install dependencies
npm install

# Setup testing environment
npm run test:setup
```

### Configuration Files

- `tests/jest.config.js` - Jest configuration
- `config/testing/playwright.config.ts` - Playwright configuration
- `tests/setup.ts` - Global test setup
- `.env.test` - Environment variables for testing

## 🚀 Running Tests

### Main Commands

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run only E2E tests
npm run test:e2e

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Custom Testing Script

```bash
# Run complete suite
node scripts/runTests.js

# Run specific types
node scripts/runTests.js --unit
node scripts/runTests.js --integration
node scripts/runTests.js --e2e
node scripts/runTests.js --coverage

# View help
node scripts/runTests.js --help
```

## 📁 Directory Structure

```
tests/
├── unit/                      # Unit tests
│   ├── show.test.ts          # Show function tests
│   ├── shows.test.ts         # Show management tests
│   ├── output.test.ts        # Output system tests
│   └── media.test.ts         # Media helper tests
├── integration/              # Integration tests
│   ├── showManagement.test.ts    # Complete show management
│   └── outputSystem.test.ts      # Integrated output system
├── e2e/                      # End-to-end tests
│   ├── app.test.ts           # Basic application tests
│   └── showWorkflows.test.ts # Show workflow tests
├── fixtures/                 # Test data
│   ├── sampleData.json       # Sample JSON data
│   └── mockData.ts           # Mocks and simulated data
├── jest.config.js            # Jest configuration
└── setup.ts                  # Global setup
```

## 📊 Code Coverage

### Coverage Reports

Reports are generated in:

- `coverage/lcov-report/index.html` - Interactive HTML report
- `coverage/lcov.info` - LCOV data for CI tools
- `coverage/coverage-final.json` - JSON coverage data

### Coverage Thresholds

```javascript
coverageThreshold: {
  global: {
    branches: 70,
    functions: 80,
    lines: 80,
    statements: 80
  }
}
```

### View Coverage Report

```bash
# Generate and open report
npm run test:coverage
# Then open coverage/lcov-report/index.html in browser
```

## 🔄 CI/CD

### GitHub Actions

Includes a GitHub Actions workflow (`.github/workflows/tests.yml`) that:

- Runs tests on Node.js 18 and 20
- Executes on push to `main` and `dev`
- Executes on pull requests
- Generates artifacts with test results

### Local CI Configuration

```bash
# Simulate CI environment
NODE_ENV=test CI=true npm test
```

## 🛠️ Troubleshooting

### Common Issues

1. **Electron errors in E2E tests**

    ```bash
    # Make sure the app is built
    npm run build
    npm run test:e2e
    ```

2. **Unit tests fail due to missing modules**

    ```bash
    # Reinstall dependencies
    rm -rf node_modules package-lock.json
    npm install
    ```

3. **Timeout in E2E tests**
    - Increase timeout in `playwright.config.ts`
    - Check that no Electron processes are running

4. **TypeScript errors in tests**
    - Verify that `@types/jest` is installed
    - Check configuration in `tsconfig.json`

## 🤝 Contributing

### Adding New Tests

1. **Unit Tests**: Create file in `tests/unit/`

    ```typescript
    import { describe, it, expect } from "@jest/globals"

    describe("New Feature", () => {
        it("should work correctly", () => {
            // Test code
        })
    })
    ```

2. **Integration Tests**: Create file in `tests/integration/`
    - Focus on complete workflows
    - Include appropriate setup and teardown

3. **E2E Tests**: Add to existing files in `tests/e2e/`
    - Use stable selectors
    - Include appropriate waits
    - Clean state between tests

### Best Practices

- ✅ **Descriptive names**: Tests should explain what they verify
- ✅ **Independent tests**: Each test should be able to run alone
- ✅ **Test data**: Use fixtures for consistent data
- ✅ **Cleanup**: Clean state after each test
- ✅ **Appropriate mocks**: Mock external dependencies
- ✅ **Clear assertions**: Verify specific behavior

### Adding Coverage

To add coverage for new files:

1. Make sure they're in `src/`
2. Add tests that cover main functions
3. Run `npm run test:coverage` to verify

## 📝 Important Notes

- Tests are designed to be resilient to UI changes
- Flexible selectors are used in E2E tests
- Mocks allow testing without external dependencies
- The suite is optimized for CI/CD execution

## 📞 Support

If you have issues with tests:

1. Review the documentation in this README
2. Check error logs
3. Run individual tests to isolate problems
4. Check GitHub issues

---

**Thank you for contributing to keep FreeShow stable and reliable!** 🎉
