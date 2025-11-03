#!/usr/bin/env node

// Clay Terminal Bridge Server
// Runs locally to provide real system command execution and filesystem access

import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import cors from 'cors';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import pty from 'node-pty';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);

const app = express();
const server = createServer(app);

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Get shell based on OS
function getShell() {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'cmd.exe';
  } else if (process.platform === 'darwin') {
    return process.env.SHELL || '/bin/zsh';
  } else {
    return process.env.SHELL || '/bin/bash';
  }
}

// Store active processes (PTY sessions or spawn processes)
const activeProcesses = new Map();

// WebSocket server for terminal connections
const wss = new WebSocketServer({ 
  server,
  path: '/ws'
});

wss.on('connection', (ws, req) => {
  console.log('New WebSocket connection from:', req.socket.remoteAddress);
  
  let shellProcess = null;
  let sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // Create PTY session for real terminal emulation
    const shell = getShell();
    const cols = 80;
    const rows = 24;
    
    // Use node-pty for proper terminal emulation
    try {
      shellProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: cols,
        rows: rows,
        cwd: os.homedir(),
        env: process.env
      });
      
      activeProcesses.set(sessionId, shellProcess);
      
      // Send connection confirmation
      ws.send(JSON.stringify({
        type: 'connected',
        sessionId: sessionId,
        shell: shell,
        cwd: os.homedir(),
        platform: process.platform
      }));
      
      // Handle PTY output
      shellProcess.onData((data) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({
            type: 'output',
            sessionId: sessionId,
            data: data
          }));
        }
      });
      
      // Handle PTY exit
      shellProcess.onExit((code, signal) => {
        console.log(`PTY session ${sessionId} exited with code ${code}, signal ${signal}`);
        activeProcesses.delete(sessionId);
        
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({
            type: 'exit',
            sessionId: sessionId,
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
              if (shellProcess) {
                shellProcess.write(data.data);
              }
              break;
              
            case 'resize':
              if (shellProcess) {
                shellProcess.resize(data.cols || 80, data.rows || 24);
              }
              break;
              
            case 'kill':
              if (shellProcess) {
                shellProcess.kill();
                activeProcesses.delete(sessionId);
              }
              break;
              
            default:
              console.warn('Unknown message type:', data.type);
          }
        } catch (error) {
          console.error('Error handling message:', error);
        }
      });
    } catch (ptyError) {
      // Fallback to spawn if node-pty fails
      console.warn('node-pty not available, using spawn fallback:', ptyError);
      const isWindows = process.platform === 'win32';
      
      if (isWindows) {
        shellProcess = spawn(shell, [], {
          cwd: os.homedir(),
          env: process.env,
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true
        });
      } else {
        shellProcess = spawn(shell, ['-l'], {
          cwd: os.homedir(),
          env: process.env,
          stdio: ['pipe', 'pipe', 'pipe']
        });
      }
      
      activeProcesses.set(sessionId, shellProcess);
      
      ws.send(JSON.stringify({
        type: 'connected',
        sessionId: sessionId,
        shell: shell,
        cwd: os.homedir(),
        platform: process.platform
      }));
      
      shellProcess.stdout.on('data', (data) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({
            type: 'output',
            sessionId: sessionId,
            data: data.toString()
          }));
        }
      });
      
      shellProcess.stderr.on('data', (data) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({
            type: 'output',
            sessionId: sessionId,
            data: data.toString()
          }));
        }
      });
      
      shellProcess.on('exit', (code, signal) => {
        console.log(`Shell session ${sessionId} exited with code ${code}, signal ${signal}`);
        activeProcesses.delete(sessionId);
        
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({
            type: 'exit',
            sessionId: sessionId,
            code: code,
            signal: signal
          }));
        }
      });
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          
          switch (data.type) {
            case 'input':
              if (shellProcess && shellProcess.stdin) {
                shellProcess.stdin.write(data.data);
              }
              break;
              
            case 'resize':
              // Resize not supported in spawn fallback
              break;
              
            case 'kill':
              if (shellProcess) {
                shellProcess.kill();
                activeProcesses.delete(sessionId);
              }
              break;
              
            default:
              console.warn('Unknown message type:', data.type);
          }
        } catch (error) {
          console.error('Error handling message:', error);
        }
      });
    }
    
    // Handle client disconnect
    ws.on('close', () => {
      console.log(`WebSocket connection closed for session ${sessionId}`);
      if (shellProcess) {
        try {
          shellProcess.kill();
        } catch (e) {
          // Ignore errors
        }
        activeProcesses.delete(sessionId);
      }
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      if (shellProcess) {
        try {
          shellProcess.kill();
        } catch (e) {
          // Ignore errors
        }
        activeProcesses.delete(sessionId);
      }
    });
    
  } catch (error) {
    console.error('Error creating shell session:', error);
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  }
});

// REST API endpoints for command execution
app.post('/api/execute', async (req, res) => {
  const { command, cwd } = req.body;
  
  if (!command) {
    return res.status(400).json({ error: 'Command is required' });
  }
  
  try {
    const workingDir = cwd || os.homedir();
    
    // Execute command with full shell
    const shell = getShell();
    const isWindows = process.platform === 'win32';
    
    let fullCommand = command;
    if (!isWindows) {
      // For Unix-like systems, use shell -c
      fullCommand = `${shell} -c ${JSON.stringify(command)}`;
    }
    
    const { stdout, stderr } = await execAsync(fullCommand, {
      cwd: workingDir,
      env: process.env,
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });
    
    res.json({
      success: true,
      output: stdout || stderr || '',
      exitCode: stderr ? 1 : 0
    });
  } catch (error) {
    res.json({
      success: false,
      output: error.message || String(error),
      exitCode: error.code || 1
    });
  }
});

// Filesystem operations
app.get('/api/fs/read', async (req, res) => {
  const { path: filePath } = req.query;
  
  if (!filePath) {
    return res.status(400).json({ error: 'Path is required' });
  }
  
  try {
    const resolvedPath = path.resolve(filePath);
    const stats = await fs.promises.stat(resolvedPath);
    
    if (stats.isDirectory()) {
      const files = await fs.promises.readdir(resolvedPath);
      res.json({ type: 'directory', files });
    } else {
      const content = await fs.promises.readFile(resolvedPath, 'utf-8');
      res.json({ type: 'file', content });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/fs/write', async (req, res) => {
  const { path: filePath, content } = req.body;
  
  if (!filePath || content === undefined) {
    return res.status(400).json({ error: 'Path and content are required' });
  }
  
  try {
    const resolvedPath = path.resolve(filePath);
    await fs.promises.writeFile(resolvedPath, content, 'utf-8');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/fs/stat', async (req, res) => {
  const { path: filePath } = req.query;
  
  if (!filePath) {
    return res.status(400).json({ error: 'Path is required' });
  }
  
  try {
    const resolvedPath = path.resolve(filePath);
    const stats = await fs.promises.stat(resolvedPath);
    res.json({
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      size: stats.size,
      mtime: stats.mtime.toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get system info
app.get('/api/info', (req, res) => {
  res.json({
    platform: process.platform,
    arch: process.arch,
    shell: getShell(),
    homeDir: os.homedir(),
    cwd: process.cwd(),
    nodeVersion: process.version,
    activeSessions: activeProcesses.size,
    hostname: os.hostname(),
    username: os.userInfo().username
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    platform: process.platform,
    pid: process.pid
  });
});

// Serve a simple status page
app.get('/', (req, res) => {
  res.json({
    name: 'Clay Terminal Bridge',
    status: 'running',
    version: '1.0.0',
    platform: process.platform,
    endpoints: {
      websocket: '/ws',
      execute: 'POST /api/execute',
      filesystem: 'GET /api/fs/*',
      info: 'GET /api/info',
      health: 'GET /api/health'
    }
  });
});

const PORT = process.env.PORT || 8765;
const HOST = process.env.HOST || '127.0.0.1';

server.listen(PORT, HOST, () => {
  console.log(`🚀 Clay Terminal Bridge running on http://${HOST}:${PORT}`);
  console.log(`📡 WebSocket server ready at ws://${HOST}:${PORT}/ws`);
  console.log(`💻 Shell: ${getShell()}`);
  console.log(`🏠 Home directory: ${os.homedir()}`);
  console.log(`🖥️  Platform: ${process.platform}`);
  console.log(`\n✨ Ready to execute real system commands!`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Clay Terminal Bridge...');
  activeProcesses.forEach((proc) => {
    try {
      proc.kill();
    } catch (e) {
      // Ignore errors
    }
  });
  activeProcesses.clear();
  server.close(() => {
    console.log('✅ Bridge server stopped');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  activeProcesses.forEach((proc) => {
    try {
      proc.kill();
    } catch (e) {
      // Ignore errors
    }
  });
  server.close(() => {
    process.exit(0);
  });
});

