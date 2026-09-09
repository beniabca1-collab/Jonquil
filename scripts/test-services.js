/**
 * تست سرویس‌ها بدون تلگرام:
 *   node scripts/test-services.js [اسم آهنگ]
 */
import { searchYouTube, findOfficialVideo, fileNameToQuery } from '../src/services/youtube.js';
import { getVideoInfo, pickFormat, formatTitle, formatDuration, formatSize } from '../src/services/download.js';
import { downloadThumbnail } from '../src/services/thumbnail.js';
import fs from 'node:fs';

const query = process.argv.slice(2).join(' ') || 'Shape of You Ed Sheeran';

console.log(`🔎 جستجو: "${query}"`);
const videos = await searchYouTube(query, 10);
console.log(`✅ ${videos.length} نتیجه:`);
videos.slice(0, 10).forEach((v, i) => {
  console.log(`  ${i + 1}. [${v.videoId}] ${v.title} — ${v.author?.name} (${v.timestamp})`);
});

const official = findOfficialVideo(videos.slice(0, 3));
console.log(official ? `🎬 رسمی: ${official.title}` : 'ℹ️ ویدیوی رسمی در ۳ نتیجه اول نبود → مسیر انتخاب');

if (videos.length > 0) {
  const target = official ?? videos[0];

  console.log(`\n⏬ تست تامبنیل: ${target.videoId}`);
  try {
    const f = await downloadThumbnail(target.videoId, 'test', 0);
    console.log(`✅ تامبنیل: ${f} (${fs.statSync(f).size} bytes)`);
    fs.unlinkSync(f);
  } catch (e) {
    console.log(`❌ تامبنیل: ${e.message}`);
  }

  console.log(`\n⏬ تست getInfo: ${target.videoId}`);
  try {
    const info = await getVideoInfo(target.videoId);
    const fmt = pickFormat(info);
    console.log(`✅ «${formatTitle(info)}» — ${formatDuration(info)}s`);
    console.log(
      fmt
        ? `✅ دانلود ممکن است — برآورد حجم: ${Math.round(formatSize(info, fmt) / 1048576)}MB`
        : '❌ فرمت قابل ارسال پیدا نشد'
    );
  } catch (e) {
    console.log(`❌ getInfo: ${e.message}`);
  }
}

console.log('\n🧪 تست fileNameToQuery:');
for (const name of [
  'Ed Sheeran - Shape Of You [Official Video] 320kbps.mp3',
  '01-track_name-yt.mp3',
  'هومن - بی تو (320).mp3',
]) {
  console.log(`  "${name}" → "${fileNameToQuery(name)}"`);
}
