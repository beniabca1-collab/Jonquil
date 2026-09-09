/**
 * جستجوی یوتیوب سازگار با Cloudflare Workers.
 * به‌جای yt-search (که به ماژول‌های نود وابسته است)، صفحه‌ی نتایج یوتیوب
 * را با fetch می‌گیریم و ytInitialData را از روی آن می‌خوانیم.
 * خروجی: آرایه‌ای از { title, videoId, url, seconds, timestamp, author: { name } }
 */

const OFFICIAL_RE =
  /(official\s+(music\s+)?(video|visuali[sz]er|audio|mv))|(موزیک\s*ویدیو)/i;

function extractInitialData(html) {
  const marker = 'ytInitialData = ';
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const jsonStart = start + marker.length;
  // شیء JSON تا جایی که بالانس آکولاد بسته می‌شود ادامه دارد
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = jsonStart; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(jsonStart, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function flattenVideos(node, out) {
  if (!node || typeof node !== 'object' || out.length >= 40) return;
  if (Array.isArray(node)) {
    for (const child of node) flattenVideos(child, out);
    return;
  }
  if (node.videoRenderer) out.push(node.videoRenderer);
  for (const key of Object.keys(node)) {
    if (key !== 'videoRenderer' && node[key] && typeof node[key] === 'object') {
      flattenVideos(node[key], out);
    }
  }
}

function parseSeconds(ts = '') {
  const parts = String(ts).split(':').map((p) => parseInt(p, 10));
  if (parts.some((p) => Number.isNaN(p))) return 0;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

function textOf(t) {
  if (!t) return '';
  if (typeof t === 'string') return t;
  if (t.simpleText) return t.simpleText;
  if (Array.isArray(t.runs)) return t.runs.map((r) => r.text).join('');
  return '';
}

export async function searchYouTube(query, limit = 10) {
  const url =
    'https://www.youtube.com/results?hl=en&sp=EgIQAQ%253D%253D&search_query=' +
    encodeURIComponent(query); // sp = فقط ویدیو (Type: Video)
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`youtube search failed: ${res.status}`);
  const html = await res.text();
  const data = extractInitialData(html);
  if (!data) throw new Error('ytInitialData not found');

  const renderers = [];
  flattenVideos(data, renderers);

  const seen = new Set();
  const videos = [];
  for (const r of renderers) {
    const videoId = r.videoId;
    const title = textOf(r.title);
    if (!videoId || !title || seen.has(videoId)) continue;
    seen.add(videoId);
    const timestamp = textOf(r.lengthText);
    videos.push({
      videoId,
      title,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      seconds: parseSeconds(timestamp),
      timestamp,
      author: { name: textOf(r.ownerText) },
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    });
    if (videos.length >= limit) break;
  }
  return videos;
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
