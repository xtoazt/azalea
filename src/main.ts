import { app, BrowserWindow, ipcMain } from 'electron';
import { spawn, exec, ChildProcess } from 'child_process';
import * as path from 'path';
import * as os from 'os';

let mainWindow: BrowserWindow | null = null;
const activeProcesses = new Map<number, ChildProcess>();

function createWindow(): void {
  const rendererPath = path.join(__dirname, '../renderer/index.html');
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#000000',
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  mainWindow.loadFile(rendererPath);

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Clean up all active processes
    activeProcesses.forEach((proc) => {
      try {
        proc.kill();
      } catch (e) {
        // Ignore errors
      }
    });
    activeProcesses.clear();
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Clean up processes before quitting
  activeProcesses.forEach((proc) => {
    try {
      proc.kill();
    } catch (e) {
      // Ignore errors
    }
  });
  activeProcesses.clear();
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Get the default shell
function getShell(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'cmd.exe';
  }
  return process.env.SHELL || '/bin/bash';
}

// IPC Handlers for simple command execution (non-interactive)
ipcMain.handle('execute-command', async (event, command: string, cwd?: string) => {
  return new Promise((resolve) => {
    const shellCmd = getShell();
    const isWindows = process.platform === 'win32';
    
    let execCommand = command;
    if (!isWindows) {
      execCommand = `${shellCmd} -c ${JSON.stringify(command)}`;
    }
    
    exec(execCommand, {
      cwd: cwd || process.cwd(),
      env: { ...process.env },
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
    }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          success: false,
          output: stderr || error.message,
          exitCode: error.code || 1,
        });
      } else {
        resolve({
          success: true,
          output: stdout || stderr, // Some commands output to stderr
          exitCode: 0,
        });
      }
    });
  });
});

// IPC Handler for streaming/interactive commands
ipcMain.handle('execute-command-stream', async (event, command: string, cwd?: string) => {
  return new Promise((resolve) => {
    const shellCmd = getShell();
    const isWindows = process.platform === 'win32';
    
    let args: string[] = [];
    if (!isWindows) {
      args = ['-c', command];
    } else {
      args = ['/c', command];
    }
    
    const child = spawn(isWindows ? shellCmd : shellCmd, args, {
      cwd: cwd || process.cwd(),
      env: { ...process.env },
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (child.pid) {
      activeProcesses.set(child.pid, child);
    }

    const result = {
      pid: child.pid || 0,
      onOutput: (callback: (data: string) => void) => {
        child.stdout?.on('data', (data) => callback(data.toString()));
        child.stderr?.on('data', (data) => callback(data.toString()));
      },
      onClose: (callback: (code: number) => void) => {
        child.on('close', (code) => {
          if (child.pid) {
            activeProcesses.delete(child.pid);
          }
          callback(code || 0);
        });
      },
      write: (input: string) => {
        if (child.stdin && !child.stdin.destroyed) {
          child.stdin.write(input);
        }
      },
      kill: () => {
        if (child.pid) {
          activeProcesses.delete(child.pid);
        }
        child.kill();
      },
    };

    resolve(result);
  });
});

ipcMain.handle('get-current-directory', () => {
  return process.cwd();
});

ipcMain.handle('change-directory', (event, dir: string) => {
  try {
    const homeDir = os.homedir();
    let targetDir = dir;
    
    // Handle ~ expansion
    if (dir.startsWith('~')) {
      targetDir = dir.replace('~', homeDir);
    }
    
    process.chdir(targetDir);
    return { success: true, cwd: process.cwd() };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-home-directory', () => {
  return os.homedir();
});

ipcMain.handle('get-platform', () => {
  return process.platform;
});

// Handle window controls
ipcMain.handle('window-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('window-close', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});
