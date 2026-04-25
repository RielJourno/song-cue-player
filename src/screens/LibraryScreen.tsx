import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { getDurationFromBlob } from '../utils';
import type { Song } from '../types';
import SongRow from '../components/SongRow';
import Toast from '../components/Toast';

export default function LibraryScreen() {
  const { songs, loading, loadSongs, addSong, updateSong, removeSong } = useStore();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadSongs();
  }, [loadSongs]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';
    if (!file) return;

    setUploading(true);
    try {
      const blob = file.slice(0, file.size, file.type);
      const mimeType = file.type || 'audio/mpeg';
      const duration = await getDurationFromBlob(blob, mimeType);
      const title = file.name.replace(/\.[^/.]+$/, '');
      const song: Song = {
        id: crypto.randomUUID(),
        title,
        audioBlob: blob,
        mimeType,
        duration,
        cues: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await addSong(song);
      navigate(`/song/${song.id}`);
    } catch {
      showToast('Could not read audio file. Try a different format.');
    } finally {
      setUploading(false);
    }
  }

  async function handleRename(song: Song, newTitle: string) {
    await updateSong({ ...song, title: newTitle, updatedAt: Date.now() });
  }

  async function handleDelete(song: Song) {
    await removeSong(song.id);
    showToast(`"${song.title}" deleted`);
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="flex items-center px-5 pt-4 pb-3 border-b border-white/10">
        <h1 className="text-2xl font-bold tracking-tight text-white">Cue</h1>
      </header>

      {/* Song list */}
      <main className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-8 text-center gap-3">
            <div className="text-5xl">♪</div>
            <p className="text-white/50 text-base">No songs yet.</p>
            <p className="text-white/30 text-sm">Tap + to add your first.</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/10">
            {songs.map((song) => (
              <SongRow
                key={song.id}
                song={song}
                onTap={() => navigate(`/song/${song.id}`)}
                onRename={(title) => handleRename(song, title)}
                onDelete={() => handleDelete(song)}
              />
            ))}
          </ul>
        )}
      </main>

      {/* FAB */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="fixed bottom-6 right-5 w-14 h-14 rounded-full bg-amber-500 text-black flex items-center justify-center text-3xl font-light shadow-lg active:scale-95 transition-transform disabled:opacity-50"
        aria-label="Add song"
        style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        {uploading ? (
          <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
        ) : (
          <span className="leading-none mb-0.5">+</span>
        )}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.m4a,.aac,.wav,.flac,.ogg,.opus"
        className="hidden"
        onChange={handleFileChange}
      />

      {toast && <Toast message={toast} />}
    </div>
  );
}
