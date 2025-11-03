# Deploying Clay Terminal Web

## Quick Start

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000

## Build for Production

```bash
npm run build
```

Output will be in `web/dist/`

## Deploy to Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. From the `web/` directory: `vercel`
3. Follow prompts to deploy

## Deploy to Netlify

1. Install Netlify CLI: `npm i -g netlify-cli`
2. From the `web/` directory: `netlify deploy --prod`
3. Follow prompts

## Deploy to GitHub Pages

1. Update `vite.config.ts` to set `base: '/repository-name/'`
2. Build: `npm run build`
3. Push `dist/` folder to `gh-pages` branch

## PWA Installation

Once deployed, users can:
1. Visit the site
2. Click install button in browser
3. Or use the "Install" button in the app
4. On Chromebook: Opens as standalone app

## WebVM Integration

The current implementation uses a simulated WebVM. To integrate actual WebVM:

1. Load WebVM WebAssembly module
2. Initialize Linux filesystem
3. Run Node.js + Socket.io inside WebVM
4. Connect terminal frontend to WebVM Socket.io server

The architecture allows for this upgrade path without changing the frontend code.

