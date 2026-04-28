# Project Status

Last updated: 2026-04-27

## What this app does

Cue is a browser-based PWA for setting named timestamp markers (cues) in audio files and jumping to them instantly during live events such as dance rehearsals. It ships with a shared song ("ריקוד חינה") that 16 dancers use to practice a henna ceremony choreography. Each dancer can also add their own personal cue points to the shared song, stored locally on their device. Users can additionally upload their own audio files for personal use.

## Current state

v2.1 shipped. GitHub repo: `RielJourno/song-cue-player`. Connected to Vercel for auto-deploy on push to main. Live URL: check vercel.com dashboard (not confirmed in this session).

## Tech stack

**Framework:** React 19.2, Vite 8.0, TypeScript 6.0
**Routing:** react-router-dom 7.14
**State:** Zustand 5.0
**Storage:** idb 8.0 (IndexedDB v2 — `songs` + `personalCues` stores)
**Styling:** Tailwind CSS 4.2 (via @tailwindcss/vite plugin)
**PWA:** vite-plugin-pwa 1.2 (service worker + manifest)
**Build:** tsc + vite build; output to dist/

Note: vite-plugin-pwa 1.2 does not officially declare support for Vite 8. Installed with `legacy-peer-deps=true` (.npmrc). Works in practice but watch for breakage on dep updates.

## File structure

```
public/
  audio/Hinna-Shiraz-mixdown.mp3  — Shared henna song (8.2MB), precached by SW
  cues.json                       — Shared cue definitions, read on app start
src/
  App.tsx              — Route definitions (/ and /song/:id)
  main.tsx             — React root, BrowserRouter wrapper
  index.css            — Global reset, Tailwind import, dark background
  types.ts             — Song, Cue, DisplayCue, PersonalCuesRecord, SharedSongJSON
  db.ts                — IndexedDB v2: songs + personalCues stores, CRUD functions
  store.ts             — Zustand store; fetches shared song from /cues.json on load
  utils.ts             — formatTime, parseTimeInput, getDurationFromBlob
  screens/
    LibraryScreen.tsx  — Shared song first (badge), then local songs; upload FAB
    SongScreen.tsx     — Playback, merged cue list, personal/shared cue logic, author mode
  components/
    SongRow.tsx        — Library row with long-press rename/delete (local songs only)
    Toast.tsx          — Transient notification banner
```

## Data model

```ts
type Cue = { id: string; label: string; timeSeconds: number };

// Runtime only — not persisted
type DisplayCue = Cue & { isShared: boolean };

type Song = {
  id: string;
  title: string;
  source: 'local' | 'shared';
  audioBlob?: Blob;    // local songs only
  audioUrl?: string;   // shared songs only (e.g. /audio/Hinna-Shiraz-mixdown.mp3)
  mimeType: string;
  duration: number;
  cues: Cue[];         // shared cues (from cues.json) or local song cues
  createdAt: number;
  updatedAt: number;
  lastPlayedAt?: number;
};

type PersonalCuesRecord = {
  songId: string;  // matches shared song id, e.g. "shared-henna-2026"
  cues: Cue[];
  updatedAt: number;
};
```

IndexedDB: `cue-db` v2. Store `songs` (keyPath: `id`) for local songs. Store `personalCues` (keyPath: `songId`) for per-user cues on shared songs. Shared song never written to IndexedDB — lives in Zustand memory, fetched from `/cues.json` on each app start.

`cues.json` currently has 11 cues for the henna choreography (0:40–5:33).

## Features that work

**Shared song**
- Shared "ריקוד חינה" appears first in library with "Shared" badge
- Plays via direct URL (no IndexedDB); 8.2MB MP3 precached by service worker
- Shared cues display in blue (#60a5fa) with "משותף" label on each row
- Shared cue tick marks on progress bar are blue
- Tapping ⋮ on a shared cue in non-author mode shows toast: "Cue משותף — אפשר רק לקפוץ אליו"
- Cannot rename or delete shared song from library

**Personal cues on shared song**
- "+ Add cue at X:XX", Manual, and Import all write to `personalCues` IndexedDB store
- Personal cues display in amber (#f59e0b), no badge
- Personal cue tick marks on progress bar are amber
- Shared + personal cues merged and sorted by time in a single list
- Edit and delete personal cues via inline ⋮ expand
- Personal cues persist in IndexedDB, survive app close
- Personal cues are device-local — do not sync across devices (by design for v2)

**Author mode**
- Activated by `?author=1` query param on any song URL
- Shared cues become editable (label, time, delete)
- "Author" badge shown in header
- ⋮ menu gains "Export cues.json" — copies shared cues only (never personal) as valid JSON to clipboard with toast: "Copied. Paste into public/cues.json and commit."

**Local songs**
- Upload audio via file picker; blob stored in IndexedDB
- Full playback, cue add/edit/delete, rename, delete
- Import cues from pasted text (mm:ss Label format)
- Export cues to clipboard
- All cue ticks amber

**General**
- PWA installable (manifest, service worker, apple-mobile-web-app meta)
- Wake Lock on play, release on pause
- Safe area insets for notched phones
- iOS audio: explicit `audio.load()` on src change + synchronous `play()` call

## Features that are partial or broken

- **iOS audio playback:** Fixes applied but untested on a physical iPhone after the fix.
- **iOS file picker:** Explicit MIME extensions added; untested after fix.
- **PWA install:** Meta tags and manifest in place; actual install flow on iPhone not verified.
- **Wake Lock:** Silently fails on Firefox and iOS Safari — screen may lock during playback.
- **Shared song duration:** `cues.json` sets duration to 359s. The `<audio>` element overrides this via `onLoadedMetadata`, so the progress bar is accurate after load. The stored value in JSON is informational only.

## Known issues and tech debt

- `vite-plugin-pwa` peer dep conflict with Vite 8 — suppressed via `.npmrc`. Watch on dep bumps.
- PWA icons are programmatically generated (simple geometric shape, no branding).
- `SongScreen.tsx` is ~650 lines. Dialogs are inline. Should be extracted if it grows further.
- No error boundary — IndexedDB failure or corrupt blob crashes the screen silently.
- `eslint-disable react-hooks/exhaustive-deps` on two effects in SongScreen suppresses legitimate warnings. Intentional but fragile.
- Personal cues have no cross-device sync. Dancers who switch devices lose their personal cues. Noted; out of scope for v2.
- Author mode gated only by `?author=1` — no password. Acceptable because the worst case is exporting JSON the user cannot deploy.

## What I tested and what I didn't

Tested on:
- Desktop Chrome (macOS) — full flow: shared song, personal cues, author mode, local upload

Not tested on:
- iOS Safari (physical device)
- Android Chrome
- Firefox or Safari desktop
- PWA install on any device
- Offline / airplane mode after first load
- Two devices accessing the same shared song simultaneously

Manual scenarios run:
- Shared song plays from library tap
- Add personal cue at current time, label it, tap to jump
- Add personal cue via Manual dialog
- Import personal cues from text
- Edit and delete personal cue
- Open cue list — shared (blue) and personal (amber) appear merged and sorted
- Author mode: edit shared cue label and time, export cues.json, verify JSON contains only shared cues
- Local song: upload, play, full cue lifecycle, delete

Not yet run:
- Offline playback (airplane mode)
- Closing and reopening browser — verify personal cues survive
- Multiple local songs in library
- Export cues.json → paste into file → build → confirm live update

## How to run locally

```bash
git clone https://github.com/RielJourno/song-cue-player.git
cd song-cue-player
npm install
npm run dev
```

Open http://localhost:5173. Requires Node 18+.

## How to deploy

Repo is connected to Vercel. Push to `main` auto-deploys.

```bash
git add .
git commit -m "your message"
git push
```

To update shared cues: edit `public/cues.json`, commit, push. No code change needed.

## Open questions for the user

1. Has iOS playback been confirmed working on a real device?
2. What is the live Vercel production URL?
3. Should PWA icons be replaced with real branded assets before sharing with dancers?
4. "Promote personal cue to shared" — should this exist in a future author mode update? (Not built.)
5. Should there be any in-app indication that personal cues are device-local and won't appear on other devices?
