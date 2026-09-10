/**
 * نقطه‌ی ورود Cloudflare Worker برای بات Jonquil.
 *
 * - POST /            → آپدیت‌های webhook تلگرام
 * - GET  /set-webhook?token=<BOT_TOKEN>
 *                     → یک‌بار برای ثبت webhook فراخوانی کنید
 * - GET  /            → سلام سلامت
 */
import { createWorkerBot } from './bot.js';
import { debugClient, getMuxedFormats, pickVideoFormat, downloadVideo } from './streams.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/set-webhook') {
      if (url.searchParams.get('token') !== env.BOT_TOKEN) {
        return new Response('forbidden', { status: 403 });
      }
      const webhookUrl = `${url.origin}/`;
      const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/setWebhook`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: env.WEBHOOK_SECRET ?? undefined,
          allowed_updates: ['message', 'callback_query'],
        }),
      });
      const body = await res.text();
      return new Response(`webhook → ${webhookUrl}\n${body}`, { status: res.ok ? 200 : 500 });
    }

    if (request.method === 'GET' && url.pathname === '/debug-video') {
      // تشخیص زنده: رفتار InnerTube از IP کلادفلر
      if (url.searchParams.get('token') !== env.BOT_TOKEN) {
        return new Response('forbidden', { status: 403 });
      }
      const videoId = url.searchParams.get('v') ?? 'dQw4w9WgXcQ';
      const report = [];
      for (const client of ['ANDROID_VR', 'IOS', 'ANDROID']) {
        try {
          const { durationSeconds, formats, via } = await debugClient(videoId, client);
          report.push({ client, via, durationSeconds, formats });
        } catch (err) {
          report.push({ client, error: String(err?.message ?? err) });
        }
      }
      let probe = null;
      try {
        const { formats } = await getMuxedFormats(videoId);
        const fmt = pickVideoFormat(formats);
        if (fmt) {
          const r = await fetch(fmt.url, { headers: { Range: 'bytes=0-999999' } });
          const buf = await r.arrayBuffer();
          probe = {
            status: r.status,
            bytes: buf.byteLength,
            contentRange: r.headers.get('content-range'),
            type: r.headers.get('content-type'),
          };
        }
      } catch (err) {
        probe = { error: String(err?.message ?? err) };
      }
      let full = null;
      try {
        const { formats } = await getMuxedFormats(videoId);
        const fmt = pickVideoFormat(formats);
        if (fmt) {
          const t0 = Date.now();
          const dl = await downloadVideo(fmt.url);
          full = dl
            ? { bytes: dl.bytes, mb: +(dl.bytes / 1048576).toFixed(1), ms: Date.now() - t0 }
            : { result: 'null (exceeded max)' };
        }
      } catch (err) {
        full = { error: String(err?.message ?? err), stack: String(err?.stack ?? '').slice(0, 400) };
      }
      return new Response(JSON.stringify({ videoId, report, probe, full }, null, 2), {
        headers: { 'content-type': 'application/json' },
      });
    }

    if (request.method === 'GET') {
      return new Response('🌼 Jonquil is alive.');
    }

    if (request.method === 'POST' && url.pathname === '/') {
      // grammy برای apply فیلترها به botInfo نیاز دارد؛
      // در حالت webhook باید دستی init کنیم (bot.start() اینجا اجرا نمی‌شود).
      const bot = createWorkerBot(env);
      await bot.init();

      let update;
      try {
        update = await request.json();
      } catch {
        return new Response('bad request', { status: 400 });
      }

      try {
        await bot.handleUpdate(update);
      } catch (err) {
        console.error('update handling error:', err?.stack ?? err);
      }
      return new Response('ok'); // تلگرام سریع 200 بگیرد
    }

    return new Response('not found', { status: 404 });
  },
};
