/**
 * استخر انتخاب (selection store) بر پایه‌ی Cloudflare KV — نسخه‌ی Workers.
 * جایگزین نسخه‌ی Map در حافظه (src/services/selection-store.js).
 */

const TTL_SECONDS = 15 * 60; // اعتبار لیست انتخاب: ۱۵ دقیقه

export function createKvStore(kv) {
  return {
    /** لیست ویدیوها را با یک توکن تصادفی ذخیره می‌کند */
    async create(videos, chatId) {
      const token = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
      await kv.put(
        `sel:${token}`,
        JSON.stringify({ videos, chatId, createdAt: Date.now() }),
        { expirationTtl: TTL_SECONDS }
      );
      return token;
    },

    async get(token) {
      const raw = await kv.get(`sel:${token}`, 'json');
      return raw ?? null;
    },

    async delete(token) {
      await kv.delete(`sel:${token}`);
    },
  };
}
