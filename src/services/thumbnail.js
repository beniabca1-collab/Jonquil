import fs from 'node:fs';
import path from 'node:path';
import { TEMP_DIR } from '../config.js';

/**
 * دانلود تامبنیل ویدیو روی دیسک (اول کیفیت بالا، بعد hqdefault که همیشه هست).
 * @returns {Promise<string>} مسیر فایل JPG
 */
export async function downloadThumbnail(videoId, token, index) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  const candidates = [
    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      // placeholder تصویر 404 یوتیوب خیلی کوچک است
      if (buf.length < 1500) continue;
      const file = path.join(TEMP_DIR, `thumb_${token}_${index}.jpg`);
      await fs.promises.writeFile(file, buf);
      return file;
    } catch {
      /* تلاش برای کاندیدای بعدی */
    }
  }
  throw new Error(`thumbnail failed for ${videoId}`);
}
