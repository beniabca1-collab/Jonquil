// تست کامل: getInfo + برآورد حجم + دانلود و ادغام با ffmpeg
import { getVideoInfo, pickFormat, downloadVideo, formatTitle, formatDuration, formatSize } from '../src/services/download.js';
import fs from 'node:fs';
import path from 'node:path';

const videoId = process.argv[2] ?? 'JGwWNGJdvx8';

console.log('⏬ getInfo...');
const info = await getVideoInfo(videoId);
console.log(`✅ title: ${formatTitle(info)} — duration: ${formatDuration(info)}s`);

const fmt = pickFormat(info);
console.log(fmt ? '✅ فرمت ویدیو+صدا موجود است' : '❌ فرمتی نیست');
console.log(`✅ برآورد حجم: ${Math.round(formatSize(info, fmt) / 1048576)}MB`);

if (fmt) {
  fs.mkdirSync('temp', { recursive: true });
  const target = path.join('temp', `dl_${videoId}.mp4`);
  console.log('\n⏬ دانلود کامل + ادغام...');
  const t0 = Date.now();
  let last = 0;
  const finalPath = await downloadVideo(info, fmt, target, (pct) => {
    if (pct >= last + 25) {
      last = pct;
      console.log(`   ${pct}%`);
    }
  });
  const size = fs.statSync(finalPath).size;
  console.log(`✅ فایل: ${finalPath} → ${Math.round(size / 1048576)}MB در ${Math.round((Date.now() - t0) / 1000)}s`);
  fs.unlinkSync(finalPath);
  console.log('DL_OK');
}
