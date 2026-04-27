import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { Song, PersonalCuesRecord } from './types';

interface CueDB extends DBSchema {
  songs: {
    key: string;
    value: Song;
  };
  personalCues: {
    key: string;
    value: PersonalCuesRecord;
  };
}

let dbPromise: Promise<IDBPDatabase<CueDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<CueDB>('cue-db', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('songs', { keyPath: 'id' });
        }
        if (oldVersion < 2) {
          db.createObjectStore('personalCues', { keyPath: 'songId' });
        }
      },
    });
  }
  return dbPromise;
}

export async function getAllSongs(): Promise<Song[]> {
  const db = await getDB();
  const songs = await db.getAll('songs');
  return songs
    .map((s) => (s.source ? s : { ...s, source: 'local' as const }))
    .sort((a, b) => (b.lastPlayedAt ?? b.createdAt) - (a.lastPlayedAt ?? a.createdAt));
}

export async function getSong(id: string): Promise<Song | undefined> {
  const db = await getDB();
  const song = await db.get('songs', id);
  if (song && !song.source) return { ...song, source: 'local' };
  return song;
}

export async function saveSong(song: Song): Promise<void> {
  const db = await getDB();
  await db.put('songs', song);
}

export async function deleteSong(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('songs', id);
}

export async function getPersonalCues(songId: string): Promise<PersonalCuesRecord | undefined> {
  const db = await getDB();
  return db.get('personalCues', songId);
}

export async function savePersonalCues(record: PersonalCuesRecord): Promise<void> {
  const db = await getDB();
  await db.put('personalCues', record);
}
