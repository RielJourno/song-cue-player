export type Cue = {
  id: string;
  label: string;
  timeSeconds: number;
};

// Runtime-only — not persisted anywhere
export type DisplayCue = Cue & {
  isShared: boolean;
};

export type Song = {
  id: string;
  title: string;
  source: 'local' | 'shared';
  audioBlob?: Blob;    // local songs only
  audioUrl?: string;   // shared songs only
  mimeType: string;
  duration: number;
  cues: Cue[];
  createdAt: number;
  updatedAt: number;
  lastPlayedAt?: number;
};

// Shape of public/cues.json
export type SharedSongJSON = {
  id: string;
  title: string;
  audioUrl: string;
  duration: number;
  cues: Cue[];
  updatedAt: number;
};

// Stored in IndexedDB personalCues store — one record per shared song
export type PersonalCuesRecord = {
  songId: string;
  cues: Cue[];
  updatedAt: number;
};
