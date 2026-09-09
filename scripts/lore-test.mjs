// اعتبارسنجی خروجی لور: توازن تگ‌های HTML + طول متن + عدم تکرار پشت سر هم
import { nextLore, loreSignoff } from '../src/services/lore.js';

function stripTags(s) {
  return s
    .replace(/<\/?i>/g, '')
    .replace(/<\/?blockquote( expandable)?>/g, '')
    .replace(/<\/?tg-spoiler>/g, '')
    .replace(/<\/?b>/g, '');
}

function tagBalance(s, open, close) {
  const o = (s.match(new RegExp(open, 'g')) || []).length;
  const c = (s.match(new RegExp(close, 'g')) || []).length;
  return o === c;
}

let fails = 0;
let prev = null;
for (let i = 0; i < 200; i++) {
  const line = nextLore();
  if (line === prev) {
    console.log(`❌ تکرار متوالی در ایندکس ${i}`);
    fails++;
  }
  prev = line;
  const ok =
    tagBalance(line, '<i>', '</i>') &&
    tagBalance(line, '<blockquote( expandable)?>', '</blockquote>') &&
    tagBalance(line, '<tg-spoiler>', '</tg-spoiler>') &&
    tagBalance(line, '<b>', '</b>');
  if (!ok) {
    console.log(`❌ تگ نامتوازن: ${line}`);
    fails++;
  }
  if (stripTags(line).length === 0 || stripTags(line).length > 1000) {
    console.log(`❌ طول نامعتبر: ${line}`);
    fails++;
  }
}

const seen = new Set();
for (let i = 0; i < 30; i++) seen.add(loreSignoff());
console.log(`signoffهای یکتا در ۳۰ نمونه: ${seen.size}`);

console.log(fails === 0 ? 'LORE_VALIDATE_OK (۲۰۰ نمونه، بدون تکرار و بدون خطای تگ)' : `❌ ${fails} خطا`);
process.exit(fails === 0 ? 0 : 1);
