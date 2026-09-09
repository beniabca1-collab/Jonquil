import path from 'node:path';
import fs from 'node:fs';

/** پوشه‌ی فایل‌های موقت (ویدیوها و تامبنیل‌ها) */
export const TEMP_DIR = path.join(process.cwd(), 'temp');

/** سقف حجم فایل برای ارسال با Bot API تلگرام (۵۰ مگابایت) */
export const MAX_FILE_SIZE = 49 * 1024 * 1024;

/** بیشینه‌ی طول ویدیو برای دانلود و ارسال فایل (۱۵ دقیقه) */
export const MAX_DURATION_SECONDS = 15 * 60;

/** حداقل فاصله‌ی زمانی بین ادیت‌های پیام لور/پیشرفت (محدودیت rate تلگرام) */
export const LORE_EDIT_MIN_MS = 5 * 1000;

/** تعداد گزینه‌هایی که وقتی ویدیوی رسمی نبود نمایش داده می‌شود */
export const SEARCH_LIMIT = 10;

export function ensureTempDir() {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/** حذف فایل‌های قدیمی پوشه temp */
export function cleanupTempDir(maxAgeMs = 60 * 60 * 1000) {
  try {
    for (const name of fs.readdirSync(TEMP_DIR)) {
      const filePath = path.join(TEMP_DIR, name);
      try {
        const stat = fs.statSync(filePath);
        if (Date.now() - stat.mtimeMs > maxAgeMs) fs.unlinkSync(filePath);
      } catch {
        /* ignore single-file errors */
      }
    }
  } catch {
    /* ignore */
  }
}
