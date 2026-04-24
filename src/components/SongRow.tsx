import { useState, useRef } from 'react';
import type { Song } from '../types';
import { formatTime } from '../utils';

interface Props {
  song: Song;
  onTap: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}

export default function SongRow({ song, onTap, onRename, onDelete }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(song.title);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  function startLongPress() {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      setShowMenu(true);
    }, 500);
  }

  function cancelLongPress() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }

  function handleTap() {
    if (!didLongPress.current) onTap();
  }

  function submitRename() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== song.title) onRename(trimmed);
    setRenaming(false);
    setShowMenu(false);
  }

  const lastPlayed = song.lastPlayedAt
    ? new Date(song.lastPlayedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;

  return (
    <>
      <li
        className="flex items-center px-5 py-4 gap-4 cursor-pointer active:bg-white/5 select-none"
        onTouchStart={startLongPress}
        onTouchEnd={cancelLongPress}
        onMouseDown={startLongPress}
        onMouseUp={cancelLongPress}
        onMouseLeave={cancelLongPress}
        onClick={handleTap}
      >
        <div className="flex-1 min-w-0">
          <div className="text-white font-medium truncate">{song.title}</div>
          <div className="text-white/40 text-sm mt-0.5 flex gap-2">
            <span>{song.cues.length} {song.cues.length === 1 ? 'cue' : 'cues'}</span>
            <span>·</span>
            <span>{formatTime(song.duration)}</span>
            {lastPlayed && <><span>·</span><span>{lastPlayed}</span></>}
          </div>
        </div>
        <svg className="w-4 h-4 text-white/30 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </li>

      {/* Context menu */}
      {showMenu && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setShowMenu(false)}>
          <div className="w-full bg-[#1a1a1a] rounded-t-2xl p-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="text-white/50 text-sm text-center mb-4 truncate px-4">{song.title}</div>
            {renaming ? (
              <div className="flex gap-2 mb-3">
                <input
                  autoFocus
                  className="flex-1 bg-white/10 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') { setRenaming(false); setShowMenu(false); } }}
                />
                <button
                  onClick={submitRename}
                  className="bg-amber-500 text-black px-4 py-3 rounded-xl font-semibold"
                >
                  Save
                </button>
              </div>
            ) : (
              <>
                <button
                  className="w-full text-left py-4 px-4 text-white text-base rounded-xl active:bg-white/10"
                  onClick={() => setRenaming(true)}
                >
                  Rename
                </button>
                <button
                  className="w-full text-left py-4 px-4 text-red-400 text-base rounded-xl active:bg-white/10"
                  onClick={() => { onDelete(); setShowMenu(false); }}
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
