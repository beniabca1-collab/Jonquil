import { InlineKeyboard } from 'grammy';

/**
 * کیبورد شماره‌دار برای انتخاب از بین نتایج.
 * callback data: pick:<token>:<index>  یا  pick:<token>:cancel
 */
export function buildSelectionKeyboard(token, count) {
  const kb = new InlineKeyboard();
  for (let i = 0; i < count; i++) {
    if (i > 0 && i % 5 === 0) kb.row();
    kb.text(String(i + 1), `pick:${token}:${i}`);
  }
  kb.row().text('❌ لغو', `pick:${token}:cancel`);
  return kb;
}
