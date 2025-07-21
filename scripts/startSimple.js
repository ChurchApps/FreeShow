const { spawn } = require('child_process');
const path = require('path');

// Simple start script using new Vite config
console.log('Starting FreeShow with Vite...');

// Start Vite for main app
const viteMain = spawn('npx', ['vite'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, NODE_ENV: 'development' }
});

// Start Vite for servers
setTimeout(() => {
    console.log('Starting server builds...');
    const viteServers = spawn('npx', ['vite', 'build', '--config', 'vite.config.servers.mjs', '--watch'], {
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, NODE_ENV: 'development' }
    });
}, 2000);

// Handle shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    process.exit(0);
});