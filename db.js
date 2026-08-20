/* Tiny IndexedDB wrapper — stores every entry (including the photo as a Blob)
   entirely on-device, so it works with no network at all. */

const DB_NAME = "evening-paws";
const DB_VERSION = 1;
const STORE = "sightings";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const CatDB = {
  async add(entry) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).add(entry);
      tx.oncomplete = () => resolve(entry);
      tx.onerror = () => reject(tx.error);
    });
  },

  async getAll() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => {
        const all = req.result || [];
        all.sort((a, b) => b.createdAt - a.createdAt);
        resolve(all);
      };
      req.onerror = () => reject(req.error);
    });
  },

  async delete(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};
