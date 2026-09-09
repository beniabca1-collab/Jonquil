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
import { ensureTempDir, cleanupTempDir } from './config.js';

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

bot.command('start', (ctx) =>
  ctx.reply(
    '👋 سلام!\n' +
      '🎵 اسم آهنگ رو برام بنویس یا فایل صوتیش رو بفرست،\n' +
      'من موزیک ویدیوش رو از یوتیوب پیدا می‌کنم و هم لینک و هم خود ویدیو رو برات می‌فرستم 🎬\n\n' +
      'اگه ویدیوی رسمی نداشته باشه، ۱۰ تا ویدیوی مرتبط نشونت می‌دم که خودت انتخاب کنی 😉'
  )
);

bot.command('help', (ctx) =>
  ctx.reply(
    '📖 <b>راهنما</b>\n\n' +
      '• اسم آهنگ + خواننده رو تایپ کن:\nمثلاً <code>Gorgon City Gone Missing</code>\n\n' +
      '• یا فایل صوتی (MP3/صوت/ویس) بفرست؛ اسمش رو از تگ‌های فایل می‌خونم.\n\n' +
      '• لینک یوتیوب هم بفرستی، همون ویدیو رو دانلود و ارسال می‌کنم.\n\n' +
      '⚠️ ویدیوها با کیفیت ۳۶۰p و حداکثر ۱۵ دقیقه ارسال می‌شن (محدودیت تلگرام).',
    { parse_mode: 'HTML' }
  )
);

// پیام متنی: اسم آهنگ یا لینک یوتیوب
bot.on('message:text', async (ctx) => {
  const parsed = queryFromText(ctx.message.text);
  try {
    if (parsed.type === 'link') {
      await handleVideoLink(ctx, parsed.videoId);
    } else if (parsed.value) {
      await handleSongRequest(ctx, parsed.value);
    } else {
      await ctx.reply('🎵 لطفاً اسم آهنگ رو بنویس یا فایل صوتیش رو بفرست.');
    }
  } catch (err) {
    console.error('text handler error:', err);
    await ctx.reply('😅 یه خطایی پیش اومد. دوباره امتحان کن.');
  }
});

// فایل صوتی / ویس / ویدیو / فایل
bot.on(['message:audio', 'message:voice', 'message:video', 'message:document'], async (ctx) => {
  const query = queryFromMedia(ctx.message);
  if (!query) {
    await ctx.reply('🤔 نتونستم اسم آهنگ رو از فایل بفهمم. اسم آهنگ + خواننده رو تایپ کن لطفاً.');
    return;
  }
  try {
    await handleSongRequest(ctx, query);
  } catch (err) {
    console.error('media handler error:', err);
    await ctx.reply('😅 یه خطایی پیش اومد. دوباره امتحان کن.');
  }
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
