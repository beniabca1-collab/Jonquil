/**
 * استخر پیام‌های مرموز «نسرین / jonquil» با فرمت HTML تلگرام.
 *
 * هر مورد یا یک رشته است (با قالب پیش‌فرض دسته‌اش) یا یک آبجکت { t, f }.
 * قالب‌ها (f):
 *   i → <i>ایتالیک</i>              حالت پیش‌فرض؛ نویسه‌ی آرام و ناشناس
 *   q → <blockquote>نقل‌قول</blockquote>   برای پیام‌های رمزی و تأمل‌برانگیز
 *   s → <tg-spoiler>پنهان</tg-spoiler>       نادرترین‌ها؛ خودش یه act of mystery ـه
 *   e → <blockquote expandable>بلند</blockquote>  برای لورهای بلندترِ نادر
 */

const JONQUIL = [
  '🌼 jonquil از تیره‌ی نرگسه؛ کوچیکه، ولی عطرش معمولاً زودتر از خودش می‌رسه.',
  '🌙 jonquil شب‌ها خوش‌عطرتره؛ بعضی چیزها برای دیده‌شدن ساخته نشدن.',
  '☀️ خاستگاه jonquil جنوب اروپاست؛ جایی که بهار، کمی زودتر از بقیه می‌رسه.',
  '〰️ خوشه‌های jonquil معمولاً به یک سمت خم می‌شن؛ انگار دارن به چیزی گوش می‌دن.',
  '⚠️ پیاز نرگس سمیه؛ زیبایی همیشه یه خط قرمز داره.',
];

const FLORI = [
  '💛 در زبان گل‌ها، jonquil یعنی میل؛ و گاهی، محبتی که جواب گرفت. ⟡',
  '🪞 نرگس یعنی خودشیفتگی؛ بعضی گل‌ها قاضی‌ان، نه شاهد.',
  '🌹 رز وحشی یعنی استقلالِ خاردار؛ زیبایی‌ای که عذرخواهی نمی‌کنه.',
  '💜 بنفشه یعنی وفاداریِ فروتن؛ سرش پایینه، ولی حرفش بلنده.',
  '🌷 لاله یعنی اعتراف؛ بعضی گل‌ها چیزهایی می‌گن که آدم‌ها نمی‌تونن.',
];

const MYTH = [
  '🪞 نارسیس به گل تبدیل شد، اِکو فقط صداش رو نگه داشت؛ یکی دیده شد، یکی شنیده.',
  '🌑 پرسفونه وقتی نرگس رو چید، زمین دهن باز کرد؛ بعضی گل‌ها درِ یه جای دیگه‌ن.',
  '🩸 در اسطوره‌ی یونان، سنبل از خون هیاکینتوس رویید؛ حتی خدایان هم همیشه بی‌خطا نیستن.',
  '🎼 اورفئوس با موسیقی سنگ رو نرم کرد؛ ولی یه نگاه، همه‌چیزو خراب کرد.',
];

const NATURE = [
  '👃 حافظه‌ی بو راهش رو مستقیم به مغز پیدا می‌کنه؛ برای همین بعضی عطرها از بعضی آدم‌ها موندگارترن.',
  '🦋 گل‌های شب‌شکوفا برای پروانه‌ها باز می‌شن؛ نه برای ما.',
  '🌧️ بوی بارون روی خاک «پتریکور» نام داره؛ شاعرها خیلی قبل‌تر پیداش کرده بودن.',
  '🌱 رشد ریشه در تاریکی اتفاق می‌افته؛ چیزی که دیده می‌شه، فقط نتیجه‌ست.',
];

const HISTORY = [
  '💌 ویکتوریایی‌ها با گل‌ها نامه می‌نوشتن؛ یک گل عوض می‌شد، معنی عوض می‌شد.',
  '📜 در دوره‌ی لاله، بعضی پیازها قیمت یک خونه رو داشتن؛ حباب، همیشه فقط مالی نیست.',
  '🌹 در ایران قدیم، گلاب قمصر از بخار گل محمدی گرفته می‌شد؛ بعضی رسم‌ها پیر نمی‌شن.',
  '🍃 ژاپنی‌ها به گل‌آرایی می‌گن ایکه‌بانا؛ جایی که سکوت هم بخشی از زیباییه.',
];

const NASRIN = [
  { t: '🌙 نسرین؛ اسمی که هم عطر داره، هم کمی راز.', f: 'q' },
  { t: '✦ بعضی اسم‌ها بیشتر از یک معنی دارن؛ نسرین یکی از اوناست.', f: 'q' },
  { t: '<b>🌹 نسرین</b>؛ بعضی اسم‌ها رو نمی‌شه فقط اسم صدا زد.', f: 'q' },
  { t: '🥀 رز وحشی رو نمی‌شه کاملاً رام کرد؛ بعضی اسم‌ها هم همین‌طورن.', f: 'q' },
  // لورهای ملایم و محترمانه — تحسین سلیقه، بدون اعتراف عاشقانه
  { t: '🎧 سلیقه‌ی موسیقی آدم‌ها مثل اثر انگشته؛ مال تو یه‌جور خاصه.', f: 'q' },
  { t: '🌼 به نسرین می‌گن رز وحشی؛ یعنی قشنگی‌ای که برای دیده‌شدن تلاش نمی‌کنه.', f: 'q' },
  { t: '☕ بعضی آدم‌ها آهنگ‌هاشون رو با دقت انتخاب می‌کنن؛ این خودش یه هنره.', f: 'q' },
  { t: '🌙 شب که می‌شه، بعضی آهنگ‌ها معنی تازه‌ای پیدا می‌کنن. این‌یکی هم از همون‌هاست.', f: 'q' },
];


const CRYPTIC = [
  { t: 'چیزی که می‌بینی ترانه‌ست. چیزی که می‌شنوی… فعلاً.', f: 'q' },
  { t: 'این پیام قرار بود چیز دیگه‌ای باشه؛ ولی همین بهتر شد.', f: 'q' },
  { t: 'بعضی انتظارها خودشون یه جور موسیقی‌ن.', f: 'q' },
  { t: 'صبر کن؛ دارم چیزایی رو جابه‌جا می‌کنم که نمی‌بینی.', f: 'q' },
  { t: 'عطر قبل از گل می‌رسه. نتیجه قبل از پیام.', f: 'q' },
  { t: 'یه نفر یه‌جا داره همین آهنگ رو گوش می‌ده؛ آمار نیست، حدسه.', f: 'q' },
  { t: '⋯', f: 'q' },
  { t: 'گل‌ها عجله ندارن. تو هم لازم نیست.', f: 'q' },
  { t: 'این جمله رو دوبار نخون؛ بار دوم معناش عوض می‌شه.', f: 's' },
  { t: 'نرگس زرد هیچ‌وقت به آینه نگاه نکرد؛ وگرنه قصه فرق می‌کرد.', f: 's' },
  { t: 'اگه این پیام رو فهمیدی، به خودت بگو. اگه نفهمیدی، به هیچ‌کس.', f: 's' },
];

const ENGLISH = [
  { t: 'In the language of flowers, jonquil means desire. ⟡', f: 'i' },
  { t: 'Jonquil blooms in clusters; it never opens alone.', f: 'i' },
  { t: 'Some flowers are remembered by color. Others, by scent.', f: 'i' },
  { t: 'The Victorians wrote letters with bouquets; one flower moved, the message changed.', f: 'i' },
  { t: '<b>Nasrin</b> means wild rose. The rest is yours to interpret.', f: 'q' },
  { t: 'Narcissus turned into a flower; Echo kept the voice. Both became nouns.', f: 'q' },
  { t: '⌁', f: 'q' },
];

/* ------------------------------------------------------------------ */
/*  چرخش بدون تکرار (deck شافل‌شده) + وزن‌دهی دسته‌ها                  */
/* ------------------------------------------------------------------ */

// وزن نسبی ورود پیام از هر دسته در هر دور
const POOLS = [
  { items: JONQUIL, def: 'i', weight: 30 },
  { items: FLORI, def: 'i', weight: 24 },
  { items: NATURE, def: 'i', weight: 18 },
  { items: MYTH, def: 'i', weight: 12 },
  { items: HISTORY, def: 'i', weight: 8 },
  { items: NASRIN, def: 'q', weight: 4 },
  { items: CRYPTIC, def: 'q', weight: 3 },
  { items: ENGLISH, def: 'i', weight: 3 },
];

const TOTAL_WEIGHT = POOLS.reduce((s, p) => s + p.weight, 0);

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function expandable(text) {
  if (text.length <= 160) return text;
  const cut = text.lastIndexOf('؛', 160);
  const at = cut > 40 ? cut + 1 : 160;
  return `${text.slice(0, at)}<span class="tg-spoiler">${text.slice(at)}</span>`;
}

// صف فعلی؛ هر دور، ورودی‌ها بر زده و مصرف می‌شوند
let deck = [];
let lastText = '';

function refillDeck() {
  deck = [];
  for (const pool of POOLS) {
    const count = Math.max(1, Math.round((pool.weight / TOTAL_WEIGHT) * 60));
    for (let i = 0; i < count; i++) deck.push(pool);
  }
  deck = shuffle(deck);
}

/**
 * پیام لور بعدی (رشته‌ی HTML آماده برای parse_mode HTML).
 * تکراری نیست مگر بعد از تمام شدن استخر؛ پیام آخر دسته‌ی قبلی
 * اول دسته‌ی جدید قرار نمی‌گیرد.
 */
export function nextLore() {
  if (deck.length === 0) refillDeck();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (deck.length === 0) refillDeck();
    const pool = deck.pop();
    const raw = pool.items[Math.floor(Math.random() * pool.items.length)];
    const text = typeof raw === 'string' ? raw : raw.t;
    if (text === lastText) continue;
    lastText = text;
    const fmt = typeof raw === 'string' ? pool.def : raw.f;
    if (fmt === 'q') return `<blockquote>${text}</blockquote>`;
    if (fmt === 's') return `<tg-spoiler>${text}</tg-spoiler>`;
    if (fmt === 'e') return `<blockquote expandable>${expandable(text)}</blockquote>`;
    return `<i>${text}</i>`;
  }
}

/** امضای ظریف ته کپشن‌ها (با شانس کم) */
export function loreSignoff() {
  const roll = Math.random();
  if (roll < 0.5) return '\n⟡';
  if (roll < 0.75) return `\n<i>${pickRandom(JONQUIL)}</i>`;
  return `\n${pickRandom(CRYPTIC_TEXTS)}`;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const CRYPTIC_TEXTS = CRYPTIC.map((c) => `<i>${c.t}</i>`);
