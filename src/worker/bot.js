/**
 * نسخه‌ی Workers بات Jonquil — حالت webhook و بدون دانلود ویدیو.
 * پیام‌ها و لورها دقیقاً همان متن‌های نسخه‌ی نود هستند؛ فقط ارسال
 * به‌صورت «لینک + تامبنیل» انجام می‌شود (Workers نمی‌تواند ffmpeg اجرا کند).
 */
import { Bot, InlineKeyboard, InputFile } from 'grammy';
import { nextLore, loreSignoff } from '../services/lore.js';
import { escapeHtml, truncate, withTimeout } from '../utils.js';
import {
  searchYouTube,
  findOfficialVideo,
  cleanQuery,
  fileNameToQuery,
} from './search.js';
import {
  getMuxedFormats,
  pickVideoFormat,
  downloadVideo,
  MAX_DURATION_SECONDS,
} from './streams.js';
import { createKvStore } from './store.js';

export function createWorkerBot(env) {
  const bot = new Bot(env.BOT_TOKEN);
  const selectionStore = createKvStore(env.JONQUIL_KV);

  const SEND = '\n\n⚠️ کیفیت بر اساس محدودیت تلگرام (۵۰MB) انتخاب می‌شه 🎬';

  /* ------------------- /start و /help ------------------- */
  bot.command('start', (ctx) =>
    ctx.reply(
      '👋 سلام!\n' +
        '🎵 اسم آهنگ رو برام بنویس،\n' +
        'من موزیک ویدیوش رو از یوتیوب پیدا می‌کنم و <b>خود ویدیو</b> رو برات می‌فرستم 🎬\n\n' +
        'اگه ویدیوی رسمی نداشته باشه، ۱۰ تا ویدیوی مرتبط نشونت می‌دم که خودت انتخاب کنی 😉\n\n' +
        nextLore(),
      { parse_mode: 'HTML' }
    )
  );

  bot.command('help', (ctx) =>
    ctx.reply(
      '📖 <b>راهنما</b>\n\n' +
        '• اسم آهنگ + خواننده رو تایپ کن:\nمثلاً <code>Gorgon City Gone Missing</code>\n\n' +
        '• لینک یوتیوب هم بفرستی، همون ویدیو رو برات می‌فرستم.\n\n' +
        '• فایل ویدیو با بهترین فرمت ترکیبی (صدا+تصویر) یوتیوب و حداکثر ۴۵MB ارسال می‌شه؛\nاگه بزرگ‌تر از سقف تلگرام بود، فقط لینکش رو می‌فرستم.',
      { parse_mode: 'HTML' }
    )
  );

  /* ------------------- کمکی‌ها ------------------- */

  /** ارسال فایل ویدیو با بالاترین فرمت muxed موجود؛ اگر نشد → لینک + تامبنیل */
  async function sendVideoFile(ctx, video, statusMsg = null) {
    let status = statusMsg;
    try {
      if (!status) {
        status = await ctx.reply(
          `🎬 دارم «${escapeHtml(truncate(video.title ?? '', 60))}» رو آماده می‌کنم...\n\n${nextLore()}`
        );
      } else {
        await ctx.api
          .editMessageText(
            ctx.chat.id,
            status.message_id,
            `🎬 پیدا شد! دارم بهترین کیفیت رو آماده می‌کنم...\n\n${nextLore()}`
          )
          .catch(() => {});
      }

      const { durationSeconds, formats, via } = await getMuxedFormats(video.videoId);
      if (durationSeconds && durationSeconds > MAX_DURATION_SECONDS) {
        throw new Error(`too long (${durationSeconds}s)`);
      }
      const fmt = pickVideoFormat(formats);
      if (!fmt) throw new Error('no muxed format');

      const dl = await withTimeout(downloadVideo(fmt.url), 110_000, 'download timeout');
      if (!dl) throw new Error(`bigger than telegram limit (${fmt.qualityLabel})`);

      const caption =
        `🎬 <b>${escapeHtml(truncate(video.title || '', 120))}</b>\n` +
        `👤 ${escapeHtml(truncate(video.author?.name ?? '', 80))}\n` +
        `🎞 ${escapeHtml(fmt.qualityLabel)} • ${(dl.bytes / 1048576).toFixed(1)}MB\n` +
        `🔗 ${video.url}${loreSignoff()}${SEND}`;

      const safeName = `${truncate((video.title || 'jonquil').replace(/[\\/:*?"<>|]/g, ''), 60)}.mp4`;
      await ctx.replyWithVideo(new InputFile(dl.blob, safeName), {
        caption,
        parse_mode: 'HTML',
        supports_streaming: true,
      });
      if (status) await ctx.api.deleteMessage(ctx.chat.id, status.message_id).catch(() => {});
      console.log(`video sent: ${video.videoId} via=${via} ${fmt.qualityLabel} ${(dl.bytes / 1048576).toFixed(1)}MB`);
    } catch (err) {
      console.error('sendVideoFile fallback to link:', err?.message ?? err);
      if (status) await ctx.api.deleteMessage(ctx.chat.id, status.message_id).catch(() => {});
      await sendLink(ctx, video, `⚠️ ارسال فایل ناموفق بود: <code>${escapeHtml(String(err?.message ?? err).slice(0, 120))}</code>\n`);
    }
  }

  /** ارسال نتیجه به شکل لینک + تامبنیل (fallback) */
  async function sendLink(ctx, video, extraText = '') {
    const caption =
      `🎬 <b>${escapeHtml(truncate(video.title, 120))}</b>\n` +
      `👤 ${escapeHtml(truncate(video.author?.name ?? '', 80))}\n` +
      `🔗 ${video.url}\n${extraText}${loreSignoff()}${SEND}`;
    await ctx
      .replyWithPhoto(video.thumbnail ?? `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`, {
        caption,
        parse_mode: 'HTML',
      })
      .catch(async () => {
        // اگر ارسال عکس نشد، فقط متن
        await ctx.reply(caption, { parse_mode: 'HTML' });
      });
  }

  async function showSelectionAlbum(ctx, statusMsgId, query, videos) {
    await ctx.api
      .editMessageText(
        ctx.chat.id,
        statusMsgId,
        '🎬 موزیک ویدیوی رسمی براش پیدا نکردم.\n⏳ چند تا ویدیوی مرتبط برات می‌فرستم که انتخاب کنی...'
      )
      .catch(() => {});

    const token = await selectionStore.create(videos, ctx.chat.id);

    const list = videos
      .map(
        (v, i) =>
          `${i + 1}. ${escapeHtml(truncate(v.title, 80))}${
            v.timestamp ? ` [${v.timestamp}]` : ''
          }`
      )
      .join('\n');

    const kb = new InlineKeyboard();
    for (let i = 0; i < videos.length; i++) {
      if (i > 0 && i % 5 === 0) kb.row();
      kb.text(String(i + 1), `pick:${token}:${i}`);
    }
    kb.row().text('❌ لغو', `pick:${token}:cancel`);

    await ctx.api.editMessageText(
      ctx.chat.id,
      statusMsgId,
      `🎬 یکی از اینا رو انتخاب کن:\n\n${list}\n\n${nextLore()}`,
      { parse_mode: 'HTML', reply_markup: kb }
    );
  }


  /* ------------------- فلوی اصلی ------------------- */
  async function handleSongRequest(ctx, rawQuery) {
    const query = cleanQuery(rawQuery);
    if (!query) {
      await ctx.reply('🎵 لطفاً اسم آهنگ رو بنویس.');
      return;
    }

    const status = await ctx.reply(
      `🔎 دارم دنبال «${escapeHtml(truncate(query, 60))}» می‌گردم...\n\n${nextLore()}`,
      { parse_mode: 'HTML' }
    );

    let videos;
    try {
      videos = await withTimeout(searchYouTube(query, 10), 25_000, 'جستجوی یوتیوب طول کشید');
    } catch {
      await ctx.api
        .editMessageText(ctx.chat.id, status.message_id, '❌ جستجو در یوتیوب ناموفق بود. دوباره تلاش کن.')
        .catch(() => {});
      return;
    }
    if (videos.length === 0) {
      await ctx.api
        .editMessageText(ctx.chat.id, status.message_id, '😕 هیچ نتیجه‌ای پیدا نشد. اسم آهنگ رو دقیق‌تر بنویس.')
        .catch(() => {});
      return;
    }

    const official = findOfficialVideo(videos.slice(0, 3));
    if (official) {
      await ctx.api
        .editMessageText(
          ctx.chat.id,
          status.message_id,
          `🎬 موزیک ویدیوی رسمی رو پیدا کردم!\n\n${nextLore()}`,
          { parse_mode: 'HTML' }
        )
        .catch(() => {});
      await sendVideoFile(ctx, official, status);
      return;
    }

    await showSelectionAlbum(ctx, status.message_id, query, videos);
  }

  async function handleVideoLink(ctx, videoId) {
    await sendVideoFile(ctx, {
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: 'ویدیوی موردنظرت',
      author: { name: 'YouTube' },
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    });
  }

  /* ------------------- هندلرهای پیام ------------------- */
  bot.on('message:text', async (ctx) => {
    const t = String(ctx.message.text ?? '').trim();
    const linkMatch = t.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/);
    try {
      if (linkMatch) {
        await handleVideoLink(ctx, linkMatch[1]);
      } else if (t) {
        await handleSongRequest(ctx, fileNameToQuery(t));
      } else {
        await ctx.reply('🎵 لطفاً اسم آهنگ رو بنویس.');
      }
    } catch (err) {
      console.error('text handler error:', err);
      await ctx.reply('😅 یه خطایی پیش اومد. دوباره امتحان کن.');
    }
  });

  // فایل صوتی/ویس با کپشن: اسمش رو از کپشن یا فایل‌نیم می‌خوانیم
  // (دانلود فایل در Workers ممکن نیست)
  bot.on(['message:caption', 'message:document'], async (ctx) => {
    const fileName = ctx.message.document?.file_name ?? '';
    const query = cleanQuery(fileNameToQuery(ctx.message.caption ?? fileName));
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

  /* ------------------- انتخاب از کیبورد ------------------- */
  bot.callbackQuery(/^pick:[0-9a-f-]+:(\d+|cancel)$/, async (ctx) => {
    const [, token, indexOrAction] = ctx.callbackQuery.data.split(':');
    const entry = await selectionStore.get(token);

    await ctx.answerCallbackQuery().catch(() => {});

    if (!entry) {
      await ctx.reply('⌛ این لیست منقضی شده. لطفاً دوباره اسم آهنگ رو بفرست.');
      return;
    }
    if (entry.chatId !== ctx.chat.id) return;

    if (indexOrAction === 'cancel') {
      await selectionStore.delete(token);
      await ctx.editMessageText('❌ لغو شد. هر وقت خواستی اسم آهنگ بعدی رو بفرست 🎵');
      return;
    }

    const video = entry.videos[Number(indexOrAction)];
    if (!video) {
      await ctx.reply('🤔 این گزینه معتبر نیست.');
      return;
    }

    await selectionStore.delete(token);
    await ctx.editMessageText(`✅ انتخاب شد: ${escapeHtml(truncate(video.title, 80))}`, {
      parse_mode: 'HTML',
    }).catch(() => {});
    await sendVideoFile(ctx, video);
  });

  return bot;
}
