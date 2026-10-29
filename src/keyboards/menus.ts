import { InlineKeyboard } from 'grammy';
import type { TokenBalance } from '../services/solanaService.js';
import type { Locale } from '../i18n/index.js';
import { availableLocales } from '../i18n/index.js';

export function mainMenuKeyboard(t: Locale): InlineKeyboard {
  return new InlineKeyboard()
    .text(t.buttons.balance, 'action:balance')
    .text(t.buttons.revealKey, 'action:reveal_confirm')
    .row()
    .text(t.buttons.buy, 'action:buy_start')
    .text(t.buttons.sell, 'action:sell_start')
    .row()
    .text(t.buttons.settings, 'action:settings')
    .text(t.buttons.refresh, 'action:refresh')
    .row()
    .text(t.buttons.language, 'action:language');
}

export function backKeyboard(t: Locale): InlineKeyboard {
  return new InlineKeyboard().text(t.buttons.back, 'action:back');
}

export function cancelKeyboard(t: Locale): InlineKeyboard {
  return new InlineKeyboard().text(t.buttons.cancel, 'action:back');
}

export function buyAmountKeyboard(t: Locale): InlineKeyboard {
  return new InlineKeyboard()
    .text('0.1 SOL', 'buy_amount:0.1')
    .text('0.5 SOL', 'buy_amount:0.5')
    .text('1 SOL', 'buy_amount:1')
    .row()
    .text(t.buttons.customAmount, 'buy_amount:custom')
    .row()
    .text(t.buttons.back, 'action:back');
}

export function sellTokenListKeyboard(t: Locale, balances: TokenBalance[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const token of balances) {
    const label = `${shortenMint(token.mint)} — ${formatAmount(token.amount)}`;
    kb.text(label, `sell_token:${token.mint}`).row();
  }
  kb.text(t.buttons.back, 'action:back');
  return kb;
}

export function sellPercentKeyboard(t: Locale): InlineKeyboard {
  return new InlineKeyboard()
    .text('25%', 'sell_pct:25')
    .text('50%', 'sell_pct:50')
    .text('100%', 'sell_pct:100')
    .row()
    .text(t.buttons.back, 'action:sell_start');
}

export function confirmRevealKeyboard(t: Locale): InlineKeyboard {
  return new InlineKeyboard()
    .text(t.reveal.confirmButton, 'action:reveal_confirmed')
    .row()
    .text(t.reveal.cancelButton, 'action:back');
}

export function settingsKeyboard(t: Locale, currentSlippageBps: number): InlineKeyboard {
  return new InlineKeyboard()
    .text(t.settings.slippageLabel((currentSlippageBps / 100).toFixed(1)), 'noop')
    .row()
    .text('5%', 'slippage:500')
    .text('10%', 'slippage:1000')
    .text('15%', 'slippage:1500')
    .row()
    .text(t.buttons.back, 'action:back');
}

export function languageKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const locale of availableLocales()) {
    kb.text(`${locale.flag} ${locale.name}`, `language:${locale.code}`).row();
  }
  return kb;
}

export function shortenMint(mint: string): string {
  return `${mint.slice(0, 4)}...${mint.slice(-4)}`;
}

function formatAmount(amount: number): string {
  return amount < 0.001 ? amount.toExponential(2) : amount.toLocaleString(undefined, { maximumFractionDigits: 4 });
}
