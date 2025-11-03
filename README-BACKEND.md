# Clay Terminal - Backend Setup

## Quick Start

The backend needs to run locally on your machine to provide real terminal access.

### Option 1: Manual Start (Recommended)

1. **Start the backend:**
   ```bash
   cd backend
   npm install
   npm start
   ```

2. **Open the terminal:**
   - If running locally: `http://localhost:3000`
   - If deployed: The frontend will automatically try to connect to `http://localhost:3000`

### Option 2: Auto-Start Script

1. **Make the script executable:**
   ```bash
   chmod +x start.sh
   ```

2. **Run the startup script:**
   ```bash
   ./start.sh
   ```

This will start both backend and frontend automatically.

### Option 3: Development Mode

For development with auto-reload:

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd web
npm run dev
```

## Configuration

### Change Port

Set the `PORT` environment variable:

```bash
PORT=8080 npm start
```

### Custom Backend URL

If your backend runs on a different URL, set environment variables when building:

```bash
cd web
VITE_API_URL=http://your-backend-url:3000 npm run build
```

## Troubleshooting

### Backend not connecting

1. Check if backend is running:
   ```bash
   curl http://localhost:3000/api/health
   ```

2. Check firewall settings - port 3000 must be accessible

3. For ChromeOS: Make sure Linux (Beta) is enabled and the backend is running in the Linux container

### Permission Errors

If you get permission errors, make sure:
- Node.js has proper permissions
- The backend directory is writable
- Port 3000 is not in use by another application

## Security Note

⚠️ **Important**: The backend executes commands on your system. Only run this on trusted networks or localhost.

