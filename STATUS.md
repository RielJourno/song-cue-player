# Project Status

Last updated: 2026-04-27

## What this app does

Cue is a browser-based PWA for setting named timestamp markers (cues) in audio files and jumping to them instantly during live events such as dance rehearsals. The user uploads an MP3 or other audio file, marks positions while listening, labels them, and taps a button to jump to any position mid-performance. Everything is stored locally in the browser — no accounts, no server.

## Current state

v1 shipped. Deployed via Vercel from GitHub repo `RielJourno/song-cue-player`. Live URL not confirmed in this session — user connected Vercel to GitHub after this document was written; check vercel.com dashboard for the current production URL.

## Tech stack

**Framework:** React 19.2, Vite 8.0, TypeScript 6.0
**Routing:** react-router-dom 7.14
**State:** Zustand 5.0
**Storage:** idb 8.0 (IndexedDB wrapper)
**Styling:** Tailwind CSS 4.2 (via @tailwindcss/vite plugin)
**PWA:** vite-plugin-pwa 1.2 (service worker + web manifest)
**Build:** tsc + vite build; output to dist/

Note: vite-plugin-pwa 1.2 does not officially declare support for Vite 8. Installed with `legacy-peer-deps=true` (see .npmrc). Has worked in practice but watch for breakage on dependency updates.

## File structure

```
src/
  App.tsx              — Route definitions (/ and /song/:id)
  main.tsx             — React root, BrowserRouter wrapper
  index.css            — Global reset, Tailwind import, dark background
  types.ts             — Song and Cue TypeScript types
  db.ts                — IndexedDB access via idb (getAllSongs, getSong, saveSong, deleteSong)
  store.ts             — Zustand store; in-memory song list + DB write-through
  utils.ts             — formatTime, parseTimeInput, getDurationFromBlob
  screens/
    LibraryScreen.tsx  — Song list, file upload FAB, rename/delete via long-press
    SongScreen.tsx     — Audio playback, cue management, import/export
  components/
    SongRow.tsx        — Single row in library list with long-press context menu
    Toast.tsx          — Transient notification banner
```

## Data model

```ts
type Cue = {
  id: string;          // crypto.randomUUID()
  label: string;
  timeSeconds: number;
};

type Song = {
  id: string;          // crypto.randomUUID()
  title: string;
  audioBlob: Blob;     // full audio file stored in IndexedDB
  mimeType: string;
  duration: number;    // seconds
  cues: Cue[];         // sorted by timeSeconds on every write
  createdAt: number;   // Date.now()
  updatedAt: number;
  lastPlayedAt?: number;
};
```

IndexedDB: database name `cue-db`, version 1, single object store `songs` with keyPath `id`. No indexes. Audio blob stored inline in the Song record.

## Features that work

- Upload audio file from device (tested: MP3 on desktop Chrome)
- Audio stored in IndexedDB, persists across sessions
- Playback: play/pause, scrub via range input, time display updates via requestAnimationFrame
- Add cue at current playback position; inline label editor opens immediately
- Tap cue button to jump to that timestamp and start playing
- Cue buttons show label + formatted timestamp
- Amber tick marks on progress bar at each cue position
- Edit cue (label + time) via inline expand on cue row
- Delete cue via inline expand on cue row
- Add cue manually via dialog (label + mm:ss input)
- Import cues from pasted text (format: `1:23 Label`, one per line)
- Export cues to clipboard (format matches import; shows "Copied!" toast)
- Rename song (tap title inline)
- Delete song from song screen options sheet
- Rename and delete song from library long-press menu
- Song list sorted by last played, then created
- Library shows cue count and duration per song
- PWA manifest configured (standalone display, dark theme, icons)
- Service worker registered (offline app shell)
- Wake Lock acquired on play, released on pause
- Safe area insets applied for notched phones

## Features that are partial or broken

- **iOS audio playback:** Two fixes applied (explicit `audio.load()` on src change, sync `play()` call). Untested on a physical iOS device after the fix — may still have issues.
- **iOS file picker:** `accept` attribute includes explicit extensions (`.mp3,.m4a,.aac`, etc.) but behavior depends on iOS version and Safari. Untested after the fix.
- **PWA install on iOS:** Manifest and apple-mobile-web-app meta tags are present. Actual install flow on iPhone (Safari share sheet) not verified.
- **Wake Lock:** API is not supported in all browsers (e.g. Firefox desktop, iOS Safari). The code catches the error silently, so screen may still lock during playback in unsupported browsers.
- **Cue ticks on progress bar:** Rendered as absolutely positioned divs. On very short or very long songs the positioning math may be slightly off at the edges.
- **Export on iOS:** Uses `navigator.clipboard.writeText`. Clipboard API requires a secure context (HTTPS) and may be blocked in some iOS WebViews. No fallback beyond a toast error.

## Known issues and tech debt

- `vite-plugin-pwa` peer dep conflict with Vite 8 suppressed by `.npmrc legacy-peer-deps=true`. Should be resolved by upgrading to a compatible plugin version when available.
- PWA icons are programmatically generated PNGs (Python script, simple geometric shape). Not proper app icons — no branding, no adaptive icon variants for Android.
- `apple-touch-icon.png` is a copy of the 192px icon, not a purpose-built 180px icon.
- `SongScreen.tsx` is large (~600 lines). Dialogs (edit cue, manual add, import) are all inline. Should be split into components if the file grows further.
- `updateSong` is called with `lastPlayedAt` on every navigation to a song screen, even if the song was just created. This is a minor unnecessary write.
- No error boundary. An IndexedDB failure or corrupt blob will crash the screen with no recovery path.
- The `eslint-disable react-hooks/exhaustive-deps` comment on the main load effect suppresses a legitimate warning. The effect intentionally omits `updateSong` from deps to avoid a loop, but this is fragile.
- No loading state shown between tapping a song in the library and audio becoming ready to play. The play button is just disabled until `audioUrl` is set.

## What I tested and what I didn't

Tested on:
- Desktop Chrome (macOS) — full flow including upload, playback, cues, import, export

Not tested on:
- iOS Safari (physical device)
- Android Chrome
- Firefox (desktop or mobile)
- Safari desktop
- PWA install flow on any device
- Files larger than ~5MB
- Audio formats other than MP3

Manual test scenarios run:
- Upload MP3, play, add cue at current time, label it, tap to jump
- Add cue manually via dialog
- Import multiple cues from pasted text
- Export cues, verify clipboard content
- Rename song, rename cue, delete cue, delete song
- Navigate back to library, return to song — state preserved

Not yet run:
- Offline usage (airplane mode after initial load)
- Closing and reopening the browser — verify IndexedDB persistence
- Multiple songs in library
- Very long songs (>10 min) or large files (>20MB)
- Screen lock behavior during playback

## How to run locally

```bash
git clone https://github.com/RielJourno/song-cue-player.git
cd song-cue-player
npm install
npm run dev
```

Open http://localhost:5173. Requires Node 18+.

## How to deploy

The repo is connected to Vercel. Every push to `main` triggers an automatic production deploy.

```bash
git add .
git commit -m "your message"
git push
```

To deploy manually: `vercel --prod` (requires Vercel CLI and login).
To build locally: `npm run build` — output goes to `dist/`.

## Open questions for the user

1. Has playback on a physical iPhone been confirmed working after the iOS fixes?
2. What is the live production URL?
3. Should the app icons be replaced with real branded assets?
4. Is there a maximum file size that should be enforced on upload? IndexedDB can handle large blobs but browser storage limits vary.
5. The import format uses `mm:ss Label`. Is that the format users will actually have, or do they copy from a different source (YouTube timestamps, etc.)?
6. Should Export write a downloadable .txt file instead of (or in addition to) clipboard copy, for cases where the clipboard API is blocked?
