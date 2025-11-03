#!/usr/bin/env node

// Auto-start script for Clay Terminal Bridge
// This can be run to automatically start the bridge in the background

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BRIDGE_PORT = 8765;
const BRIDGE_URL = `http://127.0.0.1:${BRIDGE_PORT}/api/health`;

async function checkBridgeRunning() {
  return new Promise((resolve) => {
    const req = http.get(BRIDGE_URL, (res) => {
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

async function startBridge() {
  const isRunning = await checkBridgeRunning();
  
  if (isRunning) {
    console.log('✅ Bridge already running');
    return;
  }

  console.log('🚀 Starting Clay Terminal Bridge...');
  
  const bridgePath = path.join(__dirname, 'bridge.js');
  const bridgeProcess = spawn('node', [bridgePath], {
    cwd: __dirname,
    stdio: 'inherit',
    detached: false
  });

  bridgeProcess.on('error', (error) => {
    console.error('❌ Failed to start bridge:', error);
    process.exit(1);
  });

  // Wait a moment and check if it started
  setTimeout(async () => {
    const running = await checkBridgeRunning();
    if (running) {
      console.log('✅ Bridge started successfully');
      console.log(`📡 Listening on http://127.0.0.1:${BRIDGE_PORT}`);
    } else {
      console.log('⏳ Bridge starting...');
    }
  }, 2000);

  // Handle process exit
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping bridge...');
    bridgeProcess.kill();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    bridgeProcess.kill();
    process.exit(0);
  });
}

startBridge();

