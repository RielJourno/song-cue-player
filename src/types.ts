export type Cue = {
  id: string;
  label: string;
  timeSeconds: number;
};

export type Song = {
  id: string;
  title: string;
  audioBlob: Blob;
  mimeType: string;
  duration: number;
  cues: Cue[];
  createdAt: number;
  updatedAt: number;
  lastPlayedAt?: number;
};
