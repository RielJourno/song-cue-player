export type Cue = {
  id: string;
  label: string;
  timeSeconds: number;
};

export type Song = {
  id: string;
  title: string;
  source: 'local' | 'shared';
  audioBlob?: Blob;    // local songs only
  audioUrl?: string;   // shared songs only — relative path like /audio/foo.mp3
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
