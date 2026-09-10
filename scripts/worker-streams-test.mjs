// تست فرمت‌های InnerTube (muxed mp4) — اجرا: npm run test:streams
import { getMuxedFormats, pickVideoFormat } from '../src/worker/streams.js';

const ids = process.argv.slice(2);
const list = ids.length ? ids : ['dQw4w9WgXcQ'];

for (const id of list) {
  try {
    const { title, durationSeconds, formats } = await getMuxedFormats(id);
    console.log(`\n▶ ${id} — ${title} [${durationSeconds}s]`);
    if (formats.length === 0) {
      console.log('  ❌ هیچ فرمت muxed مستقیمی نبود');
      continue;
    }
    for (const f of formats) {
      console.log(
        `  itag=${f.itag} ${f.qualityLabel} ${(f.contentLength / 1048576).toFixed(1)}MB bitrate=${f.bitrate}`
      );
    }
    const best = pickVideoFormat(formats);
    if (!best) {
      console.log('  ⚠️ فرمتی نیست');
      continue;
    }
    console.log(`  ✅ انتخاب: itag=${best.itag} ${best.qualityLabel}`);
    // اعتبارسنجی URL دانلود: فقط ۱ مگابایت اول با Range
    const dr = await fetch(best.url, { headers: { Range: 'bytes=0-1048575' } });
    const buf = await dr.arrayBuffer();
    console.log(
      `  ⬇️ probe: HTTP ${dr.status} ${(buf.byteLength / 1048576).toFixed(2)}MB content-range=${
        dr.headers.get('content-range') ?? '-'
      } type=${dr.headers.get('content-type') ?? '-'}`
    );
  } catch (err) {
    console.log(`\n▶ ${id} — FAILED: ${err.message}`);
  }
}
