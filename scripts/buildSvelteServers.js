const { spawn } = require('child_process');
const path = require('path');

console.log('Building Svelte servers with Vite...');

const viteConfig = 'vite.config.servers.mjs';

// Build all servers using Vite
const buildProcess = spawn('npx', ['vite', 'build', '--config', viteConfig], {
    stdio: 'inherit',
    shell: true,
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'production' }
});

buildProcess.on('close', (code) => {
    if (code !== 0) {
        console.error('Server build failed with code:', code);
        process.exit(code);
    }
    console.log('Server build completed successfully!');
});

buildProcess.on('error', (err) => {
    console.error('Failed to start build process:', err);
    process.exit(1);
});