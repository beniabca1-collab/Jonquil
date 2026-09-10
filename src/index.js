import 'dotenv/config';
import { Bot } from 'grammy';
import './services/proxy.js';
import {
  handleSongRequest,
  handleSelection,
  handleVideoLink,
  queryFromMedia,
  queryFromText,
} from './handlers/song.js';
import { nextLore } from './services/lore.js';
import { ensureTempDir, cleanupTempDir } from './config.js';
import {
  welcomeText,
  helpText,
  stickerIds,
  sendEphemeralSticker,
} from './services/persona.js';

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN در فایل .env تنظیم نشده است.');
  console.error('   فایل .env.example را به .env کپی کنید و توکن بات را از @BotFather بگذارید.');
  process.exit(1);
}

ensureTempDir();
cleanupTempDir();

const bot = new Bot(BOT_TOKEN);

// نمایش دستورات در منوی بات
bot.api.setMyCommands([
  { command: 'start', description: 'شروع / راهنما' },
  { command: 'help', description: 'راهنمای استفاده' },
]).catch(() => {});

const OWNER_ID = process.env.OWNER_ID ? Number(process.env.OWNER_ID) : 0;
// اگه OWNER_ID ست نشده باشه، حالت یادگیری غیرفعاله تا نسرین پیام فنی نبینه.
const isOwner = (ctx) => Boolean(OWNER_ID) && ctx.from?.id === OWNER_ID;

bot.command('start', async (ctx) => {
  await sendEphemeralSticker(ctx, stickerIds().hello, 9000);
  await ctx.reply(welcomeText() + '\n\n' + nextLore(), { parse_mode: 'HTML' });
});

bot.command('help', (ctx) => ctx.reply(helpText(), { parse_mode: 'HTML' }));

// پیام متنی: اسم آهنگ یا لینک یوتیوب
bot.on('message:text', async (ctx) => {
  const parsed = queryFromText(ctx.message.text);
  try {
    if (parsed.type === 'link') {
      await handleVideoLink(ctx, parsed.videoId);
    } else if (parsed.value) {
      await handleSongRequest(ctx, parsed.value);
    } else {
      await ctx.reply('یه اسم آهنگ بهم بده، منم مثل برق می‌رم دنبالش 🎧');
    }
  } catch (err) {
    console.error('text handler error:', err);
    await sendEphemeralSticker(ctx, stickerIds().sorry, 8000);
    await ctx.reply('اوپس 😅 یه‌جا گیر کردم... یه بار دیگه بگو چی می‌خوای؟');
  }
});

// فایل صوتی / ویس / ویدیو / فایل
bot.on(['message:audio', 'message:voice', 'message:video', 'message:document'], async (ctx) => {
  // یادگیری استیکر: اگه صاحب بات یه استیکر بفرسته، file_idـش رو لاگ می‌کنم
  // تا توی .env بذاری (STICKER_*). پیام راهنما هم به خود صاحب بات داده می‌شه.
  if (ctx.message.sticker && isOwner(ctx)) {
    const f = ctx.message.sticker;
    console.log(`[sticker-learn] emoji=${f.emoji ?? '?'} animated=${f.is_animated} video=${f.is_video} file_id=${f.file_id} set=${f.set_name ?? '-'}`);
    await ctx.reply(
      'یاد گرفتم! ✅\n' +
        `این file_id رو بذار توی <code>.env</code>:\n<code>${f.file_id}</code>\n\n` +
        '• سلام/hello → <code>STICKER_HELLO</code>\n' +
        '• پیدا شد → <code>STICKER_FOUND</code>\n' +
        '• معذرت/خطا → <code>STICKER_SORRY</code>\n' +
        '• گل نرگس 🌼 → <code>STICKER_FLOWER</code>\n\n' +
        'بعدش سرویس رو ری‌استارت کن: <code>sudo systemctl restart jonquil</code>',
      { parse_mode: 'HTML' }
    );
    return;
  }

  const query = queryFromMedia(ctx.message);
  if (!query) {
    await ctx.reply('اسم این فایل رو نفهمیدم 🤔 اسم آهنگ + خواننده رو تایپ کن، خودم پیداش می‌کنم.');
    return;
  }
  try {
    await handleSongRequest(ctx, query);
  } catch (err) {
    console.error('media handler error:', err);
    await sendEphemeralSticker(ctx, stickerIds().sorry, 8000);
    await ctx.reply('اوپس 😅 یه‌جا گیر کردم... یه بار دیگه امتحان کن.');
  }
});

// استیکر (جدا از document): فقط برای یادگیری از طرف صاحب بات
bot.on('message:sticker', async (ctx) => {
  if (!isOwner(ctx)) return;
  const f = ctx.message.sticker;
  console.log(`[sticker-learn] emoji=${f.emoji ?? '?'} animated=${f.is_animated} video=${f.is_video} file_id=${f.file_id} set=${f.set_name ?? '-'}`);
  await ctx.reply(
    'یاد گرفتم! ✅\n' +
      `این file_id رو بذار توی <code>.env</code>:\n<code>${f.file_id}</code>\n\n` +
      '• سلام/hello → <code>STICKER_HELLO</code>\n' +
      '• پیدا شد → <code>STICKER_FOUND</code>\n' +
      '• معذرت/خطا → <code>STICKER_SORRY</code>\n' +
      '• گل نرگس 🌼 → <code>STICKER_FLOWER</code>\n\n' +
      'بعدش سرویس رو ری‌استارت کن: <code>sudo systemctl restart jonquil</code>',
    { parse_mode: 'HTML' }
  );
});

// انتخاب از کیبورد شماره‌دار
bot.callbackQuery(/^pick:[0-9a-f]+:(\d+|cancel)$/, handleSelection);

bot.catch((err) => {
  console.error('bot error:', err.error ?? err);
});

bot.start({
  onStart: (me) => console.log(`✅ بات روشن شد: @${me.username}`),
});

process.on('SIGINT', () => {
  console.log('🛑 خاموش می‌شویم...');
  bot.stop();
  process.exit(0);
});
