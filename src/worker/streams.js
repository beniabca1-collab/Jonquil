/**
 * دریافت و ارسال ویدیوی یوتیوب از داخل Cloudflare Workers.
 * کلاینت‌های InnerTube به ترتیب امتحان می‌شوند (بعضی ویدیوها فقط با
 * بعضی کلاینت‌ها باز می‌شوند). فقط فرمت muxed (صدا+تصویر) کاربردی است؛
 * فرمت‌های adaptive نیاز به mux با ffmpeg دارند که در Workers نیست.
 */

const CLIENTS = [
  {
    name: 'ANDROID_VR',
    ctx: {
      clientName: 'ANDROID_VR',
      clientVersion: '1.60.19',
      deviceMake: 'Oculus',
      deviceModel: 'Quest 3',
      androidSdkVersion: 32,
      osName: 'Android',
      osVersion: '12L',
      hl: 'en',
      gl: 'US',
    },
  },
  {
    name: 'ANDROID_VR_NEW',
    ctx: {
      clientName: 'ANDROID_VR',
      clientVersion: '1.61.48',
      deviceMake: 'Oculus',
      deviceModel: 'Quest 3',
      androidSdkVersion: 32,
      osName: 'Android',
      osVersion: '12L',
      hl: 'en',
      gl: 'US',
    },
  },
  {
    name: 'EMBED',
    ctx: {
      clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
      clientVersion: '2.0',
      hl: 'en',
      gl: 'US',
    },
    thirdParty: { embedUrl: 'https://www.youtube.com/' },
  },
];

/** حداکثر حجم ارسال با Bot API تلگرام (۵۰MB) با حاشیه امنیت */
export const MAX_VIDEO_BYTES = 45 * 1024 * 1024;
/** حداکثر مدت ویدیو برای دانلود و ارسال (۲۰ دقیقه) */
export const MAX_DURATION_SECONDS = 20 * 60;

async function playerRequest(videoId, client) {
  const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      context: { client: client.ctx },
      videoId,
      contentCheckOk: true,
      racyCheckOk: true,
      ...(client.thirdParty ? { thirdParty: client.thirdParty } : {}),
    }),
  });
  if (!res.ok) throw new Error(`player http ${res.status}`);
  return res.json();
}

function extractMuxed(data) {
  if (data.playabilityStatus?.status !== 'OK') {
    throw new Error(
      data.playabilityStatus?.reason || `not playable (${data.playabilityStatus?.status})`
    );
  }
  const formats = (data.streamingData?.formats ?? [])
    .filter((f) => typeof f.url === 'string' && (f.mimeType ?? '').startsWith('video/mp4'))
    .map((f) => ({
      itag: f.itag,
      url: f.url,
      qualityLabel: f.qualityLabel ?? 'video',
      height: f.height ?? 0,
      bitrate: f.bitrate ?? 0,
      contentLength: Number(f.contentLength ?? 0),
    }))
    .sort((a, b) => b.height - a.height || b.bitrate - a.bitrate);

  const durationSeconds = Number(
    data.microformat?.playerMicroformatRenderer?.lengthSeconds ??
      data.videoDetails?.lengthSeconds ??
      0
  );
  return { title: data.videoDetails?.title ?? '', durationSeconds, formats };
}

/**
 * فرمت‌های muxed یک ویدیو را برمی‌گرداند؛ کلاینت‌ها را به ترتیب امتحان می‌کند.
 * خروجی: { title, durationSeconds, formats, via } یا خطا اگر هیچ‌کدام نشد.
 */
export async function getMuxedFormats(videoId) {
  let lastErr = new Error('no client succeeded');
  for (const client of CLIENTS) {
    try {
      const data = await playerRequest(videoId, client);
      const out = extractMuxed(data);
      if (out.formats.length > 0) return { ...out, via: client.name };
      lastErr = new Error('no muxed format');
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

/** بهترین فرمت موجود (از بالاترین کیفیت؛ سقف حجم در حین دانلود چک می‌شود) */
export function pickVideoFormat(formats) {
  return (formats ?? [])[0] ?? null;
}

/**
 * دانلود استریمی با سقف حجم. اگر فایل از maxBytes بزرگ‌تر بود
 * وسط کار abort و null برمی‌گرداند؛ وگرنه Blob آماده‌ی ارسال.
 */
export async function downloadVideo(url, maxBytes = MAX_VIDEO_BYTES) {
  const res = await fetch(url, { headers: { 'user-agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip' } });
  if (!res.ok || !res.body) throw new Error(`download http ${res.status}`);

  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared && declared > maxBytes) {
    await res.body.cancel();
    return null;
  }

  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  if (total === 0) throw new Error('empty body');
  return { blob: new Blob(chunks, { type: 'video/mp4' }), bytes: total };
}
