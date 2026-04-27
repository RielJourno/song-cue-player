import { create } from 'zustand';
import type { Song, SharedSongJSON } from './types';
import { getAllSongs, saveSong as dbSaveSong, deleteSong as dbDeleteSong } from './db';

interface AppState {
  songs: Song[];
  sharedSong: Song | null;
  loading: boolean;
  loadSongs: () => Promise<void>;
  addSong: (song: Song) => Promise<void>;
  updateSong: (song: Song) => Promise<void>;
  removeSong: (id: string) => Promise<void>;
  // Updates shared song in memory only (author mode — not persisted to JSON)
  updateSharedSongCues: (updated: Song) => void;
}

async function fetchSharedSong(): Promise<Song | null> {
  try {
    const res = await fetch('/cues.json');
    if (!res.ok) return null;
    const data: SharedSongJSON = await res.json();
    return {
      id: data.id,
      title: data.title,
      source: 'shared',
      audioUrl: data.audioUrl,
      mimeType: 'audio/mpeg',
      duration: data.duration,
      cues: data.cues,
      createdAt: data.updatedAt,
      updatedAt: data.updatedAt,
    };
  } catch {
    return null;
  }
}

export const useStore = create<AppState>((set, get) => ({
  songs: [],
  sharedSong: null,
  loading: false,

  loadSongs: async () => {
    set({ loading: true });
    const [localSongs, shared] = await Promise.all([getAllSongs(), fetchSharedSong()]);
    set({ songs: localSongs, sharedSong: shared, loading: false });
  },

  addSong: async (song) => {
    await dbSaveSong(song);
    set({ songs: [song, ...get().songs] });
  },

  updateSong: async (song) => {
    await dbSaveSong(song);
    set({ songs: get().songs.map((s) => (s.id === song.id ? song : s)) });
  },

  removeSong: async (id) => {
    await dbDeleteSong(id);
    set({ songs: get().songs.filter((s) => s.id !== id) });
  },

  updateSharedSongCues: (updated) => {
    set({ sharedSong: updated });
  },
}));
