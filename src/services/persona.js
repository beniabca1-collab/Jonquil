/**
 * پرسونا: جانکویل — یه موجود کوچولوی زنده که عاشق موسیقیه
 * و برای نسرین ساخته شده.
 *
 * قوانین لحن (مهم):
 * - گرم، بازیگوش، اول‌شخص («من»)؛ مثل یه موجود زنده حرف می‌زنه، نه یه ابزار خشک.
 * - فاصله‌ی محترمانه: نسرین هنوز دوست‌دختر سازنده نیست — پس هیچ اعتراف عاشقانه‌ای،
 *   هیچ لقب لوس («عشقم»، «عزیزم» و...) و هیچ ادعای رابطه‌ای ممنوع.
 * - اسم «نسرین» رو کم و به‌جا استفاده کن، نه توی هر پیام.
 * - تحسین، فقط در حد سلیقه‌ی موسیقی و کنجکاوی مهربون.
 */

/** خواندن شناسه‌ی استیکرها از env (نود) یا env ورکر */
export function stickerIds(envLike) {
  const fromEnv = (k) => {
    try {
      if (envLike && envLike[k]) return envLike[k];
    } catch { /* ignore */ }
    try {
      if (typeof process !== 'undefined' && process.env && process.env[k]) return process.env[k];
    } catch { /* ignore */ }
    return '';
  };
  return {
    hello: fromEnv('STICKER_HELLO'),
    found: fromEnv('STICKER_FOUND'),
    sorry: fromEnv('STICKER_SORRY'),
    flower: fromEnv('STICKER_FLOWER'),
  };
}

/**
 * ارسال استیکر موقت که خودش بعد از ttlMs پاک می‌شه.
 * اگه fileId خالی باشه یا ارسال شکست بخوره، بی‌صدا رد می‌شه (بات بدون استیکر هم کار می‌کنه).
 */
export async function sendEphemeralSticker(ctx, fileId, ttlMs = 8000) {
  if (!fileId) return null;
  try {
    const msg = await ctx.replyWithSticker(fileId);
    if (msg && msg.message_id) {
      setTimeout(() => {
        ctx.api.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
      }, ttlMs);
    }
    return msg;
  } catch {
    return null;
  }
}

/** اسم مخاطب — چون این بات فقط برای نسرینه، پیش‌فرض «نسرین» */
export function addressName(ctx) {
  const first = ctx?.from?.first_name;
  if (first && /نسرین/i.test(first)) return 'نسرین';
  return 'نسرین';
}

/* ---------------- متن‌های مشترک پرسونا ---------------- */

export function welcomeText() {
  return (
    'سلام نسرین! 🌼\n' +
    'من جانکویلم — یه موجود کوچولو که عاشق موسیقیه و تازه اینجا خونه کرده.\n' +
    'منو ساختن که هر آهنگی دلت خواست رو برات پیدا کنم و خودِ ویدیوش رو بیارم 🎬\n\n' +
    'اسم آهنگ + خواننده رو بفرست، بقیه‌ش با من 😉'
  );
}

export function helpText() {
  return (
    '📖 <b>راهنمای خونه‌ی من</b>\n\n' +
    '• اسم آهنگ + خواننده رو تایپ کن:\nمثلاً <code>Gorgon City Gone Missing</code>\n\n' +
    '• یا فایل صوتی (MP3/صوت/ویس) بفرست؛ از اسم فایل می‌فهمم چی می‌خوای.\n\n' +
    '• لینک یوتیوب هم بفرستی، همون ویدیو رو برات میارم.\n\n' +
    '⚠️ ویدیوها با کیفیت تا ۷۲۰p و حداکثر ۱۵ دقیقه میارم (سقف تلگرام: ۵۰ مگابایت).\n\n' +
    '💡 راستی، اگه یه استیکر متحرک قشنگ (مثلاً گل نرگس) برام فوروارد کنی، یاد می‌گیرمش و بعداً سورپرایزت می‌کنم 🌼'
  );
}

export function searchingText(query, escapeHtml, truncate, nextLore) {
  return (
    `باشه، گوش‌هام رو تیز کردم 🎧 دارم دنبال «${escapeHtml(truncate(query, 60))}» می‌گردم...\n\n${nextLore()}`
  );
}

export function foundText(nextLore) {
  return `پیداش کردم! 🎬 بذار بیارمش...\n\n${nextLore()}`;
}

export function noOfficialText() {
  return (
    'موزیک‌ویدیوی رسمی‌ش رو پیدا نکردم، ولی ناامید نشو —\n' +
    '⏳ چند تا گزینه‌ی نزدیک برات می‌چینم، یکیش رو انتخاب کن 👇'
  );
}

export function deliveredCaption() {
  const lines = [
    'رسید! 🎬 بفرما، اینم آهنگت. نوش جونت 🌼',
    'آوردمش! 🎬 امیدوارم به سلیقه‌ت بخوره 😉',
    'اینم از این 🎬 بذار پخش شه، منم همین‌جام گوش می‌دم 🎧',
  ];
  return lines[Math.floor(Math.random() * lines.length)];
}
