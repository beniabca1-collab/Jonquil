// تست سریع جستجوی یوتیوب نسخه‌ی Workers (روی نود هم اجرا می‌شود)
import { searchYouTube, findOfficialVideo } from '../src/worker/search.js';

const vids = await searchYouTube('Gorgon City Gone Missing', 5);
console.log('results:', vids.length);
vids.forEach((v, i) =>
  console.log(i + 1, v.timestamp, '|', v.title.slice(0, 50), '|', v.author.name.slice(0, 30))
);
const off = findOfficialVideo(vids.slice(0, 3));
console.log('official?', off ? off.title.slice(0, 60) : 'none');
