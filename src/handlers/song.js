import fs from 'node:fs';
import path from 'node:path';
import { InputFile } from 'grammy';
import { searchYouTube, findOfficialVideo, cleanQuery, fileNameToQuery } from '../services/youtube.js';
import { getVideoInfo, pickFormat, downloadVideo, formatTitle, formatDuration, formatSize } from '../services/download.js';
import { downloadThumbnail } from '../services/thumbnail.js';
import { selectionStore } from '../services/selection-store.js';
import { buildSelectionKeyboard } from '../keyboards.js';
import { escapeHtml, truncate } from '../utils.js';
import { TEMP_DIR, MAX_FILE_SIZE, MAX_DURATION_SECONDS, ensureTempDir } from '../config.js';

/* ------------------------------------------------------------------ */
/*  مرحله ۱: جستجو و تصمیم‌گیری                                        */
/* ------------------------------------------------------------------ */

/**
 * فلوی اصلی: از اسم آهنگ جستجو می‌کند؛ اگر موزیک ویدیوی رسمی بود،
 * لینک + فایل ویدیو را می‌فرستد؛ وگرنه آلبوم ۱۰ تامبنیلی با دکمه‌های
 * شماره‌دار نشان می‌دهد تا کاربر انتخاب کند.
 */
export async function handleSongRequest(ctx, rawQuery) {
  const query = cleanQuery(rawQuery);
  if (!query) {
    await ctx.reply('🎵 لطفاً اسم آهنگ رو بنویس یا فایل صوتیش رو بفرست.');
    return;
  }

  const status = await ctx.reply(`🔎 دارم دنبال «${truncate(query, 60)}» می‌گردم...`);

  let videos;
  try {
    videos = await searchYouTube(query, 10);
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

  // اگر در ۳ نتیجه‌ی اول موزیک ویدیوی رسمی بود → مستقیم ارسال
  const official = findOfficialVideo(videos.slice(0, 3));
  if (official) {
    await ctx.api
      .editMessageText(ctx.chat.id, status.message_id, '🎬 موزیک ویدیو پیدا شد! دارم آماده‌اش می‌کنم...')
      .catch(() => {});
    await sendVideo(ctx, official.videoId);
    return;
  }

  // وگرنه: ۱۰ تامبنیل + کیبورد انتخاب
  await showSelectionAlbum(ctx, status.message_id, query, videos);
}

/* ------------------------------------------------------------------ */
/*  مرحله ۲: آلبوم انتخاب (وقتی ویدیوی رسمی نبود)                     */
/* ------------------------------------------------------------------ */

async function showSelectionAlbum(ctx, statusMsgId, query, videos) {
  await ctx.api
    .editMessageText(
      ctx.chat.id,
      statusMsgId,
      '🎬 موزیک ویدیوی رسمی براش پیدا نکردم.\n⏳ چند تا ویدیوی مرتبط برات می‌فرستم که انتخاب کنی...'
    )
    .catch(() => {});

  const token = selectionStore.create(videos, ctx.chat.id);
  ensureTempDir();

  const files = [];
  const results = await Promise.allSettled(
    videos.map((v, i) => downloadThumbnail(v.videoId, token, i))
  );
  results.forEach((r) => {
    if (r.status === 'fulfilled') files.push(r.value);
  });

  if (files.length === 0) {
    // اگر هیچ تامبنیلی دانلود نشد → لیست متنی
    const list = videos.map((v, i) => `${i + 1}. ${v.title}\n🔗 ${v.url}`).join('\n\n');
    await ctx.reply(`🎵 نتیجه‌های «${truncate(query, 50)}»:\n\n${list}`);
    return;
  }

  const caption = (i) =>
    `<b>${i + 1}.</b> ${escapeHtml(truncate(videos[i].title, 90))}\n` +
    `👤 ${escapeHtml(truncate(videos[i].author?.name ?? '-', 40))} • ${videos[i].timestamp ?? ''}`;

  try {
    const mediaGroup = files.map((file, i) => ({
      type: 'photo',
      media: new InputFile(file),
      caption: caption(i),
      parse_mode: 'HTML',
    }));
    await ctx.api.sendMediaGroup(ctx.chat.id, mediaGroup);
  } catch (err) {
    console.error('sendMediaGroup error:', err.message);
    await ctx.reply(
      '⚠️ ارسال تصاویر ناموفق بود؛ لیست متنی:\n\n' +
        videos.map((v, i) => `${i + 1}. ${v.title}\n${v.url}`).join('\n\n')
    );
  } finally {
    files.forEach((f) => fs.promises.unlink(f).catch(() => {}));
  }

  await ctx.reply(`👇 کدوم رو برات بفرستم؟ («${escapeHtml(truncate(query, 40))}»)`, {
    parse_mode: 'HTML',
    reply_markup: buildSelectionKeyboard(token, Math.min(videos.length, 10)),
  });
}

/* ------------------------------------------------------------------ */
/*  مرحله ۳: ارسال لینک + فایل ویدیو                                  */
/* ------------------------------------------------------------------ */

/** برای وقتی کاربر مستقیم لینک یوتیوب می‌فرستد — بدون جستجو */
export async function handleVideoLink(ctx, videoId) {
  await sendVideo(ctx, videoId);
}

async function sendVideo(ctx, videoId) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  let info;
  try {
    info = await getVideoInfo(url);
  } catch (err) {
    console.error('getVideoInfo error:', err.message);
    await ctx.reply(`❌ نتونستم اطلاعات ویدیو رو بگیرم 😕\nاما لینکش اینجاست:\n${url}`);
    return;
  }

  const title = formatTitle(info);
  const duration = formatDuration(info);
  const format = pickFormat(info);
  const size = formatSize(info, format);
  const tooBig =
    !format ||
    size > MAX_FILE_SIZE ||
    duration > MAX_DURATION_SECONDS;

  // ۱) لینک را همیشه بفرست
  const linkText =
    `🎬 <b>${escapeHtml(truncate(title, 100))}</b>\n` +
    `🔗 ${url}` +
    (tooBig
      ? '\n\n⚠️ این ویدیو برای ارسال فایل خیلی بزرگ/بلنده؛ فقط لینکش رو دارم.'
      : '\n\n⏳ دارم ویدیو رو دانلود و ارسال می‌کنم...');
  await ctx.reply(linkText, { parse_mode: 'HTML' });

  if (tooBig) return;

  // ۲) دانلود و ارسال فایل ویدیو
  ensureTempDir();
  const filePath = path.join(TEMP_DIR, `video_${videoId}.mp4`);
  const progressMsg = await ctx.reply('⏬ دانلود: 0%');
  let lastPct = 0;

  try {
    const finalPath = await downloadVideo(info, format, filePath, (pct) => {
      if (pct - lastPct >= 25) {
        lastPct = pct;
        ctx.api
          .editMessageText(ctx.chat.id, progressMsg.message_id, `⏬ دانلود: ${pct}%`)
          .catch(() => {});
      }
    });

    await ctx.api
      .editMessageText(ctx.chat.id, progressMsg.message_id, '📤 در حال ارسال ویدیو...')
      .catch(() => {});

    const size = fs.statSync(finalPath).size;
    if (size > MAX_FILE_SIZE) {
      await ctx.reply('⚠️ حجم فایل از حد مجاز تلگرام بیشتر شد؛ لینک بالارو داری 🙏');
      return;
    }

    await ctx.replyWithVideo(
      new InputFile(finalPath, `${truncate(title, 60).replace(/[\\/:*?"<>|]/g, '')}.mp4`),
      {
        caption: `🎬 ${escapeHtml(truncate(title, 200))}\n🔗 ${url}`,
        parse_mode: 'HTML',
        supports_streaming: true,
      }
    );
    await ctx.api.deleteMessage(ctx.chat.id, progressMsg.message_id).catch(() => {});
  } catch (err) {
    console.error('sendVideo error:', err.message);
    await ctx.api
      .editMessageText(
        ctx.chat.id,
        progressMsg.message_id,
        '❌ دانلود/ارسال ویدیو ناموفق بود 😔\nلینکش بالاست، خودت می‌تونی ببینیش 🙏'
      )
      .catch(() => {});
  } finally {
    fs.promises.unlink(filePath).catch(() => {});
    fs.promises.unlink(filePath.replace(/\.mp4$/i, '.mkv')).catch(() => {});
  }
}

/* ------------------------------------------------------------------ */
/*  انتخاب کاربر از کیبورد                                            */
/* ------------------------------------------------------------------ */

export async function handleSelection(ctx) {
  const [, token, indexOrAction] = ctx.callbackQuery.data.split(':');
  const entry = selectionStore.get(token);

  await ctx.answerCallbackQuery().catch(() => {});

  if (!entry) {
    await ctx.reply('⌛ این لیست منقضی شده. لطفاً دوباره اسم آهنگ رو بفرست.');
    return;
  }
  if (entry.chatId !== ctx.chat.id) return;

  if (indexOrAction === 'cancel') {
    selectionStore.delete(token);
    await ctx.editMessageText('❌ لغو شد. هر وقت خواستی اسم آهنگ بعدی رو بفرست 🎵');
    return;
  }

  const video = entry.videos[Number(indexOrAction)];
  if (!video) {
    await ctx.reply('🤔 این گزینه معتبر نیست.');
    return;
  }

  selectionStore.delete(token);
  await ctx.editMessageText(`✅ انتخاب شد: ${escapeHtml(truncate(video.title, 80))}`, {
    parse_mode: 'HTML',
  }).catch(() => {});
  await sendVideo(ctx, video.videoId);
}

/* ------------------------------------------------------------------ */
/*  استخراج کوئری از انواع پیام                                       */
/* ------------------------------------------------------------------ */

/** از تگ‌های فایل صوتی/ویس/ویدیو یا اسم فایل */
export function queryFromMedia(message) {
  const media = message.audio ?? message.voice ?? message.video ?? message.document;
  if (!media) return '';
  const title = media.title || media.file_name?.replace(/\.[a-z0-9]{1,5}$/i, '') || '';
  const performer = media.performer || '';
  const combined = performer ? `${performer} ${title}` : title;
  return cleanQuery(combined || fileNameToQuery(media.file_name ?? ''));
}

/** از متن پیام: یا لینک یوتیوب یا اسم آهنگ */
export function queryFromText(text) {
  const t = String(text ?? '').trim();
  const linkMatch = t.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (linkMatch) return { type: 'link', videoId: linkMatch[1] };
  return { type: 'query', value: fileNameToQuery(t) };
}
