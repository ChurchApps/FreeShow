#!/usr/bin/env node

const fs = require("fs")
const path = require("path")

// Directories to create
const directories = ["test-output", "test-output/playwright-report", "test-output/playwright-results", "test-output/jest-results", "coverage"]

// Configuration files to copy/create
const setupFiles = [
    {
        src: "tests/jest.config.js",
        dest: "jest.config.js"
    }
]

console.log("🔧 Setting up test environment...\n")

// Create test directories
directories.forEach(dir => {
    const fullPath = path.resolve(__dirname, "..", dir)
    if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true })
        console.log(`✅ Created directory: ${dir}`)
    } else {
        console.log(`📁 Directory already exists: ${dir}`)
    }
})

// Setup configuration files
setupFiles.forEach(({ src, dest }) => {
    const srcPath = path.resolve(__dirname, "..", src)
    const destPath = path.resolve(__dirname, "..", dest)

    if (fs.existsSync(srcPath) && !fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath)
        console.log(`✅ Copied config: ${src} -> ${dest}`)
    } else if (fs.existsSync(destPath)) {
        console.log(`📄 Config already exists: ${dest}`)
    } else {
        console.log(`⚠️  Source config not found: ${src}`)
    }
})

// Create test environment variables file
const envContent = `# Test Environment Variables
NODE_ENV=test
FS_MOCK_STORE_PATH=tmp
ELECTRON_DISABLE_SECURITY_WARNINGS=true
`

const envPath = path.resolve(__dirname, "..", ".env.test")
if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, envContent)
    console.log("✅ Created .env.test file")
} else {
    console.log("📄 .env.test file already exists")
}

// Create GitHub Actions workflow (optional)
const workflowDir = path.resolve(__dirname, "..", ".github", "workflows")
const workflowContent = `name: Tests

on:
  push:
    branches: [ main, dev ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18, 20]
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Use Node.js \${{ matrix.node-version }}
      uses: actions/setup-node@v4
      with:
        node-version: \${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run unit tests
      run: npm run test:unit
    
    - name: Run integration tests
      run: npm run test:integration
    
    - name: Build application
      run: npm run build
    
    - name: Run E2E tests
      run: npm run test:e2e
    
    - name: Upload test results
      uses: actions/upload-artifact@v4
      if: always()
      with:
        name: test-results-\${{ matrix.node-version }}
        path: |
          test-output/
          coverage/
`

if (!fs.existsSync(workflowDir)) {
    fs.mkdirSync(workflowDir, { recursive: true })
}

const workflowPath = path.join(workflowDir, "tests.yml")
if (!fs.existsSync(workflowPath)) {
    fs.writeFileSync(workflowPath, workflowContent)
    console.log("✅ Created GitHub Actions workflow")
} else {
    console.log("📄 GitHub Actions workflow already exists")
}

console.log("\n🎉 Test environment setup complete!")
console.log("\nNext steps:")
console.log("1. Run: npm install (if not already done)")
console.log("2. Run: npm run test:setup (this script)")
console.log("3. Run: npm run test (run all tests)")
console.log("4. Run: npm run test:unit (run only unit tests)")
console.log("5. Run: npm run test:e2e (run only E2E tests)")
console.log("\nFor more options, run: node scripts/runTests.js --help")
