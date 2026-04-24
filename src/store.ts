import { create } from 'zustand';
import type { Song } from './types';
import { getAllSongs, saveSong as dbSaveSong, deleteSong as dbDeleteSong } from './db';

interface AppState {
  songs: Song[];
  loading: boolean;
  loadSongs: () => Promise<void>;
  addSong: (song: Song) => Promise<void>;
  updateSong: (song: Song) => Promise<void>;
  removeSong: (id: string) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  songs: [],
  loading: false,

  loadSongs: async () => {
    set({ loading: true });
    const songs = await getAllSongs();
    set({ songs, loading: false });
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
}));
