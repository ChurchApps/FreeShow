const { spawn } = require('child_process');

// Quick script to rebuild servers during development
console.log('Rebuilding server files...');

const buildProcess = spawn('node', ['scripts/createServerFiles.js'], {
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, NODE_ENV: 'development' }
});

buildProcess.on('close', (code) => {
    if (code !== 0) {
        console.error('Server rebuild failed');
        process.exit(code);
    }
    console.log('Server rebuild completed!');
});

buildProcess.on('error', (err) => {
    console.error('Failed to start rebuild process:', err);
    process.exit(1);
});