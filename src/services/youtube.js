import yts from 'yt-search';
import { withTimeout } from '../utils.js';

/** الگوی تشخیص ویدیوی رسمی از روی تیتر */
const OFFICIAL_RE =
  /(official\s+(music\s+)?(video|visuali[sz]er|audio|mv))|(موزیک\s*ویدیو)/i;

/**
 * جستجوی یوتیوب بدون نیاز به کلید API.
 * خروجی: آرایه‌ای از { title, videoId, url, seconds, timestamp, author: { name } , thumbnail }
 */
export async function searchYouTube(query, limit = 10) {
  const res = await withTimeout(yts(query), 30_000, 'زمان جستجوی یوتیوب تمام شد');
  const seen = new Set();
  return (res?.videos ?? [])
    .filter((v) => {
      if (!v || !v.videoId || seen.has(v.videoId)) return false;
      seen.add(v.videoId);
      return true;
    })
    .slice(0, limit);
}

/** اولین نتیجه‌ای که تیترش «رسمی» به نظر برسد */
export function findOfficialVideo(videos) {
  return (videos ?? []).find((v) => v?.title && OFFICIAL_RE.test(v.title)) ?? null;
}

export function cleanQuery(raw) {
  return String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

/** تبدیل اسم فایل صوتی به یک کوئری جستجوی تمیز */
export function fileNameToQuery(name) {
  let q = String(name ?? '').replace(/\.[a-z0-9]{1,5}$/i, '');
  q = q.replace(/[_\-.]+/g, ' ');
  q = q.replace(
    /\(\s*\d{3,4}\s*\)|\b\d{3,4}\s*kbps\b|\b\d{3,4}p\b|\b(official\s+)?(music\s+)?video\b|\blyrics?\b|\baudio\b|\bfull\s+song\b|\bdownload\b|\byt\b|\byoutube\b|\bmp3\b|\bm4a\b|\bwav\b|\b320\b|\b128\b/gi,
    ' '
  );
  q = q.replace(/[[\]{}()]/g, ' ');
  return cleanQuery(q);
}
