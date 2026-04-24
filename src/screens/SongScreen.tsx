import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { getSong } from '../db';
import type { Song, Cue } from '../types';
import { formatTime, parseTimeInput } from '../utils';
import Toast from '../components/Toast';

export default function SongScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { updateSong, removeSong } = useStore();

  const [song, setSong] = useState<Song | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [cueMenu, setCueMenu] = useState<Cue | null>(null);
  const [editingCue, setEditingCue] = useState<Cue | null>(null);
  const [editCueLabel, setEditCueLabel] = useState('');
  const [editCueTime, setEditCueTime] = useState('');
  const [newInlineCue, setNewInlineCue] = useState<Cue | null>(null);
  const [showDeleteSong, setShowDeleteSong] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const animFrameRef = useRef<number>(0);
  const scrubbing = useRef(false);

  // Load song
  useEffect(() => {
    if (!id) return;
    getSong(id).then((s) => {
      if (!s) { setNotFound(true); return; }
      setSong(s);
      setTitleValue(s.title);
      setDuration(s.duration);
      const url = URL.createObjectURL(s.audioBlob);
      objectUrlRef.current = url;
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.load();
      }
      // Update lastPlayedAt
      const updated = { ...s, lastPlayedAt: Date.now() };
      updateSong(updated);
    });
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      cancelAnimationFrame(animFrameRef.current);
      releaseWakeLock();
    };
  }, [id]);

  // Animate time display
  const tick = useCallback(() => {
    if (audioRef.current && !scrubbing.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
    animFrameRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [tick]);

  async function acquireWakeLock() {
    if ('wakeLock' in navigator && !wakeLockRef.current) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        wakeLockRef.current.addEventListener('release', () => { wakeLockRef.current = null; });
      } catch { /* wake lock not available */ }
    }
  }

  function releaseWakeLock() {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  }

  // Re-acquire wake lock on visibility change
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible' && isPlaying) acquireWakeLock();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [isPlaying]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      releaseWakeLock();
    } else {
      await audio.play();
      setIsPlaying(true);
      acquireWakeLock();
    }
  }

  async function jumpToCue(cue: Cue) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = cue.timeSeconds;
    if (!isPlaying) {
      await audio.play();
      setIsPlaying(true);
      acquireWakeLock();
    }
  }

  function handleProgressChange(e: React.ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    if (!audio) return;
    const t = parseFloat(e.target.value);
    audio.currentTime = t;
    setCurrentTime(t);
  }

  function handleProgressMouseDown() { scrubbing.current = true; }
  function handleProgressMouseUp() { scrubbing.current = false; }

  async function persistSong(updated: Song) {
    setSong(updated);
    await updateSong(updated);
  }

  // Title editing
  async function submitTitle() {
    if (!song) return;
    const trimmed = titleValue.trim();
    if (trimmed && trimmed !== song.title) {
      await persistSong({ ...song, title: trimmed, updatedAt: Date.now() });
    } else {
      setTitleValue(song.title);
    }
    setEditingTitle(false);
  }

  // Add cue at current time
  async function addCueAtCurrentTime() {
    if (!song || !audioRef.current) return;
    const t = audioRef.current.currentTime;
    const cue: Cue = { id: crypto.randomUUID(), label: 'New cue', timeSeconds: t };
    const updated = { ...song, cues: [...song.cues, cue].sort((a, b) => a.timeSeconds - b.timeSeconds), updatedAt: Date.now() };
    await persistSong(updated);
    setNewInlineCue(cue);
  }

  // Save inline cue label
  async function saveInlineCueLabel(cue: Cue, label: string) {
    if (!song) return;
    const trimmed = label.trim() || 'New cue';
    const updated = {
      ...song,
      cues: song.cues.map((c) => c.id === cue.id ? { ...c, label: trimmed } : c),
      updatedAt: Date.now(),
    };
    await persistSong(updated);
    setNewInlineCue(null);
  }

  // Manual add cue
  const [manualLabel, setManualLabel] = useState('');
  const [manualTime, setManualTime] = useState('');

  async function submitManualCue() {
    if (!song) return;
    const t = parseTimeInput(manualTime);
    if (t === null || t < 0) { showToast('Invalid time. Use mm:ss format.'); return; }
    const label = manualLabel.trim() || 'New cue';
    const cue: Cue = { id: crypto.randomUUID(), label, timeSeconds: t };
    const updated = { ...song, cues: [...song.cues, cue].sort((a, b) => a.timeSeconds - b.timeSeconds), updatedAt: Date.now() };
    await persistSong(updated);
    setShowManualDialog(false);
    setManualLabel('');
    setManualTime('');
  }

  // Edit/delete cue
  function openCueEdit(cue: Cue) {
    setEditingCue(cue);
    setEditCueLabel(cue.label);
    setEditCueTime(formatTime(cue.timeSeconds));
    setCueMenu(null);
  }

  async function submitCueEdit() {
    if (!song || !editingCue) return;
    const t = parseTimeInput(editCueTime);
    if (t === null || t < 0) { showToast('Invalid time. Use mm:ss format.'); return; }
    const label = editCueLabel.trim() || editingCue.label;
    const updated = {
      ...song,
      cues: song.cues.map((c) => c.id === editingCue.id ? { ...c, label, timeSeconds: t } : c)
        .sort((a, b) => a.timeSeconds - b.timeSeconds),
      updatedAt: Date.now(),
    };
    await persistSong(updated);
    setEditingCue(null);
  }

  async function deleteCue(cue: Cue) {
    if (!song) return;
    const updated = { ...song, cues: song.cues.filter((c) => c.id !== cue.id), updatedAt: Date.now() };
    await persistSong(updated);
    setCueMenu(null);
  }

  async function handleDeleteSong() {
    if (!song) return;
    await removeSong(song.id);
    navigate('/');
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#0a0a0a] text-white gap-4">
        <p className="text-white/50">Song not found.</p>
        <button onClick={() => navigate('/')} className="text-amber-500">Back to library</button>
      </div>
    );
  }

  if (!song) {
    return (
      <div className="flex items-center justify-center h-full bg-[#0a0a0a]">
        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] text-white">
      <audio
        ref={audioRef}
        preload="auto"
        onEnded={() => { setIsPlaying(false); releaseWakeLock(); }}
        onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration)}
      />

      {/* Header */}
      <header className="flex items-center px-4 pt-4 pb-3 gap-3 border-b border-white/10">
        <button onClick={() => navigate('/')} className="w-10 h-10 flex items-center justify-center text-white/70 active:text-white -ml-1" aria-label="Back">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {editingTitle ? (
          <input
            autoFocus
            className="flex-1 bg-transparent text-white text-lg font-semibold outline-none border-b border-amber-500 pb-0.5"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={submitTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') submitTitle(); if (e.key === 'Escape') { setTitleValue(song.title); setEditingTitle(false); } }}
          />
        ) : (
          <button className="flex-1 text-left text-lg font-semibold text-white truncate" onClick={() => setEditingTitle(true)}>
            {song.title}
          </button>
        )}

        <button
          onClick={() => setShowDeleteSong(true)}
          className="w-10 h-10 flex items-center justify-center text-white/40 active:text-white"
          aria-label="Song options"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <circle cx="10" cy="4" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="10" cy="16" r="1.5" />
          </svg>
        </button>
      </header>

      {/* Playback controls */}
      <div className="px-5 pt-5 pb-4 flex flex-col gap-4">
        {/* Time display */}
        <div className="flex justify-between text-sm text-white/50">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        {/* Progress bar */}
        <div className="relative">
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={currentTime}
            onChange={handleProgressChange}
            onMouseDown={handleProgressMouseDown}
            onMouseUp={handleProgressMouseUp}
            onTouchStart={handleProgressMouseDown}
            onTouchEnd={handleProgressMouseUp}
            className="w-full h-1 appearance-none bg-white/20 rounded-full outline-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #f59e0b ${progressPct}%, rgba(255,255,255,0.2) ${progressPct}%)`,
            }}
          />
          {/* Cue tick marks */}
          {song.cues.map((cue) => (
            <div
              key={cue.id}
              className="absolute top-1/2 -translate-y-1/2 w-1 h-3 bg-amber-500/60 rounded-full pointer-events-none"
              style={{ left: `calc(${duration > 0 ? (cue.timeSeconds / duration) * 100 : 0}% - 2px)` }}
            />
          ))}
        </div>

        {/* Play/Pause button */}
        <div className="flex justify-center mt-2">
          <button
            onClick={togglePlay}
            className="w-20 h-20 rounded-full bg-amber-500 text-black flex items-center justify-center active:scale-95 transition-transform shadow-lg"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <rect x="5" y="4" width="4" height="16" rx="1" />
                <rect x="15" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86A1 1 0 008 5.14z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Cue list */}
      <div className="flex-1 overflow-y-auto px-4">
        {song.cues.length === 0 && (
          <p className="text-white/30 text-sm text-center py-6">No cues yet. Tap "+ Add cue" below.</p>
        )}
        <ul className="flex flex-col gap-2 pb-4">
          {song.cues.map((cue) => (
            <li key={cue.id}>
              {newInlineCue?.id === cue.id ? (
                <InlineCueEditor
                  initialLabel={cue.label}
                  onSave={(label) => saveInlineCueLabel(cue, label)}
                  onCancel={() => saveInlineCueLabel(cue, cue.label)}
                />
              ) : (
                <button
                  className="w-full min-h-[64px] flex items-center justify-between px-4 py-3 bg-[#1a1a1a] rounded-xl text-left active:bg-[#252525] transition-colors"
                  onClick={() => jumpToCue(cue)}
                  onContextMenu={(e) => { e.preventDefault(); setCueMenu(cue); }}
                  onTouchStart={() => {
                    const t = setTimeout(() => setCueMenu(cue), 500);
                    const cancel = () => clearTimeout(t);
                    window.addEventListener('touchend', cancel, { once: true });
                  }}
                >
                  <div>
                    <div className="text-white font-medium">{cue.label}</div>
                    <div className="text-amber-500 text-sm">{formatTime(cue.timeSeconds)}</div>
                  </div>
                  <svg className="w-5 h-5 text-white/20" fill="currentColor" viewBox="0 0 20 20">
                    <circle cx="10" cy="5" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="10" cy="15" r="1.5" />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Bottom bar */}
      <div
        className="border-t border-white/10 bg-[#0a0a0a] px-4 pt-3 flex gap-2"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={addCueAtCurrentTime}
          className="flex-1 min-h-[52px] bg-amber-500 text-black font-semibold rounded-xl active:scale-95 transition-transform text-sm"
        >
          + Add cue at {formatTime(currentTime)}
        </button>
        <button
          onClick={() => { setManualLabel(''); setManualTime(''); setShowManualDialog(true); }}
          className="min-h-[52px] px-4 bg-white/10 text-white rounded-xl active:bg-white/20 text-sm"
        >
          Manual
        </button>
      </div>

      {/* Cue context menu */}
      {cueMenu && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setCueMenu(null)}>
          <div className="w-full bg-[#1a1a1a] rounded-t-2xl p-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="text-white/50 text-sm text-center mb-4">{cueMenu.label} — {formatTime(cueMenu.timeSeconds)}</div>
            <button
              className="w-full text-left py-4 px-4 text-white text-base rounded-xl active:bg-white/10"
              onClick={() => openCueEdit(cueMenu)}
            >
              Edit
            </button>
            <button
              className="w-full text-left py-4 px-4 text-red-400 text-base rounded-xl active:bg-white/10"
              onClick={() => deleteCue(cueMenu)}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Edit cue dialog */}
      {editingCue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5">
          <div className="w-full max-w-sm bg-[#1a1a1a] rounded-2xl p-5 flex flex-col gap-4">
            <h2 className="text-white font-semibold text-lg">Edit cue</h2>
            <div className="flex flex-col gap-1">
              <label className="text-white/50 text-sm">Label</label>
              <input
                autoFocus
                className="bg-white/10 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500"
                value={editCueLabel}
                onChange={(e) => setEditCueLabel(e.target.value)}
                placeholder="Cue label"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-white/50 text-sm">Time (mm:ss)</label>
              <input
                className="bg-white/10 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500"
                value={editCueTime}
                onChange={(e) => setEditCueTime(e.target.value)}
                placeholder="1:23"
              />
            </div>
            <div className="flex gap-3 mt-1">
              <button onClick={() => setEditingCue(null)} className="flex-1 py-3 bg-white/10 text-white rounded-xl">Cancel</button>
              <button onClick={submitCueEdit} className="flex-1 py-3 bg-amber-500 text-black font-semibold rounded-xl">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Manual add cue dialog */}
      {showManualDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5">
          <div className="w-full max-w-sm bg-[#1a1a1a] rounded-2xl p-5 flex flex-col gap-4">
            <h2 className="text-white font-semibold text-lg">Add cue</h2>
            <div className="flex flex-col gap-1">
              <label className="text-white/50 text-sm">Label</label>
              <input
                autoFocus
                className="bg-white/10 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500"
                value={manualLabel}
                onChange={(e) => setManualLabel(e.target.value)}
                placeholder="e.g. Parents dance"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-white/50 text-sm">Time (mm:ss)</label>
              <input
                className="bg-white/10 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500"
                value={manualTime}
                onChange={(e) => setManualTime(e.target.value)}
                placeholder="1:23"
                onKeyDown={(e) => { if (e.key === 'Enter') submitManualCue(); }}
              />
            </div>
            <div className="flex gap-3 mt-1">
              <button onClick={() => setShowManualDialog(false)} className="flex-1 py-3 bg-white/10 text-white rounded-xl">Cancel</button>
              <button onClick={submitManualCue} className="flex-1 py-3 bg-amber-500 text-black font-semibold rounded-xl">Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete song confirmation */}
      {showDeleteSong && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setShowDeleteSong(false)}>
          <div className="w-full bg-[#1a1a1a] rounded-t-2xl p-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="text-white/50 text-sm text-center mb-4 px-4">"{song.title}"</div>
            <button
              className="w-full text-left py-4 px-4 text-red-400 text-base rounded-xl active:bg-white/10"
              onClick={handleDeleteSong}
            >
              Delete song
            </button>
            <button
              className="w-full text-left py-4 px-4 text-white text-base rounded-xl active:bg-white/10"
              onClick={() => setShowDeleteSong(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}

// Inline cue label editor that appears immediately after adding a cue at current time
function InlineCueEditor({ initialLabel, onSave, onCancel }: { initialLabel: string; onSave: (l: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initialLabel === 'New cue' ? '' : initialLabel);
  return (
    <div className="min-h-[64px] flex items-center gap-2 px-4 py-3 bg-[#252525] rounded-xl">
      <input
        autoFocus
        className="flex-1 bg-transparent text-white outline-none placeholder-white/30"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Cue label"
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave(value);
          if (e.key === 'Escape') onCancel();
        }}
      />
      <button onClick={() => onSave(value)} className="text-amber-500 font-semibold text-sm px-2">Done</button>
    </div>
  );
}
