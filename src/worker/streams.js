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
      clientVersion: '1.65.10',
      deviceMake: 'Oculus',
      deviceModel: 'Quest 3',
      androidSdkVersion: 32,
      osName: 'Android',
      osVersion: '12L',
      userAgent:
        'com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
      hl: 'en',
      gl: 'US',
    },
  },
  {
    name: 'IOS',
    ctx: {
      clientName: 'IOS',
      clientVersion: '21.26.4',
      deviceMake: 'Apple',
      deviceModel: 'iPhone16,2',
      osName: 'iPhone',
      osVersion: '18.3.2.22D82',
      userAgent:
        'com.google.ios.youtube/21.26.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)',
      hl: 'en',
      gl: 'US',
    },
  },
  {
    name: 'ANDROID',
    ctx: {
      clientName: 'ANDROID',
      clientVersion: '21.26.364',
      androidSdkVersion: 30,
      osName: 'Android',
      osVersion: '11',
      userAgent:
        'com.google.android.youtube/21.26.364 (Linux; U; Android 11) gzip',
      hl: 'en',
      gl: 'US',
    },
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
 * رله‌های عمومی Piped: ویدیو را از سرورهای خودشان پروکسی می‌کنند
 * (برای وقتی یوتیوب به IP دیتاسنتر PO Token می‌خواهد).
 */
const PIPED_RELAYS = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.private.coffee',
  'https://pipedapi.reallyaweso.me',
  'https://pipedapi.ducks.party',
];

async function relayMuxed(videoId) {
  for (const base of PIPED_RELAYS) {
    try {
      const res = await withTimeoutFetch(`${base}/streams/${videoId}`, 8_000);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.error) continue;
      const formats = (data.videoStreams ?? [])
        .filter((s) => s.url && s.videoOnly === false && /\d+p/.test(s.quality ?? ''))
        .map((s) => ({
          itag: s.itag ?? 0,
          url: s.url,
          qualityLabel: s.quality ?? 'video',
          height: parseInt(s.quality, 10) || 0,
          bitrate: 0,
          contentLength: 0,
        }))
        .sort((a, b) => b.height - a.height);
      if (formats.length > 0) {
        return {
          title: data.title ?? '',
          durationSeconds: Number(data.duration ?? 0),
          formats,
          via: `piped:${new URL(base).hostname}`,
        };
      }
    } catch {
      /* اینستنس بعدی */
    }
  }
  throw new Error('all relays failed');
}

async function withTimeoutFetch(url, ms) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

/**
 * فرمت‌های muxed یک ویدیو را برمی‌گرداند؛ اول InnerTube، بعد رله‌های Piped.
 * خروجی: { title, durationSeconds, formats, via } یا خطا اگر هیچ‌کدام نشد.
 */
export async function getMuxedFormats(videoId) {
  let lastErr = new Error('no source succeeded');
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
  try {
    return await relayMuxed(videoId);
  } catch (err) {
    throw new Error(`${lastErr.message} | ${err.message}`);
  }
}

/** بهترین فرمت موجود (از بالاترین کیفیت؛ سقف حجم در حین دانلود چک می‌شود) */
export function pickVideoFormat(formats) {
  return (formats ?? [])[0] ?? null;
}

/** دیباگ: خروجی خام یک کلاینت خاص (برای مسیر /debug-video) */
export async function debugClient(videoId, clientName) {
  const client = CLIENTS.find((c) => c.name === clientName) ?? CLIENTS[0];
  const data = await playerRequest(videoId, client);
  const ps = data.playabilityStatus ?? {};
  let formats = [];
  try {
    formats = extractMuxed(data).formats;
  } catch {
    /* ویدیو پخش‌پذیر نیست؛ فقط وضعیت را برمی‌گردانیم */
  }
  return {
    via: client.name,
    playability: ps.status ?? 'UNKNOWN',
    reason: ps.reason ?? null,
    durationSeconds: Number(
      data.microformat?.playerMicroformatRenderer?.lengthSeconds ?? 0
    ),
    formats,
  };
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
