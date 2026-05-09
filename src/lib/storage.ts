import type { Shape, Project } from './types';
import { get } from 'svelte/store';
import { store } from './stores';

const DB_NAME = 'whiteboard-db';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

let db: IDBDatabase | null = null;

export async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

export async function saveProject(project: Project): Promise<void> {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const data = JSON.parse(JSON.stringify(project, (key, value) => {
      if (key === 'image') return undefined;
      return value;
    }));
    const request = store.put(data);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function loadProject(id: string): Promise<Project | null> {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllProjects(): Promise<Project[]> {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteProject(id: string): Promise<void> {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function autoSave() {
  try {
    const project = store.exportProject();
    await saveProject(project);
  } catch (e) {
    console.error('Auto save failed:', e);
  }
}

export function startAutoSave(intervalMs: number = 30000) {
  return setInterval(autoSave, intervalMs);
}
