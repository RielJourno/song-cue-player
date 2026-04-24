# Cue — Song Cue Player

Set timestamp markers in songs and jump to them instantly during dance rehearsals.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Build & deploy

```bash
npm run build
```

This produces a `dist/` folder of static files. Deploy to any static host:

**Vercel (recommended)**
```bash
npm i -g vercel
vercel --prod
```

**Netlify**
```bash
npm i -g netlify-cli
netlify deploy --prod --dir dist
```

**Cloudflare Pages / GitHub Pages**: drag and drop the `dist/` folder, or connect the repo and set build command to `npm run build` with output directory `dist`.

## Install as PWA on iPhone

1. Open the app URL in **Safari** (not Chrome)
2. Tap the **Share** button (box with arrow)
3. Tap **Add to Home Screen**
4. Tap **Add**

The app opens without browser chrome and works fully offline.

## Stack

- React 18 + Vite + TypeScript
- Tailwind CSS
- React Router
- Zustand
- IndexedDB via `idb`
- `vite-plugin-pwa` (service worker + manifest)

## Data model

All audio and cue data is stored locally in IndexedDB (`cue-db`). No backend, no accounts.
Songs survive browser restarts and work in airplane mode.
