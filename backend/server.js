import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import cors from 'cors';
import pty from 'node-pty';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import * as systemAccess from './system-access.js';
import { credentialManager } from './credential-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Serve static files from web/dist (if built)
app.use(express.static(path.join(__dirname, '../web/dist')));

// Get shell based on OS
function getShell() {
  if (process.platform === 'win32') {
    return 'powershell.exe';
  } else if (process.platform === 'darwin') {
    return '/bin/zsh';
  } else {
    // Linux/ChromeOS
    return process.env.SHELL || '/bin/bash';
  }
}

// Store active PTY sessions
const activeSessions = new Map();

// WebSocket server for terminal connections
const wss = new WebSocketServer({ 
  server,
  path: '/ws'
});

wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection');
  
  let ptyProcess = null;
  let sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // Create PTY session
    const shell = getShell();
    const cols = 80;
    const rows = 24;
    
    ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: cols,
      rows: rows,
      cwd: os.homedir(),
      env: process.env
    });
    
    activeSessions.set(sessionId, ptyProcess);
    
    // Send connection confirmation
    ws.send(JSON.stringify({
      type: 'connected',
      sessionId: sessionId,
      shell: shell,
      cwd: os.homedir()
    }));
    
    // Handle PTY output
    ptyProcess.onData((data) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'output',
          data: data
        }));
      }
    });
    
    // Handle PTY exit
    ptyProcess.onExit((code, signal) => {
      console.log(`PTY session ${sessionId} exited with code ${code}, signal ${signal}`);
      activeSessions.delete(sessionId);
      
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'exit',
          code: code,
          signal: signal
        }));
      }
    });
    
    // Handle incoming messages from client
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        switch (data.type) {
          case 'input':
            if (ptyProcess) {
              ptyProcess.write(data.data);
            }
            break;
            
          case 'resize':
            if (ptyProcess) {
              ptyProcess.resize(data.cols || 80, data.rows || 24);
            }
            break;
            
          case 'kill':
            if (ptyProcess) {
              ptyProcess.kill();
              activeSessions.delete(sessionId);
            }
            break;
            
          default:
            console.warn('Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('Error handling message:', error);
      }
    });
    
    // Handle client disconnect
    ws.on('close', () => {
      console.log(`WebSocket connection closed for session ${sessionId}`);
      if (ptyProcess) {
        try {
          ptyProcess.kill();
        } catch (e) {
          // Ignore errors
        }
        activeSessions.delete(sessionId);
      }
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      if (ptyProcess) {
        try {
          ptyProcess.kill();
        } catch (e) {
          // Ignore errors
        }
        activeSessions.delete(sessionId);
      }
    });
    
  } catch (error) {
    console.error('Error creating PTY session:', error);
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  }
});

// REST API endpoints for command execution (alternative to WebSocket)
app.post('/api/execute', async (req, res) => {
  const { command, cwd, root = false, privileged = false } = req.body;
  
  if (!command) {
    return res.status(400).json({ error: 'Command is required' });
  }
  
  try {
    const workingDir = cwd || os.homedir();
    
    let result;
    if (privileged) {
      // Execute with full system privileges (bypass all restrictions)
      result = await systemAccess.executeWithFullPrivileges(command, {
        cwd: workingDir,
        timeout: 30000
      });
    } else if (root) {
      // Execute as root
      result = await systemAccess.executeAsRoot(command, {
        cwd: workingDir,
        timeout: 30000
      });
    } else {
      // Regular execution
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      result = await execAsync(command, {
        cwd: workingDir,
        env: process.env,
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
    }
    
    res.json({
      success: true,
      output: result.stdout || result.stderr || '',
      exitCode: result.stderr ? 1 : 0
    });
  } catch (error) {
    res.json({
      success: false,
      output: error.message || String(error),
      exitCode: error.code || 1
    });
  }
});

// System-level API endpoints for root access
app.post('/api/system/root-execute', async (req, res) => {
  const { command, cwd } = req.body;
  
  if (!command) {
    return res.status(400).json({ error: 'Command is required' });
  }
  
  try {
    const result = await systemAccess.executeAsRoot(command, {
      cwd: cwd || os.homedir(),
      timeout: 30000
    });
    
    res.json({
      success: true,
      output: result.stdout || '',
      stderr: result.stderr || '',
      exitCode: 0
    });
  } catch (error) {
    res.json({
      success: false,
      output: error.message || String(error),
      exitCode: error.code || 1
    });
  }
});

app.post('/api/system/privileged-execute', async (req, res) => {
  const { command, cwd } = req.body;
  
  if (!command) {
    return res.status(400).json({ error: 'Command is required' });
  }
  
  try {
    const result = await systemAccess.executeWithFullPrivileges(command, {
      cwd: cwd || os.homedir(),
      timeout: 30000
    });
    
    res.json({
      success: true,
      output: result.stdout || '',
      stderr: result.stderr || '',
      exitCode: 0
    });
  } catch (error) {
    res.json({
      success: false,
      output: error.message || String(error),
      exitCode: error.code || 1
    });
  }
});

// Kernel parameter access endpoints
app.get('/api/system/kernel-param/:param', async (req, res) => {
  try {
    const value = await systemAccess.readKernelParam(req.params.param);
    res.json({ success: true, param: req.params.param, value });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/system/kernel-param/:param', async (req, res) => {
  try {
    const { value } = req.body;
    await systemAccess.writeKernelParam(req.params.param, value);
    res.json({ success: true, param: req.params.param, value });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// System file access endpoints
app.get('/api/system/sys-file/:path(*)', async (req, res) => {
  try {
    const content = await systemAccess.readSysFile(req.params.path);
    res.json({ success: true, path: req.params.path, content });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/system/sys-file/:path(*)', async (req, res) => {
  try {
    const { value } = req.body;
    await systemAccess.writeSysFile(req.params.path, value);
    res.json({ success: true, path: req.params.path });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get system info
app.get('/api/info', async (req, res) => {
  try {
    const rootStatus = systemAccess.hasRootAccess();
    const systemInfo = await systemAccess.getSystemInfo().catch(() => null);
    
    res.json({
      platform: process.platform,
      arch: process.arch,
      shell: getShell(),
      homeDir: os.homedir(),
      cwd: process.cwd(),
      nodeVersion: process.version,
      activeSessions: activeSessions.size,
      hostname: os.hostname(),
      username: os.userInfo().username,
      hasRootAccess: rootStatus,
      systemInfo: systemInfo
    });
  } catch (error) {
    res.json({
      platform: process.platform,
      arch: process.arch,
      shell: getShell(),
      homeDir: os.homedir(),
      cwd: process.cwd(),
      nodeVersion: process.version,
      activeSessions: activeSessions.size,
      hostname: os.hostname(),
      username: os.userInfo().username,
      hasRootAccess: false,
      error: error.message
    });
  }
});

// Get root access status
app.get('/api/system/root-status', (req, res) => {
  res.json({
    hasRootAccess: systemAccess.hasRootAccess(),
    platform: process.platform
  });
});

// Credential management endpoints
app.post('/api/system/credentials/store', async (req, res) => {
  try {
    const { operationId, credential } = req.body;
    await credentialManager.storeCredential(operationId, credential);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/system/credentials/:operationId', async (req, res) => {
  try {
    const credential = await credentialManager.getCredential(req.params.operationId);
    res.json({ success: true, credential });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/system/credentials/:operationId', async (req, res) => {
  try {
    await credentialManager.clearCredential(req.params.operationId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/system/credentials', async (req, res) => {
  try {
    await credentialManager.clearAll();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve generated HTML for SPA routing (HTML is generated by Vite from TypeScript)
app.get('*', (req, res) => {
  // HTML is now generated by TypeScript, served by Vite build
  const indexPath = path.join(__dirname, '../web/dist/index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // Fallback: generate HTML on the fly
    const base = '/';
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Clay Terminal</title>
</head>
<body>
  <div id="app-root"></div>
  <script type="module" src="${base}src/main.ts"></script>
</body>
</html>`);
  }
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Clay Terminal Backend running on http://0.0.0.0:${PORT}`);
  console.log(`📡 WebSocket server ready at ws://localhost:${PORT}/ws`);
  console.log(`💻 Shell: ${getShell()}`);
  console.log(`🏠 Home directory: ${os.homedir()}`);
});

