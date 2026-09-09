import { ProxyAgent, fetch as undiciFetch } from 'undici';
import { bootstrap } from 'global-agent';

export const PROXY_URL =
  process.env.HTTPS_PROXY ||
  process.env.https_proxy ||
  process.env.HTTP_PROXY ||
  process.env.http_proxy ||
  '';

if (PROXY_URL) {
  // 1) همه‌ی fetch های سراسری (API تلگرام، دانلود تامبنیل) از پروکسی رد می‌شوند
  const dispatcher = new ProxyAgent(PROXY_URL);
  globalThis.fetch = (input, init = {}) => undiciFetch(input, { ...init, dispatcher });

  // 2) ماژول‌های http/https (که yt-search استفاده می‌کند) هم از پروکسی رد می‌شوند
  process.env.GLOBAL_AGENT_HTTP_PROXY = PROXY_URL;
  process.env.GLOBAL_AGENT_LOGGER_LEVEL = 'warn';
  bootstrap();
}
