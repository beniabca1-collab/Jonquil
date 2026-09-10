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
  '🌼🌚',
  '☀️🌼🌱',
  '🌼👂✨',
];

const FLORI = [
  '💛🌼⟡',
];

const MYTH = [
  '🪞🌼',
  '🌑🌼🕳️',
  '🩸🌺',
  '🎼🪨👀',
];

const NATURE = [
  '👃🌸🧠',
  '🦋🌙🌼',
  '🌧️🌱👃',
];

const HISTORY = [
  '🍃🤫🌼',
];

const NASRIN = [
  { t: '🌹🌿', f: 'q' },
  { t: '🌹✨', f: 'q' },
  { t: '🎧🌙', f: 'q' },
  { t: '🌼🌹', f: 'q' },
  { t: '☕🎶', f: 'q' },
  { t: '🌙🎧✨', f: 'q' },
];


const CRYPTIC = [
  { t: '🎧🌫️', f: 'q' },
  { t: '🎶⏳', f: 'q' },
  { t: '⏳🎶✨', f: 'q' },
  { t: '👃🌼💨', f: 'q' },
  { t: '🌙🎧', f: 'q' },
  { t: '👁️🎶👁️', f: 'q' },
  { t: '✨⋯✨', f: 'q' },
  { t: '🌼⏳💛', f: 'q' },
  { t: '🌼🪞✨', f: 's' },
  { t: '👁️🤫👁️', f: 's' },
  { t: '🤫✨🤫', f: 's' },
];

const ENGLISH = [
  { t: '🌼💛⟡', f: 'i' },
  { t: '🌼🌼🌼', f: 'i' },
  { t: '🌸👃✨', f: 'i' },
  { t: '💐✉️🌼', f: 'i' },
  { t: '🌹🌿✨', f: 'q' },
  { t: '🪞🎶🌼', f: 'q' },
  { t: '⌁✨', f: 'q' },
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
