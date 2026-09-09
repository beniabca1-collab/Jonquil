/**
 * نقطه‌ی ورود Cloudflare Worker برای بات Jonquil.
 *
 * - POST /            → آپدیت‌های webhook تلگرام
 * - GET  /set-webhook?token=<BOT_TOKEN>
 *                     → یک‌بار برای ثبت webhook فراخوانی کنید
 * - GET  /            → سلام سلامت
 */
import { createWorkerBot } from './bot.js';

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
