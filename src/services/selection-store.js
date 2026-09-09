import { randomBytes } from 'node:crypto';

const TTL_MS = 15 * 60 * 1000; // اعتبار لیست انتخاب: ۱۵ دقیقه
const MAX_ENTRIES = 500;
const store = new Map();

function evictExpired() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
}

export const selectionStore = {
  /** لیست ویدیوها را با یک توکن تصادفی ذخیره می‌کند */
  create(videos, chatId) {
    if (store.size >= MAX_ENTRIES) evictExpired();
    if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value);

    const token = randomBytes(4).toString('hex');
    store.set(token, { videos, chatId, expiresAt: Date.now() + TTL_MS });
    return token;
  },

  get(token) {
    const entry = store.get(token);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      store.delete(token);
      return null;
    }
    return entry;
  },

  delete(token) {
    store.delete(token);
  },
};
