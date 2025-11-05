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
import * as systemAccess from '../backend/system-access.js';
import { chromeOSAPIs } from '../backend/privileged-apis.js';
import { settingsUnlocker } from '../backend/chromeos-settings-unlocker.js';
import { filesystemScanner } from '../backend/filesystem-scanner.js';
import { nativeMessaging } from '../backend/chromeos-native-messaging.js';

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
    // For ChromeOS/Linux, prefer bash
    return process.env.SHELL || '/bin/bash';
  }
}

// Check if running on ChromeOS
function isChromeOS() {
  // Check for ChromeOS-specific environment
  return process.env.CHROMEOS === '1' || 
         process.platform === 'linux' && 
         (fs.existsSync('/etc/lsb-release') && 
          fs.readFileSync('/etc/lsb-release', 'utf8').includes('CHROMEOS'));
}

// Get ChromeOS Linux Files path
function getLinuxFilesPath() {
  if (!isChromeOS()) return null;
  
  const possiblePaths = [
    '/mnt/chromeos/MyFiles/LinuxFiles',
    os.homedir() + '/LinuxFiles',
    os.homedir() + '/MyFiles/LinuxFiles'
  ];
  
  for (const path of possiblePaths) {
    try {
      if (fs.existsSync(path) && fs.statSync(path).isDirectory()) {
        return path;
      }
    } catch (e) {
      // Continue checking other paths
    }
  }
  
  return null;
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
  const { command, cwd, root = false, privileged = false } = req.body;
  
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
      result = await execAsync(fullCommand, {
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

// Save file to Linux Files (ChromeOS)
app.post('/api/save-to-linux-files', async (req, res) => {
  const { content, filename } = req.body;
  
  if (!content || !filename) {
    return res.status(400).json({ error: 'Content and filename are required' });
  }
  
  try {
    const linuxFilesPath = getLinuxFilesPath();
    if (!linuxFilesPath) {
      return res.status(404).json({ error: 'Linux Files folder not found' });
    }
    
    const fullPath = path.join(linuxFilesPath, filename);
    
    // Ensure directory exists
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write file
    fs.writeFileSync(fullPath, content, 'utf8');
    
    res.json({
      success: true,
      path: fullPath,
      message: `File saved to ${fullPath}`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
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

// System-level API endpoints
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

app.get('/api/system/kernel-param', async (req, res) => {
  const { param } = req.query;
  
  if (!param) {
    return res.status(400).json({ error: 'Parameter name is required' });
  }
  
  try {
    const value = await systemAccess.readKernelParam(param);
    res.json({ success: true, param, value });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/system/kernel-param', async (req, res) => {
  const { param, value } = req.body;
  
  if (!param || value === undefined) {
    return res.status(400).json({ error: 'Parameter name and value are required' });
  }
  
  try {
    await systemAccess.writeKernelParam(param, value);
    res.json({ success: true, param, value });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/system/sys-file', async (req, res) => {
  const { path: filePath } = req.query;
  
  if (!filePath) {
    return res.status(400).json({ error: 'Path is required' });
  }
  
  try {
    const value = await systemAccess.readSysFile(filePath);
    res.json({ success: true, path: filePath, value });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/system/info', async (req, res) => {
  try {
    const info = await systemAccess.getSystemInfo();
    res.json({ success: true, ...info });
  } catch (error) {
    res.json({
      success: true,
      platform: process.platform,
      arch: process.arch,
      hostname: os.hostname(),
      username: os.userInfo().username,
      hasRootAccess: systemAccess.hasRootAccess(),
      error: error.message
    });
  }
});

app.get('/api/system/root-status', (req, res) => {
  res.json({
    hasRootAccess: systemAccess.hasRootAccess(),
    platform: process.platform,
    uid: process.getuid ? process.getuid() : null
  });
});

// ChromeOS privileged API endpoints
app.get('/api/chromeos/system-info', async (req, res) => {
  try {
    const info = await chromeOSAPIs.getSystemInfo();
    res.json({ success: true, ...info });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/chromeos/processes', async (req, res) => {
  try {
    const processes = await chromeOSAPIs.getProcesses();
    res.json({ success: true, processes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/chromeos/processes/kill', async (req, res) => {
  const { pid } = req.body;
  if (!pid) {
    return res.status(400).json({ error: 'PID is required' });
  }
  
  try {
    await chromeOSAPIs.killProcess(pid);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/chromeos/diagnostics', async (req, res) => {
  try {
    const diagnostics = await chromeOSAPIs.runDiagnostics();
    res.json({ success: true, ...diagnostics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/chromeos/hardware', async (req, res) => {
  try {
    const hardware = await chromeOSAPIs.getHardwareInfo();
    res.json({ success: true, ...hardware });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/chromeos/network', async (req, res) => {
  try {
    const interfaces = await chromeOSAPIs.getNetworkInterfaces();
    res.json({ success: true, interfaces });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/chromeos/paths', async (req, res) => {
  try {
    const paths = await chromeOSAPIs.getChromeOSPaths();
    res.json({ success: true, paths });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/chromeos/developer-mode', async (req, res) => {
  try {
    const enabled = await chromeOSAPIs.enableDeveloperFeatures();
    res.json({ success: enabled });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/chromeos/bypass-security', async (req, res) => {
  try {
    const bypassed = await chromeOSAPIs.bypassSecurityRestrictions();
    res.json({ success: bypassed });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/chromeos/enterprise', async (req, res) => {
  try {
    const enterprise = await chromeOSAPIs.getEnterpriseInfo();
    res.json({ success: true, ...enterprise });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Native messaging installation endpoint
app.post('/api/chromeos/native-messaging/install', async (req, res) => {
  try {
    await nativeMessaging.installManifest();
    res.json({ success: true, message: 'Native messaging host installed' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/chromeos/native-messaging/status', (req, res) => {
  try {
    const manifestPath = '/etc/opt/chrome/native-messaging-hosts/clay_terminal.json';
    const installed = fs.existsSync(manifestPath);
    res.json({ success: true, installed, path: manifestPath });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ChromeOS Settings Unlocker endpoints
app.get('/api/chromeos/settings/list', (req, res) => {
  try {
    const settings = settingsUnlocker.getAvailableSettings();
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/chromeos/settings/status', async (req, res) => {
  try {
    const status = await settingsUnlocker.getSettingsStatus();
    res.json({ success: true, ...status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/chromeos/settings/toggle', async (req, res) => {
  const { setting } = req.body;
  
  if (!setting) {
    return res.status(400).json({ error: 'Setting ID is required' });
  }
  
  try {
    let result = false;
    let enabled = false;
    
    switch (setting) {
      case 'linux-env':
        result = await settingsUnlocker.enableLinuxEnvironment();
        enabled = result;
        break;
      case 'adb':
        result = await settingsUnlocker.enableADB();
        enabled = result;
        break;
      case 'guest-mode':
        result = await settingsUnlocker.enableGuestMode();
        enabled = result;
        break;
      case 'developer-mode':
        result = await settingsUnlocker.enableDeveloperMode();
        enabled = result;
        break;
      case 'user-accounts':
        result = await settingsUnlocker.enableUserAccountManagement();
        enabled = result;
        break;
      case 'developer-features':
        result = await settingsUnlocker.enableAllDeveloperFeatures();
        enabled = result;
        break;
      case 'bypass-enrollment':
        result = await settingsUnlocker.bypassEnrollment();
        enabled = result;
        break;
      case 'all-settings':
        result = await settingsUnlocker.enableAllSettings();
        enabled = result;
        break;
      default:
        return res.status(400).json({ error: 'Unknown setting' });
    }
    
    res.json({ success: result, enabled });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/chromeos/settings/enable-all', async (req, res) => {
  try {
    const result = await settingsUnlocker.enableAllSettings();
    res.json({ success: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Filesystem Scanner endpoints
app.post('/api/filesystem/scan', async (req, res) => {
  const { path: scanPath = '/', maxDepth = 10, excludePaths = [] } = req.body;
  
  try {
    const result = await filesystemScanner.scanFilesystem(scanPath, maxDepth, excludePaths);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/filesystem/scan/progress', (req, res) => {
  try {
    const progress = filesystemScanner.getScanProgress();
    res.json({ success: true, progress });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/filesystem/scan/cache', (req, res) => {
  const { path: scanPath = '/' } = req.query;
  
  try {
    const cached = filesystemScanner.getCachedScan(scanPath as string);
    if (cached) {
      res.json({ success: true, ...cached });
    } else {
      res.json({ success: false, message: 'No cached scan found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/filesystem/summary', async (req, res) => {
  const { path: summaryPath = '/' } = req.query;
  
  try {
    const summary = await filesystemScanner.getFilesystemSummary(summaryPath as string);
    res.json({ success: true, ...summary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/filesystem/scan/directory', async (req, res) => {
  const { path: dirPath, maxDepth = 5 } = req.body;
  
  if (!dirPath) {
    return res.status(400).json({ error: 'Directory path is required' });
  }
  
  try {
    const result = await filesystemScanner.scanDirectory(dirPath, maxDepth);
    res.json({ success: true, ...result });
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
      activeSessions: activeProcesses.size,
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
    activeSessions: activeProcesses.size,
    hostname: os.hostname(),
      username: os.userInfo().username,
      hasRootAccess: false,
      error: error.message
  });
  }
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

