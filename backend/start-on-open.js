// Auto-start backend script
// This can be run to automatically start the backend when the page opens

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const BACKEND_PORT = process.env.PORT || 3000;
const BACKEND_DIR = __dirname;

// Check if backend is already running
const http = require('http');

function checkBackendRunning() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${BACKEND_PORT}/api/health`, (res) => {
      resolve(true);
    });
    req.on('error', () => {
      resolve(false);
    });
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function startBackend() {
  const isRunning = await checkBackendRunning();
  
  if (isRunning) {
    console.log('✅ Backend already running on port', BACKEND_PORT);
    return;
  }

  console.log('🚀 Starting Clay Terminal backend...');
  
  // Change to backend directory and start
  const backendProcess = spawn('node', ['server.js'], {
    cwd: BACKEND_DIR,
    stdio: 'inherit',
    shell: true
  });

  backendProcess.on('error', (error) => {
    console.error('❌ Failed to start backend:', error);
    process.exit(1);
  });

  // Wait a moment for server to start
  setTimeout(async () => {
    const isRunning = await checkBackendRunning();
    if (isRunning) {
      console.log('✅ Backend started successfully on port', BACKEND_PORT);
    } else {
      console.log('⏳ Backend starting...');
    }
  }, 2000);

  // Handle process exit
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping backend...');
    backendProcess.kill();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    backendProcess.kill();
    process.exit(0);
  });
}

startBackend();

