const tmp = require('tmp')
const {execSync} = require('child_process')

async function runTest() {
  const dirObj = tmp.dirSync({unsafeCleanup: true})
  execSync(
    'npm run test:playwright',
    {env: {...process.env, 'FS_MOCK_STORE_PATH': dirObj.name}}
  )
  dirObj.removeCallback()
}

runTest()
