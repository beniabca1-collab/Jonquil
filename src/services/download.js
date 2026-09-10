import youtubedl from 'youtube-dl-exec';
import { constants as ytdlConstants } from 'youtube-dl-exec';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import ffmpegPath from 'ffmpeg-static';
import { PROXY_URL } from './proxy.js';

/** فرمت هدف: ویدیوی mp4 تا ۷۲۰p + بهترین صدا، ادغام‌شده با ffmpeg */
const FORMAT_SPEC =
  'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]/best';

function baseFlags() {
  return {
    proxy: PROXY_URL || undefined,
    'ffmpeg-location': ffmpegPath || undefined,
    'no-playlist': true,
    'no-warnings': true,
  };
}

/** دریافت اطلاعات کامل ویدیو (yt-dlp JSON) */
export async function getVideoInfo(urlOrId) {
  const s = String(urlOrId ?? '');
  const url = /^https?:\/\//.test(s) ? s : `https://www.youtube.com/watch?v=${s}`;
  return youtubedl(url, { ...baseFlags(), dumpSingleJson: true });
}

export function formatTitle(info) {
  return info?.title ?? 'ویدیو';
}

export function formatDuration(info) {
  return Number(info?.duration ?? 0);
}

export function formatChannel(info) {
  return info?.uploader ?? info?.channel ?? '';
}

/** برآورد حجم فایل نهایی (ویدیو + صدا) برای چک سقف ۵۰ مگابایت */
export function formatSize(info, format) {
  const formats = info?.formats ?? [];
  const video = formats
    .filter((f) => f.vcodec !== 'none' && f.acodec === 'none' && (f.height ?? 0) <= 720)
    .sort((a, b) => (b.filesize ?? 0) - (a.filesize ?? 0))[0];
  const audio = formats
    .filter((f) => f.acodec !== 'none' && f.vcodec === 'none')
    .sort((a, b) => (b.filesize ?? 0) - (a.filesize ?? 0))[0];
  const estimated = (video?.filesize ?? video?.filesize_approx ?? 0) + (audio?.filesize ?? audio?.filesize_approx ?? 0);
  // اگر برآورد ممکن نبود، از bitrate تقریبی استفاده کن
  if (estimated > 0) return estimated;
  return Number(info?.duration ?? 0) * 500 * 1024; // ≈500KB/s
}

/**
 * آماده‌سازی دانلود — دانلود واقعی در downloadVideo انجام می‌شود.
 * خروجی: آبجکت مشخصات برای downloadVideo یا null اگر فرمتی نبود.
 */
export function pickFormat(info) {
  const formats = info?.formats ?? [];
  const hasVideo = formats.some((f) => f.vcodec !== 'none');
  const hasAudio = formats.some((f) => f.acodec !== 'none');
  return hasVideo && hasAudio ? { spec: FORMAT_SPEC } : null;
}

/**
 * دانلود ویدیو روی دیسک با گزارش درصد پیشرفت (spawn مستقیم yt-dlp).
 * @returns {Promise<string>} مسیر فایل نهایی
 */
export async function downloadVideo(info, format, filePath, onProgress) {
  const base = filePath.replace(/\.mp4$/i, '');
  const url = info?.webpage_url ?? info?.original_url;

  const args = [];
  for (const [key, value] of Object.entries(baseFlags())) {
    if (value === undefined || value === false) continue;
    args.push(`--${key}`);
    if (value !== true) args.push(String(value));
  }
  args.push(
    '--output', `${base}.%(ext)s`,
    '--format', format?.spec ?? FORMAT_SPEC,
    '--merge-output-format', 'mp4',
    '--newline',
    url
  );

  return new Promise((resolve, reject) => {
    const child = spawn(ytdlConstants.YOUTUBE_DL_PATH, args, { windowsHide: true });
    let stderr = '';
    let lastPct = -1;

    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('زمان دانلود بیش از حد طول کشید'));
    }, 6 * 60 * 1000);

    child.stdout.on('data', (chunk) => {
      for (const line of chunk.toString().split('\n')) {
        const m = line.match(/\[download\]\s+([\d.]+)%/);
        if (m) {
          const pct = Math.floor(Number(m[1]));
          if (onProgress && pct > lastPct) {
            lastPct = pct;
            onProgress(Math.min(99, pct));
          }
        }
      }
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr.trim().split('\n').slice(-3).join('\n') || `yt-dlp exited with code ${code}`));
        return;
      }
      // فایل نهایی (بعد از merge معمولاً mp4 است)
      const candidates = [`${base}.mp4`, `${base}.mkv`, `${base}.webm`];
      const found = candidates.find((p) => {
        try { return fs.existsSync(p) && fs.statSync(p).size > 0; } catch { return false; }
      });
      if (!found) {
        reject(new Error('فایل خروجی پیدا نشد'));
        return;
      }
      onProgress?.(100);
      resolve(found);
    });
  });
}
